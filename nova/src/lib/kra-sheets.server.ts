import "server-only";

import type { Kpi } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SheetMeta } from "@/lib/kra-sheets";
import {
  isPlantHeadRoleDepartment,
  PLANT_HEAD_EMPLOYEE_DEPARTMENT,
  PLANT_HEAD_KPI_DEPARTMENT,
  PLANT_HEAD_KRA_SHEET_ID,
} from "@/lib/masters/37p-roster";
import { formatDepartmentDisplayName, departmentsAreEquivalent, isArchivedDepartmentName } from "@/lib/masters/department-master-sync";
import {
  filterRealKraEmployees,
  isHiddenKraDepartment,
  isLogisticsJunkName,
} from "@/lib/masters/logistics-kra-junk";
import {
  departmentMasterWhereForPlant,
  employeeMasterWhereForPlant,
  kpiWhereForPlantScope,
  type PlantDataScope,
} from "@/lib/unit-workspace";
import { personNamesMatch } from "@/lib/person-name";

export type KraSubSheet = {
  id: string;
  label: string;
  meta: SheetMeta;
};

export type KraSheetFromDb = {
  id: string;
  label: string;
  department: string;
  meta: SheetMeta;
  subSheets?: KraSubSheet[];
};

function slugDept(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "general"
  );
}

function pushSheetIfNew(
  sheets: KraSheetFromDb[],
  seen: Set<string>,
  name: string,
  meta?: Partial<KraSheetFromDb["meta"]>
): void {
  if (isPlantHeadRoleDepartment(name)) return;
  if (isHiddenKraDepartment(name)) return;
  if (isArchivedDepartmentName(name)) return;
  const displayName = formatDepartmentDisplayName(name);
  if (!displayName || isHiddenKraDepartment(displayName)) return;
  const id = slugDept(displayName);
  if (seen.has(id)) return;
  // Collapse equivalent department labels (e.g. "QA" / "Quality Assurance")
  for (const existing of sheets) {
    if (departmentsAreEquivalent(existing.department, displayName)) return;
  }
  seen.add(id);
  sheets.push({
    id,
    label: displayName,
    department: displayName,
    meta: {
      kpiLevel: meta?.kpiLevel ?? "DEPARTMENT",
      department: displayName,
      category: meta?.category ?? displayName,
      showPerspective: meta?.showPerspective ?? true,
    },
  });
}

/**
 * One KRA sheet tab per active department in the plant/unit.
 * Includes Department Master rows even when they have no staff yet, plus any
 * staff/KPI departments missing from master.
 */
