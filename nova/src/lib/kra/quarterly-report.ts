import type { Kpi } from "@prisma/client";
import { parseQuarterTargets } from "@/lib/kpi-quarters";
import {
  quarterAchievementStatus,
  quarterStatusLabel,
  type QuarterAchievementStatus,
} from "@/lib/kra/quarter-status";
import { formatWeightage } from "@/lib/kra/weightage";
import type { FiscalQuarter } from "@/lib/kpi-quarters";

export type QuarterlyReportRow = {
  kpiId: string;
  employeeName: string;
  department: string;
  kraName: string;
  kpiName: string;
  weightage: string;
  target: string;
  achieved: string;
  status: QuarterAchievementStatus;
  statusLabel: string;
};

export function buildQuarterlyReportRows(
  kpis: Pick<
    Kpi,
    | "id"
    | "name"
    | "kraName"
    | "ownerName"
    | "department"
    | "weightage"
    | "quarterTargets"
    | "kpiLevel"
  >[],
  quarter: FiscalQuarter,
  employeeFilter?: string | null
): QuarterlyReportRow[] {
  const rows: QuarterlyReportRow[] = [];

  for (const kpi of kpis) {
    if (kpi.kpiLevel !== "INDIVIDUAL" && !kpi.ownerName) continue;
    const owner = kpi.ownerName?.trim();
    if (!owner) continue;
    if (employeeFilter && owner.toLowerCase() !== employeeFilter.toLowerCase()) {
      continue;
    }

    const q = parseQuarterTargets(kpi.quarterTargets);
    const cell = q?.[quarter] ?? { target: "", achieved: "" };
    const target = cell.target?.trim() || "—";
    const achieved = cell.achieved?.trim() || "—";
    const status = quarterAchievementStatus(cell.target, cell.achieved);

    rows.push({
      kpiId: kpi.id,
      employeeName: owner,
      department: kpi.department ?? "—",
      kraName: kpi.kraName?.trim() || "—",
      kpiName: kpi.name,
      weightage: formatWeightage(kpi.weightage),
      target,
      achieved,
      status,
      statusLabel: quarterStatusLabel(status),
    });
  }

  return rows.sort((a, b) => {
    const dept = a.department.localeCompare(b.department);
    if (dept !== 0) return dept;
    const emp = a.employeeName.localeCompare(b.employeeName);
    if (emp !== 0) return emp;
    return a.kraName.localeCompare(b.kraName) || a.kpiName.localeCompare(b.kpiName);
  });
}

export function quarterlyReportSummary(rows: QuarterlyReportRow[]) {
  return {
    total: rows.length,
    met: rows.filter((r) => r.status === "met").length,
    notMet: rows.filter((r) => r.status === "not_met").length,
    pending: rows.filter((r) => r.status === "pending").length,
    entered: rows.filter((r) => r.status === "entered").length,
  };
}
