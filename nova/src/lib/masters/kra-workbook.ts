import * as XLSX from "xlsx";
import type { EmployeeImportRow } from "./import";
import { normalizeRosterDepartment } from "./37p-roster";
import { isLogisticsJunkName } from "./logistics-kra-junk";
import { normalizeKraCellValue } from "@/lib/kra/target-format";
import { readNumericWeightage, readSheetCell } from "./excel-cell-read";
import { parseNumericTarget, resolveImportTargetValue } from "./parse-numeric-target";

function excelSerialToDoj(serial: unknown): string | undefined {
  if (serial === "" || serial == null) return undefined;
  const numericSerial =
    typeof serial === "number"
      ? serial
      : typeof serial === "string" && /^\d+(\.\d+)?$/.test(serial.trim())
        ? Number(serial)
        : null;
  if (numericSerial != null && numericSerial >= 1000) {
    const parsed = XLSX.SSF.parse_date_code(numericSerial);
    if (parsed) {
      const d = String(parsed.d).padStart(2, "0");
      const m = String(parsed.m).padStart(2, "0");
      return `${d}.${m}.${parsed.y}`;
    }
  }
  if (typeof serial === "string") return serial.trim() || undefined;
  return undefined;
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

/** KPI table / score row labels — not employee designation. */
const KRA_TABLE_LABEL =
  /^(total\s*score|weighted\s*score|overall\s*score|grand\s*total|score\s*%|s\.?\s*no\.?|sr\.?\s*no\.?|kpi|kra|weightage|weight\s*%|annual\s*target|last\s*year|uom|unit|target|achieved|perspective|remark|rating|q[1-4])$/i;

export function isKraTableLabel(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (KRA_TABLE_LABEL.test(v)) return true;
  if (/^q[1-4]\s*(target|achieved)?$/i.test(v)) return true;
  return false;
}

/** Reject designation values mis-read from KRA sheet score/footer rows. */
export function sanitizeKraDesignation(
  value?: string | null
): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (isKraTableLabel(v)) return undefined;
  if (isKraHeaderLabelValue(v)) return undefined;
  return v;
}

function parseHeaderBlock(text: string): Partial<KraWorkbookEmployee> {
  const out: Partial<KraWorkbookEmployee> = {};
  const pick = (re: RegExp) => text.match(re)?.[1]?.trim();

  const name = pick(/Name:\s*([^\r\n|]+)/i);
  if (name) out.name = name.replace(/\s+/g, " ").trim();

  out.level = pick(/Level:\s*([^\r\n|]+)/i);
  out.designation = sanitizeKraDesignation(
    pick(/Designation:\s*([^\r\n|]+?)(?=\s*(?:Department|Reporting|$))/i) ??
      pick(/Designation:\s*([^\r\n|]+)/i)
  );
  const deptRaw =
    pick(/Department:\s*([^\r\n|]+?)(?=\s*(?:Reporting|Location|$))/i) ??
    pick(/Department:\s*([^\r\n|]+)/i);
  if (deptRaw) {
    out.departmentRaw = deptRaw.replace(/\.$/, "").trim();
    const { masterName } = normalizeKraDepartment(deptRaw);
    out.department = masterName;
  }
  out.location = pick(/Location:\s*([^\r\n|]+)/i);
  out.doj = pick(/DOJ:\s*([^\r\n|]+)/i);
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
    return { masterName: "IT & Systems", kraSheetId: "it" };
  }
  if (/logistic/i.test(d)) {
    return { masterName: "Logistics", kraSheetId: "logistics" };
  }
  if (/it\s*&?\s*sys/i.test(d)) {
    return { masterName: "IT & Systems", kraSheetId: "it" };
  }
  if (/human resource|^hr$/i.test(d)) {
    return { masterName: "HR", kraSheetId: "hr" };
  }
  if (/^operations$|plant head/i.test(d)) {
    return { masterName: "Production", kraSheetId: "plant" };
  }
  if (/^production$/i.test(d)) {
    return { masterName: "Production", kraSheetId: "production" };
  }
  if (/^maintenance$/i.test(d)) {
    return { masterName: "Maintenance", kraSheetId: "maintenance" };
  }
  if (/tool\s*room/i.test(d)) {
    return { masterName: "Tool Room", kraSheetId: "tool-room" };
  }
  if (/^store$/i.test(d)) {
    return { masterName: "Store", kraSheetId: "store" };
  }
  if (/^quality$/i.test(d)) {
    return { masterName: "Quality", kraSheetId: "quality" };
  }
  if (/^development$|^r\s*&\s*d$/i.test(d)) {
    return { masterName: "Development", kraSheetId: "development" };
  }
  if (/^design(?:ing)?$|^desiging$|^design\s*&\s*development$/i.test(d)) {
    return { masterName: "Design", kraSheetId: "design" };
  }
  if (/^npd$/i.test(d)) {
    return { masterName: "NPD", kraSheetId: "npd" };
  }
  if (/^corporate\s*office$/i.test(d)) {
    return { masterName: "Admin", kraSheetId: "admin" };
  }
  if (/^dispatch$/i.test(d)) {
    return { masterName: "Dispatch", kraSheetId: "dispatch" };
  }
  if (/costing\s*&?\s*mis/i.test(d)) {
    return { masterName: "Costing & MIS", kraSheetId: "costing-mis" };
  }
  if (/production\s*\/\s*dispatch|dispatch\s*&?\s*assembly/i.test(d)) {
    return { masterName: "Dispatch & Assembly", kraSheetId: "dispatch-assembly" };
  }
  if (/maintenance\s*&?\s*project/i.test(d)) {
    return { masterName: "Maintenance", kraSheetId: "maintenance" };
  }
  if (/bop\s*store|compound\s*store|green\s*hollow/i.test(d)) {
    return { masterName: "Store", kraSheetId: "store" };
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
  if (isSf1Workbook(wb)) return true;
  for (const sheetName of wb.SheetNames) {
    if (/^sheet\d*$/i.test(sheetName.trim())) continue;
    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as string[][];
    if (isLogisticKraSheet(matrix)) return true;
    if (hasEmployeeKraHeader(matrix)) return true;
    if (isMainKraSheetName(sheetName)) {
      const headerCell = String(matrix[0]?.[1] ?? matrix[0]?.[0] ?? "");
      if (/Name:\s*.+/i.test(headerCell) && /Department:/i.test(headerCell)) {
        return true;
      }
    }
  }
  return false;
}

