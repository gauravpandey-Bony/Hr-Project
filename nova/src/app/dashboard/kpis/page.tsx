import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace, requireAdminWorkspace } from "@/lib/unit-workspace.server";
import { KpiToolbar } from "@/components/kpi/kpi-toolbar";
import { KpiLibraryHero } from "@/components/kpi/kpi-library-hero";
import { KpiLibraryTable } from "@/components/kpi/kpi-library-table";
import { EmptyState } from "@/components/ui/empty-state";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { Target } from "lucide-react";

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { q, category, unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const kpis = await db.kpi.findMany({
    where: await mergeKpiWhereForWorkspace(user, workspace.dataScope, {
      ...(category && category !== "all" ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
    }),
    include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const stats = kpis.reduce(
    (acc, k) => {
      const { status } = evaluateKpiCurrent(k);
      if (status === "green") acc.onTrack++;
      else acc.offTarget++;
      return acc;
    },
    { onTrack: 0, offTarget: 0 }
  );

  return (
    <div className="library-grid-bg space-y-6 pb-8">
      <KpiLibraryHero
        total={kpis.length}
        onTrack={stats.onTrack}
        offTarget={stats.offTarget}
      />

      <KpiToolbar
        isAdmin={user.role === "ADMIN"}
        currentCategory={category}
        query={q}
        resultCount={kpis.length}
        unitId={workspace.unitId ?? undefined}
        plantUnitKey={workspace.plantUnitKey}
      />

      {kpis.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No KPIs yet"
          description="Use Add a KPI, Generate KPIs, or Upload a Spreadsheet to get started."
        />
      ) : (
        <KpiLibraryTable
          kpis={kpis.map((kpi) => ({ ...kpi, entries: kpi.entries }))}
          query={q}
          category={category}
        />
      )}
    </div>
  );
}
