import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { managerDashboardRedirect } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { departmentMasterWhereForPlant } from "@/lib/unit-workspace";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { DepartmentMasterClient } from "@/components/masters/department-master-client";

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

  const departments = await db.departmentMaster.findMany({
    where: workspace.dataScope
      ? departmentMasterWhereForPlant(user.organizationId, workspace.dataScope)
      : { organizationId: user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { employees: true } } },
  });

  return (
    <DepartmentMasterClient
      initialRows={departments}
      isAdmin={user.role === "ADMIN"}
      unitId={workspace.unitId}
    />
  );
}