function hasEmployeeKraHeader(matrix: string[][]): boolean {
  for (let i = 0; i < Math.min(matrix.length, 6); i++) {
    const headerCell = (matrix[i] ?? [])
      .map((c) => String(c ?? ""))
      .filter(Boolean)
      .join("\n");
    if (/Name:\s*.+/i.test(headerCell) && /Department:/i.test(headerCell)) {
      return true;
    }
  }
  return false;
}

function sheetMatrix(wb: XLSX.WorkBook, sheetName: string): string[][] {
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  }) as string[][];
}

/** Corporate Design "WORK RECORD" sheets — Name:/Department: block + Perspective/KRA/KPI table. */
function isWorkRecordSheet(matrix: string[][]): boolean {
  const headerCell = (matrix[0] ?? [])
    .map((c) => String(c ?? ""))
    .filter(Boolean)
    .join("\n");
  if (!/Name:\s*.+/i.test(headerCell)) return false;
  if (!/Department:/i.test(headerCell) && !/Location:/i.test(headerCell)) return false;
  return findKpiHeaderRow(matrix) >= 0;
}

function isSf1Workbook(wb: XLSX.WorkBook): boolean {
  for (const sheetName of wb.SheetNames) {
    const matrix = sheetMatrix(wb, sheetName);
    // Work-record workbooks must use the Perspective/KRA/KPI parser, not SF1.
    if (isWorkRecordSheet(matrix)) return false;
    const title = cellStr(matrix[0]?.[0]);
    if (/KRA\s*\/\s*KPI|SF-1|Saket Fabs/i.test(title)) return true;
    if (/^kra\s*(?:\/\s*)?kpi/i.test(sheetName.trim())) return true;
    if (findSf1EmployeeInfoRow(matrix) >= 0) return true;
    if (isSf1KpiHeaderRow(matrix[1] ?? []) || isSf1KpiHeaderRow(matrix[4] ?? [])) {
      return true;
    }
  }
  return false;
}

function isSf1EmployeeInfoRow(row: unknown[]): boolean {
  const joined = row.map((c) => String(c ?? "").toLowerCase()).join("|");
  return (
    joined.includes("name") &&
    (joined.includes("department") ||
      joined.includes("dept") ||
      joined.includes("doj") ||
      joined.includes("date of joining") ||
      joined.includes("e.code") ||
      joined.includes("ecode"))
  );
}

function isSf1KpiHeaderRow(row: unknown[]): boolean {
  const c0 = cellStr(row[0]).toLowerCase();
  const c2 = cellStr(row[2]).toLowerCase();
  return (c0 === "sno" || c0.includes("sno")) && c2.includes("kpi");
}

function isDwmChecklistSheet(matrix: string[][]): boolean {
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const c0 = cellStr(matrix[i]?.[0]).toLowerCase();
    const c1 = cellStr(matrix[i]?.[1]).toLowerCase();
    if (
      (c0.includes("sl") && c0.includes("no")) ||
      c0 === "sl. no."
    ) {
      if (c1.includes("activit")) return true;
    }
  }
  return false;
}

function inferDepartmentFromTitle(title: string, sheetName = ""): string {
  const t = `${title} ${sheetName}`.toLowerCase();
  if (/maintenance|maint/i.test(t)) return "Maintenance";
  if (/quality|qa/i.test(t)) return "Quality";
  if (/development|r\s*&\s*d/i.test(t)) return "Development";
  if (/\bdesign(?:ing)?\b/i.test(t)) return "Design";
  if (/tool\s*room/i.test(t)) return "Tool Room";
  if (/it\s*&?\s*system/i.test(t)) return "IT & Systems";
  if (/\bstore\b/i.test(t)) return "Store";
  if (/human resource|\bhr\b/i.test(t)) return "HR";
  if (/plant head|operations|sf-1 prithla/i.test(t)) return "Production";
  if (/production/i.test(t)) return "Production";
  if (/costing\s*&?\s*mis/i.test(t)) return "Costing & MIS";
  if (/dispatch|assembly/i.test(t)) return "Dispatch & Assembly";
  if (/plant\s*58|fluid\s*58|bony\s*fluid/i.test(t)) return "Production";
  return "General";
}

function parseEmployeeNameFromSheetName(sheetName: string): string {
  const trimmed = sheetName.trim();
  const qa = trimmed.match(
    /(?:KRA\s*KPI\s*)?(?:QA|Maint)\s*-?\s*26-?27\s+(.+)$/i
  );
  if (qa?.[1]) return titleCaseName(qa[1].trim());

  const stripped = trimmed
    .replace(/^kra\s*(?:\/\s*)?kpi\s*-?\s*26-?27\s*/i, "")
    .replace(/^mr\.?\s+|^ms\.?\s+|^mrs\.?\s+/i, "")
    .trim();
  if (stripped && stripped !== trimmed) return titleCaseName(stripped);

  return titleCaseName(trimmed);
}

function isSummaryKraSheetName(sheetName: string): boolean {
  const t = sheetName.trim();
  if (/^kra\s*(?:\/\s*)?kpi\s*-?\s*26-?27\s*$/i.test(t)) return true;
  if (/^kra\s*kpi\s*maint\s*-?\s*26-?27\s*$/i.test(t)) return true;
  return false;
}

function looksLikeKraEmployeeSheetName(sheetName: string): boolean {
  return /^kra\s*(?:\/\s*)?kpi/i.test(sheetName.trim());
}

function parseNameFromKraBanner(cell: string): string | null {
  const m = cell.match(/^(.+?)\s+kra\s*\/\s*kpi/i);
  if (m?.[1]?.trim()) return titleCaseName(m[1].trim());
  return null;
}

