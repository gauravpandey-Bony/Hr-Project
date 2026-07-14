import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  mergeKpiWhere,
  mergeKpiWhereForWorkspace,
  employeeMasterWhereForUser,
} from "@/lib/access-control";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { KraPageClient } from "@/components/kra/kra-page-client";
import { getCompanyContext } from "@/lib/company.server";
import {
  fetchKraSheets,
  fetchKraEmployeesByDepartment,
  type KraEmployeeRow,
  type KraSheetFromDb,
} from "@/lib/kra-sheets.server";
import { employeeMasterWhereForPlant } from "@/lib/unit-workspace";
import {
  findUnitSlugByPlantUnitKey,
  locationToPlantUnitKey,
} from "@/lib/org-units.server";
import {
  departmentsAreEquivalent,
  formatDepartmentDisplayName,
} from "@/lib/masters/department-master-sync";
import type { UserRole } from "@prisma/client";
import { getViewableEmployees } from "@/lib/team-scope";

export const dynamic = "force-dynamic";

function slugDept(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "general"
  );
}

function toKraEmployeeRow(emp: {
  id: string;
  name: string;
  department: string | null;
  designation: string | null;
  ecn: string | null;
  doj: string | null;
  location: string | null;
  managerName: string | null;
}): KraEmployeeRow {
  return {
    id: emp.id,
    name: emp.name,
    department: emp.department,
    designation: emp.designation,
    ecn: emp.ecn,
    doj: emp.doj,
    location: emp.location,
    managerName: emp.managerName,
  };
}

function injectEmployee(
  employeesByDepartment: Record<string, KraEmployeeRow[]>,
  emp: KraEmployeeRow
): Record<string, KraEmployeeRow[]> {
  const deptKey =
    formatDepartmentDisplayName(emp.department?.trim() || "General") || "General";
  const next = { ...employeesByDepartment };
  const list = next[deptKey] ?? [];
  if (!list.some((e) => e.id === emp.id)) {
    next[deptKey] = [...list, emp];
  }
  // Also ensure under raw department name if different
  const raw = emp.department?.trim();
  if (raw && raw !== deptKey) {
    const rawList = next[raw] ?? [];
    if (!rawList.some((e) => e.id === emp.id)) {
      next[raw] = [...rawList, emp];
    }
  }
  return next;
}

