import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace, requireAdminWorkspace } from "@/lib/unit-workspace.server";
import { KpiSummaryRow } from "@/components/kpi/kpi-card";
import { KpiToolbar } from "@/components/kpi/kpi-toolbar";
import { KpiLibraryHero } from "@/components/kpi/kpi-library-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { StickyTableShell } from "@/components/ui/sticky-table-shell";
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    where: mergeKpiWhereForWorkspace(user, workspace.dataScope, {
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
      />

      {kpis.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No KPIs yet"
          description="Use Add a KPI, Generate KPIs, or Upload a Spreadsheet to get started."
        />
      ) : (
        <StickyTableShell>
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
              <TableRow className="hover:bg-transparent border-b border-border/80">
                <TableHead className="pl-5">KPI</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-28 pr-5 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((kpi) => (
                <KpiSummaryRow
                  key={kpi.id}
                  kpi={{ ...kpi, entries: kpi.entries }}
                />
              ))}
            </TableBody>
          </table>
        </StickyTableShell>
      )}
    </div>
  );
}