/** Merge label/value pairs from the first rows (Name on row 0, Department on row 1, etc.). */
function parseSpreadsheetEmployeeMeta(
  matrix: string[][],
  maxRows = 8
): Partial<KraWorkbookEmployee> {
  const meta: Partial<KraWorkbookEmployee> = {};
  for (let i = 0; i < Math.min(matrix.length, maxRows); i++) {
    const row = matrix[i] ?? [];
    const bannerName = parseNameFromKraBanner(cellStr(row[0]));
    if (bannerName && !isMisreadEmployeeName(bannerName)) meta.name = bannerName;

    const rowMeta = parseLogisticKraHeaderRow(row);
    if (rowMeta.name && !isMisreadEmployeeName(rowMeta.name)) {
      meta.name = rowMeta.name;
    }
    if (rowMeta.department && !isMisreadDepartment(rowMeta.department)) {
      meta.department = rowMeta.department;
      meta.departmentRaw = rowMeta.departmentRaw ?? rowMeta.department;
    }
    if (rowMeta.designation && !meta.designation) meta.designation = rowMeta.designation;
    if (rowMeta.doj && !meta.doj) meta.doj = rowMeta.doj;
    if (rowMeta.ecn && !meta.ecn) meta.ecn = rowMeta.ecn;
    if (rowMeta.managerName && !meta.managerName) meta.managerName = rowMeta.managerName;
    if (rowMeta.location && !meta.location) meta.location = rowMeta.location;
    if (rowMeta.level && !meta.level) meta.level = rowMeta.level;
  }
  return meta;
}

function isMainKraSheetName(name: string): boolean {
  if (!/kra/i.test(name)) return false;
  return !/stock|vehicle|freight|gprs|safety|ship|vro|capacity|ageing|check/i.test(
    name
  );
}

function isLogisticKraSheet(matrix: string[][]): boolean {
  for (const row of matrix.slice(0, 4)) {
    if (!isSf1EmployeeInfoRow(row ?? [])) continue;
    const joined = row.map((c) => String(c).toLowerCase()).join("|");
    return (
      joined.includes("name") &&
      (joined.includes("department") || joined.includes("dept")) &&
      (joined.includes("e.code") || joined.includes("ecode") || joined.includes("doj"))
    );
  }
  return false;
}

function parseLogisticKraHeaderRow(row: unknown[]): Partial<KraWorkbookEmployee> {
  const cells = row.map((c) => String(c ?? "").trim());
  const out: Partial<KraWorkbookEmployee> = {};

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) continue;

    if (isKraTableLabel(cell)) break;

    const inlineName = cell.match(/^name\s+(.+)$/i);
    if (inlineName?.[1]?.trim()) {
      out.name = titleCaseName(inlineName[1]);
      continue;
    }

    const inlineDoj = cell.match(/^doj\s+(.+)$/i);
    if (inlineDoj?.[1]?.trim()) {
      out.doj = excelSerialToDoj(inlineDoj[1]) ?? inlineDoj[1].trim();
      continue;
    }

    const inlineEcn = cell.match(/^e\.?code\s+(.+)$/i);
    if (inlineEcn?.[1]?.trim()) {
      out.ecn = formatEcn(inlineEcn[1]);
      continue;
    }

    const inlineDept = cell.match(/^department\s+(.+)$/i);
    if (inlineDept?.[1]?.trim()) {
      out.departmentRaw = inlineDept[1].trim();
      out.department = normalizeKraDepartment(inlineDept[1]).masterName;
      continue;
    }

    const inlineDesig = cell.match(/^designation\s+(.+)$/i);
    if (inlineDesig?.[1]?.trim()) {
      const desig = sanitizeKraDesignation(inlineDesig[1]);
      if (desig && !out.designation) out.designation = desig;
      continue;
    }

    const label = cell.toLowerCase().replace(/[^a-z.]/g, "");
    if (label === "kpi" || label === "kra" || label === "sno") break;
    let val = "";
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[j]) {
        val = cells[j];
        break;
      }
    }
    if (!val) continue;
    if (isKraTableLabel(val)) break;
    if (label === "department" || label === "dept") {
      if (/^designation$/i.test(val)) continue;
    }
    if (label === "name" && isKraHeaderLabelValue(val)) continue;
    if ((label === "ecode" || label === "e.code") && /^department\b/i.test(val)) continue;
    if ((label === "department" || label === "dept") && /^designation\b/i.test(val)) continue;

    if (label === "name" && !out.name) out.name = titleCaseName(val);
    else if (label === "doj" && !out.doj) out.doj = excelSerialToDoj(val) ?? val;
    else if ((label === "ecode" || label === "e.code") && !out.ecn) out.ecn = formatEcn(val);
    else if ((label === "department" || label === "dept") && !out.department) {
      out.departmentRaw = val;
      out.department = normalizeKraDepartment(val).masterName;
    } else if (label === "designation" && !out.designation) {
      const desig = sanitizeKraDesignation(val);
      if (desig) out.designation = desig;
    } else if (label === "location" && !out.location) out.location = val;
  }

  return out;
}

function isKraHeaderLabelValue(val: string): boolean {
  return /^(doj|e\.?code|ecode|department|dept|designation|location|name)$/i.test(
    val.trim()
  );
}

function isMisreadDepartment(dept: string | null | undefined): boolean {
  const d = (dept ?? "").trim();
  if (!d) return true;
  return /^(experience|qualification|reporting manager|general)$/i.test(d);
}

function isMisreadEmployeeName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  if (!n) return true;
  if (isKraHeaderLabelValue(n)) return true;
  if (looksLikeKraEmployeeSheetName(n)) return true;
  if (
    /^(date of joining|experience|qualification|reporting manager|department|designation|name|uom|weightage)$/i.test(
      n
    )
  ) {
    return true;
  }
  return false;
}

function isSerialNumberHeader(cell: string): boolean {
  const c0 = cell.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  return (
    c0.includes("sno") ||
    c0.includes("srno") ||
    c0 === "sno" ||
    c0 === "srno"
  );
}

function findLogisticKpiHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const c0 = cellStr(matrix[i]?.[0]);
    const c2 = cellStr(matrix[i]?.[2]).toLowerCase();
    if (isSerialNumberHeader(c0) && c2.includes("kpi")) {
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

function isStoreKpiHeaderRow(row: unknown[]): boolean {
  const h = row.map((c) => cellStr(c).toLowerCase()).join("|");
  return h.includes("sno") && h.includes("kpi") && h.includes("current year");
}

function parseSf1StoreKpiRows(
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
      if (kraCell) currentKra = kraCell.replace(/\r?\n/g, " ").trim();
    } else if (kraCell) {
      currentKra = kraCell.replace(/\r?\n/g, " ").trim();
    }
    if (!currentKra) currentKra = kpiName;

    const unit = inferUnitFromText(cellStr(row[3]), kpiName);
    const weightage = parseLogisticWeightage(ws, r, row[4]);
    const targetAnnual = readSheetCell(ws, r, 5, unit, "annual") || cellStr(row[5]);
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

    kpis.push({
      sheetName: ctx.sheetName,
      ownerName: ctx.ownerName,
      department: ctx.department,
      srNo: currentSr || kpis.length + 1,
      perspective: currentKra,
      kraName: currentKra,
      name: kpiName,
      unit,
      weightage,
      targetAnnual,
      targetValue,
      direction,
      quarterTargets: {
        q1: { target: q1t, achieved: q1a },
        q2: { target: q2t, achieved: q2a },
        q3: { target: q3t, achieved: q3a },
        q4: { target: q4t, achieved: q4a },
      },
      entryValues: [],
    });
  }

  return kpis;
}

function isCompactProductionRow(row: unknown[]): boolean {
  const name = cellStr(row[1]);
  const col2 = row[2];
  const col3 = cellStr(row[3]);
  if (!name || cellStr(row[2]) === "") return false;
  if (typeof col2 === "number" || /^\d+(\.\d+)?$/.test(cellStr(col2))) {
    return !col3 || col3 === name;
  }
  return false;
}

function parseSf1CompactKpiRows(
  matrix: string[][],
  ws: XLSX.WorkSheet,
  headerIdx: number,
  ctx: { sheetName: string; ownerName: string; department: string }
): KraWorkbookKpi[] {
  const kpis: KraWorkbookKpi[] = [];
  let currentSr = 0;

  for (let r = headerIdx + 2; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const name = cellStr(row[1]);
    if (!name || !isCompactProductionRow(row)) continue;

    const srCell = cellStr(row[0]);
    currentSr = srCell ? parseInt(srCell, 10) || currentSr + 1 : currentSr + 1;
    const unit = inferUnitFromText(name, cellStr(row[3]));
    const weightage = parseLogisticWeightage(ws, r, row[2]);
    const lastYearAchieved =
      readSheetCell(ws, r, 4, unit, "quarterAchieved") || cellStr(row[4]);
    const targetAnnual = readSheetCell(ws, r, 5, unit, "annual") || cellStr(row[5]);
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
    const direction = inferDirection(unit, targetAnnual || q1t, name);
    const targetValue = resolveImportTargetValue(targetAnnual, q1t, unit);

    kpis.push({
      sheetName: ctx.sheetName,
      ownerName: ctx.ownerName,
      department: ctx.department,
      srNo: currentSr,
      perspective: name,
      kraName: name,
      name,
      unit,
      weightage,
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
      entryValues: [],
    });
  }

  return kpis;
}

function findSf1EmployeeInfoRow(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 4); i++) {
    if (isSf1EmployeeInfoRow(matrix[i] ?? [])) return i;
  }
  return -1;
}

function parseDwmEmployeeOnly(
  sheetName: string,
  matrix: string[][],
  idx: number
): { employee?: KraWorkbookEmployee; errors: string[] } {
  const errors: string[] = [];
  const headerCell = (matrix[0] ?? [])
    .map((c) => String(c ?? ""))
    .filter(Boolean)
    .join("\n");
  const meta = parseHeaderBlock(headerCell);
  if (!meta.name && !meta.department) {
    errors.push(`Sheet "${sheetName}": could not read DWM employee header`);
    return { errors };
  }
  const department =
    meta.department ?? normalizeKraDepartment(meta.departmentRaw ?? "Maintenance").masterName;
  return {
    employee: {
      sheetName: sheetName.trim(),
      name: meta.name?.trim() || sheetName.trim(),
      designation: meta.designation,
      department,
      departmentRaw: meta.departmentRaw ?? department,
      location: meta.location,
      doj: meta.doj,
      ecn: meta.ecn,
      managerName: meta.managerName,
      level: meta.level,
      sortOrder: idx + 1,
      isActive: true,
    },
    errors,
  };
}

