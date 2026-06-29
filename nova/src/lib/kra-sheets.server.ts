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
    where: { organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const withSheetId = departments.filter(
    (d) => d.kraSheetId && d.kpiLevel !== "INDIVIDUAL"
  );

  const source =
    withSheetId.length > 0
      ? withSheetId
      : departments.filter((d) => d.kpiLevel !== "INDIVIDUAL");

  const seen = new Set<string>();
  const sheets: KraSheetFromDb[] = [];

  for (const d of source) {
    const id =
      d.kraSheetId ??
      (d.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "general");
    if (seen.has(id)) continue;
    seen.add(id);
    sheets.push({
      id,
      label: d.name,
      department: d.name,
      meta: {
        kpiLevel: d.kpiLevel ?? "DEPARTMENT",
        department: d.name,
        category: d.category ?? d.name,
        showPerspective: d.showPerspective,
      },
    });
  }

  const employees = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  for (const emp of employees) {
    const slug = emp.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const id = `emp-${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);
    sheets.push({
      id,
      label: emp.name,
      department: emp.department ?? emp.name,
      meta: {
        kpiLevel: "INDIVIDUAL",
        department: emp.department ?? "General",
        category: emp.department ?? "Logistics",
        showPerspective: true,
        ownerName: emp.name,
      },
    });
  }

  return sheets;
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
