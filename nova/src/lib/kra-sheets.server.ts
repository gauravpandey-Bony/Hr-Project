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
import { formatDepartmentDisplayName, departmentsAreEquivalent } from "@/lib/masters/department-master-sync";
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
          select: { department: true, departmentId: true },
        })
      : Promise.resolve([]),
  ]);

  const linkedDeptIds = [
    ...new Set(scopedEmployees.map((emp) => emp.departmentId).filter(Boolean)),
  ] as string[];
  const linkedDepartments =
    linkedDeptIds.length > 0
      ? await db.departmentMaster.findMany({
          where: { organizationId, id: { in: linkedDeptIds } },
          select: { id: true, name: true },
        })
      : [];
  const deptNameById = new Map(linkedDepartments.map((d) => [d.id, d.name]));

  const deptNamesFromStaff = new Set<string>();
  for (const emp of scopedEmployees) {
    const raw =
      emp.department?.trim() ||
      (emp.departmentId ? deptNameById.get(emp.departmentId)?.trim() : undefined);
    if (raw) deptNamesFromStaff.add(raw);
  }

  const deptByName = new Map(
    departments.map((d) => [formatDepartmentDisplayName(d.name), d])
  );

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
    const displayName = formatDepartmentDisplayName(name);
    const hasEquivalent = [...deptByName.keys()].some((existing) =>
      departmentsAreEquivalent(existing, displayName)
    );
    if (!hasEquivalent) {
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

  if (scope && scopedEmployees.length > 0) {
    const employeeDisplayDepts = new Set<string>();
    for (const emp of scopedEmployees) {
      const raw =
        emp.department?.trim() ||
        (emp.departmentId ? deptNameById.get(emp.departmentId)?.trim() : undefined);
      if (raw) employeeDisplayDepts.add(formatDepartmentDisplayName(raw));
    }

    const plantKpis = await db.kpi.findMany({
      where: {
        organizationId,
        isActive: true,
        ...kpiWhereForPlantScope(scope),
      },
      select: { department: true },
    });
    for (const k of plantKpis) {
      const dept = k.department?.trim();
      if (dept) employeeDisplayDepts.add(formatDepartmentDisplayName(dept));
    }

    return sheets.filter((s) =>
      [...employeeDisplayDepts].some((ed) => departmentsAreEquivalent(ed, s.department))
    );
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
