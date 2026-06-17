import type { EmployeeDashboardData, EmployeeQuarterlyKpiRow } from "@/lib/ai/employee-report";
import {
  formatKpiValue,
  kraWeightedProgress,
  kraWeightedStatus,
  kpiProgressForKra,
  kpiStatusForKra,
  OFF_TARGET_THRESHOLD,
  type KpiStatus,
} from "@/lib/kpi";
import { parseQuarterNumber, parseQuarterTarget } from "@/lib/kpi-quarters";

export type QuarterFilter = "all" | "annual" | "q1" | "q2" | "q3" | "q4";

export const QUARTER_FILTER_OPTIONS: { value: QuarterFilter; label: string }[] = [
  { value: "all", label: "All quarters" },
  { value: "annual", label: "Annual" },
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
];

/** Employee report period boxes — no "All quarters" */
export const EMPLOYEE_QUARTER_FILTER_OPTIONS = QUARTER_FILTER_OPTIONS.filter(
  (o) => o.value !== "all"
);

export function quarterFilterLabel(filter: QuarterFilter): string {
  return QUARTER_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? "Annual";
}

const STATUS_SORT_ORDER: Record<KpiStatus, number> = {
  green: 0,
  amber: 1,
  red: 2,
};

/** On track first, then off target — highest progress within each group */
export function sortQuarterlyRowsByStatus(
  rows: EmployeeQuarterlyKpiRow[],
  filter: QuarterFilter
): EmployeeQuarterlyKpiRow[] {
  return [...rows].sort((a, b) => {
    const ma = kpiMetricsForFilter(a, filter);
    const mb = kpiMetricsForFilter(b, filter);
    const byStatus = STATUS_SORT_ORDER[ma.status] - STATUS_SORT_ORDER[mb.status];
    if (byStatus !== 0) return byStatus;
    return mb.progressNum - ma.progressNum;
  });
}

type KpiMetrics = {
  progressNum: number;
  status: KpiStatus;
  currentFormatted: string;
  targetFormatted: string;
};

export function kpiMetricsForFilter(
  row: EmployeeQuarterlyKpiRow,
  filter: QuarterFilter
): KpiMetrics {
  if (filter === "all" || filter === "annual") {
    const progressNum = parseInt(row.progress, 10) || 0;
    return {
      progressNum,
      status: row.status as KpiStatus,
      currentFormatted: row.currentFormatted,
      targetFormatted: row.annualTarget,
    };
  }

  const cell = row.quarters[filter];
  const achieved = parseQuarterNumber(cell.achieved);

  if (achieved === null) {
    return {
      progressNum: 0,
      status: "red",
      currentFormatted: cell.achieved === "—" ? "—" : cell.achieved,
      targetFormatted:
        cell.target !== "—" ? `${cell.target} ${row.unit}`.trim() : row.annualTarget,
    };
  }

  // Quarter "Achieved" is weighted score (e.g. 9 of 9% weightage), not raw days/hours.
  const progressNum =
    row.weightageNum != null && row.weightageNum > 0
      ? kraWeightedProgress(achieved, row.weightageNum)
      : kpiProgressForKra(achieved, row.weightageNum, row.targetValue, row.direction);
  const status =
    row.weightageNum != null && row.weightageNum > 0
      ? kraWeightedStatus(achieved, row.weightageNum)
      : kpiStatusForKra(achieved, row.weightageNum, row.targetValue, row.direction);

  return {
    progressNum,
    status,
    currentFormatted:
      row.weightageNum != null && row.weightageNum > 0
        ? `${achieved.toFixed(achieved % 1 ? 2 : 0)} / ${(row.weightageNum * 100).toFixed(0)}`
        : formatKpiValue(achieved, row.unit),
    targetFormatted:
      cell.target !== "—" ? cell.target : row.annualTarget,
  };
}

export type FilteredEmployeeView = Pick<
  EmployeeDashboardData,
  "stats" | "statusSegments" | "categoryBars" | "kpiBars" | "highlights" | "concerns"
>;

export function computeFilteredEmployeeView(
  data: EmployeeDashboardData,
  filter: QuarterFilter
): FilteredEmployeeView {
  if (filter === "all") {
    return {
      stats: data.stats,
      statusSegments: data.statusSegments,
      categoryBars: data.categoryBars,
      kpiBars: data.kpiBars,
      highlights: data.highlights,
      concerns: data.concerns,
    };
  }

  const rows = data.quarterlyReport.map((row) => {
    const metrics = kpiMetricsForFilter(row, filter);
    return { row, ...metrics };
  });

  const green = rows.filter((k) => k.status === "green").length;
  const red = rows.filter((k) => k.status === "red").length;
  const avg =
    rows.length > 0
      ? Math.round(rows.reduce((s, k) => s + k.progressNum, 0) / rows.length)
      : 0;

  const byCategory = new Map<string, number[]>();
  for (const k of rows) {
    const cat = k.row.category || "Other";
    const list = byCategory.get(cat) ?? [];
    list.push(k.progressNum);
    byCategory.set(cat, list);
  }

  const categoryBars = Array.from(byCategory.entries())
    .map(([label, vals]) => ({
      label,
      progress: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))
    .sort((a, b) => b.progress - a.progress);

  const kpiBars = [...rows]
    .sort((a, b) => b.progressNum - a.progressNum)
    .map((k) => ({
      name: k.row.name,
      progress: k.progressNum,
      status: k.status,
    }));

  const sorted = [...rows].sort((a, b) => a.progressNum - b.progressNum);

  const toKpiRow = (k: (typeof rows)[number]) => ({
    name: k.row.name,
    category: k.row.category,
    kraName: k.row.kraName,
    current: k.currentFormatted,
    target: k.targetFormatted,
    progress: `${k.progressNum}%`,
    progressNum: k.progressNum,
    status: k.status,
    weightage: k.row.weightageNum,
  });

  return {
    stats: [
      { label: "KPIs owned", value: String(rows.length), tone: "neutral" as const },
      { label: "On track", value: String(green), sub: `≥${OFF_TARGET_THRESHOLD}%`, tone: "green" as const },
      { label: "Off target", value: String(red), sub: `<${OFF_TARGET_THRESHOLD}%`, tone: "red" as const },
      {
        label: "Avg progress",
        value: rows.length ? `${avg}%` : "—",
        tone:
          rows.length === 0
            ? ("neutral" as const)
            : avg >= OFF_TARGET_THRESHOLD
              ? ("green" as const)
              : ("red" as const),
      },
    ],
    statusSegments: [
      { label: "On track", value: green, color: "#10b981" },
      { label: "Off target", value: red, color: "#ef4444" },
    ].filter((s) => s.value > 0),
    categoryBars,
    kpiBars,
    highlights: [...rows]
      .filter((k) => k.status === "green")
      .sort((a, b) => b.progressNum - a.progressNum)
      .slice(0, 5)
      .map(toKpiRow),
    concerns: sorted
      .filter((k) => k.status !== "green")
      .slice(0, 5)
      .map(toKpiRow),
  };
}
