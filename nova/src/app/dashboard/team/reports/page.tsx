import { redirect } from "next/navigation";
import { employeeDashboardRedirect } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { getManagedEmployees, displayTeamForUser } from "@/lib/team-scope";
import { buildTeamReports } from "@/lib/team-reports";
import { TeamReportsClient } from "@/components/team/team-reports-client";

export default async function TeamReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "EMPLOYEE") redirect(employeeDashboardRedirect(user.id));

  const team = displayTeamForUser(user, await getManagedEmployees(user));

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

  const bundle = await buildTeamReports(user.organizationId, team);

  return (
    <TeamReportsClient
      department={user.department ?? "Team"}
      bundle={bundle}
      canEdit={user.role === "ADMIN" || user.role === "MANAGER"}
    />
  );
}