export async function fetchKraSheets(
  organizationId: string,
  scope?: PlantDataScope | null
): Promise<KraSheetFromDb[]> {
  const deptWhere: Prisma.DepartmentMasterWhereInput = scope
    ? { ...departmentMasterWhereForPlant(organizationId, scope), isActive: true }
    : { organizationId, isActive: true };

  const [departments, scopedEmployees, plantKpis] = await Promise.all([
    db.departmentMaster.findMany({
      where: deptWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    scope
      ? db.employeeMaster.findMany({
          where: {
            organizationId,
            isActive: true,
            ...employeeMasterWhereForPlant(organizationId, scope),
          },
          select: { department: true, departmentId: true },
        })
      : db.employeeMaster.findMany({
          where: { organizationId, isActive: true },
          select: { department: true, departmentId: true },
        }),
    scope
      ? db.kpi.findMany({
          where: {
            organizationId,
            isActive: true,
            ...kpiWhereForPlantScope(scope),
          },
          select: { department: true },
        })
      : Promise.resolve([] as { department: string | null }[]),
  ]);

  const linkedDeptIds = [
    ...new Set(scopedEmployees.map((emp) => emp.departmentId).filter(Boolean)),
  ] as string[];
  const linkedDepartments =
    linkedDeptIds.length > 0
      ? await db.departmentMaster.findMany({
          where: {
            organizationId,
            id: { in: linkedDeptIds },
            isActive: true,
            NOT: { name: { contains: "(archived" } },
          },
          select: { id: true, name: true },
        })
      : [];
  const deptNameById = new Map(linkedDepartments.map((d) => [d.id, d.name]));

  const seen = new Set<string>();
  const sheets: KraSheetFromDb[] = [];

  // 1) Every active Department Master row for this unit
  for (const d of departments) {
    if (isArchivedDepartmentName(d.name)) continue;
    pushSheetIfNew(sheets, seen, d.name, {
      kpiLevel: (d.kpiLevel as KraSheetFromDb["meta"]["kpiLevel"]) ?? "DEPARTMENT",
      category: d.category ?? undefined,
      showPerspective: d.showPerspective,
    });
  }

  // 2) Departments present on staff but missing from master
  for (const emp of scopedEmployees) {
    const raw =
      emp.department?.trim() ||
      (emp.departmentId ? deptNameById.get(emp.departmentId)?.trim() : undefined);
    if (!raw || isArchivedDepartmentName(raw)) continue;
    pushSheetIfNew(sheets, seen, raw, { kpiLevel: "INDIVIDUAL" });
  }

  // 3) Departments present on plant KPIs but missing above
  for (const k of plantKpis) {
    const dept = k.department?.trim();
    if (!dept || isArchivedDepartmentName(dept)) continue;
    pushSheetIfNew(sheets, seen, dept, { kpiLevel: "INDIVIDUAL" });
  }

  sheets.sort((a, b) => a.label.localeCompare(b.label));
  attachProductionSubSheets(sheets);
  return sheets;
}

function attachProductionSubSheets(sheets: KraSheetFromDb[]): void {
  const production = sheets.find(
    (s) =>
      s.department === PLANT_HEAD_EMPLOYEE_DEPARTMENT ||
      s.id === slugDept(PLANT_HEAD_EMPLOYEE_DEPARTMENT)
  );
  if (!production || production.subSheets?.length) return;

  production.subSheets = [
    {
      id: PLANT_HEAD_KRA_SHEET_ID,
      label: PLANT_HEAD_KPI_DEPARTMENT,
      meta: {
        kpiLevel: "PLANT",
        department: PLANT_HEAD_KPI_DEPARTMENT,
        category: "Sales",
        showPerspective: true,
      },
    },
    {
      id: "production",
      label: PLANT_HEAD_EMPLOYEE_DEPARTMENT,
      meta: production.meta,
    },
  ];
}

export type KraEmployeeRow = {
  id: string;
  name: string;
  department: string | null;
  designation: string | null;
  ecn: string | null;
  doj: string | null;
  location: string | null;
  managerName: string | null;
};

export async function fetchKraEmployeesByDepartment(
  organizationId: string,
  extraWhere?: Prisma.EmployeeMasterWhereInput,
  scope?: PlantDataScope | null
): Promise<Record<string, KraEmployeeRow[]>> {
  const employees = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true, ...extraWhere },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      department: true,
      designation: true,
      ecn: true,
      doj: true,
      location: true,
      managerName: true,
    },
  });

  const seenIds = new Set(employees.map((e) => e.id));
  const merged = [...employees];

  if (scope) {
    const plantKpis = await db.kpi.findMany({
      where: {
        organizationId,
        isActive: true,
        kpiLevel: "INDIVIDUAL",
        ...kpiWhereForPlantScope(scope),
      },
      select: { ownerName: true, department: true },
    });

    const ownerNames = [
      ...new Set(
        plantKpis.map((k) => k.ownerName?.trim()).filter((n): n is string => Boolean(n))
      ),
    ];

    if (ownerNames.length) {
      const orgEmployees = await db.employeeMaster.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          department: true,
          designation: true,
          ecn: true,
          doj: true,
          location: true,
          managerName: true,
        },
      });

      for (const owner of ownerNames) {
        const match = orgEmployees.find((e) => personNamesMatch(e.name, owner));
        if (match && !seenIds.has(match.id)) {
          seenIds.add(match.id);
          const kpiDept = plantKpis.find((k) => k.ownerName && personNamesMatch(k.ownerName, owner))
            ?.department;
          merged.push({
            ...match,
            department: kpiDept?.trim() || match.department,
          });
        }
      }
    }
  }

  const byDept: Record<string, KraEmployeeRow[]> = {};
  for (const emp of filterRealKraEmployees(merged)) {
    if (isHiddenKraDepartment(emp.department)) continue;
    const dept = formatDepartmentDisplayName(emp.department?.trim() || "General");
    if (isHiddenKraDepartment(dept)) continue;
    (byDept[dept] ??= []).push(emp);
  }
  return byDept;
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
