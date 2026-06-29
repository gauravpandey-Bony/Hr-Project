"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { appendUnitQuery } from "@/lib/unit-workspace";
import {
  PEOPLE_SCORE_METHODOLOGY,
  PLANT_KPI_METHODOLOGY,
  type DepartmentPerformanceRow,
  type EmployeePerformanceRow,
  type PlantBusinessKpiRow,
  type PlantPerformanceReport,
  type PlantScorecardBrief,
} from "@/lib/kra/plant-performance-report";
import { quarterStatusClass } from "@/lib/kra/quarter-status";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import {
  BarChart3,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Factory,
  Users,
} from "lucide-react";

const QUARTERS: { id: FiscalQuarter; label: string; months: string }[] = [
  { id: "q1", label: "Q1", months: "Apr – Jun" },
  { id: "q2", label: "Q2", months: "Jul – Sep" },
  { id: "q3", label: "Q3", months: "Oct – Dec" },
  { id: "q4", label: "Q4", months: "Jan – Mar" },
];

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
        —
      </span>
    );
  }
  const tone =
    score >= 90 ? "bg-emerald-100 text-emerald-800" : score >= 70 ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-800";
  return (
    <span className={cn("rounded-full px-3 py-1 text-sm font-bold", tone)}>
      {score}%
    </span>
  );
}

