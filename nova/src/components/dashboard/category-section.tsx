"use client";

import Link from "next/link";
import { KpiCard } from "@/components/kpi/kpi-card";
import { cn } from "@/lib/utils";
import type { QuarterFilter } from "@/lib/ai/employee-quarter-filter";
import { evaluateKpiForFilter } from "@/lib/kpi-dashboard-filter";
import type { Kpi, KpiEntry } from "@prisma/client";
import { ChevronRight } from "lucide-react";

const categoryTheme: Record<
  string,
  { gradient: string; glow: string; icon: string; accent: string }
> = {
  Production: {
    gradient: "from-emerald-600 via-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/20",
    icon: "🏭",
    accent: "text-emerald-600",
  },
  Quality: {
    gradient: "from-blue-600 via-blue-500 to-indigo-500",
    glow: "shadow-blue-500/20",
    icon: "✓",
    accent: "text-blue-600",
  },
  Sales: {
    gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
    glow: "shadow-violet-500/20",
    icon: "📦",
    accent: "text-violet-600",
  },
  Maintenance: {
    gradient: "from-orange-600 via-orange-500 to-amber-500",
    glow: "shadow-orange-500/20",
    icon: "🔧",
    accent: "text-orange-600",
  },
  Safety: {
    gradient: "from-rose-600 via-rose-500 to-pink-500",
    glow: "shadow-rose-500/20",
    icon: "🛡️",
    accent: "text-rose-600",
  },
  Finance: {
    gradient: "from-amber-600 via-amber-500 to-yellow-500",
    glow: "shadow-amber-500/20",
    icon: "₹",
    accent: "text-amber-600",
  },
  Store: {
    gradient: "from-cyan-600 via-teal-500 to-emerald-500",
    glow: "shadow-cyan-500/20",
    icon: "📦",
    accent: "text-cyan-600",
  },
  Billing: {
    gradient: "from-indigo-600 via-blue-500 to-violet-500",
    glow: "shadow-indigo-500/20",
    icon: "🧾",
    accent: "text-indigo-600",
  },
  Process: {
    gradient: "from-slate-600 via-slate-500 to-zinc-500",
    glow: "shadow-slate-500/20",
    icon: "⚙️",
    accent: "text-slate-600",
  },
};

const defaultTheme = {
  gradient: "from-slate-600 to-slate-500",
  glow: "shadow-slate-500/20",
  icon: "📊",
  accent: "text-slate-600",
};

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

export function CategorySection({
  category,
  kpis,
  filter = "annual",
  delay = 0,
}: {
  category: string;
  kpis: KpiWithEntries[];
  filter?: QuarterFilter;
  delay?: number;
}) {
  const theme = categoryTheme[category] ?? defaultTheme;

  const stats = kpis.map((k) => {
    const { progress, status } = evaluateKpiForFilter(k, filter);
    return { progress, status };
  });
  const avgProgress =
    stats.length > 0 ? Math.round(stats.reduce((s, x) => s + x.progress, 0) / stats.length) : 0;
  const onTrack = stats.filter((s) => s.status === "green").length;

  return (
    <section
      className={cn(
        "surface-card card-raised-interactive animate-fade-up flex h-full flex-col overflow-hidden",
        theme.glow
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("relative shrink-0 bg-gradient-to-r px-4 py-3.5 text-white", theme.gradient)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-base backdrop-blur-sm ring-1 ring-white/30">
              {theme.icon}
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight">{category}</h2>
              <p className="text-[11px] text-white/80">
                {kpis.length} KPI · {avgProgress}% avg
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold leading-none">{onTrack}/{kpis.length}</p>
            <p className="text-[10px] text-white/70">on track</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} compact filter={filter} />
        ))}
      </div>

      <Link
        href={`/dashboard/reports`}
        className={cn(
          "flex shrink-0 items-center justify-center gap-1 border-t border-border/60 py-2.5 text-xs font-semibold transition hover:bg-muted/50",
          theme.accent
        )}
      >
        View {category} report
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
