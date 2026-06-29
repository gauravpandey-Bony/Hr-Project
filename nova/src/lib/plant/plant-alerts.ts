import type { FiscalQuarter } from "@/lib/kpi-quarters";
import type { PlantPerformanceReport } from "@/lib/kra/plant-performance-report";
import type { ResolvedSpotlightMetric } from "@/lib/plant/plant-dashboard-config";

export type PlantAlertSeverity = "critical" | "warning" | "info" | "success";

export type PlantAlertItem = {
  label: string;
  meta?: string;
  href?: string;
};

export type PlantAlert = {
  id: string;
  severity: PlantAlertSeverity;
  title: string;
  description: string;
  count: number;
  items: PlantAlertItem[];
  actionLabel?: string;
  actionHref?: string;
};

const OFF_TRACK_THRESHOLD = 70;
const DEPT_WARN_THRESHOLD = 60;

export function buildPlantAlerts(
  report: PlantPerformanceReport,
  spotlight: ResolvedSpotlightMetric[],
  employeeIdByName: Record<string, string>,
  unitId: string,
  quarter: FiscalQuarter
): PlantAlert[] {
  const alerts: PlantAlert[] = [];
  const unitQs = `?unit=${encodeURIComponent(unitId)}`;
  const qQs = `${unitQs}&quarter=${quarter}`;

  const offTrack = report.employees.rows
    .filter((e) => e.weightedScore != null && e.weightedScore < OFF_TRACK_THRESHOLD)
    .sort((a, b) => (a.weightedScore ?? 0) - (b.weightedScore ?? 0));

  if (offTrack.length > 0) {
    alerts.push({
      id: "off-track-employees",
      severity: "critical",
      title: "Employees below 70%",
      description: `${offTrack.length} employee(s) need review this quarter.`,
      count: offTrack.length,
      items: offTrack.slice(0, 8).map((e) => ({
        label: e.employeeName,
        meta: `${e.weightedScore}% · ${e.department}`,
        href: employeeIdByName[e.employeeName]
          ? `/dashboard/masters/employees/${employeeIdByName[e.employeeName]}${unitQs}`
          : undefined,
      })),
      actionLabel: "View scorecard",
      actionHref: `/dashboard/reports/plant${qQs}`,
    });
  }

  const pendingByEmployee = report.employees.rows
    .map((e) => ({
      name: e.employeeName,
      department: e.department,
      pending: e.breakdown.filter((b) => b.status === "pending").length,
      scored: e.scoredCount,
      total: e.kpiCount,
    }))
    .filter((e) => e.pending > 0)
    .sort((a, b) => b.pending - a.pending);

  const totalPending = report.employees.summary.pending;
  if (totalPending > 0) {
    alerts.push({
      id: "pending-kras",
      severity: "warning",
      title: "KRAs pending data entry",
      description: `${totalPending} KPI cells have no achieved value yet.`,
      count: totalPending,
      items: pendingByEmployee.slice(0, 8).map((e) => ({
        label: e.name,
        meta: `${e.pending} pending · ${e.department}`,
        href: employeeIdByName[e.name]
          ? `/dashboard/masters/employees/${employeeIdByName[e.name]}${unitQs}`
          : `/dashboard/kra${unitQs}`,
      })),
      actionLabel: "Open KRA sheet",
      actionHref: `/dashboard/kra${unitQs}`,
    });
  }

  const notMetPlant = report.plantKpis.rows.filter((r) => r.status === "not_met");
  if (notMetPlant.length > 0) {
    alerts.push({
      id: "plant-kpi-miss",
      severity: "critical",
      title: "Plant KPIs off target",
      description: "Business metrics not meeting quarterly target.",
      count: notMetPlant.length,
      items: notMetPlant.slice(0, 6).map((r) => ({
        label: r.kpiName,
        meta: `${r.achieved} vs ${r.target}`,
      })),
      actionLabel: "Plant scorecard",
      actionHref: `/dashboard/reports/plant${qQs}`,
    });
  }

  const weakDepts = report.departments.cards
    .filter((d) => d.weightedScore != null && d.weightedScore < DEPT_WARN_THRESHOLD)
    .sort((a, b) => (a.weightedScore ?? 0) - (b.weightedScore ?? 0));

  if (weakDepts.length > 0) {
    alerts.push({
      id: "weak-departments",
      severity: "warning",
      title: "Departments below 60%",
      description: "Department KRA rollup needs attention.",
      count: weakDepts.length,
      items: weakDepts.map((d) => ({
        label: d.department,
        meta: `${d.weightedScore}% · ${d.employeeCount} employees`,
      })),
      actionHref: `/dashboard/reports/plant${qQs}`,
    });
  }

  const missedSpotlight = spotlight.filter(
    (s) => s.resolved && (s.resolved.status === "not_met" || s.resolved.status === "pending")
  );
  if (missedSpotlight.length > 0) {
    alerts.push({
      id: "spotlight-miss",
      severity: "warning",
      title: "Spotlight metrics need attention",
      description: "Key plant metrics for this unit are off track or pending.",
      count: missedSpotlight.length,
      items: missedSpotlight.map((s) => ({
        label: s.label,
        meta: s.resolved
          ? `${s.resolved.achieved} vs ${s.resolved.target} (${s.resolved.statusLabel})`
          : "No data",
      })),
    });
  }

  const achieved = report.employees.summary.met;
  if (achieved > 0) {
    alerts.push({
      id: "achieved-kras",
      severity: "success",
      title: "KRAs achieved",
      description: `${achieved} individual KPI targets met this quarter.`,
      count: achieved,
      items: [],
      actionHref: `/dashboard/reports/quarterly${unitQs}`,
    });
  }

  const severityOrder: Record<PlantAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
