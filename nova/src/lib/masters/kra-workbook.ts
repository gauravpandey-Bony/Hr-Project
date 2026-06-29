import * as XLSX from "xlsx";
import type { EmployeeImportRow } from "./import";
import { normalizeRosterDepartment } from "./37p-roster";
import { normalizeKraCellValue } from "@/lib/kra/target-format";
import { readNumericWeightage, readSheetCell } from "./excel-cell-read";
import { parseNumericTarget, resolveImportTargetValue } from "./parse-numeric-target";

function excelSerialToDoj(serial: unknown): string | undefined {
  if (serial === "" || serial == null) return undefined;
  if (typeof serial === "string") return serial.trim() || undefined;
  if (typeof serial !== "number" || serial < 1000) return undefined;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return undefined;
  const d = String(parsed.d).padStart(2, "0");
  const m = String(parsed.m).padStart(2, "0");
  return `${d}.${m}.${parsed.y}`;
}

function formatEcn(code: unknown): string {
  if (code === "" || code == null) return "";
  return String(code).trim();
}

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export type KraWorkbookEmployee = EmployeeImportRow & {
  sheetName: string;
  departmentRaw: string;
  level?: string;
  totalExperience?: string;
  experienceInBony?: string;
};

export type KraWorkbookKpi = {
  sheetName: string;
  ownerName: string;
  department: string;
  srNo: number;
  perspective?: string;
  kraName: string;
  name: string;
  unit: string;
  weightage: number;
  targetAnnual: string;
  targetValue: number;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  quarterTargets: {
    q1: { target: string; achieved?: string };
    q2: { target: string; achieved?: string };
    q3: { target: string; achieved?: string };
    q4: { target: string; achieved?: string };
  };
  lastYearAchieved?: string;
  entryValues: number[];
};