function parseSf1KraSheet(
  sheetName: string,
  matrix: string[][],
  ws: XLSX.WorkSheet,
  idx: number,
  sourceFileName?: string
): { employee?: KraWorkbookEmployee; kpis: KraWorkbookKpi[]; errors: string[] } {
  const errors: string[] = [];
  const title = cellStr(matrix[0]?.[0]);
  let defaultDept = inferDepartmentFromTitle(title, sheetName);
  if (/store/i.test(sourceFileName ?? "")) defaultDept = "Store";
  if (/maint/i.test(sourceFileName ?? "")) defaultDept = "Maintenance";
  if (/production/i.test(sourceFileName ?? "")) defaultDept = "Production";
  if (/quality/i.test(sourceFileName ?? "")) defaultDept = "Quality";
  if (/development/i.test(sourceFileName ?? "")) defaultDept = "Development";
  if (/dispatch/i.test(sourceFileName ?? "")) defaultDept = "Dispatch";

  if (isDwmChecklistSheet(matrix)) {
    const dwm = parseDwmEmployeeOnly(sheetName, matrix, idx);
    return { employee: dwm.employee, kpis: [], errors: dwm.errors };
  }

  const empRowIdx = findSf1EmployeeInfoRow(matrix);
  let meta: Partial<KraWorkbookEmployee> = parseSpreadsheetEmployeeMeta(matrix);
  if (empRowIdx >= 0 && !meta.name) {
    meta = { ...meta, ...parseLogisticKraHeaderRow(matrix[empRowIdx] ?? []) };
  }

  const qualityStyle = !meta.name && empRowIdx < 0 && isSf1KpiHeaderRow(matrix[1] ?? []);
  if (qualityStyle) {
    meta.department = defaultDept;
    meta.departmentRaw = defaultDept;
    meta.name = parseEmployeeNameFromSheetName(sheetName);
  }

  if (!meta.department || isMisreadDepartment(meta.department)) {
    meta.department = defaultDept;
    meta.departmentRaw = defaultDept;
  }
  if (/maint/i.test(sourceFileName ?? "") && meta.department === "Tool Room") {
    meta.department = "Maintenance";
    meta.departmentRaw = "Maintenance";
  }

  const displayName =
    (!isMisreadEmployeeName(meta.name) ? meta.name?.trim() : null) ||
    parseEmployeeNameFromSheetName(sheetName) ||
    `Employee ${idx + 1}`;

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

  const headerRow = matrix[headerIdx] ?? [];
  const ctx = {
    sheetName: sheetName.trim(),
    ownerName: displayName,
    department: meta.department!,
  };

  let kpis: KraWorkbookKpi[];
  if (isStoreKpiHeaderRow(headerRow)) {
    kpis = parseSf1StoreKpiRows(matrix, ws, headerIdx, ctx);
  } else {
    const sample = matrix[headerIdx + 2] ?? [];
    if (isCompactProductionRow(sample)) {
      kpis = parseSf1CompactKpiRows(matrix, ws, headerIdx, ctx);
    } else {
      kpis = parseLogisticKpiRows(matrix, ws, headerIdx, ctx);
    }
  }

  return { employee, kpis, errors };
}

function parseLogisticKraSheet(
  sheetName: string,
  matrix: string[][],
  ws: XLSX.WorkSheet,
  idx: number
): { employee?: KraWorkbookEmployee; kpis: KraWorkbookKpi[]; errors: string[] } {
  const errors: string[] = [];
  const meta = parseSpreadsheetEmployeeMeta(matrix);
  if (!meta.department) {
    errors.push(`Sheet "${sheetName}": could not read department`);
    return { kpis: [], errors };
  }

  const displayName =
    (!isMisreadEmployeeName(meta.name) ? meta.name?.trim() : null) ||
    parseEmployeeNameFromSheetName(sheetName) ||
    `Employee ${idx + 1}`;

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
    const row = matrix[i] ?? [];
    const joined = row.map((c) => cellStr(c).toLowerCase()).join("|");
    const c0 = cellStr(row[0]).toLowerCase();
    const hasSr =
      c0.includes("sr") ||
      c0.includes("sno") ||
      c0 === "s. no" ||
      c0 === "s.no" ||
      c0 === "s no" ||
      c0 === "sr. no" ||
      c0 === "sr.no";
    const hasKpi = joined.includes("kpi");
    const hasKra = joined.includes("kra");
    const hasPerspective = joined.includes("perspective");
    if (hasSr && hasKpi) return i;
    if (hasSr && hasKra && (joined.includes("weight") || hasPerspective)) return i;
    if (hasPerspective && hasKra && hasKpi) return i;
  }
  return -1;
}

type KpiColMap = {
  sr: number;
  perspective: number;
  kra: number;
  kpi: number;
  uom: number;
  weightage: number;
  annual: number;
  q1t: number;
  q1a: number;
  q2t: number;
  q2a: number;
  q3t: number;
  q3a: number;
  q4t: number;
  q4a: number;
};

