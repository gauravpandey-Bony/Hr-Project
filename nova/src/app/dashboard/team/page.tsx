import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { employeeDashboardRedirect, mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import { getManagedEmployees, displayTeamForUser } from "@/lib/team-scope";
import { TeamKraClient } from "@/components/team/team-kra-client";

export default async function TeamKraPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === "EMPLOYEE") redirect(employeeDashboardRedirect(user.id));

  const workspace = await resolveWorkspace(user);

  const team = await getManagedEmployees(user);
  if (user.role === "MANAGER" && team.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-lg font-medium text-slate-700">No team members found</p>
        <p className="mt-2 text-sm text-slate-500">
          Add employees for your department in Employee Master.
        </p>
      </div>
    );
  }

  const allKpis = await db.kpi.findMany({
    where: mergeKpiWhereForWorkspace(user, workspace.dataScope),
    include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
    orderBy: [{ weightage: "desc" }, { name: "asc" }],
  });

  const displayTeam = displayTeamForUser(user, team);

  return (
    <TeamKraClient
      managerName={user.name}
      department={user.department ?? "Team"}
      team={displayTeam}
      allKpis={allKpis}
      canEdit={user.role === "ADMIN" || user.role === "MANAGER"}
    />
  );
}
