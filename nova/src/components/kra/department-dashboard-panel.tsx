"use client";

import { cn } from "@/lib/utils";
import type { DepartmentDashboardData } from "@/lib/kra/department-dashboard";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { scoreToneClass, scoreSoftBgClass } from "@/lib/score-tone";
import {
  QuarterScoreCircles,
  QuarterScoreDot,
} from "@/components/ui/quarter-score-circles";
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
          <h2 className="text-lg font-semibold text-slate-900">
            {data.departmentName} — Department Dashboard
          </h2>
          <p className="text-sm text-slate-500">
            Team overview — click an employee for Q1–Q4 report & fill-up
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1">
          {QUARTERS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onQuarterChange(q.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                quarter === q.id
                  ? "bg-[#1e3a5f] text-white shadow"
                  : "text-slate-500 hover:bg-white"
              )}
            >
              {q.label}
              <span className="ml-1 hidden opacity-80 sm:inline">{q.months}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Dept score"
          value={data.departmentScore != null ? `${data.departmentScore}%` : "—"}
          tone={scoreToneClass(data.departmentScore)}
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
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Team scores — {quarter.toUpperCase()}
          </h3>
          <div className="space-y-3">
            {data.team.length === 0 ? (
              <p className="text-sm text-slate-500">No employees in this department.</p>
            ) : (
              data.team.map((member) => (
                <button
                  key={member.employeeId}
                  type="button"
                  onClick={() => onSelectEmployee(member.employeeId)}
                  className="block w-full text-left"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{member.name}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        scoreToneClass(member.activeQuarterScore)
                      )}
                    >
                      {member.activeQuarterScore != null
                        ? `${member.activeQuarterScore}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
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

        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-sky-50/50 p-5 shadow-sm">
          <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Quarter trend (department avg)
          </h3>
          <QuarterScoreCircles
            size="md"
            activeId={quarter}
            items={QUARTERS.map((q) => ({
              id: q.id,
              label: q.label,
              score: data.scoreByQuarter[q.id],
            }))}
          />
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Reporting Manager</th>
              <th className="px-4 py-3">KPIs</th>
              <th className="px-4 py-3">Q1</th>
              <th className="px-4 py-3">Q2</th>
              <th className="px-4 py-3">Q3</th>
              <th className="px-4 py-3">Q4</th>
              <th className="px-4 py-3">{quarter.toUpperCase()}</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.team.map((member) => (
              <tr
                key={member.employeeId}
                className={cn(
                  "cursor-pointer border-b border-slate-100 transition hover:bg-sky-50/60",
                  selectedEmployeeId === member.employeeId && "bg-sky-500/10"
                )}
                onClick={() => onSelectEmployee(member.employeeId)}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{member.name}</td>
                <td className="px-4 py-3 text-slate-500">{member.designation ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{member.managerName ?? "—"}</td>
                <td className="px-4 py-3">{member.kpiCount}</td>
                {QUARTERS.map((q) => (
                  <td key={q.id} className="px-4 py-3">
                    <QuarterScoreDot score={member.scores[q.id]} />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                      scoreSoftBgClass(member.activeQuarterScore)
                    )}
                  >
                    {member.activeQuarterScore != null
                      ? `${member.activeQuarterScore}%`
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                    Fill KPI
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
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <p className={cn("mt-1 text-2xl font-bold", tone)}>{value}</p>
    </div>
  );
}