function MethodologyPanel({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        <Calculator className="h-4 w-4 text-violet-600" />
        {title}
        {open ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
      </button>
      {open && (
        <ol className="list-decimal space-y-2 border-t border-border px-6 py-4 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function KpiBreakdownTable({
  rows,
}: {
  rows: { kraName: string; kpiName: string; weightage: string; target: string; achieved: string; statusLabel: string; status: string; points: number | null; calculationBasis: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th className="px-3 py-2">KRA / KPI</th>
            <th className="px-3 py-2 text-center">Wt</th>
            <th className="px-3 py-2 text-center">Target</th>
            <th className="px-3 py-2 text-center">Achieved</th>
            <th className="px-3 py-2 text-center">Pts</th>
            <th className="px-3 py-2">Calculation basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">
                <p className="font-medium">{r.kraName}</p>
                <p className="text-muted-foreground">{r.kpiName}</p>
              </td>
              <td className="px-3 py-2 text-center">{r.weightage}</td>
              <td className="px-3 py-2 text-center font-mono">{r.target}</td>
              <td className="px-3 py-2 text-center font-mono">{r.achieved}</td>
              <td className="px-3 py-2 text-center">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", quarterStatusClass(r.status))}>
                  {r.points ?? "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: EmployeePerformanceRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{employee.employeeName}</p>
          <p className="text-xs text-muted-foreground">
            {employee.scoredCount}/{employee.kpiCount} KPIs scored
          </p>
        </div>
        <ScoreBadge score={employee.weightedScore} />
      </button>
      {open && (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-3">
          <p className="mb-2 font-mono text-xs text-violet-800">{employee.calculation}</p>
          <KpiBreakdownTable rows={employee.breakdown} />
        </div>
      )}
    </div>
  );
}

function DepartmentBlock({ dept }: { dept: DepartmentPerformanceRow }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-left"
      >
        <Building2 className="h-4 w-4 text-emerald-600" />
        <div className="flex-1">
          <p className="font-semibold">{dept.department}</p>
          <p className="text-xs text-muted-foreground">{dept.employeeCount} employees</p>
        </div>
        <ScoreBadge score={dept.weightedScore} />
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <>
          <p className="border-b border-border/50 bg-violet-50/50 px-4 py-2 font-mono text-xs text-violet-900">
            {dept.calculation}
          </p>
          <div>
            {dept.employees.map((e) => (
              <EmployeeRow key={e.employeeName} employee={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PlantKpiTable({ rows }: { rows: PlantBusinessKpiRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No plant-level KPIs imported yet for this unit (e.g. Plant Head sheet with sales, OTD).
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">KRA / KPI</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-center">Wt</th>
              <th className="px-4 py-3 text-center">Target</th>
              <th className="px-4 py-3 text-center">Achieved</th>
              <th className="px-4 py-3 text-center">Pts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Calculation basis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kpiId} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.kraName}</p>
                  <p className="text-xs text-muted-foreground">{r.kpiName}</p>
                </td>
                <td className="px-4 py-3 text-xs">{r.category}</td>
                <td className="px-4 py-3 text-center">{r.weightage}</td>
                <td className="px-4 py-3 text-center font-mono text-xs">{r.target}</td>
                <td className="px-4 py-3 text-center font-mono text-xs">{r.achieved}</td>
                <td className="px-4 py-3 text-center font-semibold">{r.points ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", quarterStatusClass(r.status))}>
                    {r.statusLabel}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">{r.calculationBasis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PlantPerformanceReportClient({
  reportsByQuarter,
  allPlants,
  unitId,
  initialQuarter,
}: {
  reportsByQuarter: Record<FiscalQuarter, PlantPerformanceReport | null>;
  allPlants: PlantScorecardBrief[];
  unitId: string | null;
  initialQuarter: FiscalQuarter;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quarter, setQuarter] = useState<FiscalQuarter>(initialQuarter);

  function pickQuarter(q: FiscalQuarter) {
    setQuarter(q);
    const params = new URLSearchParams(searchParams.toString());
    params.set("quarter", q);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "", { scroll: false });
  }

  const activeReport = reportsByQuarter[quarter] ?? null;
  const showAllPlants = !unitId && allPlants.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {QUARTERS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => pickQuarter(q.id)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition",
              quarter === q.id
                ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                : "border-border bg-card hover:border-indigo-400/60"
            )}
          >
            {q.label}
            <span className="ml-1.5 text-xs opacity-80">({q.months})</span>
          </button>
        ))}
      </div>

      {showAllPlants && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Factory className="h-5 w-5 text-indigo-600" />
            All plants — scorecard summary ({quarter.toUpperCase()})
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a plant to open the full report with calculation breakdown. Scores use weighted KRA achievement (see methodology below).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allPlants.map((p) => (
              <Link
                key={p.unitId}
                href={appendUnitQuery(`/dashboard/reports/plant?quarter=${quarter}`, p.unitId)}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-indigo-400 hover:shadow-md"
              >
                <p className="font-semibold">{p.plantName}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <p className="text-muted-foreground">People KRA</p>
                    <p className="text-lg font-bold text-emerald-800">{p.peopleScore ?? "—"}%</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-2">
                    <p className="text-muted-foreground">Plant KPIs</p>
                    <p className="text-lg font-bold text-indigo-800">{p.plantScore ?? "—"}%</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {p.employeeCount} employees · {p.plantKpiCount} plant KPIs
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activeReport && (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <Users className="h-5 w-5 text-emerald-600" />
                  Section 1 — People KRA / KPI
                </h2>
                <p className="text-sm text-muted-foreground">
                  Individual performance at {activeReport.plantName} (top of report)
                </p>
              </div>
              <ScoreBadge score={activeReport.people.overallScore} />
            </div>

            <MethodologyPanel title="How people score is calculated" items={PEOPLE_SCORE_METHODOLOGY} />

            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Overall calculation</p>
              <p className="mt-1 font-mono text-sm text-violet-950">{activeReport.people.overallCalculation}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Total KPIs" value={activeReport.people.summary.total} />
              <MiniStat label="Achieved" value={activeReport.people.summary.met} tone="emerald" />
              <MiniStat label="Not achieved" value={activeReport.people.summary.notMet} tone="rose" />
              <MiniStat label="Pending" value={activeReport.people.summary.pending} tone="amber" />
            </div>

            <div className="space-y-3">
              {activeReport.people.departments.map((d) => (
                <DepartmentBlock key={d.department} dept={d} />
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Section 2 — Plant business KPIs
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sales, delivery, quality & other plant parameters (bottom of report)
                </p>
              </div>
              <ScoreBadge score={activeReport.plantKpis.overallScore} />
            </div>

            <MethodologyPanel title="How plant KPI score is calculated" items={PLANT_KPI_METHODOLOGY} />

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Plant score calculation</p>
              <p className="mt-1 font-mono text-sm text-indigo-950">{activeReport.plantKpis.overallCalculation}</p>
            </div>

            <PlantKpiTable rows={activeReport.plantKpis.rows} />
          </section>
        </>
      )}

      {!showAllPlants && !activeReport && unitId && (
        <p className="text-sm text-muted-foreground">Loading report for selected quarter…</p>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-border bg-card";
  return (
    <div className={cn("rounded-xl border px-4 py-3", cls)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
