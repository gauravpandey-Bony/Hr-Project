import * as XLSX from "xlsx";
import { ALL_PLANT_KPIS } from "@/lib/plant-37p";
import { normalizeKraCellValue } from "@/lib/kra/target-format";
import { readNumericWeightage, readSheetCell } from "./excel-cell-read";
import { parseNumericTarget, resolveImportTargetValue } from "./parse-numeric-target";

export type PlantKraSheetConfig = {
  sheetId: string;
  department: string;
  kpiLevel: "PLANT" | "DEPARTMENT" | "INDIVIDUAL";
  ownerName?: string;
  category: string;
};

export type PlantKraWorkbookKpi = {
  sheetName: string;
  sheetId: string;
  srNo: number;
  kraName: string;
  name: string;
  unit: string;
  weightage: number;
  targetAnnual: string;
  targetValue: number;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  department: string;
  kpiLevel: "PLANT" | "DEPARTMENT" | "INDIVIDUAL";
  ownerName?: string;
  category: string;
  quarterTargets: {
    q1: { target: string; achieved?: string };
    q2: { target: string; achieved?: string };
    q3: { target: string; achieved?: string };
    q4: { target: string; achieved?: string };
  };
  entryValues: number[];
};

export type PlantKraWorkbookParseResult = {
  kpis: PlantKraWorkbookKpi[];
  errors: string[];
};

const SHEET_MATCHERS: { pattern: RegExp; config: PlantKraSheetConfig }[] = [
  {
    pattern: /kra\s*kpi\s*-?\s*26-27/i,
    config: {
      sheetId: "plant",
      department: "Plant Head",
      kpiLevel: "PLANT",
      ownerName: "Raj Kumar",
      category: "Sales",
    },
  },
  {
    pattern: /kra\s*kpi\s*prod/i,
    config: {
      sheetId: "production",
      department: "Production",
      kpiLevel: "DEPARTMENT",
      category: "Production",
    },
  },
  {
    pattern: /kra\s*kpi\s*qa/i,
    config: {
      sheetId: "qa",
      department: "Quality Assurance",
      kpiLevel: "DEPARTMENT",
      category: "Quality",
    },
  },
  {
    pattern: /kra\s*kpi\s*maint/i,
    config: {
      sheetId: "maintenance",
      department: "Maintenance",
      kpiLevel: "DEPARTMENT",
      category: "Maintenance",
    },
  },
  {
    pattern: /kra\s*kpi\s*hr/i,
    config: {
      sheetId: "hr",
      department: "HR",
      kpiLevel: "DEPARTMENT",
      category: "HR",
    },
  },
];

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function cellStr(v: unknown): string {
  if (v === "" || v == null) return "";
  return String(v).trim();
}

function sheetConfig(sheetName: string): PlantKraSheetConfig | null {
  const n = sheetName.trim();
  for (const m of SHEET_MATCHERS) {
    if (m.pattern.test(n)) return m.config;
  }
  return null;
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
    t.includes("<") ||
    /within\s+\d+\s*(hour|day|hr)/i.test(t)
  ) {
    return "LOWER_IS_BETTER";
  }
  if (/hour|day|minute|closure|timely|stoppage|injury|lti|complaint|rejection|ppm/i.test(`${unit} ${kpiName}`) && /\d|zero/i.test(targetText)) {
    if (/zero|0\b/i.test(targetText) && /injury|lti|stoppage|complaint|strike/i.test(kpiName)) {
      return "LOWER_IS_BETTER";
    }
    if (/less than|zero/i.test(t)) return "LOWER_IS_BETTER";
  }
  if (/zero/i.test(targetText) && /injury|lti|strike|complaint/i.test(kpiName)) {
    return "LOWER_IS_BETTER";
  }
  if (/%/.test(uom) || unit === "percent") {
    return "HIGHER_IS_BETTER";
  }
  return "HIGHER_IS_BETTER";
}

function inferUnit(kpiName: string, targetText: string): string {
  const t = `${kpiName} ${targetText}`.toLowerCase();
  if (/₹|cr|revenue|budget/i.test(t)) return "₹ Cr";
  if (/%|percent|otd|adherence|ebitda|attrition|rejection|availability|\b5s\b/i.test(t)) return "%";
  if (/ppm/i.test(t)) return "PPM";
  if (/day|days/i.test(t)) return "days";
  if (/hour|hr|min/i.test(t)) return "Hours";
  if (/zero|lti|injury|complaint|sop|nos\b|count/i.test(t)) return "Count";
  return "Count";
}

function findDeptKpiHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const c0 = cellStr(matrix[i]?.[0]).toLowerCase();
    const c1 = cellStr(matrix[i]?.[1]).toLowerCase();
    if ((c0 === "sno" || c0.startsWith("sno")) && c1.includes("kra")) {
      return i;
    }
  }
  return -1;
}

function normalizeNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const PLANT_HEAD_KPI_IDS: Record<number, string> = {
  1: "37p-sales-target",
  2: "37p-otd",
  3: "37p-rejection",
  4: "37p-inventory",
  5: "37p-ebitda",
  6: "37p-5s",
  7: "37p-npd",
  8: "37p-lti",
};

const SHEET_DEPARTMENTS: Record<string, string> = {
  plant: "Plant Head",
  production: "Production",
  qa: "Quality Assurance",
  maintenance: "Maintenance",
  hr: "HR",
};

