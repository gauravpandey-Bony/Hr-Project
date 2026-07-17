import type { Kpi } from "@prisma/client";
import type { KraSheetFromDb } from "@/lib/kra-sheets.server";
import { departmentsAreEquivalent } from "@/lib/masters/department-master-sync";
import { personNamesMatch } from "@/lib/person-name";

export type SheetMeta = {
  kpiLevel: string;
  department: string;
  category: string;
  showPerspective: boolean;
  ownerName?: string;
};

export function kpisForSheet(
  sheet: KraSheetFromDb,
  allKpis: Kpi[]
): Kpi[] {
  const meta = sheet.meta;
  if (meta.kpiLevel === "INDIVIDUAL" && meta.ownerName) {
    return allKpis.filter(
      (k) =>
        k.kpiLevel === "INDIVIDUAL" &&
        k.ownerName &&
        personNamesMatch(k.ownerName, meta.ownerName!)
    );
  }
  return allKpis.filter((k) => {
    if (k.kpiLevel === "INDIVIDUAL") return false;
    if (departmentsAreEquivalent(k.department ?? "", meta.department)) return true;
    return k.kpiLevel === meta.kpiLevel && departmentsAreEquivalent(k.department ?? "", meta.department);
  });
}

export const emptyQuarterTargets = () =>
  JSON.stringify({
    q1: { target: "", achieved: "", managerAchieved: "" },
    q2: { target: "", achieved: "", managerAchieved: "" },
    q3: { target: "", achieved: "", managerAchieved: "" },
    q4: { target: "", achieved: "", managerAchieved: "" },
  });

export function sheetMetaForDepartment(
  department: string | null | undefined,
  sheets: KraSheetFromDb[]
): SheetMeta {
  if (!department) {
    return {
      kpiLevel: "INDIVIDUAL",
      department: "General",
      category: "Process",
      showPerspective: true,
    };
  }
  const match = sheets.find((s) => s.department === department);
  if (match) return match.meta;
  return {
    kpiLevel: "INDIVIDUAL",
    department,
    category: department,
    showPerspective: true,
  };
}
