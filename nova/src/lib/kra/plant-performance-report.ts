import type { Kpi } from "@prisma/client";
import {
  parseQuarterTargets,
  type FiscalQuarter,
} from "@/lib/kpi-quarters";
import {
  quarterAchievementStatus,
  quarterStatusLabel,
  type QuarterAchievementStatus,
} from "@/lib/kra/quarter-status";
import { formatWeightage, weightageFraction } from "@/lib/kra/weightage";
import { buildQuarterlyReportRows, quarterlyReportSummary } from "@/lib/kra/quarterly-report";

export const PEOPLE_SCORE_METHODOLOGY = [
  "Section 1 uses only Individual KRA/KPI rows (kpiLevel = INDIVIDUAL) for the selected plant and quarter.",
  "Each KPI with achieved data is scored: Achieved = 100 pts, Not achieved = 0 pts, Entered (review) = 50 pts. Pending KPIs are excluded.",
  "Weighted score = Σ (weightage × points) ÷ Σ (weightage) — weightage from the KRA sheet (e.g. 15% = 0.15).",
  "Employee score = weighted average of that employee's scored KPIs.",
  "Department score = simple average of employee scores in that department.",
  "Overall people score = weighted average across all scored individual KPIs at the plant.",
] as const;

export const PLANT_KPI_METHODOLOGY = [
  "Section 2 uses Plant-level KPIs (kpiLevel = PLANT) — sales, OTD, rejection, production, etc.",
  "Target vs achieved for the selected quarter (Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar).",
  "Status rules: numeric targets use ≤ / ≥ when marked in target text; otherwise ±5% tolerance vs target.",
  "Plant health score uses the same 100 / 50 / 0 point scale and weightage formula as Section 1.",
] as const;

export type KpiScoreBreakdown = {
  kpiId: string;
  kraName: string;
  kpiName: string;
  weightage: string;
  weightFraction: number | null;
  target: string;
  achieved: string;
  status: QuarterAchievementStatus;
  statusLabel: string;
  points: number | null;
  weightedContribution: number | null;
  calculationBasis: string;
};

export type EmployeePerformanceRow = {
  employeeName: string;
  department: string;
  kpiCount: number;
  scoredCount: number;
  weightedScore: number | null;
  calculation: string;
  breakdown: KpiScoreBreakdown[];
};

export type DepartmentPerformanceRow = {
  department: string;
  employeeCount: number;
  weightedScore: number | null;
  calculation: string;
  employees: EmployeePerformanceRow[];
};

export type PlantBusinessKpiRow = {
  kpiId: string;
  kraName: string;
  kpiName: string;
  category: string;
  unit: string;
  weightage: string;
  weightFraction: number | null;
  target: string;
  achieved: string;
  status: QuarterAchievementStatus;
  statusLabel: string;
  points: number | null;
  weightedContribution: number | null;
  calculationBasis: string;
};

export type PlantPerformanceReport = {
  quarter: FiscalQuarter;
  plantName: string;
  people: {
    overallScore: number | null;
    overallCalculation: string;
    summary: ReturnType<typeof quarterlyReportSummary>;
    departments: DepartmentPerformanceRow[];
  };
  plantKpis: {
    overallScore: number | null;
    overallCalculation: string;
    rows: PlantBusinessKpiRow[];
  };
};

type KpiPick = Pick<
  Kpi,
  | "id"
  | "name"
  | "kraName"
  | "ownerName"
  | "department"
  | "weightage"
  | "quarterTargets"
  | "kpiLevel"
  | "category"
  | "unit"
>;

function statusToPoints(status: QuarterAchievementStatus): number | null {
  if (status === "met") return 100;
  if (status === "not_met") return 0;
  if (status === "entered") return 50;
  return null;
}

export function describeQuarterComparison(
  target: string,
  achieved: string,
  status: QuarterAchievementStatus
): string {
  const t = target?.trim() || "—";
  const a = achieved?.trim() || "—";

  if (status === "pending") {
    return "Achieved value missing or placeholder (0 / blank) — excluded from score.";
  }
  if (status === "entered") {
    return `Achieved "${a}" entered but target "${t}" could not be auto-compared — counted as 50 pts (review).`;
  }
  if (status === "met" && t.toLowerCase() === a.toLowerCase()) {
    return `Achieved "${a}" matches target "${t}" → 100 pts.`;
  }
  if (t.includes("<") || t.includes("≤")) {
    return status === "met"
      ? `Achieved ${a} ≤ target ${t} → 100 pts.`
      : `Achieved ${a} > target ${t} → 0 pts.`;
  }
  if (t.includes(">") || t.includes("≥")) {
    return status === "met"
      ? `Achieved ${a} ≥ target ${t} → 100 pts.`
      : `Achieved ${a} < target ${t} → 0 pts.`;
  }
  if (status === "met") {
    return `Achieved ${a} within ±5% of target ${t} → 100 pts.`;
  }
  return `Achieved ${a} outside ±5% of target ${t} → 0 pts.`;
}