export type KraWorkbookParseResult = {
  employees: KraWorkbookEmployee[];
  kpis: KraWorkbookKpi[];
  errors: string[];
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseHeaderBlock(text: string): Partial<KraWorkbookEmployee> {
  const out: Partial<KraWorkbookEmployee> = {};
  const pick = (re: RegExp) => text.match(re)?.[1]?.trim();

  const name = pick(/Name:\s*([^\r\n]+)/i);
  if (name) out.name = name.replace(/\s+/g, " ").trim();

  out.level = pick(/Level:\s*([^\r\n]+)/i);
  out.designation = pick(/Designation:\s*([^\r\n]+)/i);
  const deptRaw = pick(/Department:\s*([^\r\n]+)/i);
  if (deptRaw) {
    out.departmentRaw = deptRaw.replace(/\.$/, "").trim();
    const { masterName } = normalizeKraDepartment(deptRaw);
    out.department = masterName;
  }
  out.location = pick(/Location:\s*([^\r\n]+)/i);
  out.doj = pick(/DOJ:\s*([^\r\n]+)/i);
  out.totalExperience = pick(/Total Experience:\s*([^\r\n]+)/i);
  out.experienceInBony = pick(/Experience In Bony:\s*([^\r\n]+)/i);

  const ecnMatch = text.match(/ECN[-\s:]*([0-9]{4,})/i);
  if (ecnMatch) out.ecn = ecnMatch[1].trim();

  const mgr = pick(
    /Reporting Manager Name\s*&\s*Designation:\s*([^\r\n]+)/i
  );
  if (mgr) out.managerName = mgr.trim();

  return out;
}

/** Excel sometimes captures the word "Format" instead of a real ECN. */
export function isValidKraEcn(ecn?: string | null): boolean {
  if (!ecn?.trim()) return false;
  const t = ecn.trim().toLowerCase();
  if (t === "format" || t === "n/a" || t === "na" || t === "-") return false;
  return /\d{4,}/.test(ecn);
}

export function normalizeKraDepartment(raw: string): {
  masterName: string;
  kraSheetId: string;
} {
  const d = raw.trim().replace(/\.$/, "");
  if (/^edp$/i.test(d)) {
    return { masterName: "IT", kraSheetId: "it" };
  }
  if (/logistic/i.test(d)) {
    return { masterName: "Logistics", kraSheetId: "logistics" };
  }
  if (/it\s*&?\s*systems?/i.test(d)) {
    return { masterName: "IT", kraSheetId: "it" };
  }
  const mapped = normalizeRosterDepartment(d);
  return {
    masterName: mapped.masterName,
    kraSheetId: mapped.kraSheetId || "plant",
  };
}

function inferDirection(
  uom: string,
  targetText: string,
  kpiName = ""
): "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" {
  const t = `${targetText} ${kpiName}`.toLowerCase();
  const unit = uom.toLowerCase();
  if (
    t.includes("<=") ||
    t.includes("≤") ||
    t.includes("less than") ||
    /within\s+\d+\s*(hour|day|hr)/i.test(t)
  ) {
    return "LOWER_IS_BETTER";
  }
  if (/hour|day|minute|closure|timely/i.test(`${unit} ${kpiName}`) && /\d/.test(targetText)) {
    return "LOWER_IS_BETTER";
  }
  if (/%/.test(uom) || unit === "percent") {
    return "HIGHER_IS_BETTER";
  }
  return "HIGHER_IS_BETTER";
}

function normalizeUnit(uom: string): string {
  const u = uom.trim();
  if (u === "%" || u.toLowerCase() === "percent") return "%";
  if (/%/.test(u)) return u;
  if (/minute|hour|day/i.test(u)) return "Hours";
  if (/number|nos|count/i.test(u)) return "Count";
  return u || "%";
}

function perspectiveToCategory(perspective: string): string {
  const p = perspective.toLowerCase();
  if (p.includes("finance")) return "Finance";
  if (p.includes("quality")) return "Quality";
  if (p.includes("user")) return "Process";
  if (p.includes("security")) return "Process";
  if (p.includes("process")) return "Process";
  return "IT";
}

function cellStr(v: unknown): string {
  if (v === "" || v == null) return "";
  return String(v).trim();
}

export function isKraEmployeeWorkbook(buffer: ArrayBuffer): boolean {
  const wb = XLSX.read(buffer, { type: "array" });
  for (const sheetName of wb.SheetNames) {
    if (!isMainKraSheetName(sheetName)) continue;
    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as string[][];
    if (isLogisticKraSheet(matrix)) return true;
    const headerCell = String(matrix[0]?.[1] ?? matrix[0]?.[0] ?? "");
    if (/Name:\s*.+/i.test(headerCell) && /Department:/i.test(headerCell)) {
      return true;
    }
  }
  return false;
}

function isMainKraSheetName(name: string): boolean {
  if (!/kra/i.test(name)) return false;
  return !/stock|vehicle|freight|gprs|safety|ship|vro|capacity|ageing|check/i.test(
    name
  );
}

function isLogisticKraSheet(matrix: string[][]): boolean {
  const row1 = matrix[1] ?? [];
  const joined = row1.map((c) => String(c).toLowerCase()).join("|");
  return (
    joined.includes("name") &&
    joined.includes("department") &&
    (joined.includes("e.code") || joined.includes("ecode")) &&
    joined.includes("designation")
  );
}

function parseLogisticKraHeaderRow(row: unknown[]): Partial<KraWorkbookEmployee> {
  const cells = row.map((c) => String(c ?? "").trim());
  const out: Partial<KraWorkbookEmployee> = {};

  for (let i = 0; i < cells.length; i++) {
    const label = cells[i].toLowerCase().replace(/[^a-z.]/g, "");
    let val = "";
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[j]) {
        val = cells[j];
        break;
      }
    }
    if (!val) continue;

    if (label === "name") out.name = titleCaseName(val);
    else if (label === "doj") out.doj = excelSerialToDoj(val) ?? val;
    else if (label === "ecode" || label === "e.code") out.ecn = formatEcn(val);
    else if (label === "department") {
      out.departmentRaw = val;
      out.department = normalizeKraDepartment(val).masterName;
    } else if (label === "designation") out.designation = val;
    else if (label === "location") out.location = val;
  }

  return out;
}

function findLogisticKpiHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const c0 = cellStr(matrix[i]?.[0]).toLowerCase();
    const c2 = cellStr(matrix[i]?.[2]).toLowerCase();
    if ((c0 === "sno" || c0.includes("sno")) && c2.includes("kpi")) {
      return i;
    }
  }
  return -1;
}

function inferUnitFromText(...parts: string[]): string {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  if (t.includes("%") || t.includes("sales")) return "%";
  if (t.includes("day")) return "Days";
  if (t.includes("hr") || t.includes("hour")) return "Hours";
  if (/^yes|no|green$/i.test(t.trim())) return "Text";
  if (/^\d+(\.\d+)?$/.test(t.trim())) return "Count";
  return "Text";
}

function parseLogisticWeightage(ws: XLSX.WorkSheet, r: number, raw: unknown): number {
  if (typeof raw === "number") {
    return raw > 0 && raw <= 1 ? Math.round(raw * 1000) / 10 : raw;
  }
  return readNumericWeightage(ws, r, 3, raw);
}

function parseLogisticKpiRows(
  matrix: string[][],
  ws: XLSX.WorkSheet,
  headerIdx: number,
  ctx: { sheetName: string; ownerName: string; department: string }
): KraWorkbookKpi[] {
  const kpis: KraWorkbookKpi[] = [];
  let currentKra = "";
  let currentSr = 0;

  for (let r = headerIdx + 2; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const kpiName = cellStr(row[2]);
    if (!kpiName) continue;

    const srCell = cellStr(row[0]);
    const kraCell = cellStr(row[1]);
    if (srCell) {
      currentSr = parseInt(srCell, 10) || currentSr + 1;
      if (kraCell) currentKra = kraCell;
    } else if (kraCell) {
      currentKra = kraCell;
    }
    if (!currentKra) continue;

    const unit = inferUnitFromText(
      cellStr(row[4]),
      cellStr(row[5]),
      cellStr(row[6]),
      cellStr(row[7]),
      kpiName
    );
    const targetAnnual = readSheetCell(ws, r, 5, unit, "annual") || cellStr(row[5]);
    const lastYearAchieved =
      readSheetCell(ws, r, 4, unit, "quarterAchieved") || cellStr(row[4]);
    const q1t = readSheetCell(ws, r, 6, unit, "quarterTarget") || cellStr(row[6]);
    const q1a = normalizeKraCellValue(
      readSheetCell(ws, r, 7, unit, "quarterAchieved") || cellStr(row[7]),
      unit
    );
    const q2t = readSheetCell(ws, r, 8, unit, "quarterTarget") || cellStr(row[8]);
    const q2a = normalizeKraCellValue(
      readSheetCell(ws, r, 9, unit, "quarterAchieved") || cellStr(row[9]),
      unit
    );
    const q3t = readSheetCell(ws, r, 10, unit, "quarterTarget") || cellStr(row[10]);
    const q3a = normalizeKraCellValue(
      readSheetCell(ws, r, 11, unit, "quarterAchieved") || cellStr(row[11]),
      unit
    );
    const q4t = readSheetCell(ws, r, 12, unit, "quarterTarget") || cellStr(row[12]);
    const q4a = normalizeKraCellValue(
      readSheetCell(ws, r, 13, unit, "quarterAchieved") || cellStr(row[13]),
      unit
    );
    const direction = inferDirection(unit, targetAnnual || q1t, kpiName);
    const targetValue = resolveImportTargetValue(targetAnnual, q1t, unit);
    const entryValues = [q1a, q2a, q3a, q4a]
      .map((v) => {
        const n = parseNumericTarget(v, unit);
        return Number.isFinite(n) ? n : null;
      })
      .filter((n): n is number => n !== null);

    kpis.push({
      sheetName: ctx.sheetName,
      ownerName: ctx.ownerName,
      department: ctx.department,
      srNo: currentSr || kpis.length + 1,
      perspective: currentKra,
      kraName: currentKra,
      name: kpiName,
      unit,
      weightage: parseLogisticWeightage(ws, r, row[3]),
      targetAnnual,
      targetValue,
      direction,
      lastYearAchieved,
      quarterTargets: {
        q1: { target: q1t, achieved: q1a },
        q2: { target: q2t, achieved: q2a },
        q3: { target: q3t, achieved: q3a },
        q4: { target: q4t, achieved: q4a },
      },
      entryValues,
    });
  }

  return kpis;
}

