"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  quarterlyReportSummary,
  type QuarterlyReportRow,
} from "@/lib/kra/quarterly-report";
import { quarterStatusClass } from "@/lib/kra/quarter-status";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { BarChart3, CheckCircle2, Clock, XCircle } from "lucide-react";

const QUARTERS: { id: FiscalQuarter; label: string; months: string }[] = [
  { id: "q1", label: "Q1", months: "Apr – Jun" },
  { id: "q2", label: "Q2", months: "Jul – Sep" },
  { id: "q3", label: "Q3", months: "Oct – Dec" },
  { id: "q4", label: "Q4", months: "Jan – Mar" },
];

export function QuarterlyReportClient({
  rowsByQuarter,
  employees,
  isEmployeeView,
  initialEmployeeFilter = null,
}: {
  rowsByQuarter: Record<FiscalQuarter, QuarterlyReportRow[]>;
  employees: string[];
  isEmployeeView: boolean;
  initialEmployeeFilter?: string | null;
}) {
  const [quarter, setQuarter] = useState<FiscalQuarter>("q1");
  const [employeeFilter, setEmployeeFilter] = useState<string>(() => {
    const wanted = initialEmployeeFilter?.trim();
    if (!wanted) return "all";
    const match = employees.find(
      (name) => name.toLowerCase() === wanted.toLowerCase()
    );
    return match ?? wanted;
  });

  const baseRows = rowsByQuarter[quarter] ?? [];
  const rows = useMemo(() => {
    if (isEmployeeView || employeeFilter === "all") return baseRows;
    return baseRows.filter(
      (r) => r.employeeName.toLowerCase() === employeeFilter.toLowerCase()
    );
  }, [baseRows, employeeFilter, isEmployeeView]);

  const summary = quarterlyReportSummary(rows);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {QUARTERS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setQuarter(q.id)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition",
              quarter === q.id
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            {q.label}
            <span className="ml-1.5 text-xs opacity-80">({q.months})</span>
          </button>
        ))}
      </div>

      {!isEmployeeView && employees.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Employee
          </span>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="all">All employees</option>
            {employees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={BarChart3}
          label="Total KPIs"
          value={summary.total}
          className="border-slate-200 bg-slate-50"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Achieved"
          value={summary.met}
          className="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <SummaryCard
          icon={XCircle}
          label="Not achieved"
          value={summary.notMet}
          className="border-rose-200 bg-rose-50 text-rose-800"
        />
        <SummaryCard
          icon={Clock}
          label="Pending"
          value={summary.pending}
          className="border-amber-200 bg-amber-50 text-amber-800"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                {!isEmployeeView && <th className="px-4 py-3 font-semibold">Employee</th>}
                <th className="px-4 py-3 font-semibold">KRA</th>
                <th className="px-4 py-3 font-semibold">KPI</th>
                <th className="px-4 py-3 font-semibold text-center">Wt %</th>
                <th className="px-4 py-3 font-semibold text-center">Target</th>
                <th className="px-4 py-3 font-semibold text-center">Achieved</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.kpiId} className="border-b border-border/60 hover:bg-muted/30">
                  {!isEmployeeView && (
                    <td className="px-4 py-2.5 font-medium">{row.employeeName}</td>
                  )}
                  <td className="px-4 py-2.5 text-muted-foreground">{row.kraName}</td>
                  <td className="px-4 py-2.5">{row.kpiName}</td>
                  <td className="px-4 py-2.5 text-center">{row.weightage}</td>
                  <td className="px-4 py-2.5 text-center">{row.target}</td>
                  <td className="px-4 py-2.5 text-center font-medium">{row.achieved}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        quarterStatusClass(row.status)
                      )}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={isEmployeeView ? 6 : 7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No KPI data for this quarter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", className)}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
