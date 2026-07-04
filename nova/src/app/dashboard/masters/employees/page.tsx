import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { employeeMasterWhereForUser } from "@/lib/access-control";
import {
  departmentMasterWhereForPlant,
  employeeMasterWhereForPlant,
} from "@/lib/unit-workspace";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { EmployeeMasterClient } from "@/components/masters/employee-master-client";
import { dedupeEmployeeMasterRows } from "@/lib/employee-master-grouping";
import { filterRealKraEmployees } from "@/lib/masters/logistics-kra-junk";
import { sanitizeKraDesignation } from "@/lib/masters/kra-workbook";

export default async function EmployeeMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const employeeWhere =
    user.role === "ADMIN" && workspace.dataScope
      ? employeeMasterWhereForPlant(user.organizationId, workspace.dataScope)
      : employeeMasterWhereForUser(user);

  const [employees, departments] = await Promise.all([
    db.employeeMaster.findMany({
      where: { ...employeeWhere, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.departmentMaster.findMany({
      where: workspace.dataScope
        ? departmentMasterWhereForPlant(user.organizationId, workspace.dataScope)
        : { organizationId: user.organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const rows = dedupeEmployeeMasterRows(filterRealKraEmployees(employees)).map(
    (e) => ({
      ...e,
      designation: sanitizeKraDesignation(e.designation) ?? null,
    })
  );

  return (
    <EmployeeMasterClient
      initialRows={rows}
      departments={departments}
      isAdmin={user.role === "ADMIN"}
      unitId={workspace.unitId}
    />
  );
}
