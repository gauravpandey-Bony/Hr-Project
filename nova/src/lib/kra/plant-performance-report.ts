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

export const EMPLOYEE_SCORE_METHODOLOGY = [
  "Employee section uses Individual KRA/KPI rows (kpiLevel = INDIVIDUAL) for the selected plant and quarter.",
  "Each KPI: Achieved = 100 pts, Not achieved = 0 pts, Entered (review) = 50 pts. Pending KPIs are excluded.",
  "Employee score = Σ (weightage × points) ÷ Σ (weightage) for that employee's scored KPIs.",
  "Overall employee score = weighted average across all individual KPIs at the plant.",
] as const;

export const DEPARTMENT_SCORE_METHODOLOGY = [
  "Department section uses Department-level KPIs (kpiLevel = DEPARTMENT) — dept targets from KRA master sheets.",
  "When department KPIs exist, dept score = Σ (weightage × points) ÷ Σ (weightage) for that department's KPIs.",
  "When no department KPIs exist, dept score = average of employee scores in that department.",
  "Overall department score = average of all department scores (or weighted dept KPI rollup if present).",
] as const;

export const PLANT_KPI_METHODOLOGY = [
  "Plant section uses Plant-level KPIs (kpiLevel = PLANT) — sales, OTD, rejection, production, etc.",
  "Target vs achieved for the selected quarter (Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar).",
  "Status rules: numeric targets use ≤ / ≥ when marked in target text; otherwise ±5% tolerance vs target.",
  "Plant score = Σ (weightage × points) ÷ Σ (weightage) for all plant-level KPIs.",
] as const;

/** @deprecated use level-specific constants */
export const PEOPLE_SCORE_METHODOLOGY = EMPLOYEE_SCORE_METHODOLOGY;

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