function parseLogisticKraSheet(
  sheetName: string,
  matrix: string[][],
  ws: XLSX.WorkSheet,
  idx: number
): { employee?: KraWorkbookEmployee; kpis: KraWorkbookKpi[]; errors: string[] } {
  const errors: string[] = [];
  const meta = parseLogisticKraHeaderRow(matrix[1] ?? []);
  if (!meta.department) {
    errors.push(`Sheet "${sheetName}": could not read department`);
    return { kpis: [], errors };
  }

  const displayName =
    meta.name?.trim() || sheetName.trim() || `Employee ${idx + 1}`;

  const employee: KraWorkbookEmployee = {
    sheetName: sheetName.trim(),
    name: displayName,
    designation: meta.designation,
    department: meta.department,
    departmentRaw: meta.departmentRaw ?? meta.department,
    location: meta.location,
    doj: meta.doj,
    ecn: meta.ecn,
    managerName: meta.managerName,
    level: meta.level,
    sortOrder: idx + 1,
    isActive: true,
  };

  const headerIdx = findLogisticKpiHeaderRow(matrix);
  if (headerIdx < 0) {
    errors.push(`Sheet "${sheetName}": KPI table not found`);
    return { employee, kpis: [], errors };
  }

  const kpis = parseLogisticKpiRows(matrix, ws, headerIdx, {
    sheetName: sheetName.trim(),
    ownerName: displayName,
    department: meta.department,
  });

  return { employee, kpis, errors };
}

function findKpiHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const c0 = cellStr(matrix[i]?.[0]).toLowerCase();
    const c3 = cellStr(matrix[i]?.[3]).toLowerCase();
    if ((c0.includes("sr") || c0 === "sr. no") && c3.includes("kpi")) {
      return i;
    }
  }
  return -1;
}

function parseKpiRows(
  matrix: string[][],
  ws: XLSX.WorkSheet,
  headerIdx: number,
  ctx: { sheetName: string; ownerName: string; department: string }
): KraWorkbookKpi[] {
  const kpis: KraWorkbookKpi[] = [];
  for (let r = headerIdx + 2; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const kpiName = cellStr(row[3]);
    const uom = cellStr(row[4]);
    if (!kpiName || !uom) continue;

    const srNo = parseInt(cellStr(row[0]), 10) || kpis.length + 1;
    const unit = normalizeUnit(uom);
    const targetAnnual = readSheetCell(ws, r, 6, unit, "annual");
    const q1t = readSheetCell(ws, r, 7, unit, "quarterTarget");
    const direction = inferDirection(unit, targetAnnual || q1t, kpiName);
    const targetValue = resolveImportTargetValue(targetAnnual, q1t, unit);
    const q1a = normalizeKraCellValue(
      readSheetCell(ws, r, 8, unit, "quarterAchieved"),
      unit
    );
    const q2t = readSheetCell(ws, r, 9, unit, "quarterTarget");
    const q2a = normalizeKraCellValue(
      readSheetCell(ws, r, 10, unit, "quarterAchieved"),
      unit
    );
    const q3t = readSheetCell(ws, r, 11, unit, "quarterTarget");
    const q3a = normalizeKraCellValue(
      readSheetCell(ws, r, 12, unit, "quarterAchieved"),
      unit
    );
    const q4t = readSheetCell(ws, r, 13, unit, "quarterTarget");
    const q4a = normalizeKraCellValue(
      readSheetCell(ws, r, 14, unit, "quarterAchieved"),
      unit
    );

    const entryValues = [q1a, q2a, q3a, q4a]
      .map((v) => parseFloat(v.replace(/[^0-9.-]/g, "")))
      .filter((n) => !Number.isNaN(n));

    kpis.push({
      sheetName: ctx.sheetName,
      ownerName: ctx.ownerName,
      department: ctx.department,
      srNo,
      perspective: cellStr(row[1]).replace(/\r?\n/g, " "),
      kraName: cellStr(row[2]),
      name: kpiName,
      unit,
      weightage: readNumericWeightage(ws, r, 5, row[5]),
      targetAnnual,
      targetValue,
      direction,
      quarterTargets: {
        q1: { target: q1t, achieved: q1a },
        q2: { target: q2t, achieved: q2a },
        q3: { target: q3t, achieved: q3a },
        q4: { target: q4t, achieved: q4a },
      },
      entryValues,
    });
  }
  return kpis;
}

