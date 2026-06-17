import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { employeeDashboardRedirect, mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import {
  employeeMasterWhereForPlant,
} from "@/lib/unit-workspace";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeeReportPicker } from "@/components/reports/employee-report-picker";

export default async function EmployeeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "EMPLOYEE") redirect(employeeDashboardRedirect(user.id));
  if (user.role === "MANAGER") redirect("/dashboard/team/reports");

  const { q, unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const employeeWhere = workspace.dataScope
    ? employeeMasterWhereForPlant(user.organizationId, workspace.dataScope)
    : { organizationId: user.organizationId, isActive: true };

  const [masterRows, kpiOwners] = await Promise.all([
    db.employeeMaster.findMany({
      where: { ...employeeWhere, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        ecn: true,
        department: true,
        designation: true,
      },
    }),
    db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, workspace.dataScope, {
        ownerName: { not: null },
      }),
      select: { ownerName: true, department: true },
      distinct: ["ownerName"],
    }),
  ]);

  const seen = new Set(masterRows.map((e) => e.name.toLowerCase()));
  const extraFromKpis = kpiOwners
    .filter((k) => k.ownerName && !seen.has(k.ownerName.toLowerCase()))
    .map((k) => ({
      id: `kpi-owner:${k.ownerName}`,
      name: k.ownerName!,
      ecn: null as string | null,
      department: k.department,
      designation: null as string | null,
    }));

  const employees = [...masterRows, ...extraFromKpis].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="reports-grid-bg space-y-6 pb-10">
      <PageHeader
        title="Employee Performance Report"
        description={
          workspace.unit
            ? `Annual & quarterly KPI breakdown for ${workspace.unit.name}`
            : "Annual & quarterly KPI breakdown · Q1 through Q4 for every employee"
        }
      />
      <EmployeeReportPicker
        employees={employees}
        initialQuery={q}
        plantUnit={workspace.dataScope ?? undefined}
        unitId={workspace.unitId ?? undefined}
      />
    </div>
  );
}
