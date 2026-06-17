import Link from "next/link";
import { ProgressBar } from "./progress-bar";
import { RankBadge } from "./rank-badge";
import { StatusPill } from "@/components/kpi/kpi-card";
import { formatKpiValue, type KpiStatus } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

type RankedKpi = {
  id: string;
  name: string;
  unit: string;
  current: number;
  target: number;
  progress: number;
  status: KpiStatus;
};

const categoryTheme: Record<
  string,
  { gradient: string; icon: string; border: string; bg: string }
> = {
  Production: {
    gradient: "from-emerald-600 to-teal-500",
    icon: "🏭",
    border: "border-emerald-200",
    bg: "bg-emerald-50/50",
  },
  Quality: {
    gradient: "from-blue-600 to-indigo-500",
    icon: "✓",
    border: "border-blue-200",
    bg: "bg-blue-50/50",
  },
  Sales: {
    gradient: "from-violet-600 to-purple-500",
    icon: "📦",
    border: "border-violet-200",
    bg: "bg-violet-50/50",
  },
  Maintenance: {
    gradient: "from-orange-600 to-amber-500",
    icon: "🔧",
    border: "border-orange-200",
    bg: "bg-orange-50/50",
  },
  Safety: {
    gradient: "from-rose-600 to-pink-500",
    icon: "🛡️",
    border: "border-rose-200",
    bg: "bg-rose-50/50",
  },
  Finance: {
    gradient: "from-amber-600 to-yellow-500",
    icon: "₹",
    border: "border-amber-200",
    bg: "bg-amber-50/50",
  },
};

const defaultTheme = {
  gradient: "from-slate-600 to-slate-500",
  icon: "📊",
  border: "border-slate-200",
  bg: "bg-slate-50",
};

export function CategoryReportCard({
  category,
  ranked,
  onHeaderClick,
}: {
  category: string;
  ranked: RankedKpi[];
  onHeaderClick?: () => void;
}) {
  const theme = categoryTheme[category] ?? defaultTheme;
  const green = ranked.filter((r) => r.status === "green").length;
  const red = ranked.filter((r) => r.status === "red").length;
  const avgProgress =
    ranked.length > 0
      ? Math.round(ranked.reduce((s, r) => s + r.progress, 0) / ranked.length)
      : 0;

  const top3 = ranked.slice(0, 3);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-lg",
        theme.border
      )}
    >
      <div className={cn("bg-gradient-to-r px-6 py-5 text-white", theme.gradient)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {onHeaderClick ? (
            <button
              type="button"
              onClick={onHeaderClick}
              className="flex items-center gap-3 rounded-xl text-left transition hover:bg-white/10 px-1 -mx-1"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl backdrop-blur">
                {theme.icon}
              </span>
              <div className="min-w-0 text-left">
                <h2 className="text-xl font-bold">{category}</h2>
                <p className="text-sm text-white/80">
                  {ranked.length} KPIs · click for details →
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl backdrop-blur">
                {theme.icon}
              </span>
              <div className="text-left">
                <h2 className="text-xl font-bold">{category}</h2>
                <p className="text-sm text-white/80">{ranked.length} KPIs tracked</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <div className="text-left">
              <p className="text-2xl font-bold leading-none">{avgProgress}%</p>
              <p className="mt-1 text-xs text-white/70">Avg progress</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-medium">
                {green} on track
              </span>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs">
                {red} off target
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/20">
          {ranked.length > 0 && (
            <>
              <div
                className="bg-emerald-300 transition-all"
                style={{ width: `${(green / ranked.length) * 100}%` }}
              />
              <div
                className="bg-rose-300 transition-all"
                style={{ width: `${(red / ranked.length) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {top3.length > 0 && (
        <div className={cn("grid gap-3 border-b p-5 sm:grid-cols-3 items-end", theme.bg)}>
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((item, displayIdx) => {
            const i = item === top3[0] ? 0 : item === top3[1] ? 1 : 2;
            return (
            <Link
              key={item.id}
              href={`/dashboard/kpis/${item.id}`}
              className={cn(
                "relative block rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                i === 0 && "ring-2 ring-amber-300/80 shadow-amber-100 sm:pb-6",
                displayIdx === 1 && "sm:-mt-2"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <RankBadge rank={i + 1} />
                <StatusPill status={item.status} />
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</p>
              <p className="mt-2 text-lg font-bold text-slate-800">
                {formatKpiValue(item.current, item.unit)}
              </p>
              <p className="text-xs text-slate-500">
                Target {formatKpiValue(item.target, item.unit)} · {item.progress}%
              </p>
              <ProgressBar value={item.progress} status={item.status} className="mt-3" />
            </Link>
          );
          })}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {ranked.map((item, i) => (
          <Link
            key={item.id}
            href={`/dashboard/kpis/${item.id}`}
            className="group flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-nowrap"
          >
            <RankBadge rank={i + 1} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 group-hover:text-emerald-700">
                {item.name}
              </p>
              <div className="mt-2 max-w-md">
                <ProgressBar value={item.progress} status={item.status} />
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <p className="font-semibold text-slate-900">
                  {formatKpiValue(item.current, item.unit)}
                </p>
                <p className="text-xs text-slate-400">Actual</p>
              </div>
              <div className="text-right">
                <p className="text-slate-600">{formatKpiValue(item.target, item.unit)}</p>
                <p className="text-xs text-slate-400">Target</p>
              </div>
              <div className="flex w-16 flex-col items-end gap-1">
                <span className="text-lg font-bold text-slate-800">{item.progress}%</span>
                {item.progress >= 20 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                )}
              </div>
              <StatusPill status={item.status} />
              <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 transition group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
