import Link from "next/link";
import { formatKpiValue, type KpiStatus } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import { Crown, Sparkles } from "lucide-react";
import { ProgressBar } from "./progress-bar";
import { RankBadge } from "./rank-badge";

type Performer = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current: number;
  target: number;
  progress: number;
  status: KpiStatus;
};

const podiumHeights = ["sm:mt-6", "sm:mt-0", "sm:mt-10"];

export function TopPerformersSpotlight({
  performers,
  onViewAll,
}: {
  performers: Performer[];
  onViewAll?: () => void;
}) {
  if (performers.length === 0) return null;

  const top3 = performers.slice(0, 3);
  const rest = performers.slice(3, 5);

  return (
    <section className="animate-fade-up overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-white to-violet-50/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100/80 bg-gradient-to-r from-amber-100/40 to-violet-100/30 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200/60">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Top performers</h2>
            <p className="text-xs text-slate-500">Highest progress across all categories</p>
          </div>
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            View all →
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
            <Sparkles className="h-3.5 w-3.5" />
            League leaders
          </span>
        )}
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-3">
        {top3.map((item, i) => (
          <Link
            key={item.id}
            href={`/dashboard/kpis/${item.id}`}
            className={cn(
              "group relative flex flex-col rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
              i === 0 && "border-amber-200 ring-2 ring-amber-100",
              podiumHeights[i]
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <RankBadge rank={i + 1} />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {item.category}
              </span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
              {item.name}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {formatKpiValue(item.current, item.unit)}
            </p>
            <p className="text-xs text-slate-500">
              Target {formatKpiValue(item.target, item.unit)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <ProgressBar value={item.progress} status={item.status} className="flex-1" />
              <span className="text-sm font-bold text-emerald-700">{item.progress}%</span>
            </div>
          </Link>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="border-t border-slate-100 bg-white/60 px-6 py-3">
          <div className="flex flex-wrap gap-4">
            {rest.map((item, i) => (
              <Link
                key={item.id}
                href={`/dashboard/kpis/${item.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white"
              >
                <RankBadge rank={i + 4} />
                <span className="font-medium text-slate-700">{item.name}</span>
                <span className="text-emerald-600 font-semibold">{item.progress}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
