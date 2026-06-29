import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { departmentMasterWhereForPlant } from "@/lib/unit-workspace";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { EmployeeProfileClient } from "@/components/masters/employee-profile-client";
import {
  fetchEmployeeProfile,
  formatCtc,
  formatIncrementPercent,
  formatProfileDoj,
} from "@/lib/employee-profile.server";

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === "EMPLOYEE") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  if (user.role === "ADMIN") {
    requireAdminWorkspace(user, workspace);
  }

  const profile = await fetchEmployeeProfile(user.organizationId, id);
  if (!profile) notFound();

  const departments = await db.departmentMaster.findMany({
    where: workspace.dataScope
      ? departmentMasterWhereForPlant(user.organizationId, workspace.dataScope)
      : { organizationId: user.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <EmployeeProfileClient
      employee={profile.employee}
      departments={departments}
      kpis={profile.kpis}
      linkedUser={profile.linkedUser}
      isAdmin={user.role === "ADMIN"}
      unitId={workspace.unitId}
      dojLabel={formatProfileDoj(profile.employee.doj)}
      incrementLabel={formatIncrementPercent(profile.employee.lastIncrementPercent)}
      ctcLabel={formatCtc(profile.employee.lastCtc)}
    />
  );
}