function buildKpiBreakdown(
  kpi: KpiPick,
  quarter: FiscalQuarter
): KpiScoreBreakdown | null {
  if (kpi.kpiLevel !== "INDIVIDUAL" || !kpi.ownerName?.trim()) return null;

  const q = parseQuarterTargets(kpi.quarterTargets);
  const cell = q?.[quarter] ?? { target: "", achieved: "" };
  const target = cell.target?.trim() || "—";
  const achieved = cell.achieved?.trim() || "—";
  const status = quarterAchievementStatus(cell.target, cell.achieved);
  const wf = weightageFraction(kpi.weightage);
  const points = statusToPoints(status);
  const weightedContribution =
    points != null && wf != null ? Math.round(points * wf * 100) / 100 : null;

  return {
    kpiId: kpi.id,
    kraName: kpi.kraName?.trim() || "—",
    kpiName: kpi.name,
    weightage: formatWeightage(kpi.weightage),
    weightFraction: wf,
    target,
    achieved,
    status,
    statusLabel: quarterStatusLabel(status),
    points,
    weightedContribution,
    calculationBasis: describeQuarterComparison(target, achieved, status),
  };
}

function weightedAverageFormula(
  label: string,
  items: { weight: number; points: number; label: string }[]
): { score: number | null; calculation: string } {
  if (items.length === 0) {
    return {
      score: null,
      calculation: `${label}: no scored KPIs (all pending).`,
    };
  }
  const weightSum = items.reduce((s, i) => s + i.weight, 0);
  const weightedSum = items.reduce((s, i) => s + i.weight * i.points, 0);
  const score = weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : null;
  const terms = items
    .slice(0, 4)
    .map((i) => `${i.label} (${(i.weight * 100).toFixed(1)}%×${i.points})`)
    .join(" + ");
  const more = items.length > 4 ? ` + … (${items.length - 4} more)` : "";
  return {
    score,
    calculation: `${label} = (${terms}${more}) ÷ ${(weightSum * 100).toFixed(1)}% = ${score ?? "—"}%`,
  };
}

