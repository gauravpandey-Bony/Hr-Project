import {
  formatKpiValue,
  kraWeightedProgress,
  kraWeightedStatus,
  kpiProgressForKra,
  kpiStatusForKra,
  type KpiStatus,
} from "@/lib/kpi";
import { weightagePercent } from "@/lib/kra/weightage";
import {
  evaluateKpiCurrent,
  isPlaceholderAchieved,
  latestEntryValueForFiscalQuarter,
  parseQuarterNumber,
  parseQuarterTarget,
  parseQuarterTargets,
  type FiscalQuarter,
} from "@/lib/kpi-quarters";
import { normalizeQuarterTargets } from "@/lib/kra/target-format";
import type { QuarterFilter } from "@/lib/ai/employee-quarter-filter";
import type { Kpi, KpiEntry } from "@prisma/client";

export type KpiWithEntries = Kpi & { entries: KpiEntry[] };

export type FilteredKpiView = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current: number;
  target: number;
  progress: number;
  status: KpiStatus;
  kraName: string | null;
  department: string | null;
  currentLabel: string;
  targetLabel: string;
};

function isQuarterFilter(filter: QuarterFilter): filter is FiscalQuarter {
  return filter === "q1" || filter === "q2" || filter === "q3" || filter === "q4";
}

export function evaluateKpiForFilter(
  kpi: KpiWithEntries,
  filter: QuarterFilter
): FilteredKpiView {
  if (filter === "annual" || filter === "all") {
    const { current, progressNum, status } = evaluateKpiCurrent(kpi);
    return {
      id: kpi.id,
      name: kpi.name,
      category: kpi.category,
      unit: kpi.unit,
      current,
      target: kpi.targetValue,
      progress: progressNum,
      status,
      kraName: kpi.kraName,
      department: kpi.department,
      currentLabel: formatKpiValue(current, kpi.unit),
      targetLabel: formatKpiValue(kpi.targetValue, kpi.unit),
    };
  }

  const raw = parseQuarterTargets(kpi.quarterTargets) ?? {
    q1: { target: "", achieved: "" },
    q2: { target: "", achieved: "" },
    q3: { target: "", achieved: "" },
    q4: { target: "", achieved: "" },
  };
  const quarters = normalizeQuarterTargets(raw, kpi.unit);
  const cell = quarters[filter];
  let achieved = parseQuarterNumber(
    isPlaceholderAchieved(cell.achieved) ? undefined : cell.achieved
  );
  let fromEntryFallback = false;

  if (achieved === null && isQuarterFilter(filter)) {
    const fromEntry = latestEntryValueForFiscalQuarter(kpi.entries, filter);
    if (fromEntry !== null) {
      achieved = fromEntry;
      fromEntryFallback = true;
    }
  }

  if (achieved === null) {
    return {
      id: kpi.id,
      name: kpi.name,
      category: kpi.category,
      unit: kpi.unit,
      current: 0,
      target: kpi.targetValue,
      progress: 0,
      status: "red",
      kraName: kpi.kraName,
      department: kpi.department,
      currentLabel: cell.achieved === "—" ? "—" : cell.achieved || "—",
      targetLabel: cell.target?.trim() || "—",
    };
  }

  const quarterTarget = parseQuarterTarget(cell.target) ?? kpi.targetValue;
  const useWeighted =
    !fromEntryFallback && kpi.weightage != null && kpi.weightage > 0;

  const progressNum = useWeighted
    ? kraWeightedProgress(achieved, kpi.weightage)
    : kpiProgressForKra(
        achieved,
        fromEntryFallback ? null : kpi.weightage,
        quarterTarget,
        kpi.direction
      );
  const status = useWeighted
    ? kraWeightedStatus(achieved, kpi.weightage)
    : kpiStatusForKra(
        achieved,
        fromEntryFallback ? null : kpi.weightage,
        quarterTarget,
        kpi.direction
      );

  return {
    id: kpi.id,
    name: kpi.name,
    category: kpi.category,
    unit: kpi.unit,
    current: achieved,
    target: quarterTarget,
    progress: progressNum,
    status,
    kraName: kpi.kraName,
    department: kpi.department,
    currentLabel: fromEntryFallback
      ? formatKpiValue(achieved, kpi.unit)
      : kpi.weightage != null && kpi.weightage > 0
        ? `${achieved.toFixed(achieved % 1 ? 2 : 0)} / ${weightagePercent(kpi.weightage)?.toFixed(0) ?? "—"}`
        : formatKpiValue(achieved, kpi.unit),
    targetLabel:
      cell.target?.trim() || formatKpiValue(quarterTarget, kpi.unit) || "—",
  };
}

export function buildFilteredDashboardItems(
  kpis: KpiWithEntries[],
  filter: QuarterFilter
): FilteredKpiView[] {
  return kpis.map((k) => evaluateKpiForFilter(k, filter));
}