export type LevelKpiRow = KpiScoreBreakdown & {
  category?: string;
  unit?: string;
  department?: string;
  ownerName?: string;
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

export type DepartmentScorecard = {
  department: string;
  employeeCount: number;
  kpiRows: LevelKpiRow[];
  kpiScore: number | null;
  kpiCalculation: string;
  employeeRollupScore: number | null;
  employeeRollupCalculation: string;
  /** Primary display score — dept KPIs if present, else employee average */
  weightedScore: number | null;
  calculation: string;
  employees: EmployeePerformanceRow[];
};

export type PlantBusinessKpiRow = LevelKpiRow & {
  category: string;
  unit: string;
};

export type PlantPerformanceReport = {
  quarter: FiscalQuarter;
  plantName: string;
  employees: {
    overallScore: number | null;
    overallCalculation: string;
    summary: ReturnType<typeof quarterlyReportSummary>;
    rows: EmployeePerformanceRow[];
  };
  departments: {
    overallScore: number | null;
    overallCalculation: string;
    cards: DepartmentScorecard[];
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

function buildLevelKpiRows(
  kpis: KpiPick[],
  quarter: FiscalQuarter,
  level: "PLANT" | "DEPARTMENT",
  departmentFilter?: string
): LevelKpiRow[] {
  const rows: LevelKpiRow[] = [];

  for (const kpi of kpis) {
    if (kpi.kpiLevel !== level) continue;
    if (departmentFilter && (kpi.department ?? "—") !== departmentFilter) continue;

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
      weightage: formatWeightage(kpi.weightage),
      weightFraction: wf,
      target,
      achieved,
      status,
      statusLabel: quarterStatusLabel(status),
      points,
      weightedContribution,
      calculationBasis: describeQuarterComparison(target, achieved, status),
      category: kpi.category ?? "—",
      unit: kpi.unit ?? "—",
      department: kpi.department ?? "—",
      ownerName: kpi.ownerName ?? undefined,
    });
  }

  return rows.sort((a, b) => a.kraName.localeCompare(b.kraName) || a.kpiName.localeCompare(b.kpiName));
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

function scoreFromKpiRows(label: string, rows: LevelKpiRow[]) {
  const items = rows
    .filter((r) => r.points != null && r.weightFraction != null)
    .map((r) => ({
      weight: r.weightFraction!,
      points: r.points!,
      label: r.kpiName.slice(0, 16),
    }));
  return weightedAverageFormula(label, items);
}

export function buildEmployeeRows(
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
    const { score, calculation } = weightedAverageFormula(employeeName, items);

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

function normalizeDept(name: string | null | undefined): string {
  return name?.trim() || "—";
}

function departmentsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeDept(a);
  const right = normalizeDept(b);
  if (left === right) return true;
  if (left === "—" || right === "—") return false;
  const key = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const lk = key(left);
  const rk = key(right);
  if (lk === rk) return true;
  const hr = new Set(["hr", "human resource", "human resources"]);
  if (hr.has(lk) && hr.has(rk)) return true;
  const it = new Set(["it", "it and systems", "it and system", "edp"]);
  if (it.has(lk) && it.has(rk)) return true;
  const qa = new Set(["quality", "quality assurance"]);
  if (qa.has(lk) && qa.has(rk)) return true;
  const admin = new Set(["admin", "corporate office"]);
  if (admin.has(lk) && admin.has(rk)) return true;
  return false;
}

function buildDepartmentScorecards(
  kpis: KpiPick[],
  employees: EmployeePerformanceRow[],
  quarter: FiscalQuarter
): DepartmentScorecard[] {
  const deptNames = new Set<string>();
  for (const e of employees) deptNames.add(normalizeDept(e.department));
  // Include departments from ALL KPI levels so Corporate individual KRA sheets
  // still create department tiles on the plant dashboard.
  for (const k of kpis) {
    deptNames.add(normalizeDept(k.department));
  }

  // Collapse aliases (HR ↔ Human Resources) into one display department.
  const displayDepts: string[] = [];
  for (const name of [...deptNames].sort((a, b) => a.localeCompare(b))) {
    if (displayDepts.some((d) => departmentsMatch(d, name))) continue;
    const empLabel = employees.find((e) => departmentsMatch(e.department, name))?.department;
    displayDepts.push(normalizeDept(empLabel) !== "—" ? normalizeDept(empLabel!) : name);
  }

  return displayDepts
    .sort((a, b) => a.localeCompare(b))
    .map((department) => {
      const emps = employees
        .filter((e) => departmentsMatch(e.department, department))
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

      const relatedDeptNames = [
        ...new Set(
          kpis
            .map((k) => normalizeDept(k.department))
            .filter((d) => departmentsMatch(d, department))
        ),
      ];
      const kpiRows = relatedDeptNames.flatMap((d) =>
        buildLevelKpiRows(kpis, quarter, "DEPARTMENT", d)
      );
      const kpiScoreResult = scoreFromKpiRows(`${department} dept KPIs`, kpiRows);

      const scoredEmps = emps.filter((e) => e.weightedScore != null);
      const employeeRollupScore =
        scoredEmps.length > 0
          ? Math.round(
              (scoredEmps.reduce((s, e) => s + (e.weightedScore ?? 0), 0) / scoredEmps.length) * 10
            ) / 10
          : null;
      const names = scoredEmps.map((e) => `${e.employeeName} (${e.weightedScore}%)`).join(", ");
      const employeeRollupCalculation =
        scoredEmps.length > 0
          ? `Avg of employee scores: (${names}) ÷ ${scoredEmps.length} = ${employeeRollupScore}%`
          : "No employee scores yet.";

      const hasDeptKpis = kpiRows.some((r) => r.points != null);
      const weightedScore = hasDeptKpis ? kpiScoreResult.score : employeeRollupScore;
      const calculation = hasDeptKpis
        ? kpiScoreResult.calculation
        : `No department KPIs — using employee rollup. ${employeeRollupCalculation}`;

      return {
        department,
        employeeCount: emps.length,
        kpiRows,
        kpiScore: kpiScoreResult.score,
        kpiCalculation: kpiScoreResult.calculation,
        employeeRollupScore,
        employeeRollupCalculation,
        weightedScore,
        calculation,
        employees: emps,
      };
    });
}

function buildPlantKpiRows(kpis: KpiPick[], quarter: FiscalQuarter): PlantBusinessKpiRow[] {
  return buildLevelKpiRows(kpis, quarter, "PLANT").map((r) => ({
    ...r,
    category: r.category ?? "—",
    unit: r.unit ?? "—",
  }));
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
  const employeeRows = buildEmployeeRows(kpis, quarter);
  const departmentCards = buildDepartmentScorecards(kpis, employeeRows, quarter);

  const allBreakdowns = employeeRows.flatMap((e) =>
    e.breakdown.filter((b) => b.points != null && b.weightFraction != null)
  );
  const employeeOverall = weightedAverageFormula(
    "Overall employee score",
    allBreakdowns.map((b) => ({
      weight: b.weightFraction!,
      points: b.points!,
      label: b.kpiName.slice(0, 16),
    }))
  );

  const scoredDepts = departmentCards.filter((d) => d.weightedScore != null);
  const deptOverallScore =
    scoredDepts.length > 0
      ? Math.round(
          (scoredDepts.reduce((s, d) => s + (d.weightedScore ?? 0), 0) / scoredDepts.length) * 10
        ) / 10
      : null;
  const deptOverallCalculation =
    scoredDepts.length > 0
      ? `Avg of department scores: (${scoredDepts.map((d) => `${d.department} ${d.weightedScore}%`).join(", ")}) ÷ ${scoredDepts.length} = ${deptOverallScore}%`
      : "No department scores yet.";

  const plantRows = buildPlantKpiRows(kpis, quarter);
  const plantOverall = scoreFromKpiRows("Plant KPI score", plantRows);

  return {
    quarter,
    plantName,
    employees: {
      overallScore: employeeOverall.score,
      overallCalculation: employeeOverall.calculation,
      summary: quarterlyReportSummary(quarterlyRows),
      rows: employeeRows,
    },
    departments: {
      overallScore: deptOverallScore,
      overallCalculation: deptOverallCalculation,
      cards: departmentCards,
    },
    plantKpis: {
      overallScore: plantOverall.score,
      overallCalculation: plantOverall.calculation,
      rows: plantRows,
    },
  };
}

type EmployeeMasterRow = {
  name: string;
  department: string | null;
};

/** When KPI rows are missing, show department headcount from Employee Master on the plant dashboard. */
export function enrichPlantReportWithEmployeeMaster(
  report: PlantPerformanceReport,
  employees: EmployeeMasterRow[]
): PlantPerformanceReport {
  if (report.departments.cards.length > 0 || employees.length === 0) {
    return report;
  }

  const byDept = new Map<string, number>();
  for (const row of employees) {
    const dept = row.department?.trim() || "Unassigned";
    byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
  }

  const cards: DepartmentScorecard[] = [...byDept.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([department, employeeCount]) => ({
      department,
      employeeCount,
      kpiRows: [],
      kpiScore: null,
      kpiCalculation: "Upload KRA sheets to score department KPIs.",
      employeeRollupScore: null,
      employeeRollupCalculation: "No employee KRA data yet.",
      weightedScore: null,
      calculation: `${employeeCount} employee${employeeCount === 1 ? "" : "s"} in master — upload KRA Excel to enable scores.`,
      employees: [],
    }));

  return {
    ...report,
    departments: {
      overallScore: null,
      overallCalculation: `${employees.length} employees in master across ${cards.length} departments — KRA upload pending.`,
      cards,
    },
    employees: {
      ...report.employees,
      overallCalculation: `${employees.length} employees assigned to this plant. Upload KRA workbooks to score KPIs.`,
    },
  };
}

export type PlantScorecardBrief = {
  unitId: string;
  plantName: string;
  employeeScore: number | null;
  departmentScore: number | null;
  plantScore: number | null;
  employeeCount: number;
  departmentCount: number;
  plantKpiCount: number;
};

export function buildPlantScorecardBrief(
  unitId: string,
  plantName: string,
  kpis: KpiPick[],
  quarter: FiscalQuarter
): PlantScorecardBrief {
  const report = buildPlantPerformanceReport(kpis, quarter, plantName);
  const employeeCount = report.employees.rows.length;
  const departmentCount = report.departments.cards.length;

  return {
    unitId,
    plantName,
    employeeScore: report.employees.overallScore,
    departmentScore: report.departments.overallScore,
    plantScore: report.plantKpis.overallScore,
    employeeCount,
    departmentCount,
    plantKpiCount: report.plantKpis.rows.length,
  };
}