function buildEmployeeRows(
  kpis: KpiPick[],
  quarter: FiscalQuarter
): EmployeePerformanceRow[] {
  const byEmployee = new Map<string, KpiScoreBreakdown[]>();

  for (const kpi of kpis) {
    const row = buildKpiBreakdown(kpi, quarter);
    if (!row) continue;
    const name = kpi.ownerName!.trim();
    const list = byEmployee.get(name) ?? [];
    list.push(row);
    byEmployee.set(name, list);
  }

  const employees: EmployeePerformanceRow[] = [];

  for (const [employeeName, breakdown] of byEmployee) {
    const department = breakdown[0]
      ? kpis.find((k) => k.ownerName?.trim() === employeeName)?.department ?? "—"
      : "—";
    const scored = breakdown.filter((b) => b.points != null);
    const items = scored
      .filter((b) => b.weightFraction != null)
      .map((b) => ({
        weight: b.weightFraction!,
        points: b.points!,
        label: b.kpiName.slice(0, 20),
      }));
    const { score, calculation } = weightedAverageFormula(
      employeeName,
      items
    );

    employees.push({
      employeeName,
      department: department ?? "—",
      kpiCount: breakdown.length,
      scoredCount: scored.length,
      weightedScore: score,
      calculation,
      breakdown,
    });
  }

  return employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

function buildDepartmentRows(employees: EmployeePerformanceRow[]): DepartmentPerformanceRow[] {
  const byDept = new Map<string, EmployeePerformanceRow[]>();
  for (const e of employees) {
    const dept = e.department || "—";
    const list = byDept.get(dept) ?? [];
    list.push(e);
    byDept.set(dept, list);
  }

  return [...byDept.entries()]
    .map(([department, emps]) => {
      const scored = emps.filter((e) => e.weightedScore != null);
      const avg =
        scored.length > 0
          ? Math.round(
              (scored.reduce((s, e) => s + (e.weightedScore ?? 0), 0) / scored.length) * 10
            ) / 10
          : null;
      const names = scored.map((e) => `${e.employeeName} (${e.weightedScore}%)`).join(", ");
      return {
        department,
        employeeCount: emps.length,
        weightedScore: avg,
        calculation:
          scored.length > 0
            ? `Avg of employee scores: (${names}) ÷ ${scored.length} = ${avg}%`
            : "No employee scores yet.",
        employees: emps.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
      };
    })
    .sort((a, b) => a.department.localeCompare(b.department));
}

function buildPlantKpiRows(kpis: KpiPick[], quarter: FiscalQuarter): PlantBusinessKpiRow[] {
  const rows: PlantBusinessKpiRow[] = [];

  for (const kpi of kpis) {
    if (kpi.kpiLevel !== "PLANT") continue;
    const q = parseQuarterTargets(kpi.quarterTargets);
    const cell = q?.[quarter] ?? { target: "", achieved: "" };
    const target = cell.target?.trim() || "—";
    const achieved = cell.achieved?.trim() || "—";
    const status = quarterAchievementStatus(cell.target, cell.achieved);
    const wf = weightageFraction(kpi.weightage);
    const points = statusToPoints(status);
    const weightedContribution =
      points != null && wf != null ? Math.round(points * wf * 100) / 100 : null;

    rows.push({
      kpiId: kpi.id,
      kraName: kpi.kraName?.trim() || "—",
      kpiName: kpi.name,
      category: kpi.category ?? "—",
      unit: kpi.unit ?? "—",
      weightage: formatWeightage(kpi.weightage),
      weightFraction: wf,
      target,
      achieved,
      status,
      statusLabel: quarterStatusLabel(status),
      points,
      weightedContribution,
      calculationBasis: describeQuarterComparison(target, achieved, status),
    });
  }

  return rows.sort((a, b) => a.kraName.localeCompare(b.kraName) || a.kpiName.localeCompare(b.kpiName));
}

export function buildPlantPerformanceReport(
  kpis: KpiPick[],
  quarter: FiscalQuarter,
  plantName: string
): PlantPerformanceReport {
  const quarterlyRows = buildQuarterlyReportRows(
    kpis.filter((k) => k.kpiLevel === "INDIVIDUAL"),
    quarter
  );
  const employees = buildEmployeeRows(kpis, quarter);
  const departments = buildDepartmentRows(employees);

  const allBreakdowns = employees.flatMap((e) =>
    e.breakdown.filter((b) => b.points != null && b.weightFraction != null)
  );
  const overallItems = allBreakdowns.map((b) => ({
    weight: b.weightFraction!,
    points: b.points!,
    label: b.kpiName.slice(0, 16),
  }));
  const peopleOverall = weightedAverageFormula("Overall people score", overallItems);

  const plantRows = buildPlantKpiRows(kpis, quarter);
  const plantItems = plantRows
    .filter((r) => r.points != null && r.weightFraction != null)
    .map((r) => ({
      weight: r.weightFraction!,
      points: r.points!,
      label: r.kpiName.slice(0, 16),
    }));
  const plantOverall = weightedAverageFormula("Plant KPI score", plantItems);

  return {
    quarter,
    plantName,
    people: {
      overallScore: peopleOverall.score,
      overallCalculation: peopleOverall.calculation,
      summary: quarterlyReportSummary(quarterlyRows),
      departments,
    },
    plantKpis: {
      overallScore: plantOverall.score,
      overallCalculation: plantOverall.calculation,
      rows: plantRows,
    },
  };
}

export type PlantScorecardBrief = {
  unitId: string;
  plantName: string;
  peopleScore: number | null;
  plantScore: number | null;
  employeeCount: number;
  plantKpiCount: number;
};

export function buildPlantScorecardBrief(
  unitId: string,
  plantName: string,
  kpis: KpiPick[],
  quarter: FiscalQuarter
): PlantScorecardBrief {
  const report = buildPlantPerformanceReport(kpis, quarter, plantName);
  const employeeCount = new Set(
    kpis.filter((k) => k.kpiLevel === "INDIVIDUAL" && k.ownerName?.trim()).map((k) => k.ownerName!.trim())
  ).size;

  return {
    unitId,
    plantName,
    peopleScore: report.people.overallScore,
    plantScore: report.plantKpis.overallScore,
    employeeCount,
    plantKpiCount: report.plantKpis.rows.length,
  };
}
