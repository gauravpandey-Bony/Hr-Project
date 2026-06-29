"use client";

import { cn } from "@/lib/utils";
import type { DepartmentDashboardData } from "@/lib/kra/department-dashboard";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";

const QUARTERS: { id: FiscalQuarter; label: string; months: string }[] = [
  { id: "q1", label: "Q1", months: "Apr – Jun" },
  { id: "q2", label: "Q2", months: "Jul – Sep" },
  { id: "q3", label: "Q3", months: "Oct – Dec" },
  { id: "q4", label: "Q4", months: "Jan – Mar" },
];

function scoreTone(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-rose-600";
}

export function DepartmentDashboardPanel({
  data,
  quarter,
  onQuarterChange,
  onSelectEmployee,
  selectedEmployeeId,
}: {
  data: DepartmentDashboardData;
  quarter: FiscalQuarter;
  onQuarterChange: (q: FiscalQuarter) => void;
  onSelectEmployee: (employeeId: string) => void;
  selectedEmployeeId: string | null;
}) {
  const maxTeamScore = Math.max(
    ...data.team.map((t) => t.activeQuarterScore ?? 0),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{data.departmentName} — Department Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Team overview — click an employee for Q1–Q4 report & fill-up
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
          {QUARTERS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onQuarterChange(q.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                quarter === q.id
                  ? "bg-emerald-600 text-white shadow"
                  : "text-muted-foreground hover:bg-background"
              )}
            >
              {q.label}
              <span className="ml-1 hidden sm:inline opacity-80">{q.months}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Dept score"
          value={data.departmentScore != null ? `${data.departmentScore}%` : "—"}
          tone={scoreTone(data.departmentScore)}
        />
        <StatCard label="Employees" value={String(data.employeeCount)} icon={Users} />
        <StatCard label="Total KPIs" value={String(data.totalKpis)} icon={BarChart3} />
        <StatCard
          label="On track"
          value={String(data.summary.met)}
          icon={CheckCircle2}
          tone="text-emerald-600"
        />
        <StatCard
          label="Pending fill-up"
          value={String(data.summary.pending)}
          icon={Clock}
          tone="text-amber-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Team scores — {quarter.toUpperCase()}
          </h3>
          <div className="space-y-3">
            {data.team.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees in this department.</p>
            ) : (
              data.team.map((member) => (
                <button
                  key={member.employeeId}
                  type="button"
                  onClick={() => onSelectEmployee(member.employeeId)}
                  className="block w-full text-left"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{member.name}</span>
                    <span className={cn("font-semibold", scoreTone(member.activeQuarterScore))}>
                      {member.activeQuarterScore != null
                        ? `${member.activeQuarterScore}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${((member.activeQuarterScore ?? 0) / maxTeamScore) * 100}%`,
                      }}
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quarter trend (department avg)
          </h3>
          <div className="flex h-40 items-end justify-between gap-2">
            {QUARTERS.map((q) => {
              const score = data.scoreByQuarter[q.id];
              const h = score != null ? Math.max(8, (score / 100) * 100) : 8;
              return (
                <div key={q.id} className="flex flex-1 flex-col items-center gap-1">
                  <span className={cn("text-xs font-semibold", scoreTone(score))}>
                    {score != null ? `${score}%` : "—"}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      quarter === q.id ? "bg-emerald-500" : "bg-emerald-500/40"
                    )}
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{q.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </p>
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
            {data.alerts.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Reporting Manager</th>
              <th className="px-4 py-3">KPIs</th>
              <th className="px-4 py-3">Q1</th>
              <th className="px-4 py-3">Q2</th>
              <th className="px-4 py-3">Q3</th>
              <th className="px-4 py-3">Q4</th>
              <th className="px-4 py-3">{quarter.toUpperCase()}</th>
            </tr>
          </thead>
          <tbody>
            {data.team.map((member) => (
              <tr
                key={member.employeeId}
                className={cn(
                  "cursor-pointer border-b transition hover:bg-muted/30",
                  selectedEmployeeId === member.employeeId && "bg-sky-500/10"
                )}
                onClick={() => onSelectEmployee(member.employeeId)}
              >
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {member.designation ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {member.managerName ?? "—"}
                </td>
                <td className="px-4 py-3">{member.kpiCount}</td>
                {QUARTERS.map((q) => (
                  <td key={q.id} className="px-4 py-3">
                    <span className={cn("font-medium", scoreTone(member.scores[q.id]))}>
                      {member.scores[q.id] != null ? `${member.scores[q.id]}%` : "—"}
                    </span>
                  </td>
                ))}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                      member.activeQuarterScore != null && member.activeQuarterScore >= 90
                        ? "bg-emerald-500/15 text-emerald-700"
                        : member.activeQuarterScore != null && member.activeQuarterScore >= 70
                          ? "bg-amber-500/15 text-amber-800"
                          : member.activeQuarterScore != null
                            ? "bg-rose-500/15 text-rose-700"
                            : "bg-muted text-muted-foreground"
                    )}
                  >
                    {member.activeQuarterScore != null ? `${member.activeQuarterScore}%` : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className={cn("mt-1 text-2xl font-bold", tone)}>{value}</p>
    </div>
  );
}