export function parseKraWorkbook(buffer: ArrayBuffer): KraWorkbookParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const employees: KraWorkbookEmployee[] = [];
  const kpis: KraWorkbookKpi[] = [];
  const errors: string[] = [];

  const logisticMode = wb.SheetNames.some((sheetName) => {
    if (!isMainKraSheetName(sheetName)) return false;
    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as string[][];
    return isLogisticKraSheet(matrix);
  });

  wb.SheetNames.forEach((sheetName, idx) => {
    if (/^sheet\d*$/i.test(sheetName.trim())) return;
    if (logisticMode && !isMainKraSheetName(sheetName)) return;

    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as string[][];

    if (logisticMode && isLogisticKraSheet(matrix)) {
      const parsed = parseLogisticKraSheet(sheetName, matrix, wb.Sheets[sheetName], idx);
      errors.push(...parsed.errors);
      if (parsed.employee) employees.push(parsed.employee);
      kpis.push(...parsed.kpis);
      return;
    }

    const headerCell = (matrix[0] ?? [])
      .map((c) => String(c ?? ""))
      .filter(Boolean)
      .join("\n");
    if (!headerCell.includes("Department")) {
      errors.push(`Sheet "${sheetName}": missing employee header`);
      return;
    }

    const meta = parseHeaderBlock(headerCell);
    if (!meta.department) {
      errors.push(`Sheet "${sheetName}": could not read department`);
      return;
    }

    const displayName =
      meta.name?.trim() || sheetName.trim() || `Employee ${idx + 1}`;

    employees.push({
      sheetName: sheetName.trim(),
      name: displayName,
      designation: meta.designation,
      department: meta.department,
      departmentRaw: meta.departmentRaw ?? meta.department,
      location: meta.location,
      doj: meta.doj,
      ecn: meta.ecn,
      managerName: meta.managerName,
      level: meta.level,
      totalExperience: meta.totalExperience,
      experienceInBony: meta.experienceInBony,
      sortOrder: employees.length + 1,
      isActive: true,
    });

    const headerIdx = findKpiHeaderRow(matrix);
    if (headerIdx < 0) {
      errors.push(`Sheet "${sheetName}": KPI table not found`);
      return;
    }

    kpis.push(
      ...parseKpiRows(matrix, wb.Sheets[sheetName], headerIdx, {
        sheetName: sheetName.trim(),
        ownerName: displayName,
        department: meta.department,
      })
    );
  });

  if (!employees.length) errors.push("No employee sheets found in workbook");
  return { employees, kpis, errors };
}

export function kpiStableId(ownerName: string, srNo: number, kpiName: string): string {
  return `kra-${slug(ownerName)}-${srNo}-${slug(kpiName).slice(0, 24)}`;
}

export function defaultKraWorkbookPath(): string {
  return `${process.cwd()}/data/kra-it-13-4-26.xlsx`;
}
