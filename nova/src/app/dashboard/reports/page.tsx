import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { appendUnitQueryForAdmin } from "@/lib/admin-unit";
import { resolveWorkspace, requireAdminWorkspace } from "@/lib/unit-workspace.server";
import { COMPANY, KPI_CATEGORIES } from "@/lib/company";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { BarChart3, Download, Sparkles } from "lucide-react";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const kpis = await db.kpi.findMany({
    where: mergeKpiWhereForWorkspace(user, workspace.dataScope),
    include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
  });

  const items = kpis.map((k) => {
    const { current, progressNum: progress, status } = evaluateKpiCurrent(k);
    return {
      id: k.id,
      name: k.name,
      category: k.category,
      unit: k.unit,
      current,
      target: k.targetValue,
      progress,
      status,
      kraName: k.kraName,
      department: k.department,
    };
  });

  const onTrack = items.filter((k) => k.status === "green").length;
  const offTarget = items.filter((k) => k.status === "red").length;
  const avgProgress =
    items.length > 0
      ? Math.round(items.reduce((s, k) => s + k.progress, 0) / items.length)
      : 0;

  const categoriesWithData = KPI_CATEGORIES.filter((cat) =>
    items.some((k) => k.category === cat)
  ).length;

  const topPerformers = [...items].sort((a, b) => b.progress - a.progress).slice(0, 5);

  const unitQuery = workspace.unitId ? `?unit=${encodeURIComponent(workspace.unitId)}` : "";

  return (
    <div className="reports-grid-bg space-y-8 pb-10">
      <div
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-8 py-12 text-white shadow-2xl animate-fade-up"
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-emerald-100">Performance intelligence</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">KPI Reports</h1>
            <p className="mt-3 text-lg text-slate-300/90 text-balance">
              League tables for{" "}
              <span className="font-medium text-white">
                {workspace.unit?.name ?? COMPANY.shortName}
              </span>{" "}
              — click any section for KPI details.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard/ai${unitQuery}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-indigo-500"
            >
              <Sparkles className="h-4 w-4" />
              AI insights
            </Link>
            <Link
              href={workspace.unitId ? appendUnitQueryForAdmin("/dashboard/kpis", workspace.unitId) : "/dashboard/kpis"}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur-md transition hover:bg-white/20"
            >
              <Download className="h-4 w-4" />
              KPI library
            </Link>
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <ReportsPageClient
          items={items}
          onTrack={onTrack}
          offTarget={offTarget}
          avgProgress={avgProgress}
          categoriesWithData={categoriesWithData}
          topPerformers={topPerformers}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white py-20 text-center shadow-inner">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <BarChart3 className="h-8 w-8 text-slate-400" />
          </div>
          <p className="mt-5 text-lg font-medium text-slate-700">No KPI data yet</p>
          <Link
            href={workspace.unitId ? appendUnitQueryForAdmin("/dashboard/kpis/create", workspace.unitId) : "/dashboard/kpis/create"}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
          >
            Create your first KPI
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        Report generated {new Date().toLocaleString("en-IN")} · {COMPANY.name}
      </p>
    </div>
  );
}
