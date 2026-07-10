"use client";

import { useMemo } from "react";
import type { Kpi, KpiEntry } from "@prisma/client";
import { buildQuarterlyReportRows } from "@/lib/kra/quarterly-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { quarterStatusClass } from "@/lib/kra/quarter-status";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import { QuarterScoreCircles } from "@/components/ui/quarter-score-circles";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

const QUARTERS: FiscalQuarter[] = ["q1", "q2", "q3", "q4"];

export function EmployeeKraDashboard({
  employeeName,
  departmentLabel,
  kpis,
  quarter,
}: {
  employeeName: string;
  departmentLabel: string;
  kpis: KpiWithEntries[];
  quarter: FiscalQuarter;
}) {
  const byQuarter = useMemo(
    () =>
      Object.fromEntries(
        QUARTERS.map((q) => [
          q,
          buildQuarterlyReportRows(
            kpis.map((k) => ({
              id: k.id,
              name: k.name,
              kraName: k.kraName,
              ownerName: k.ownerName,
              department: k.department,
              weightage: k.weightage,
              quarterTargets: k.quarterTargets,
              kpiLevel: k.kpiLevel,
            })),
            q,
            employeeName
          ),
        ])
      ) as Record<FiscalQuarter, ReturnType<typeof buildQuarterlyReportRows>>,
    [kpis, employeeName]
  );

  const activeRows = byQuarter[quarter] ?? [];
  const met = activeRows.filter((r) => r.status === "met").length;
  const pending = activeRows.filter((r) => r.status === "pending").length;
  const notMet = activeRows.filter((r) => r.status === "not_met").length;

  const quarterScores = QUARTERS.map((q) => {
    const rows = byQuarter[q] ?? [];
    const scored = rows.filter((r) => r.status !== "pending");
    const pct =
      scored.length > 0
        ? Math.round((rows.filter((r) => r.status === "met").length / scored.length) * 100)
        : null;
    return { q, pct };
  });

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employee performance report
          </p>
          <h3 className="text-xl font-bold text-slate-900">{employeeName}</h3>
          <p className="text-sm text-slate-500">{departmentLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge label="On track" value={met} tone="emerald" />
          <Badge label="Pending" value={pending} tone="amber" />
          <Badge label="Off track" value={notMet} tone="rose" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-sm">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <BarChart3 className="h-3.5 w-3.5" />
            Quarter achievement rate
          </p>
          <QuarterScoreCircles
            size="md"
            activeId={quarter}
            items={quarterScores.map(({ q, pct }) => ({
              id: q,
              label: q.toUpperCase(),
              score: pct,
            }))}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white/70">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-left uppercase text-slate-500">
                <th className="px-3 py-2">KRA / KPI</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="px-3 py-2 text-center">
                    {q.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...new Map(activeRows.map((r) => [r.kpiName, r])).values()]
                .slice(0, 8)
                .map((row) => (
                  <tr key={row.kpiId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{row.kpiName}</p>
                      <p className="text-slate-500">{row.kraName}</p>
                    </td>
                    {QUARTERS.map((q) => {
                      const qRow = (byQuarter[q] ?? []).find((r) => r.kpiId === row.kpiId);
                      return (
                        <td key={q} className="px-3 py-2 text-center">
                          {qRow ? (
                            <span
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 font-medium",
                                quarterStatusClass(qRow.status)
                              )}
                            >
                              {qRow.achieved !== "—" ? qRow.achieved : "—"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Badge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose";
}) {
  const colors = {
    emerald: "bg-emerald-500/15 text-emerald-800",
    amber: "bg-amber-500/15 text-amber-900",
    rose: "bg-rose-500/15 text-rose-800",
  };
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", colors[tone])}>
      {label}: {value}
    </span>
  );
}
