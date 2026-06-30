import type { Kpi } from "@prisma/client";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { departmentsAreEquivalent } from "@/lib/masters/department-master-sync";
import {
  buildEmployeeRows,
  type EmployeePerformanceRow,
} from "@/lib/kra/plant-performance-report";
import {
  buildQuarterlyReportRows,
  quarterlyReportSummary,
} from "@/lib/kra/quarterly-report";
import { resolveReportingManagerName } from "@/lib/reporting-manager";

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
>;

export type DepartmentTeamMember = {
  employeeId: string;
  name: string;
  designation: string | null;
  managerName: string | null;
  kpiCount: number;
  scores: Record<FiscalQuarter, number | null>;
  activeQuarterScore: number | null;
};

export type DepartmentDashboardData = {
  departmentName: string;
  quarter: FiscalQuarter;
  departmentScore: number | null;
  employeeCount: number;
  totalKpis: number;
  summary: ReturnType<typeof quarterlyReportSummary>;
  team: DepartmentTeamMember[];
  alerts: string[];
  scoreByQuarter: Record<FiscalQuarter, number | null>;
};

const QUARTERS: FiscalQuarter[] = ["q1", "q2", "q3", "q4"];

function filterDeptEmployees(
  rows: EmployeePerformanceRow[],
  departmentName: string
): EmployeePerformanceRow[] {
  return rows.filter((e) => departmentsAreEquivalent(e.department, departmentName));
}

function averageScore(rows: EmployeePerformanceRow[]): number | null {
  const scored = rows.filter((e) => e.weightedScore != null);
  if (!scored.length) return null;
  return (
    Math.round(
      (scored.reduce((s, e) => s + (e.weightedScore ?? 0), 0) / scored.length) * 10
    ) / 10
  );
}

function findEmployeeRow(
  rows: EmployeePerformanceRow[],
  name: string
): EmployeePerformanceRow | undefined {
  return rows.find((e) => e.employeeName.toLowerCase() === name.toLowerCase());
}

export function buildDepartmentDashboard(
  kpis: KpiPick[],
  departmentName: string,
  quarter: FiscalQuarter,
  employees: {
    id: string;
    name: string;
    designation?: string | null;
    managerName?: string | null;
    ecn?: string | null;
  }[]
): DepartmentDashboardData {
  const individual = kpis.filter((k) => k.kpiLevel === "INDIVIDUAL");
  const deptIndividual = individual.filter((k) =>
    departmentsAreEquivalent(k.department ?? "", departmentName)
  );

  const quarterlyRows = buildQuarterlyReportRows(deptIndividual, quarter);
  const summary = quarterlyReportSummary(quarterlyRows);

  const scoreByQuarter = Object.fromEntries(
    QUARTERS.map((q) => [
      q,
      averageScore(
        filterDeptEmployees(buildEmployeeRows(individual, q), departmentName)
      ),
    ])
  ) as Record<FiscalQuarter, number | null>;

  const activeRows = filterDeptEmployees(
    buildEmployeeRows(individual, quarter),
    departmentName
  );

  const team: DepartmentTeamMember[] = employees.map((emp) => {
    const scores = Object.fromEntries(
      QUARTERS.map((q) => {
        const row = findEmployeeRow(
          filterDeptEmployees(buildEmployeeRows(individual, q), departmentName),
          emp.name
        );
        return [q, row?.weightedScore ?? null];
      })
    ) as Record<FiscalQuarter, number | null>;
    const active = findEmployeeRow(activeRows, emp.name);
    return {
      employeeId: emp.id,
      name: emp.name,
      designation: emp.designation ?? null,
      managerName:
        resolveReportingManagerName(emp.managerName, employees) ||
        emp.managerName ||
        null,
      kpiCount: active?.kpiCount ?? 0,
      scores,
      activeQuarterScore: scores[quarter],
    };
  });

  const alerts: string[] = [];
  if (summary.pending > 0) {
    alerts.push(`${summary.pending} KPI(s) — Q${quarter.slice(1)} achieved not entered`);
  }
  if (summary.notMet > 0) {
    alerts.push(`${summary.notMet} KPI(s) off track this quarter`);
  }
  for (const m of team) {
    if (m.kpiCount === 0) {
      alerts.push(`${m.name} — no individual KPI rows uploaded`);
    }
  }

  return {
    departmentName,
    quarter,
    departmentScore: averageScore(activeRows),
    employeeCount: employees.length,
    totalKpis: deptIndividual.length,
    summary,
    team,
    alerts,
    scoreByQuarter,
  };
}
