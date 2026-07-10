"use client";

import { useMemo, useState } from "react";
import {
  User,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Target,
  ClipboardList,
  Briefcase,
  Hash,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDepartmentDisplayName } from "@/lib/masters/department-master-sync";
import { HealthDonut } from "@/components/reports/health-donut";
import type { EmployeeDashboardData } from "@/lib/ai/employee-report";
import {
  EMPLOYEE_QUARTER_FILTER_OPTIONS,
  computeFilteredEmployeeView,
  kpiMetricsForFilter,
  quarterFilterLabel,
  sortQuarterlyRowsByStatus,
  type QuarterFilter,
} from "@/lib/ai/employee-quarter-filter";

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

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "green"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
      : s === "amber"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
        : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
  const label = s === "green" ? "On track" : "Off target";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

export function EmployeeDashboardBlock({ data }: { data: EmployeeDashboardData }) {
  const [filter, setFilter] = useState<QuarterFilter>("annual");
  const view = useMemo(() => computeFilteredEmployeeView(data, filter), [data, filter]);
  const total = view.statusSegments.reduce((s, seg) => s + seg.value, 0);
  const avgProgress =
    view.kpiBars.length > 0
      ? Math.round(view.kpiBars.reduce((s, k) => s + k.progress, 0) / view.kpiBars.length)
      : 0;
  const visibleStats = view.stats.filter((s) => s.label !== "Avg progress");
  const { employee } = data;
  const quarterlyRows = useMemo(
    () => sortQuarterlyRowsByStatus(data.quarterlyReport, filter),
    [data.quarterlyReport, filter]
  );
  const initials = employee.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full min-w-0 space-y-4 rounded-xl border border-violet-200/80 bg-gradient-to-b from-card to-muted/30 p-4 shadow-sm dark:border-violet-800/40">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-base font-bold text-white shadow-sm">
            {initials}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
              Employee report
            </p>
            <h3 className="text-lg font-bold text-foreground">{employee.name}</h3>
            <p className="text-sm text-muted-foreground">{data.headline}</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground ring-1 ring-border">
          {employee.role}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Hash, label: "ECN", value: employee.ecn ?? "—" },
          { icon: Briefcase, label: "Department", value: employee.department ? formatDepartmentDisplayName(employee.department) : "—" },
          { icon: User, label: "Designation", value: employee.designation ?? "—" },
          ...(employee.managerName
            ? [{ icon: User, label: "Manager", value: employee.managerName }]
            : []),
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </dt>
            <dd className="mt-1 truncate text-sm font-semibold text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <CalendarRange className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Report period</p>
            <p className="text-sm text-muted-foreground">
              Showing {quarterFilterLabel(filter).toLowerCase()} data
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Select report period">
          {EMPLOYEE_QUARTER_FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            const shortLabel = opt.value === "annual" ? "Annual" : opt.label;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition",
                  active
                    ? "bg-violet-600 text-white shadow-sm"
                    : "border border-border bg-background text-foreground hover:border-violet-400/50"
                )}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleStats.map((s) => (
          <div key={s.label} className={cn("rounded-lg border px-3 py-3 shadow-sm", TONE_CARD[s.tone])}>
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
              segments={view.statusSegments}
              total={total}
              centerValue={`${avgProgress}%`}
              centerLabel="Avg progress"
              className="justify-center"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No KPIs assigned</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4" />
            By category
          </p>
          {view.categoryBars.length ? (
            <div className="space-y-3">
              {view.categoryBars.map((c) => (
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

      {quarterlyRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">KPI details</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">KPI</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Weight</th>
                  <th className="px-3 py-2 font-semibold">Current</th>
                  <th className="px-3 py-2 font-semibold">Target</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quarterlyRows.map((row) => {
                  const metrics = kpiMetricsForFilter(row, filter);
                  return (
                    <tr key={row.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {row.name}
                        {row.kraName && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">KRA · {row.kraName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{row.category}</td>
                      <td className="px-3 py-2.5 text-foreground">{row.weightage}</td>
                      <td className="px-3 py-2.5 text-foreground">{metrics.currentFormatted}</td>
                      <td className="px-3 py-2.5 text-foreground">{metrics.targetFormatted}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={metrics.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4" />
          KPI progress
        </p>
        {data.totalWeight !== "—" && (
          <p className="mb-3 text-sm text-muted-foreground">Total weight {data.totalWeight}</p>
        )}
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {view.kpiBars.map((k) => (
            <ProgressBar key={k.name} label={k.name} progress={k.progress} status={k.status} compact />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {view.concerns.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              Needs attention
            </p>
            <ul className="space-y-2">
              {view.concerns.map((k) => (
                <li
                  key={k.name}
                  className="rounded-lg border border-red-100 bg-card px-3 py-2.5 text-sm dark:border-red-900/40"
                >
                  <p className="font-medium text-foreground">{k.name}</p>
                  <p className="text-muted-foreground">
                    {k.current} → {k.target} · {k.progress}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view.highlights.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              On track
            </p>
            <ul className="space-y-2">
              {view.highlights.map((k) => (
                <li
                  key={k.name}
                  className="rounded-lg border border-emerald-100 bg-card px-3 py-2.5 text-sm dark:border-emerald-900/40"
                >
                  <p className="font-medium text-foreground">{k.name}</p>
                  <p className="text-muted-foreground">
                    {k.current} / {k.target} · {k.progress}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(data.goals.length > 0 || data.reviews.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.goals.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Target className="h-4 w-4" />
                Goals
              </p>
              <ul className="space-y-2">
                {data.goals.map((g) => (
                  <li key={g.title} className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                    <p className="font-medium text-foreground">{g.title}</p>
                    <p className="text-muted-foreground">
                      {g.progress} · {g.status}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.reviews.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4" />
                Reviews
              </p>
              <ul className="space-y-2">
                {data.reviews.map((r, i) => (
                  <li
                    key={`${r.cycle}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{r.cycle}</p>
                      <p className="text-muted-foreground">
                        {r.type} · as {r.role}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