export default async function KraPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; employee?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId, employee: employeeParam } = await searchParams;
  const focusEmployeeId = employeeParam?.trim() || null;

  let focusEmployee: KraEmployeeRow | null = null;
  if (focusEmployeeId) {
    const row = await db.employeeMaster.findFirst({
      where: { id: focusEmployeeId, organizationId: user.organizationId },
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
    if (row) {
      if (user.role === "MANAGER") {
        const { canViewEmployeeMaster } = await import("@/lib/team-scope");
        if (await canViewEmployeeMaster(user, row.id)) {
          focusEmployee = toKraEmployeeRow(row);
        }
      } else {
        focusEmployee = toKraEmployeeRow(row);
      }
    }
  }

  let workspace = await resolveWorkspace(user, unitId);

  // Deep-link from profile: open the employee's plant when unit is missing/wrong.
  if (focusEmployee && (!workspace.plantUnitKey || !unitId)) {
    const plantKey = await locationToPlantUnitKey(
      user.organizationId,
      focusEmployee.location
    );
    const slug = await findUnitSlugByPlantUnitKey(user.organizationId, plantKey);
    if (slug) {
      workspace = await resolveWorkspace(user, slug);
    }
  }

  // Allow employee deep-links even when admin has no unit selected.
  if (user.role === "ADMIN" && !focusEmployee) {
    requireAdminWorkspace(user, workspace);
  }

  const isManager = user.role === "MANAGER";

  // Managers see their full direct-report team across plants — plant scope
  // would hide reports sitting at Corporate / other units (e.g. Bhupesh IT).
  const employeeScope = isManager
    ? { organizationId: user.organizationId }
    : workspace.dataScope
      ? employeeMasterWhereForPlant(user.organizationId, workspace.dataScope)
      : { organizationId: user.organizationId };

  const kpiWhere = isManager
    ? await mergeKpiWhere(user, {})
    : await mergeKpiWhereForWorkspace(user, workspace.dataScope, {});

  const [kpis, sheetsRaw, employeesByDepartmentRaw, company] = await Promise.all([
    db.kpi.findMany({
      where: kpiWhere,
      include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
      orderBy: [{ kpiLevel: "asc" }, { weightage: "desc" }],
    }),
    fetchKraSheets(
      user.organizationId,
      isManager ? null : workspace.dataScope
    ),
    fetchKraEmployeesByDepartment(
      user.organizationId,
      employeeScope,
      isManager ? null : workspace.dataScope
    ),
    getCompanyContext(user.organizationId),
  ]);

  let sheets: KraSheetFromDb[] = sheetsRaw;
  let employeesByDepartment = employeesByDepartmentRaw;
  if (user.role === "EMPLOYEE") {
    const allowed = await db.employeeMaster.findMany({
      where: { ...employeeMasterWhereForUser(user), isActive: true },
      select: { id: true, name: true, department: true },
    });
    const allowedIds = new Set(allowed.map((e) => e.id));
    employeesByDepartment = Object.fromEntries(
      Object.entries(employeesByDepartmentRaw).map(([dept, emps]) => [
        dept,
        emps.filter((e) => allowedIds.has(e.id)),
      ])
    );
  } else if (isManager) {
    const viewable = await getViewableEmployees(user);
    // Rebuild from viewable team + self — never rely on plant-scoped raw list.
    employeesByDepartment = {};
    for (const emp of viewable) {
      employeesByDepartment = injectEmployee(
        employeesByDepartment,
        toKraEmployeeRow(emp)
      );
    }

    // Ensure a sheet exists for every department on the manager's team.
    for (const dept of Object.keys(employeesByDepartment)) {
      const hasSheet = sheets.some((s) =>
        departmentsAreEquivalent(s.department, dept)
      );
      if (!hasSheet) {
        sheets = [
          ...sheets,
          {
            id: slugDept(dept),
            label: dept,
            department: dept,
            meta: {
              kpiLevel: "INDIVIDUAL",
              department: dept,
              category: dept,
              showPerspective: true,
            },
          },
        ];
      }
    }
  }

  if (focusEmployee) {
    employeesByDepartment = injectEmployee(employeesByDepartment, focusEmployee);
    const dept =
      formatDepartmentDisplayName(focusEmployee.department?.trim() || "General") ||
      "General";
    const hasSheet = sheets.some((s) =>
      departmentsAreEquivalent(s.department, dept)
    );
    if (!hasSheet) {
      sheets = [
        ...sheets,
        {
          id: slugDept(dept),
          label: dept,
          department: dept,
          meta: {
            kpiLevel: "INDIVIDUAL",
            department: dept,
            category: dept,
            showPerspective: true,
          },
        },
      ];
    }
  }

  const isAdmin = user.role === "ADMIN";
  const isEmployee = user.role === "EMPLOYEE";

  return (
    <KraPageClient
      allKpis={kpis}
      sheets={sheets}
      employeesByDepartment={employeesByDepartment}
      company={company}
      isAdmin={isAdmin}
      userRole={user.role as UserRole}
      viewerName={user.name}
      canEditTargets={isAdmin || isManager}
      canEditAchieved={isEmployee || isAdmin || isManager}
      canFillKra={isAdmin || isManager}
      plantUnit={workspace.plantUnitKey ?? "Bony Polymers"}
      unitName={workspace.unit?.name}
      unitId={workspace.unitId}
      initialEmployeeId={focusEmployee?.id ?? focusEmployeeId}
    />
  );
}
