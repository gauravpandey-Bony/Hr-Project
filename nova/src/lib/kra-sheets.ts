import type { Kpi } from "@prisma/client";
import { KRA_SHEETS } from "@/lib/plant-37p";

export type SheetMeta = {
  kpiLevel: string;
  department: string;
  category: string;
  showPerspective: boolean;
};

export const SHEET_META: Record<string, SheetMeta> = {
  plant: { kpiLevel: "PLANT", department: "Plant Head", category: "Sales", showPerspective: false },
  production: { kpiLevel: "DEPARTMENT", department: "Production", category: "Production", showPerspective: false },
  qa: { kpiLevel: "DEPARTMENT", department: "Quality Assurance", category: "Quality", showPerspective: false },
  maintenance: { kpiLevel: "DEPARTMENT", department: "Maintenance", category: "Maintenance", showPerspective: false },
  store: { kpiLevel: "INDIVIDUAL", department: "Store", category: "Process", showPerspective: true },
  billing: { kpiLevel: "INDIVIDUAL", department: "Billing", category: "Process", showPerspective: true },
  it: { kpiLevel: "DEPARTMENT", department: "IT", category: "IT", showPerspective: true },
};

export function kpisForSheet(sheetId: string, allKpis: Kpi[]): Kpi[] {
  const sheet = KRA_SHEETS.find((s) => s.id === sheetId);
  const seedIds = new Set(sheet?.kpis.map((k) => k.id) ?? []);
  const meta = SHEET_META[sheetId];

  return allKpis.filter((k) => {
    if (seedIds.has(k.id)) return true;
    if (!meta) return false;
    return k.kpiLevel === meta.kpiLevel && k.department === meta.department;
  });
}

export const emptyQuarterTargets = () =>
  JSON.stringify({
    q1: { target: "", achieved: "" },
    q2: { target: "", achieved: "" },
    q3: { target: "", achieved: "" },
    q4: { target: "", achieved: "" },
  });

export function sheetMetaForDepartment(department: string | null | undefined): SheetMeta {
  if (!department) {
    return { kpiLevel: "INDIVIDUAL", department: "General", category: "Process", showPerspective: true };
  }
  const match = Object.values(SHEET_META).find((m) => m.department === department);
  if (match) return match;
  return {
    kpiLevel: "INDIVIDUAL",
    department,
    category: department,
    showPerspective: true,
  };
}
