import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace, requireAdminWorkspace } from "@/lib/unit-workspace.server";
import { UpdateKpiForm } from "@/components/kpi/update-kpi-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PenLine } from "lucide-react";

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ kpi?: string; unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { kpi: preselectKpi, unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const kpis = await db.kpi.findMany({
    where: mergeKpiWhereForWorkspace(user, workspace.dataScope),
    select: { id: true, name: true, unit: true, category: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspace.unit ? `Update KPI Data — ${workspace.unit.name}` : "Update KPI Data"}
        description={
          workspace.unit
            ? `Log figures for ${workspace.unit.name}. Only KPIs in this unit workspace are listed.`
            : "Enter the latest figure — replaces spreadsheets with one simple form."
        }
      />
      {kpis.length > 0 ? (
        <UpdateKpiForm kpis={kpis} defaultKpiId={preselectKpi} />
      ) : (
        <EmptyState
          icon={PenLine}
          title={workspace.unit ? `No KPIs in ${workspace.unit.name} yet` : "No KPIs available"}
          description={
            workspace.unit
              ? "Add KPIs from the unit dashboard first, then return here to enter data."
              : "Ask your admin to create KPIs before logging data."
          }
        />
      )}
    </div>
  );
}
