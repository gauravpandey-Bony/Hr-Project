import Link from "next/link";
import { KpiGauge } from "./kpi-gauge";
import { TrendSparkline } from "./trend-sparkline";
import { CategoryBadge } from "./category-badge";
import {
  entryTimestamp,
  formatKpiValue,
  formatKpiValueParts,
  type KpiStatus,
} from "@/lib/kpi";
import type { QuarterFilter } from "@/lib/ai/employee-quarter-filter";
import { evaluateKpiForFilter } from "@/lib/kpi-dashboard-filter";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import type { Kpi, KpiEntry } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpRight, Plus } from "lucide-react";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

const statusAccent: Record<KpiStatus, string> = {
  green: "hover:border-emerald-300/80 hover:shadow-emerald-100/50",
  amber: "hover:border-amber-300/80 hover:shadow-amber-100/50",
  red: "hover:border-rose-300/80 hover:shadow-rose-100/50",
};

const statusStripe: Record<KpiStatus, string> = {
  green: "from-emerald-400 to-teal-400",
  amber: "from-amber-400 to-orange-400",
  red: "from-rose-400 to-pink-400",
};

export function KpiCard({
  kpi,
  compact = false,
  filter = "annual",
}: {
  kpi: KpiWithEntries;
  compact?: boolean;
  filter?: QuarterFilter;
}) {
  const view =
    filter === "annual" || filter === "all"
      ? (() => {
          const { current, progressNum, status } = evaluateKpiCurrent(kpi);
          return {
            current,
            progress: progressNum,
            status,
            currentLabel: formatKpiValue(current, kpi.unit),
            targetLabel: formatKpiValue(kpi.targetValue, kpi.unit),
          };
        })()
      : (() => {
          const m = evaluateKpiForFilter(kpi, filter);
          return {
            current: m.current,
            progress: m.progress,
            status: m.status,
            currentLabel: m.currentLabel,
            targetLabel: m.targetLabel,
          };
        })();
  const { progress, status, currentLabel, targetLabel } = view;

  const trendPoints = [...kpi.entries]
    .sort((a, b) => entryTimestamp(a.recordedAt) - entryTimestamp(b.recordedAt))
    .slice(-6)
    .map((e) => ({
      label: new Date(e.recordedAt).toLocaleDateString("en-IN", { month: "short" }),
      value: e.value,
    }));

  if (compact) {
    return (
      <Link href={`/dashboard/kpis/${kpi.id}`} className="group block flex-1">
        <article
          className={cn(
            "relative flex h-full flex-col overflow-hidden rounded-xl border border-white/70 bg-card p-3.5 card-raised card-raised-interactive transition-all duration-300",
            statusAccent[status]
          )}
        >
          <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", statusStripe[status])} />

          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                {kpi.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  {currentLabel}
                </span>
                <span className="text-[11px] text-slate-400">/ {targetLabel}</span>
              </div>
            </div>
            <KpiGauge progress={progress} status={status} size={64} />
          </div>

          {trendPoints.length >= 2 && (
            <div className="mt-3 rounded-lg border border-slate-100/80 bg-white px-2 py-2">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                6-mo trend
              </p>
              <TrendSparkline points={trendPoints} status={status} />
            </div>
          )}

          <div className="mt-auto flex items-center justify-between pt-2.5">
            <StatusPill status={status} />
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100 group-hover:text-emerald-600">
              Details <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/dashboard/kpis/${kpi.id}`} className="group block">
      <article
        className={cn(
          "relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
          statusAccent[status]
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", statusStripe[status])} />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {kpi.category}
            </p>
            <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900 group-hover:text-emerald-800">
              {kpi.name}
            </h3>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {currentLabel}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Target {targetLabel}
            </p>
          </div>
          <KpiGauge progress={progress} status={status} size={88} />
        </div>

        {trendPoints.length >= 2 && (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              6-month trend
            </p>
            <TrendSparkline points={trendPoints} status={status} />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <StatusPill status={status} />
          <span className="flex items-center gap-0.5 text-xs font-medium text-slate-400 opacity-0 transition group-hover:opacity-100 group-hover:text-emerald-600">
            View details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: KpiStatus;
  className?: string;
}) {
  const labels = { green: "On track", amber: "At risk", red: "Off target" };
  const dots = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
  };
  const styles = {
    green:
      "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
    amber:
      "bg-amber-500/12 text-amber-800 ring-amber-500/20 dark:text-amber-300",
    red: "bg-rose-500/12 text-rose-700 ring-rose-500/20 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        styles[status],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dots[status])} />
      {labels[status]}
    </span>
  );
}

const rowStatusBorder: Record<KpiStatus, string> = {
  green: "border-l-emerald-500/90",
  amber: "border-l-amber-500/90",
  red: "border-l-rose-500/90",
};

const rowStatusHover: Record<KpiStatus, string> = {
  green: "hover:bg-emerald-500/[0.045] hover:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]",
  amber: "hover:bg-amber-500/[0.045] hover:shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]",
  red: "hover:bg-rose-500/[0.045] hover:shadow-[inset_0_0_0_1px_rgba(244,63,94,0.08)]",
};

const progressBarFill: Record<KpiStatus, string> = {
  green: "from-emerald-500 to-teal-400",
  amber: "from-amber-500 to-orange-400",
  red: "from-rose-500 to-pink-500",
};

const progressBarTrack: Record<KpiStatus, string> = {
  green: "group-hover:bg-emerald-500/10 group-hover:ring-emerald-500/20",
  amber: "group-hover:bg-amber-500/10 group-hover:ring-amber-500/20",
  red: "group-hover:bg-rose-500/10 group-hover:ring-rose-500/20",
};

const progressTextColor: Record<KpiStatus, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-rose-600 dark:text-rose-400",
};

const actualValueColor: Record<KpiStatus, string> = {
  green: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  red: "text-foreground",
};

function KpiMetricValue({
  value,
  unit,
  emphasize = false,
  status,
}: {
  value: number;
  unit: string;
  emphasize?: boolean;
  status?: KpiStatus;
}) {
  const parts = formatKpiValueParts(value, unit);

  return (
    <div
      className={cn(
        "inline-flex items-baseline justify-end gap-1 tabular-nums",
        emphasize && status ? actualValueColor[status] : emphasize ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span className={cn("text-sm", emphasize ? "font-semibold" : "font-normal")}>
        {parts.value}
      </span>
      {parts.unit && (
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/65">
          {parts.unit}
        </span>
      )}
    </div>
  );
}

function DirectionBadge({ direction }: { direction: Kpi["direction"] }) {
  const lower = direction === "LOWER_IS_BETTER";
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-70 transition group-hover:opacity-100",
        lower ? "bg-sky-500/10 text-sky-600" : "bg-emerald-500/10 text-emerald-600"
      )}
      title={lower ? "Lower is better" : "Higher is better"}
    >
      {lower ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
    </span>
  );
}

export function KpiSummaryRow({
  kpi,
}: {
  kpi: Kpi & { entries: KpiEntry[] };
}) {
  const { current, progressNum: progress, status } = evaluateKpiCurrent(kpi);

  const freqLabel =
    kpi.frequency === "DAILY" ? "Daily" : kpi.frequency === "WEEKLY" ? "Weekly" : "Monthly";
  const barWidth = progress > 0 ? Math.min(100, Math.max(progress, 4)) : 0;

  return (
    <TableRow
      className={cn(
        "group border-l-[3px] transition-[background-color,box-shadow] duration-200 even:bg-muted/[0.18]",
        rowStatusBorder[status],
        rowStatusHover[status]
      )}
    >
      <TableCell className="px-4 py-2.5 pl-5">
        <Link
          href={`/dashboard/kpis/${kpi.id}`}
          className="block truncate font-medium text-foreground underline-offset-2 transition group-hover:text-primary group-hover:underline"
        >
          {kpi.name}
        </Link>
        {kpi.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {kpi.description}
          </p>
        )}
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <CategoryBadge category={kpi.category} />
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">{freqLabel}</TableCell>
      <TableCell className="px-3 py-2.5 text-right">
        <KpiMetricValue value={current} unit={kpi.unit} emphasize status={status} />
      </TableCell>
      <TableCell className="px-3 py-2.5 text-right">
        <div className="inline-flex items-center justify-end gap-1.5">
          <KpiMetricValue value={kpi.targetValue} unit={kpi.unit} />
          <DirectionBadge direction={kpi.direction} />
        </div>
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <div
            className={cn(
              "h-2 w-[76px] overflow-hidden rounded-full bg-muted/90 ring-1 ring-border/50 transition-[background-color,box-shadow] duration-200",
              progressBarTrack[status]
            )}
          >
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-500 group-hover:brightness-110",
                progress > 0 ? progressBarFill[status] : "bg-muted-foreground/25"
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span
            className={cn(
              "w-9 text-right text-xs font-semibold tabular-nums transition-colors duration-200",
              progress > 0 ? progressTextColor[status] : "text-muted-foreground/70"
            )}
          >
            {progress}%
          </span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-right">
        <StatusPill status={status} />
      </TableCell>
      <TableCell className="px-3 py-2.5 pr-5 text-right">
        <Link
          href={`/dashboard/track?kpi=${kpi.id}`}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/70 bg-background/90 px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition-all duration-200 hover:border-primary/45 hover:bg-primary/10 hover:text-primary hover:shadow-md group-hover:border-primary/35 group-hover:bg-primary/[0.07] group-hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
          <span className="hidden sm:inline">Add data</span>
        </Link>
      </TableCell>
    </TableRow>
  );
}
