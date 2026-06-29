import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
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
} from "@/lib/kra-sheets.server";
import { employeeMasterWhereForPlant } from "@/lib/unit-workspace";
import type { UserRole } from "@prisma/client";

export default async function KraPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  if (user.role === "ADMIN") {
    requireAdminWorkspace(user, workspace);
  }

  const employeeScope = workspace.dataScope
    ? employeeMasterWhereForPlant(user.organizationId, workspace.dataScope)
    : { organizationId: user.organizationId };

  const [kpis, sheets, employeesByDepartmentRaw, company] = await Promise.all([
    db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, workspace.dataScope, {}),
      include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
      orderBy: [{ kpiLevel: "asc" }, { weightage: "desc" }],
    }),
    fetchKraSheets(user.organizationId),
    fetchKraEmployeesByDepartment(user.organizationId, employeeScope),
    getCompanyContext(user.organizationId),
  ]);

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
      canEditTargets={isAdmin || user.role === "MANAGER"}
      canEditAchieved={isEmployee}
      plantUnit={workspace.plantUnitKey ?? "Bony Polymers"}
      unitName={workspace.unit?.name}
    />
  );
}
