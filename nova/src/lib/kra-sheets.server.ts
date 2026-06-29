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
import { formatDepartmentDisplayName } from "@/lib/masters/department-master-sync";
import {
  filterRealKraEmployees,
  isHiddenKraDepartment,
  isLogisticsJunkName,
} from "@/lib/masters/logistics-kra-junk";
import {
  departmentMasterWhereForPlant,
  employeeMasterWhereForPlant,
  type PlantDataScope,
} from "@/lib/unit-workspace";

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

export async function fetchKraSheets(
  organizationId: string,
  scope?: PlantDataScope | null
): Promise<KraSheetFromDb[]> {
  const deptWhere: Prisma.DepartmentMasterWhereInput = scope
    ? { ...departmentMasterWhereForPlant(organizationId, scope), isActive: true }
    : { organizationId, isActive: true };

  const [departments, scopedEmployees] = await Promise.all([
    db.departmentMaster.findMany({
      where: deptWhere,
      orderBy: { sortOrder: "asc" },
    }),
    scope
      ? db.employeeMaster.findMany({
          where: {
            organizationId,
            isActive: true,
            ...employeeMasterWhereForPlant(organizationId, scope),
          },
          select: { department: true },
        })
      : Promise.resolve([]),
  ]);

  const deptNamesFromStaff = new Set(
    scopedEmployees
      .map((e) => e.department?.trim())
      .filter((n): n is string => Boolean(n))
  );

  const deptByName = new Map(departments.map((d) => [d.name, d]));

  const withSheetId = departments.filter(
    (d) => d.kraSheetId && d.kpiLevel !== "INDIVIDUAL"
  );

  let source =
    withSheetId.length > 0
      ? withSheetId
      : departments.filter((d) => d.kpiLevel !== "INDIVIDUAL");

  for (const name of deptNamesFromStaff) {
    if (isPlantHeadRoleDepartment(name)) continue;
    if (isHiddenKraDepartment(name)) continue;
    if (!deptByName.has(name)) {
      source = [
        ...source,
        {
          id: `virtual-${slugDept(name)}`,
          organizationId,
          name,
          headName: null,
          location: scope?.plantUnitKey ?? null,
          kraSheetId: slugDept(name),
          kpiLevel: "INDIVIDUAL",
          category: name,
          showPerspective: true,
          sortOrder: 100,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }
  }

  const seen = new Set<string>();
  const sheets: KraSheetFromDb[] = [];

  for (const d of source) {
    if (isPlantHeadRoleDepartment(d.name)) continue;
    if (isHiddenKraDepartment(d.name)) continue;
    const displayName = formatDepartmentDisplayName(d.name);
    const id = slugDept(displayName);
    if (seen.has(id)) continue;
    seen.add(id);
    sheets.push({
      id,
      label: displayName,
      department: displayName,
      meta: {
        kpiLevel: d.kpiLevel ?? "DEPARTMENT",
        department: displayName,
        category: d.category ?? displayName,
        showPerspective: d.showPerspective,
      },
    });
  }

  if (sheets.length === 0 && deptNamesFromStaff.size > 0) {
    for (const name of [...deptNamesFromStaff].sort()) {
      if (isPlantHeadRoleDepartment(name)) continue;
      if (isHiddenKraDepartment(name)) continue;
      const displayName = formatDepartmentDisplayName(name);
      const id = slugDept(displayName);
      if (seen.has(id)) continue;
      seen.add(id);
      sheets.push({
        id,
        label: displayName,
        department: displayName,
        meta: {
          kpiLevel: "INDIVIDUAL",
          department: displayName,
          category: displayName,
          showPerspective: true,
        },
      });
    }
  }

  attachProductionSubSheets(sheets);

  if (scopedEmployees.length > 0) {
    const employeeDisplayDepts = new Set(
      scopedEmployees
        .map((e) => e.department?.trim())
        .filter((n): n is string => Boolean(n))
        .map((n) => formatDepartmentDisplayName(n))
    );
    return sheets.filter((s) => employeeDisplayDepts.has(s.department));
  }

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
  extraWhere?: Prisma.EmployeeMasterWhereInput
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

  const byDept: Record<string, KraEmployeeRow[]> = {};
  for (const emp of filterRealKraEmployees(employees)) {
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
