"use client";

import { TrendingUp, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HealthDonut } from "@/components/reports/health-donut";
import type { DepartmentDashboardData } from "@/lib/ai/department-report";

const TONE_CARD: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/40",
  amber: "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/40",
  red: "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/40",
  neutral: "border-border bg-card",
};

function ProgressBar({
  label,
  progress,
  status,
  compact,
}: {
  label: string;
  progress: number;
  status: string;
  compact?: boolean;
}) {
  const barColor =
    status === "green" ? "bg-emerald-500" : status === "amber" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={cn("space-y-1.5", compact && "py-0.5")}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("font-medium text-foreground", compact ? "text-sm leading-snug" : "text-base")}>
          {label}
        </p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{progress}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

export function DepartmentDashboardBlock({ data }: { data: DepartmentDashboardData }) {
  const total = data.statusSegments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="w-full min-w-0 space-y-4 rounded-xl border border-violet-200/80 bg-gradient-to-b from-card to-muted/30 p-4 shadow-sm dark:border-violet-800/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{data.department}</h3>
            <p className="text-sm text-muted-foreground">{data.headline}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {data.stats.map((s) => (
          <div
            key={s.label}
            className={cn("rounded-lg border px-3 py-3 shadow-sm", TONE_CARD[s.tone])}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{s.value}</p>
            {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Health mix</p>
          {total > 0 ? (
            <HealthDonut
              segments={data.statusSegments}
              total={total}
              centerLabel="KPIs"
              className="justify-center"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No status data</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">By category (avg progress)</p>
          {data.categoryBars.length ? (
            <div className="space-y-3">
              {data.categoryBars.map((c) => (
                <ProgressBar
                  key={c.label}
                  label={c.label}
                  progress={c.progress}
                  status={c.progress >= 20 ? "green" : "red"}
                  compact
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4" />
          KPI progress
        </p>
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {data.kpiBars.map((k) => (
            <ProgressBar key={k.name} label={k.name} progress={k.progress} status={k.status} compact />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.concerns.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              Needs attention
            </p>
            <ul className="space-y-2">
              {data.concerns.map((k) => (
                <li
                  key={k.name}
                  className="rounded-lg border border-red-100 bg-card px-3 py-2.5 text-sm dark:border-red-900/40"
                >
                  <p className="font-medium text-foreground">{k.name}</p>
                  <p className="text-muted-foreground">
                    {k.actual} → target {k.target} · {k.progress}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.highlights.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              On track
            </p>
            <ul className="space-y-2">
              {data.highlights.map((k) => (
                <li
                  key={k.name}
                  className="rounded-lg border border-emerald-100 bg-card px-3 py-2.5 text-sm dark:border-emerald-900/40"
                >
                  <p className="font-medium text-foreground">{k.name}</p>
                  <p className="text-muted-foreground">
                    {k.actual} / {k.target} · {k.progress}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
