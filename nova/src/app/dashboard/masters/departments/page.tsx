import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { managerDashboardRedirect } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { departmentMasterWhereForPlant, employeeMasterWhereForPlant, kpiWhereForPlantScope } from "@/lib/unit-workspace";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { DepartmentMasterClient } from "@/components/masters/department-master-client";
import {
  departmentsAreEquivalent,
  formatDepartmentDisplayName,
  isArchivedDepartmentName,
  staffedDepartmentNamesFromEmployees,
} from "@/lib/masters/department-master-sync";

export default async function DepartmentMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "MANAGER") redirect(managerDashboardRedirect("/dashboard/masters/departments"));

  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  // Skip heavy reconcile on every navigation — departments load from DB as-is.
  // Reconcile still runs on staff/KRA import and deploy.

  const departments = await db.departmentMaster.findMany({
    where: workspace.dataScope
      ? {
          ...departmentMasterWhereForPlant(user.organizationId, workspace.dataScope),
          isActive: true,
        }
      : { organizationId: user.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const employees = await db.employeeMaster.findMany({
    where: workspace.dataScope
      ? {
          organizationId: user.organizationId,
          isActive: true,
          ...employeeMasterWhereForPlant(user.organizationId, workspace.dataScope),
        }
      : { organizationId: user.organizationId, isActive: true },
    select: { departmentId: true, department: true, name: true },
  });

  const linkedDeptIds = [
    ...new Set(employees.map((emp) => emp.departmentId).filter(Boolean)),
  ] as string[];
  const linkedDepartments =
    linkedDeptIds.length > 0
      ? await db.departmentMaster.findMany({
          where: { organizationId: user.organizationId, id: { in: linkedDeptIds } },
          select: { id: true, name: true },
        })
      : [];
  const deptNameById = new Map(linkedDepartments.map((d) => [d.id, d.name]));

  const { staffedDeptIds, staffedDeptNames } = staffedDepartmentNamesFromEmployees(
    employees,
    deptNameById
  );

  if (workspace.dataScope) {
    const plantKpis = await db.kpi.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...kpiWhereForPlantScope(workspace.dataScope),
      },
      select: { department: true },
    });
    for (const k of plantKpis) {
      const dept = k.department?.trim();
      if (dept) staffedDeptNames.add(formatDepartmentDisplayName(dept));
    }
  }

  const departmentsWithEmployees = departments.filter(
    (d) =>
      !isArchivedDepartmentName(d.name) &&
      (staffedDeptIds.has(d.id) ||
        [...staffedDeptNames].some((name) => departmentsAreEquivalent(name, d.name)))
  );

  return (
    <DepartmentMasterClient
      initialRows={departmentsWithEmployees}
      isAdmin={user.role === "ADMIN"}
      unitId={workspace.unitId}
    />
  );
}
