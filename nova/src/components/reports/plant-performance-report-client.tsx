"use client";

import { useMemo, useState, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { appendUnitQuery } from "@/lib/unit-workspace";
import {
  DEPARTMENT_SCORE_METHODOLOGY,
  EMPLOYEE_SCORE_METHODOLOGY,
  PLANT_KPI_METHODOLOGY,
  type DepartmentScorecard,
  type EmployeePerformanceRow,
  type LevelKpiRow,
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
  User,
  Users,
} from "lucide-react";
import { ListPagination, pageSlice } from "@/components/ui/list-pagination";

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

function LevelKpiTable({
  rows,
  extraColumns,
  emptyMessage,
}: {
  rows: LevelKpiRow[];
  extraColumns?: { header: string; render: (r: LevelKpiRow) => string }[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              {extraColumns?.map((c) => (
                <th key={c.header} className="px-4 py-3">
                  {c.header}
                </th>
              ))}
              <th className="px-4 py-3">KRA / KPI</th>
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
                {extraColumns?.map((c) => (
                  <td key={c.header} className="px-4 py-3 text-xs">
                    {c.render(r)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <p className="font-medium">{r.kraName}</p>
                  <p className="text-xs text-muted-foreground">{r.kpiName}</p>
                </td>
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

function ScorecardSection({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  score,
  methodologyTitle,
  methodology,
  calculation,
  calculationClass,
  children,
}: {
  icon: typeof Users;
  iconClass: string;
  title: string;
  subtitle: string;
  score: number | null;
  methodologyTitle: string;
  methodology: readonly string[];
  calculation: string;
  calculationClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Icon className={cn("h-5 w-5", iconClass)} />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <ScoreBadge score={score} />
      </div>
      <MethodologyPanel title={methodologyTitle} items={methodology} />
      <div className={cn("rounded-xl border px-4 py-3", calculationClass)}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Score calculation</p>
        <p className="mt-1 font-mono text-sm">{calculation}</p>
      </div>
      {children}
    </section>
  );
}

const EMPLOYEE_PAGE_SIZE = 15;

function EmployeeSummaryTable({ rows }: { rows: EmployeePerformanceRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [page, setPage] = useState(0);

  const departments = useMemo(
    () => [...new Set(rows.map((e) => e.department).filter(Boolean))].sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const list =
      departmentFilter === "all"
        ? rows
        : rows.filter((e) => e.department === departmentFilter);
    return [...list].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [rows, departmentFilter]);

  const pageRows = useMemo(
    () => pageSlice(filteredRows, page, EMPLOYEE_PAGE_SIZE),
    [filteredRows, page]
  );

  function toggleEmployee(name: string) {
    setExpanded((v) => (v === name ? null : name));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Click an employee name to view KPI details.{" "}
          <span className="font-medium text-foreground">
            {filteredRows.length} employee{filteredRows.length === 1 ? "" : "s"}
          </span>
        </p>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Department
          </span>
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(0);
              setExpanded(null);
            }}
            className="min-w-[160px] rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3 text-center">KPIs</th>
              <th className="px-4 py-3 text-center">Scored</th>
              <th className="px-4 py-3 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((e) => {
              const isOpen = expanded === e.employeeName;
              return (
                <Fragment key={e.employeeName}>
                  <tr
                    className={cn(
                      "border-b border-border/50 transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
                      isOpen && "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleEmployee(e.employeeName)}
                        className="inline-flex items-center gap-1.5 text-left font-medium text-emerald-800 hover:underline dark:text-emerald-300"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {e.employeeName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.department}</td>
                    <td className="px-4 py-3 text-center">{e.kpiCount}</td>
                    <td className="px-4 py-3 text-center">{e.scoredCount}</td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={e.weightedScore} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} className="bg-muted/10 px-4 py-3">
                        <p className="mb-2 text-xs text-muted-foreground">
                          KPI details for{" "}
                          <span className="font-semibold text-foreground">{e.employeeName}</span>
                        </p>
                        <p className="mb-2 font-mono text-xs text-violet-900 dark:text-violet-200">
                          {e.calculation}
                        </p>
                        <LevelKpiTable rows={e.breakdown} emptyMessage="No KPIs" />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No employees in this department.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ListPagination
        page={page}
        pageSize={EMPLOYEE_PAGE_SIZE}
        total={filteredRows.length}
        onPageChange={(p) => {
          setPage(p);
          setExpanded(null);
        }}
        label="employees"
      />
    </div>
  );
}

function DepartmentCard({ dept }: { dept: DepartmentScorecard }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-left"
      >
        <Building2 className="h-4 w-4 text-sky-600" />
        <div className="flex-1">
          <p className="font-semibold">{dept.department}</p>
          <p className="text-xs text-muted-foreground">
            {dept.employeeCount} employees · {dept.kpiRows.length} dept KPIs
          </p>
        </div>
        <ScoreBadge score={dept.weightedScore} />
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2">
            <p className="font-mono text-xs text-sky-950">{dept.calculation}</p>
            {dept.kpiRows.length > 0 && dept.employeeRollupScore != null && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Employee rollup (reference): {dept.employeeRollupCalculation}
              </p>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Department KPIs
            </h4>
            <LevelKpiTable
              rows={dept.kpiRows}
              emptyMessage="No department-level KPIs — score uses employee average."
            />
          </div>

          {dept.employees.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Employees in department
              </h4>
              <div className="divide-y rounded-lg border border-border">
                {dept.employees.map((e) => (
                  <div key={e.employeeName} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{e.employeeName}</span>
                    <ScoreBadge score={e.weightedScore} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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

  const report = reportsByQuarter[quarter] ?? null;
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
            All plants — {quarter.toUpperCase()} scorecard
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allPlants.map((p) => (
              <Link
                key={p.unitId}
                href={appendUnitQuery(`/dashboard/reports/plant?quarter=${quarter}`, p.unitId)}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-indigo-400 hover:shadow-md"
              >
                <p className="font-semibold">{p.plantName}</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className="rounded-lg bg-emerald-50 p-2 text-center">
                    <p className="text-muted-foreground">Employee</p>
                    <p className="text-base font-bold text-emerald-800">{p.employeeScore ?? "—"}%</p>
                  </div>
                  <div className="rounded-lg bg-sky-50 p-2 text-center">
                    <p className="text-muted-foreground">Dept</p>
                    <p className="text-base font-bold text-sky-800">{p.departmentScore ?? "—"}%</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-2 text-center">
                    <p className="text-muted-foreground">Plant</p>
                    <p className="text-base font-bold text-indigo-800">{p.plantScore ?? "—"}%</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {p.employeeCount} employees · {p.departmentCount} depts · {p.plantKpiCount} plant KPIs
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Employee score"
              score={report.employees.overallScore}
              sub={`${report.employees.rows.length} employees`}
              tone="emerald"
            />
            <SummaryCard
              label="Department score"
              score={report.departments.overallScore}
              sub={`${report.departments.cards.length} departments`}
              tone="sky"
            />
            <SummaryCard
              label="Plant score"
              score={report.plantKpis.overallScore}
              sub={`${report.plantKpis.rows.length} plant KPIs`}
              tone="indigo"
            />
          </div>

          <ScorecardSection
            icon={User}
            iconClass="text-emerald-600"
            title="Section 1 — Employee KRA / KPI"
            subtitle={`Individual performance · ${report.plantName}`}
            score={report.employees.overallScore}
            methodologyTitle="How employee score is calculated"
            methodology={EMPLOYEE_SCORE_METHODOLOGY}
            calculation={report.employees.overallCalculation}
            calculationClass="border-emerald-200 bg-emerald-50/60 text-emerald-950"
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Total KPIs" value={report.employees.summary.total} />
              <MiniStat label="Achieved" value={report.employees.summary.met} tone="emerald" />
              <MiniStat label="Not achieved" value={report.employees.summary.notMet} tone="rose" />
              <MiniStat label="Pending" value={report.employees.summary.pending} tone="amber" />
            </div>
            <EmployeeSummaryTable rows={report.employees.rows} />
          </ScorecardSection>

          <ScorecardSection
            icon={Users}
            iconClass="text-sky-600"
            title="Section 2 — Department KRA / KPI"
            subtitle="Department-level targets and employee rollup"
            score={report.departments.overallScore}
            methodologyTitle="How department score is calculated"
            methodology={DEPARTMENT_SCORE_METHODOLOGY}
            calculation={report.departments.overallCalculation}
            calculationClass="border-sky-200 bg-sky-50/60 text-sky-950"
          >
            <div className="space-y-3">
              {report.departments.cards.map((d) => (
                <DepartmentCard key={d.department} dept={d} />
              ))}
            </div>
            {report.departments.cards.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  All department KPIs (combined)
                </h3>
                <LevelKpiTable
                  rows={report.departments.cards.flatMap((d) => d.kpiRows)}
                  extraColumns={[{ header: "Department", render: (r) => r.department ?? "—" }]}
                  emptyMessage="No department-level KPIs imported."
                />
              </div>
            )}
          </ScorecardSection>

          <ScorecardSection
            icon={BarChart3}
            iconClass="text-indigo-600"
            title="Section 3 — Plant business KPIs"
            subtitle="Sales, delivery, quality & plant parameters"
            score={report.plantKpis.overallScore}
            methodologyTitle="How plant score is calculated"
            methodology={PLANT_KPI_METHODOLOGY}
            calculation={report.plantKpis.overallCalculation}
            calculationClass="border-indigo-200 bg-indigo-50/60 text-indigo-950"
          >
            <LevelKpiTable
              rows={report.plantKpis.rows as LevelKpiRow[]}
              extraColumns={[
                { header: "Category", render: (r) => (r as PlantBusinessKpiRow).category ?? "—" },
              ]}
              emptyMessage="No plant-level KPIs imported (Plant Head sheet with sales, OTD, etc.)."
            />
          </ScorecardSection>
        </>
      )}

      {!showAllPlants && !report && unitId && (
        <p className="text-sm text-muted-foreground">No data for selected plant.</p>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  score,
  sub,
  tone,
}: {
  label: string;
  score: number | null;
  sub: string;
  tone: "emerald" | "sky" | "indigo";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
      : tone === "sky"
        ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white"
        : "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white";
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", cls)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{score ?? "—"}%</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
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
