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
  BadgeCheck,
  Briefcase,
  Hash,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HealthDonut } from "@/components/reports/health-donut";
import {
  EmployeeQuarterlyReport,
  type EmployeeReportEditContext,
} from "@/components/reports/employee-quarterly-report";
import type { EmployeeDashboardData } from "@/lib/ai/employee-report";
import {
  EMPLOYEE_QUARTER_FILTER_OPTIONS,
  computeFilteredEmployeeView,
  quarterFilterLabel,
  type QuarterFilter,
} from "@/lib/ai/employee-quarter-filter";

const STAT_STYLES: Record<string, { ring: string; glow: string; icon: string }> = {
  neutral: { ring: "ring-slate-200/80", glow: "from-slate-50 to-white", icon: "text-slate-500" },
  green: { ring: "ring-emerald-200/80", glow: "from-emerald-50/80 to-white", icon: "text-emerald-600" },
  amber: { ring: "ring-amber-200/80", glow: "from-amber-50/80 to-white", icon: "text-amber-600" },
  red: { ring: "ring-rose-200/80", glow: "from-rose-50/80 to-white", icon: "text-rose-600" },
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
    status === "green" ? "bg-emerald-500" : status === "amber" ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className={cn("space-y-1.5", compact && "py-0.5")}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "font-medium text-foreground",
            compact ? "text-xs leading-snug" : "text-sm"
          )}
        >
          {label}
        </p>
        <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card overflow-hidden backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function EmployeeDashboardBlock({
  data,
  editContext,
}: {
  data: EmployeeDashboardData;
  editContext?: EmployeeReportEditContext;
}) {
  const [filter, setFilter] = useState<QuarterFilter>("annual");
  const view = useMemo(() => computeFilteredEmployeeView(data, filter), [data, filter]);
  const total = view.statusSegments.reduce((s, seg) => s + seg.value, 0);
  const avgProgress =
    view.kpiBars.length > 0
      ? Math.round(view.kpiBars.reduce((s, k) => s + k.progress, 0) / view.kpiBars.length)
      : 0;
  const visibleStats = view.stats.filter((s) => s.label !== "Avg progress");
  const { employee } = data;
  const initials = employee.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-[#0f172a] to-emerald-950 p-6 text-white shadow-elevated ring-1 ring-black/5 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 text-lg font-bold ring-1 ring-white/20 backdrop-blur-sm">
              {initials}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
                Performance Report
              </p>
              <h2 className="mt-0.5 text-2xl font-bold tracking-tight">{employee.name}</h2>
              <p className="mt-1 text-sm text-slate-300">{data.headline}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold ring-1 ring-white/15 backdrop-blur-sm">
            {employee.role}
          </span>
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Hash, label: "ECN", value: employee.ecn ?? "—" },
            { icon: Briefcase, label: "Department", value: employee.department ?? "—" },
            { icon: User, label: "Designation", value: employee.designation ?? "—" },
            ...(employee.managerName
              ? [{ icon: User, label: "Manager", value: employee.managerName }]
              : []),
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm"
            >
              <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-emerald-200/80">
                <item.icon className="h-3 w-3" />
                {item.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Quarter filter — box selector drives stats, charts, and KPI list */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-soft backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <CalendarRange className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Report period</p>
            <p className="text-xs text-muted-foreground">
              Stats and charts update for {quarterFilterLabel(filter).toLowerCase()}
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-5"
          role="group"
          aria-label="Select report period"
        >
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
                  "card-raised-sm px-3 py-3 text-center transition-all duration-200",
                  active
                    ? "card-raised-sm-active bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "card-raised-interactive bg-background/90 ring-1 ring-border/60 hover:ring-primary/25"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    active ? "text-primary-foreground" : "text-foreground"
                  )}
                >
                  {shortLabel}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleStats.map((s) => {
          const style = STAT_STYLES[s.tone] ?? STAT_STYLES.neutral;
          return (
            <div
              key={s.label}
              className={cn(
                "rounded-2xl bg-gradient-to-b p-4 ring-1 shadow-sm",
                style.glow,
                style.ring
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {s.label}
              </p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", style.icon)}>
                {s.value}
              </p>
              {s.sub && <p className="mt-0.5 text-[10px] text-slate-400">{s.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Avg Progress">
          {total > 0 ? (
            <HealthDonut
              segments={view.statusSegments}
              total={total}
              centerValue={`${avgProgress}%`}
              centerLabel="Progress"
              className="justify-center"
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No KPIs assigned</p>
          )}
        </SectionCard>

        <SectionCard title="By Category" icon={BarChart3}>
          {view.categoryBars.length ? (
            <div className="space-y-4">
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
            <p className="py-8 text-center text-sm text-slate-500">—</p>
          )}
        </SectionCard>
      </div>

      {/* Quarterly report — card layout */}
      <div className="surface-card p-5">
        <EmployeeQuarterlyReport
          rows={data.quarterlyReport}
          filter={filter}
          editContext={editContext}
        />
      </div>

      {/* KPI progress list */}
      <SectionCard
        title="KPI Progress Overview"
        icon={TrendingUp}
      >
        {data.totalWeight !== "—" && (
          <p className="-mt-2 mb-4 text-xs text-slate-400">Total weight {data.totalWeight}</p>
        )}
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {view.kpiBars.map((k) => (
            <ProgressBar
              key={k.name}
              label={k.name}
              progress={k.progress}
              status={k.status}
              compact
            />
          ))}
        </div>
      </SectionCard>

      {/* Highlights & concerns */}
      <div className="grid gap-4 sm:grid-cols-2">
        {view.concerns.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-b from-rose-50/60 to-white shadow-sm dark:border-rose-900/50 dark:from-rose-950/40 dark:to-card">
            <div className="flex items-center gap-2 border-b border-rose-100 px-5 py-3.5 dark:border-rose-900/40">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
                Needs Attention
              </h3>
            </div>
            <ul className="space-y-2 p-4">
              {view.concerns.map((k) => (
                <li
                  key={k.name}
                  className="rounded-xl border border-rose-100/80 bg-card px-3.5 py-3 shadow-sm dark:border-rose-900/30"
                >
                  <p className="text-sm font-semibold text-foreground">{k.name}</p>
                  {k.kraName && <p className="mt-0.5 text-xs text-muted-foreground">KRA · {k.kraName}</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {k.current} → {k.target} · <span className="font-semibold text-rose-600">{k.progress}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view.highlights.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-b from-emerald-50/60 to-white shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-card">
            <div className="flex items-center gap-2 border-b border-emerald-100 px-5 py-3.5 dark:border-emerald-900/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                On Track
              </h3>
            </div>
            <ul className="space-y-2 p-4">
              {view.highlights.map((k) => (
                <li
                  key={k.name}
                  className="rounded-xl border border-emerald-100/80 bg-card px-3.5 py-3 shadow-sm dark:border-emerald-900/30"
                >
                  <p className="text-sm font-semibold text-foreground">{k.name}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {k.current} / {k.target} · <span className="font-semibold text-emerald-600">{k.progress}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(data.goals.length > 0 || data.reviews.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.goals.length > 0 && (
            <SectionCard title="Goals" icon={Target}>
              <ul className="space-y-2">
                {data.goals.map((g) => (
                  <li
                    key={g.title}
                    className="rounded-xl border border-border bg-muted/50 px-3.5 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">{g.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.progress} · {g.status}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {data.reviews.length > 0 && (
            <SectionCard title="Reviews" icon={ClipboardList}>
              <ul className="space-y-2">
                {data.reviews.map((r, i) => (
                  <li
                    key={`${r.cycle}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3.5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.cycle}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.type} · as {r.role}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                      <BadgeCheck className="h-3 w-3" />
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