function mapKpiHeaderColumns(headerRow: unknown[]): KpiColMap {
  const cols = headerRow.map((c) => cellStr(c).toLowerCase().replace(/\s+/g, " "));
  const find = (...preds: ((s: string) => boolean)[]) => {
    for (const pred of preds) {
      const idx = cols.findIndex(pred);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const kpi = find(
    (s) => s.includes("kpi /") || s.includes("kpi/"),
    (s) => s.includes("measure kra"),
    (s) => s.includes("kpi") && !s.includes("weight")
  );
  const kra = find(
    (s) => s.includes("primary") && s.includes("kra"),
    (s) => s === "kra" || (s.includes("kra") && !s.includes("kpi"))
  );
  const perspective = find((s) => s.includes("perspective"));
  const uom = find((s) => s === "uom" || s.includes("unit of"));
  const weightage = find((s) => s.includes("weight"));
  const annual = find(
    (s) => s.includes("current year target"),
    (s) => s.includes("annual"),
    (s) => s.includes("target") && s.includes("26")
  );
  const q1 = find((s) => s === "q1" || s.startsWith("q1 "));

  // Classic layout: sr, perspective, kra, kpi, uom, weight, annual, q1t, q1a...
  const classic = kpi === 3 && uom === 4;
  if (classic) {
    return {
      sr: 0,
      perspective: perspective >= 0 ? perspective : 1,
      kra: kra >= 0 ? kra : 2,
      kpi: 3,
      uom: 4,
      weightage: weightage >= 0 ? weightage : 5,
      annual: annual >= 0 ? annual : 6,
      q1t: q1 >= 0 ? q1 : 7,
      q1a: (q1 >= 0 ? q1 : 7) + 1,
      q2t: (q1 >= 0 ? q1 : 7) + 2,
      q2a: (q1 >= 0 ? q1 : 7) + 3,
      q3t: (q1 >= 0 ? q1 : 7) + 4,
      q3a: (q1 >= 0 ? q1 : 7) + 5,
      q4t: (q1 >= 0 ? q1 : 7) + 6,
      q4a: (q1 >= 0 ? q1 : 7) + 7,
    };
  }

  // Prime / Plant-head style: sr, kra, kpi, [uom], weight, ..., target, q1
  const kpiCol = kpi >= 0 ? kpi : 2;
  const kraCol = kra >= 0 ? kra : 1;
  const uomCol = uom >= 0 ? uom : -1;
  const weightCol = weightage >= 0 ? weightage : kpiCol + (uomCol >= 0 ? 2 : 1);
  const annualCol = annual >= 0 ? annual : weightCol + 2;
  const q1Col = q1 >= 0 ? q1 : annualCol + 1;

  return {
    sr: 0,
    perspective: perspective >= 0 ? perspective : -1,
    kra: kraCol,
    kpi: kpiCol,
    uom: uomCol,
    weightage: weightCol,
    annual: annualCol,
    q1t: q1Col,
    q1a: q1Col + 1,
    q2t: q1Col + 2,
    q2a: q1Col + 3,
    q3t: q1Col + 4,
    q3a: q1Col + 5,
    q4t: q1Col + 6,
    q4a: q1Col + 7,
  };
}

function parseWorkRecordKpiRows(
  matrix: string[][],
  ws: XLSX.WorkSheet,
  headerIdx: number,
  ctx: { sheetName: string; ownerName: string; department: string }
): KraWorkbookKpi[] {
  const cols = mapKpiHeaderColumns(matrix[headerIdx] ?? []);
  const hasUomWeight = cols.uom >= 0 && cols.weightage >= 0;
  const kpis: KraWorkbookKpi[] = [];
  let currentPerspective = "";
  let currentKra = "";
  let currentSr = 0;

  // Skip blank spacer row under merged header if present.
  let dataStart = headerIdx + 1;
  while (dataStart < matrix.length) {
    const row = matrix[dataStart] ?? [];
    const nonempty = row.some((c) => cellStr(c).trim());
    if (nonempty) break;
    dataStart++;
  }

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const kpiName = cellStr(row[cols.kpi >= 0 ? cols.kpi : 3]).trim();
    if (!kpiName) continue;

    const srCell = cellStr(row[cols.sr >= 0 ? cols.sr : 0]);
    const perspectiveCell = cellStr(
      row[cols.perspective >= 0 ? cols.perspective : 1]
    ).replace(/\r?\n/g, " ");
    const kraCell = cellStr(row[cols.kra >= 0 ? cols.kra : 2]);
    if (srCell) currentSr = parseInt(srCell, 10) || currentSr + 1;
    if (perspectiveCell) currentPerspective = perspectiveCell;
    if (kraCell) currentKra = kraCell;
    if (!currentKra && !currentPerspective) continue;

    let unit = "%";
    let weightage = 0;
    let achievedNote = "";
    let targetAnnual = "";

    if (hasUomWeight) {
      const uomRaw = cellStr(row[cols.uom]);
      unit = normalizeUnit(uomRaw || "%");
      weightage = readNumericWeightage(
        ws,
        r,
        cols.weightage,
        row[cols.weightage]
      );
      // Achieved / remarks typically sit in the column after weightage.
      const noteCol = cols.weightage + 1;
      achievedNote =
        readSheetCell(ws, r, noteCol, unit, "quarterAchieved") ||
        cellStr(row[noteCol]);
      targetAnnual = achievedNote;
    } else {
      // Lightweight work record (no UOM/Weightage columns) — narrative in next col.
      const noteCol = (cols.kpi >= 0 ? cols.kpi : 3) + 1;
      achievedNote =
        cellStr(row[noteCol]) ||
        cellStr(row[noteCol + 1]) ||
        cellStr(row[noteCol + 2]);
      unit = inferUnitFromText(achievedNote, kpiName);
      targetAnnual = achievedNote;
    }

    const direction = inferDirection(unit, targetAnnual, kpiName);
    const targetValue = resolveImportTargetValue(targetAnnual, "", unit);
    const q1a = normalizeKraCellValue(achievedNote, unit);

    kpis.push({
      sheetName: ctx.sheetName,
      ownerName: ctx.ownerName,
      department: ctx.department,
      srNo: currentSr || kpis.length + 1,
      perspective: currentPerspective,
      kraName: currentKra || currentPerspective,
      name: kpiName,
      unit,
      weightage,
      targetAnnual,
      targetValue,
      direction,
      quarterTargets: {
        q1: { target: targetAnnual, achieved: q1a },
        q2: { target: "", achieved: "" },
        q3: { target: "", achieved: "" },
        q4: { target: "", achieved: "" },
      },
      entryValues: [],
    });
  }

  return kpis;
}

function parseKpiRows(
  matrix: string[][],
  ws: XLSX.WorkSheet,
  headerIdx: number,
  ctx: { sheetName: string; ownerName: string; department: string }
): KraWorkbookKpi[] {
  const cols = mapKpiHeaderColumns(matrix[headerIdx] ?? []);
  const kpis: KraWorkbookKpi[] = [];
  const dataStart =
    cellStr(matrix[headerIdx + 1]?.[0]).toLowerCase().includes("target") ||
    cellStr(matrix[headerIdx + 1]?.[1]).toLowerCase().includes("target")
      ? headerIdx + 2
      : headerIdx + 1;

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const kpiName = cellStr(row[cols.kpi]);
    if (!kpiName) continue;
    const uomRaw = cols.uom >= 0 ? cellStr(row[cols.uom]) : "";
    const unit = normalizeUnit(uomRaw || "%");

    const srNo = parseInt(cellStr(row[cols.sr]), 10) || kpis.length + 1;
    const targetAnnual = readSheetCell(ws, r, cols.annual, unit, "annual");
    const q1t = readSheetCell(ws, r, cols.q1t, unit, "quarterTarget");
    const direction = inferDirection(unit, targetAnnual || q1t, kpiName);
    const targetValue = resolveImportTargetValue(targetAnnual, q1t, unit);
    const q1a = normalizeKraCellValue(
      readSheetCell(ws, r, cols.q1a, unit, "quarterAchieved"),
      unit
    );
    const q2t = readSheetCell(ws, r, cols.q2t, unit, "quarterTarget");
    const q2a = normalizeKraCellValue(
      readSheetCell(ws, r, cols.q2a, unit, "quarterAchieved"),
      unit
    );
    const q3t = readSheetCell(ws, r, cols.q3t, unit, "quarterTarget");
    const q3a = normalizeKraCellValue(
      readSheetCell(ws, r, cols.q3a, unit, "quarterAchieved"),
      unit
    );
    const q4t = readSheetCell(ws, r, cols.q4t, unit, "quarterTarget");
    const q4a = normalizeKraCellValue(
      readSheetCell(ws, r, cols.q4a, unit, "quarterAchieved"),
      unit
    );

    const entryValues = [q1a, q2a, q3a, q4a]
      .map((v) => parseFloat(v.replace(/[^0-9.-]/g, "")))
      .filter((n) => !Number.isNaN(n));

    const kraName =
      cols.kra >= 0 ? cellStr(row[cols.kra]) : cellStr(row[1]);
    const perspective =
      cols.perspective >= 0
        ? cellStr(row[cols.perspective]).replace(/\r?\n/g, " ")
        : "";

    kpis.push({
      sheetName: ctx.sheetName,
      ownerName: ctx.ownerName,
      department: ctx.department,
      srNo,
      perspective,
      kraName,
      name: kpiName,
      unit,
      weightage: readNumericWeightage(
        ws,
        r,
        cols.weightage,
        row[cols.weightage]
      ),
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

function isPrimeStyleSheet(matrix: string[][]): boolean {
  const a0 = cellStr(matrix[0]?.[0]).toLowerCase().replace(/[^a-z]/g, "");
  const a1 = cellStr(matrix[1]?.[0]).toLowerCase().replace(/[^a-z]/g, "");
  return a0 === "name" && a1 === "department" && Boolean(cellStr(matrix[0]?.[1]));
}

function parsePrimeStyleMeta(matrix: string[][]): Partial<KraWorkbookEmployee> {
  const out: Partial<KraWorkbookEmployee> = {};
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const label = cellStr(matrix[i]?.[0])
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const val = cellStr(matrix[i]?.[1]).trim();
    if (!label || !val) continue;
    if (label === "name") out.name = titleCaseName(val);
    else if (label === "department" || label === "dept") {
      out.departmentRaw = val;
      out.department = normalizeKraDepartment(val).masterName;
    } else if (label === "designation") {
      out.designation = sanitizeKraDesignation(val) ?? undefined;
    } else if (label === "dateofjoining" || label === "doj") {
      out.doj = excelSerialToDoj(val) ?? val;
    } else if (label.includes("reporting")) {
      out.managerName = titleCaseName(val);
    } else if (label === "location") out.location = val;
  }
  return out;
}

function isChecklistActivitySheet(matrix: string[][]): boolean {
  if (isDwmChecklistSheet(matrix)) return true;
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const c0 = cellStr(matrix[i]?.[0]).toLowerCase();
    const c1 = cellStr(matrix[i]?.[1]).toLowerCase();
    const c2 = cellStr(matrix[i]?.[2]).toLowerCase();
    if (
      (c0.includes("sr") || c0.includes("sl") || c0.includes("sno")) &&
      c1.includes("activit") &&
      c2.includes("frequen")
    ) {
      return true;
    }
  }
  return false;
}

function isNonKraReportSheet(sheetName: string, matrix: string[][]): boolean {
  const name = sheetName.toLowerCase();
  if (/trend|training|accident|statutory|cases|dojo|sales data|calendar/i.test(name)) {
    return true;
  }
  const r0 = (matrix[0] ?? []).map((c) => cellStr(c).toLowerCase()).join("|");
  if (r0.includes("month") && r0.includes("head count")) return true;
  return false;
}

/** User-facing English issue lines: ISSUE|<code>|<employeeName>|<sheet>|<message>|<fixHint> */
export function formatKraIssue(
  code: string,
  employeeName: string,
  sheetName: string,
  message: string,
  fixHint: string
): string {
  return `ISSUE|${code}|${employeeName}|${sheetName}|${message}|${fixHint}`;
}

export function parseKraIssueLine(line: string): {
  code: string;
  employeeName: string;
  sheetName: string;
  message: string;
  fixHint: string;
} | null {
  if (!line.startsWith("ISSUE|")) return null;
  const parts = line.split("|");
  if (parts.length < 6) return null;
  return {
    code: parts[1],
    employeeName: parts[2],
    sheetName: parts[3],
    message: parts[4],
    fixHint: parts.slice(5).join("|"),
  };
}

export function parseKraWorkbook(
  buffer: ArrayBuffer,
  sourceFileName?: string
): KraWorkbookParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const employees: KraWorkbookEmployee[] = [];
  const kpis: KraWorkbookKpi[] = [];
  const errors: string[] = [];

  const sf1Mode = isSf1Workbook(wb);

  const logisticMode =
    !sf1Mode &&
    wb.SheetNames.some((sheetName) => {
      if (!isMainKraSheetName(sheetName)) return false;
      return isLogisticKraSheet(sheetMatrix(wb, sheetName));
    });

  wb.SheetNames.forEach((sheetName, idx) => {
    if (isLogisticsJunkName(sheetName)) return;
    if (isSummaryKraSheetName(sheetName)) return;
    const matrix = sheetMatrix(wb, sheetName);
    if (
      /^sheet\d*$/i.test(sheetName.trim()) &&
      findLogisticKpiHeaderRow(matrix) < 0 &&
      findKpiHeaderRow(matrix) < 0
    ) {
      return;
    }
    const ws = wb.Sheets[sheetName];

    // Skip pure report/trend tabs (not individual KRA scorecards).
    if (isNonKraReportSheet(sheetName, matrix)) {
      errors.push(
        formatKraIssue(
          "NON_KRA_SHEET",
          sheetName.trim(),
          sheetName.trim(),
          "This sheet is a report/trend/list (not an individual KRA/KPI scorecard), so it was skipped.",
          "Keep only employee KRA sheets in the workbook, or upload a separate standard KRA file per employee."
        )
      );
      return;
    }

    if (!sf1Mode && /^sheet\d*$/i.test(sheetName.trim()) && !isPrimeStyleSheet(matrix)) {
      // Allow Sheet1 when it has a KPI header (Plant Head style).
      if (findKpiHeaderRow(matrix) < 0) return;
    }
    if (!sf1Mode && logisticMode && !isMainKraSheetName(sheetName)) return;

    if (sf1Mode) {
      const parsed = parseSf1KraSheet(sheetName, matrix, ws, idx, sourceFileName);
      errors.push(...parsed.errors);
      if (parsed.employee) employees.push(parsed.employee);
      kpis.push(...parsed.kpis);
      return;
    }

    if (logisticMode && isLogisticKraSheet(matrix)) {
      const parsed = parseLogisticKraSheet(sheetName, matrix, ws, idx);
      errors.push(...parsed.errors);
      if (parsed.employee) employees.push(parsed.employee);
      kpis.push(...parsed.kpis);
      return;
    }

    // Daily checklist sheets (Activities / Frequency) — register employee + issue.
    if (isChecklistActivitySheet(matrix)) {
      const headerCell = (matrix[0] ?? [])
        .map((c) => String(c ?? ""))
        .filter(Boolean)
        .join("\n");
      const meta = parseHeaderBlock(headerCell);
      const displayName =
        (!isMisreadEmployeeName(meta.name) ? meta.name?.trim() : null) ||
        sheetName.trim();
      const department =
        meta.department ??
        inferDepartmentFromTitle(headerCell, sheetName);
      employees.push({
        sheetName: sheetName.trim(),
        name: displayName,
        designation: meta.designation,
        department,
        departmentRaw: meta.departmentRaw ?? department,
        location: meta.location,
        doj: meta.doj,
        ecn: meta.ecn,
        managerName: meta.managerName,
        sortOrder: employees.length + 1,
        isActive: true,
      });
      errors.push(
        formatKraIssue(
          "CHECKLIST_NOT_KRA",
          displayName,
          sheetName.trim(),
          "This file is a daily activity checklist (Activities / Frequency), not a KRA/KPI scorecard. No KPI targets were imported.",
          "Upload a standard KRA/KPI Excel with columns: Perspective, KRA, KPI, UOM, Weightage, and Target."
        )
      );
      return;
    }

    const headerCell = (matrix[0] ?? [])
      .map((c) => String(c ?? ""))
      .filter(Boolean)
      .join("\n");

    let meta: Partial<KraWorkbookEmployee> = {};
    if (isPrimeStyleSheet(matrix)) {
      meta = parsePrimeStyleMeta(matrix);
    } else {
      meta = parseHeaderBlock(headerCell);
    }

    // Name: ... header without Department: — still accept and infer department.
    if (!meta.name && /Name:\s*.+/i.test(headerCell)) {
      meta = { ...meta, ...parseHeaderBlock(headerCell) };
    }

    if (!meta.department) {
      meta.department = inferDepartmentFromTitle(
        `${headerCell} ${sourceFileName ?? ""}`,
        sheetName
      );
      meta.departmentRaw = meta.department;
    }

    const hasName =
      (!isMisreadEmployeeName(meta.name) && meta.name?.trim()) ||
      (!/^sheet\d*$/i.test(sheetName.trim()) && sheetName.trim());

    if (!hasName && findKpiHeaderRow(matrix) < 0) {
      errors.push(
        formatKraIssue(
          "MISSING_HEADER",
          sheetName.trim(),
          sheetName.trim(),
          "Could not read employee name/department header on this sheet.",
          "Add an employee header block with Name, Department, Designation, Location and DOJ, then a KPI table below."
        )
      );
      return;
    }

    const displayName =
      (!isMisreadEmployeeName(meta.name) ? meta.name?.trim() : null) ||
      (isPrimeStyleSheet(matrix)
        ? parseEmployeeNameFromSheetName(sheetName)
        : null) ||
      (looksLikeKraEmployeeSheetName(sheetName)
        ? parseEmployeeNameFromSheetName(sheetName)
        : null) ||
      (/^sheet\d*$/i.test(sheetName.trim())
        ? parseEmployeeNameFromSheetName(sourceFileName ?? "Plant Head")
        : sheetName.trim()) ||
      `Employee ${idx + 1}`;

    const department = meta.department ?? "General";

    employees.push({
      sheetName: sheetName.trim(),
      name: displayName,
      designation: meta.designation,
      department,
      departmentRaw: meta.departmentRaw ?? department,
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
      errors.push(
        formatKraIssue(
          "KPI_TABLE_NOT_FOUND",
          displayName,
          sheetName.trim(),
          "Employee header was found, but no KRA/KPI table (S.No / KRA / KPI / Weightage / Target) was detected.",
          "Add a KPI table with columns: S.No, KRA (or Perspective), KPI, UOM, Weightage, and Target."
        )
      );
      return;
    }

    const parsedKpis = isWorkRecordSheet(matrix)
      ? parseWorkRecordKpiRows(matrix, wb.Sheets[sheetName], headerIdx, {
          sheetName: sheetName.trim(),
          ownerName: displayName,
          department,
        })
      : parseKpiRows(matrix, wb.Sheets[sheetName], headerIdx, {
          sheetName: sheetName.trim(),
          ownerName: displayName,
          department,
        });
    if (!parsedKpis.length) {
      errors.push(
        formatKraIssue(
          "KPI_ROWS_EMPTY",
          displayName,
          sheetName.trim(),
          "A KPI header was found but no KPI rows could be read (missing KPI name or values).",
          "Ensure each KPI row has a KPI name, weightage, and target values filled in."
        )
      );
      return;
    }
    kpis.push(...parsedKpis);
  });

  const cleanEmployees = employees.filter(
    (e) => !isLogisticsJunkName(e.name) && !isLogisticsJunkName(e.sheetName)
  );
  const cleanSheetNames = new Set(cleanEmployees.map((e) => e.sheetName));
  const cleanKpis = kpis.filter(
    (k) =>
      cleanSheetNames.has(k.sheetName) && !isLogisticsJunkName(k.ownerName)
  );

  if (!cleanEmployees.length) errors.push("No employee sheets found in workbook");
  return { employees: cleanEmployees, kpis: cleanKpis, errors };
}

export function kpiStableId(
  ownerName: string,
  srNo: number,
  kpiName: string,
  plantKey?: string | null
): string {
  const scope = plantKey ? `${slug(plantKey)}-` : "";
  return `kra-${scope}${slug(ownerName)}-${srNo}-${slug(kpiName).slice(0, 24)}`;
}

export function defaultKraWorkbookPath(): string {
  return `${process.cwd()}/data/kra-it-13-4-26.xlsx`;
}
