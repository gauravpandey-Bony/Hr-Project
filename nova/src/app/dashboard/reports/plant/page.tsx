import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace, requireAdminWorkspace } from "@/lib/unit-workspace.server";
import { fetchOrgStructure } from "@/lib/org-units.server";
import { plantDataScope } from "@/lib/unit-workspace";
import { aliasesForUnit } from "@/lib/org-units";
import {
  buildPlantPerformanceReport,
  buildPlantScorecardBrief,
} from "@/lib/kra/plant-performance-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { PlantPerformanceReportClient } from "@/components/reports/plant-performance-report-client";
import { appendUnitQuery } from "@/lib/unit-workspace";
import { Factory, ArrowLeft } from "lucide-react";

const QUARTERS: FiscalQuarter[] = ["q1", "q2", "q3", "q4"];

const KPI_SELECT = {
  id: true,
  name: true,
  kraName: true,
  ownerName: true,
  department: true,
  weightage: true,
  quarterTargets: true,
  kpiLevel: true,
  category: true,
  unit: true,
} as const;

export default async function PlantPerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; quarter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId, quarter: quarterParam } = await searchParams;
  const quarter = (QUARTERS.includes(quarterParam as FiscalQuarter)
    ? quarterParam
    : "q1") as FiscalQuarter;

  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const plantName = workspace.unit?.name ?? "All plants";

  let reportsByQuarter: Record<FiscalQuarter, ReturnType<typeof buildPlantPerformanceReport> | null> = {
    q1: null,
    q2: null,
    q3: null,
    q4: null,
  };

  let allPlants: ReturnType<typeof buildPlantScorecardBrief>[] = [];

  if (workspace.dataScope && workspace.unitId) {
    const kpis = await db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, workspace.dataScope, { isActive: true }),
      select: KPI_SELECT,
    });

    reportsByQuarter = Object.fromEntries(
      QUARTERS.map((q) => [q, buildPlantPerformanceReport(kpis, q, plantName)])
    ) as typeof reportsByQuarter;
  } else if (user.role === "ADMIN") {
    const { allUnits } = await fetchOrgStructure(user.organizationId);
    const activeUnits = allUnits.filter((u) => u.plantUnitKey);

    allPlants = await Promise.all(
      activeUnits.map(async (unit) => {
        const { locationAliases, kpiPlantAliases } = aliasesForUnit(unit);
        const scope = plantDataScope(unit.plantUnitKey, locationAliases, kpiPlantAliases);
        const kpis = await db.kpi.findMany({
          where: mergeKpiWhereForWorkspace(user, scope, { isActive: true }),
          select: KPI_SELECT,
        });
        return buildPlantScorecardBrief(unit.id, unit.name, kpis, quarter);
      })
    );
  }

  const backHref = workspace.unitId
    ? appendUnitQuery("/dashboard/reports", workspace.unitId)
    : "/dashboard/reports";

  return (
    <div className="reports-grid-bg space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-10 text-white shadow-2xl sm:px-8">
        <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
        <Link
          href={backHref}
          className="relative mb-4 inline-flex items-center gap-1.5 text-sm text-indigo-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Reports
        </Link>
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs">
              <Factory className="h-3.5 w-3.5" />
              Plant performance scorecard
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{plantName}</h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              Section 1 (top): employee KRA/KPI achievement with weightage formula.
              Section 2 (bottom): plant sales & operational KPIs. Every score shows its calculation basis.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading scorecard…</p>}>
        <PlantPerformanceReportClient
          reportsByQuarter={reportsByQuarter}
          allPlants={allPlants}
          unitId={workspace.unitId}
          initialQuarter={quarter}
        />
      </Suspense>
    </div>
  );
}
