/**
 * Cross-check plant + employee KPI calculations for every active unit.
 *
 * Usage: npx tsx scripts/audit-all-plant-calculations.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  buildPlantPerformanceReport,
  type PlantPerformanceReport,
} from "../src/lib/kra/plant-performance-report";
import {
  quarterAchievementStatus,
  isUnfilledTemplateAchieved,
} from "../src/lib/kra/quarter-status";
import { parseQuarterTargets, type FiscalQuarter } from "../src/lib/kpi-quarters";
import { plantDataScope, kpiWhereForPlantScope } from "../src/lib/unit-workspace";
import { aliasesForUnit, parseStringArrayJson } from "../src/lib/org-units";

const db = new PrismaClient();
const QUARTERS: FiscalQuarter[] = ["q1", "q2", "q3", "q4"];

type Issue = {
  severity: "high" | "medium" | "low";
  plant: string;
  quarter: string;
  kind: string;
  detail: string;
};

type PlantSummary = {
  plant: string;
  slug: string;
  kpiCount: number;
  employeeScored: number;
  employeeTotal: number;
  byQuarter: Record<
    string,
    {
      healthLike: number | null;
      plant: number | null;
      plantSource: string;
      departments: number | null;
      employees: number | null;
      pending: number;
      met: number;
      notMet: number;
      entered: number;
      templateCopies: number;
    }
  >;
};

function recountStatuses(
  kpis: { quarterTargets: unknown }[],
  quarter: FiscalQuarter
) {
  const counts = {
    pending: 0,
    met: 0,
    not_met: 0,
    entered: 0,
    templateCopies: 0,
  };
  for (const k of kpis) {
    const q = parseQuarterTargets(k.quarterTargets as never);
    const cell = q?.[quarter] ?? { target: "", achieved: "" };
    if (isUnfilledTemplateAchieved(cell.target, cell.achieved)) {
      counts.templateCopies += 1;
    }
    const status = quarterAchievementStatus(cell.target, cell.achieved);
    counts[status] += 1;
  }
  return counts;
}

function healthLike(report: PlantPerformanceReport): number | null {
  if (report.plantKpis.scoreSource === "plant") {
    const parts = [
      report.plantKpis.overallScore,
      report.departments.overallScore,
      report.employees.overallScore,
    ].filter((s): s is number => s != null);
    if (!parts.length) return null;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
  }
  return report.departments.overallScore ?? report.employees.overallScore;
}

function verifyEmployeeMath(report: PlantPerformanceReport, plant: string, quarter: string, issues: Issue[]) {
  for (const emp of report.employees.rows) {
    const withWeight = emp.breakdown.filter((b) => b.weightFraction != null);
    const totalWeight = withWeight.reduce((s, b) => s + (b.weightFraction ?? 0), 0);
    const scored = withWeight.filter((b) => b.points != null);
    if (scored.length === 0) {
      if (emp.weightedScore != null) {
        issues.push({
          severity: "high",
          plant,
          quarter,
          kind: "employee-score-without-scored-kpis",
          detail: `${emp.employeeName} score=${emp.weightedScore} but 0 scored KPIs`,
        });
      }
      continue;
    }
    if (totalWeight <= 0) continue;
    const weightedSum = scored.reduce(
      (s, b) => s + (b.weightFraction ?? 0) * (b.points ?? 0),
      0
    );
    const expected = Math.round((weightedSum / totalWeight) * 10) / 10;
    if (emp.weightedScore != null && Math.abs(emp.weightedScore - expected) > 0.15) {
      issues.push({
        severity: "high",
        plant,
        quarter,
        kind: "employee-score-mismatch",
        detail: `${emp.employeeName}: reported ${emp.weightedScore}% vs recomputed ${expected}% (scored ${emp.scoredCount}/${emp.kpiCount})`,
      });
    }

    // False 100% with mostly pending
    if (
      emp.weightedScore != null &&
      emp.weightedScore >= 99.5 &&
      emp.kpiCount >= 4 &&
      emp.scoredCount / emp.kpiCount < 0.35
    ) {
      issues.push({
        severity: "high",
        plant,
        quarter,
        kind: "inflated-100-low-coverage",
        detail: `${emp.employeeName}: ${emp.weightedScore}% with only ${emp.scoredCount}/${emp.kpiCount} KPIs scored`,
      });
    }

    for (const b of emp.breakdown) {
      if (b.status === "met" && isUnfilledTemplateAchieved(b.target, b.achieved)) {
        issues.push({
          severity: "high",
          plant,
          quarter,
          kind: "template-copy-marked-met",
          detail: `${emp.employeeName} / ${b.kpiName}: target===achieved still met`,
        });
      }
    }
  }

  // Recompute overall employee average
  const scoredEmps = report.employees.rows.filter((e) => e.weightedScore != null);
  if (scoredEmps.length) {
    const expected =
      Math.round(
        (scoredEmps.reduce((s, e) => s + (e.weightedScore ?? 0), 0) / scoredEmps.length) * 10
      ) / 10;
    if (
      report.employees.overallScore != null &&
      Math.abs(report.employees.overallScore - expected) > 0.15
    ) {
      issues.push({
        severity: "high",
        plant,
        quarter,
        kind: "employee-overall-mismatch",
        detail: `overall ${report.employees.overallScore}% vs recomputed ${expected}%`,
      });
    }
  }
}

function verifyDepartmentMath(report: PlantPerformanceReport, plant: string, quarter: string, issues: Issue[]) {
  const scored = report.departments.cards.filter((d) => d.weightedScore != null);
  if (!scored.length) return;
  const expected =
    Math.round(
      (scored.reduce((s, d) => s + (d.weightedScore ?? 0), 0) / scored.length) * 10
    ) / 10;
  if (
    report.departments.overallScore != null &&
    Math.abs(report.departments.overallScore - expected) > 0.15
  ) {
    issues.push({
      severity: "high",
      plant,
      quarter,
      kind: "department-overall-mismatch",
      detail: `overall ${report.departments.overallScore}% vs recomputed ${expected}%`,
    });
  }

  for (const d of report.departments.cards) {
    if (
      d.weightedScore != null &&
      d.weightedScore >= 99.5 &&
      d.employees.length >= 3 &&
      d.employees.filter((e) => e.weightedScore != null).length === 0 &&
      d.kpiRows.filter((r) => r.points != null).length <= 1
    ) {
      issues.push({
        severity: "medium",
        plant,
        quarter,
        kind: "dept-100-thin-data",
        detail: `${d.department}: ${d.weightedScore}% on thin scored data`,
      });
    }
  }
}

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("No organization found");
    process.exit(1);
  }

  const units = await db.orgUnitMaster.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  console.log(`Org: ${org.name}`);
  console.log(`Active units: ${units.length}`);
  console.log("");

  const issues: Issue[] = [];
  const summaries: PlantSummary[] = [];

  for (const unit of units) {
    const aliases = aliasesForUnit({
      plantUnitKey: unit.plantUnitKey,
      locationAliases: parseStringArrayJson(unit.locationAliases),
      kpiPlantAliases: parseStringArrayJson(unit.kpiPlantAliases),
    });
    const scope = plantDataScope(
      unit.plantUnitKey,
      aliases.locationAliases,
      aliases.kpiPlantAliases
    );

    const kpis = await db.kpi.findMany({
      where: {
        organizationId: org.id,
        isActive: true,
        ...kpiWhereForPlantScope(scope),
      },
      select: {
        id: true,
        name: true,
        kraName: true,
        ownerName: true,
        department: true,
        weightage: true,
        quarterTargets: true,
        kpiLevel: true,
        category: true,
        unit: true,
        plantUnit: true,
      },
    });

    const summary: PlantSummary = {
      plant: unit.name,
      slug: unit.slug,
      kpiCount: kpis.length,
      employeeScored: 0,
      employeeTotal: 0,
      byQuarter: {},
    };

    for (const quarter of QUARTERS) {
      const report = buildPlantPerformanceReport(kpis, quarter, unit.name);
      const statusCounts = recountStatuses(kpis, quarter);
      const health = healthLike(report);

      summary.byQuarter[quarter] = {
        healthLike: health,
        plant: report.plantKpis.overallScore,
        plantSource: report.plantKpis.scoreSource,
        departments: report.departments.overallScore,
        employees: report.employees.overallScore,
        pending: statusCounts.pending,
        met: statusCounts.met,
        notMet: statusCounts.not_met,
        entered: statusCounts.entered,
        templateCopies: statusCounts.templateCopies,
      };

      if (quarter === "q1") {
        summary.employeeTotal = report.employees.rows.length;
        summary.employeeScored = report.employees.rows.filter(
          (e) => e.weightedScore != null
        ).length;
      }

      verifyEmployeeMath(report, unit.name, quarter, issues);
      verifyDepartmentMath(report, unit.name, quarter, issues);

      const scoredCells =
        statusCounts.met + statusCounts.not_met + statusCounts.entered;
      const totalCells = scoredCells + statusCounts.pending;
      if (
        health != null &&
        health >= 99.5 &&
        totalCells >= 20 &&
        scoredCells / totalCells < 0.25
      ) {
        issues.push({
          severity: "high",
          plant: unit.name,
          quarter,
          kind: "plant-health-100-low-coverage",
          detail: `health ${health}% with only ${scoredCells}/${totalCells} cells scored (${statusCounts.pending} pending, ${statusCounts.templateCopies} template copies)`,
        });
      }

      if (statusCounts.templateCopies > 0 && statusCounts.met > 0) {
        // Cross-check: template copies must not contribute to met
        // (already caught per-employee; plant-level signal)
        const ratio = statusCounts.templateCopies / Math.max(1, totalCells);
        if (ratio > 0.05 && health != null && health >= 90) {
          issues.push({
            severity: "medium",
            plant: unit.name,
            quarter,
            kind: "high-score-with-templates-present",
            detail: `${statusCounts.templateCopies} template-copy cells still in sheet; health ${health}%`,
          });
        }
      }
    }

    summaries.push(summary);
  }

  // Print plant scoreboard (Q1 focus + annual-ish)
  console.log("=== PLANT SCOREBOARD (Q1) ===");
  for (const s of summaries) {
    const q1 = s.byQuarter.q1;
    console.log(
      [
        s.plant.padEnd(28),
        `KPIs=${String(s.kpiCount).padStart(4)}`,
        `emp ${s.employeeScored}/${s.employeeTotal}`,
        `health=${q1.healthLike ?? "—"}`,
        `plant=${q1.plant ?? "—"}(${q1.plantSource})`,
        `dept=${q1.departments ?? "—"}`,
        `empScore=${q1.employees ?? "—"}`,
        `met/pending/tmpl=${q1.met}/${q1.pending}/${q1.templateCopies}`,
      ].join(" | ")
    );
  }

  console.log("\n=== ALL QUARTERS SNAPSHOT ===");
  for (const s of summaries) {
    if (s.kpiCount === 0) continue;
    console.log(`\n${s.plant} (${s.slug}) — ${s.kpiCount} KPIs`);
    for (const q of QUARTERS) {
      const row = s.byQuarter[q];
      console.log(
        `  ${q.toUpperCase()}: health=${row.healthLike ?? "—"} plant=${row.plant ?? "—"} dept=${row.departments ?? "—"} emp=${row.employees ?? "—"} | met=${row.met} not_met=${row.notMet} entered=${row.entered} pending=${row.pending} template=${row.templateCopies}`
      );
    }
  }

  const high = issues.filter((i) => i.severity === "high");
  const medium = issues.filter((i) => i.severity === "medium");
  const low = issues.filter((i) => i.severity === "low");

  console.log("\n=== ISSUES ===");
  console.log(`high=${high.length} medium=${medium.length} low=${low.length}`);
  for (const i of [...high, ...medium].slice(0, 80)) {
    console.log(`[${i.severity}] ${i.plant} ${i.quarter} · ${i.kind}: ${i.detail}`);
  }
  if (high.length + medium.length > 80) {
    console.log(`... +${high.length + medium.length - 80} more`);
  }

  if (high.length === 0) {
    console.log("\nPASS: No high-severity calculation mismatches found across plants/employees.");
  } else {
    console.log(`\nFAIL: ${high.length} high-severity calculation issues.`);
    process.exitCode = 2;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
