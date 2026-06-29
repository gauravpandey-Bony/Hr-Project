import "server-only";

import type { Kpi } from "@prisma/client";
import { db } from "@/lib/db";
import type { SheetMeta } from "@/lib/kra-sheets";

export type KraSheetFromDb = {
  id: string;
  label: string;
  department: string;
  meta: SheetMeta;
};

export async function fetchKraSheets(
  organizationId: string
): Promise<KraSheetFromDb[]> {
  const departments = await db.departmentMaster.findMany({
    where: { organizationId, isActive: true, kraSheetId: { not: null } },
    orderBy: { sortOrder: "asc" },
  });

  return departments
    .filter((d) => d.kraSheetId)
    .map((d) => ({
      id: d.kraSheetId!,
      label: d.name,
      department: d.name,
      meta: {
        kpiLevel: d.kpiLevel ?? "DEPARTMENT",
        department: d.name,
        category: d.category ?? d.name,
        showPerspective: d.showPerspective,
      },
    }));
}

export function kpisForSheetFromDb(
  sheet: KraSheetFromDb,
  allKpis: Kpi[]
): Kpi[] {
  const meta = sheet.meta;
  return allKpis.filter((k) => {
    if (k.department === meta.department) return true;
    if (k.kpiLevel === meta.kpiLevel && k.department === meta.department) {
      return true;
    }
    return k.kpiLevel === meta.kpiLevel && k.department === meta.department;
  });
}

export function sheetMetaForDepartmentDynamic(
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