function defsForSheet(sheetId: string) {
  const dept = SHEET_DEPARTMENTS[sheetId];
  if (!dept) return ALL_PLANT_KPIS;
  if (sheetId === "plant") {
    return ALL_PLANT_KPIS.filter((k) => k.kpiLevel === "PLANT");
  }
  return ALL_PLANT_KPIS.filter(
    (k) => k.department === dept && k.kpiLevel !== "PLANT"
  );
}

export function resolvePlantKpiId(
  sheetId: string,
  srNo: number,
  _kraName: string,
  kpiName: string
): string {
  if (sheetId === "plant" && PLANT_HEAD_KPI_IDS[srNo]) {
    return PLANT_HEAD_KPI_IDS[srNo];
  }

  const key = normalizeNameKey(kpiName);
  const candidates = defsForSheet(sheetId);

  const exact = candidates.find((k) => normalizeNameKey(k.name) === key);
  if (exact) return exact.id;

  const partial = candidates.find((k) => {
    const kKey = normalizeNameKey(k.name);
    return kKey.includes(key) || key.includes(kKey);
  });
  if (partial) return partial.id;

  return `plant-xlsx-${sheetId}-${srNo}-${slug(kpiName).slice(0, 24)}`;
}

export function isPlantKraWorkbook(buffer: ArrayBuffer): boolean {
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.some((name) => sheetConfig(name) !== null);
}

function parseSheetRows(
  matrix: string[][],
  ws: XLSX.WorkSheet,
  sheetName: string,
  config: PlantKraSheetConfig
): PlantKraWorkbookKpi[] {
  const headerIdx = findDeptKpiHeaderRow(matrix);
  if (headerIdx < 0) return [];

  const kpis: PlantKraWorkbookKpi[] = [];
  let lastKra = "";

  for (let r = headerIdx + 2; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const kraCell = cellStr(row[1]);
    if (kraCell) lastKra = kraCell;

    const kpiName = cellStr(row[2]) || cellStr(row[1]);
    if (!kpiName || kpiName.toLowerCase().includes("primary: kra")) continue;

    const weightage = readNumericWeightage(ws, r, 3, row[3]);
    if (weightage === 1 && !cellStr(row[2])) continue;

    const targetAnnual =
      readSheetCell(ws, r, 5, "", "annual") ||
      readSheetCell(ws, r, 6, "", "quarterTarget");
    const unit = inferUnit(kpiName, targetAnnual);
    const direction = inferDirection(unit, targetAnnual, kpiName);
    const q1t = readSheetCell(ws, r, 6, unit, "quarterTarget");
    const totalTargetText = readSheetCell(ws, r, 14, unit, "total");
    const annualText = readSheetCell(ws, r, 5, unit, "annual");
    let targetValue = parseNumericTarget(totalTargetText || annualText, unit);
    if (!targetValue && q1t) {
      targetValue = resolveImportTargetValue(annualText || targetAnnual, q1t, unit);
    }
    const q1a = normalizeKraCellValue(
      readSheetCell(ws, r, 7, unit, "quarterAchieved"),
      unit
    );
    const q2t = readSheetCell(ws, r, 8, unit, "quarterTarget");
    const q2a = normalizeKraCellValue(
      readSheetCell(ws, r, 9, unit, "quarterAchieved"),
      unit
    );
    const q3t = readSheetCell(ws, r, 10, unit, "quarterTarget");
    const q3a = normalizeKraCellValue(
      readSheetCell(ws, r, 11, unit, "quarterAchieved"),
      unit
    );
    const q4t = readSheetCell(ws, r, 12, unit, "quarterTarget");
    const q4a = normalizeKraCellValue(
      readSheetCell(ws, r, 13, unit, "quarterAchieved"),
      unit
    );

    const entryValues = [q1a, q2a, q3a, q4a]
      .map((v) => parseFloat(v.replace(/[^0-9.-]/g, "")))
      .filter((n) => !Number.isNaN(n));

    const srNo = parseInt(cellStr(row[0]), 10) || kpis.length + 1;

    kpis.push({
      sheetName,
      sheetId: config.sheetId,
      srNo,
      kraName: lastKra || kraCell || kpiName,
      name: kpiName,
      unit,
      weightage,
      targetAnnual: annualText || targetAnnual || totalTargetText,
      targetValue,
      direction,
      department: config.department,
      kpiLevel: config.kpiLevel,
      ownerName: config.ownerName,
      category: config.category,
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

export function parsePlantKraWorkbook(buffer: ArrayBuffer): PlantKraWorkbookParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const kpis: PlantKraWorkbookKpi[] = [];
  const errors: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const config = sheetConfig(sheetName);
    if (!config) continue;

    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as string[][];

    const rows = parseSheetRows(matrix, wb.Sheets[sheetName], sheetName, config);
    if (!rows.length) {
      errors.push(`Sheet "${sheetName}": KPI table not found`);
      continue;
    }
    kpis.push(...rows);
  }

  if (!kpis.length) errors.push("No department KRA sheets found in workbook");
  return { kpis, errors };
}

export function defaultPlantKraWorkbookPath(): string {
  return `${process.cwd()}/data/plant-kra-26-27-37p.xlsx`;
}
