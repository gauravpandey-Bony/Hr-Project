"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Pencil,
} from "lucide-react";
import { EmployeeDashboardBlock } from "@/components/ai/employee-dashboard-block";
import type { TeamReportBundle } from "@/lib/team-reports";
import { normalizeKpiEntryDates } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import type { Kpi, KpiEntry } from "@prisma/client";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-soft backdrop-blur-sm",
        tone === "green" && "border-emerald-200/80 bg-emerald-50/80",
        tone === "amber" && "border-amber-200/80 bg-amber-50/80",
        tone === "red" && "border-rose-200/80 bg-rose-50/80",
        (!tone || tone === "neutral") && "border-border/70 bg-card/80"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function TeamReportsClient({
  department,
  bundle,
  canEdit = false,
}: {
  department: string;
  bundle: TeamReportBundle;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);

  const { members, totals } = bundle;

  const kpisByMember = useMemo(() => {
    const map = new Map<string, KpiWithEntries[]>();
    for (const m of members) {
      map.set(
        m.employeeId,
        m.kpis.map(
          (k) =>
            ({
              ...k,
              entries: normalizeKpiEntryDates(k.entries ?? []),
            }) as KpiWithEntries
        )
      );
    }
    return map;
  }, [members]);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleExpandAll() {
    const next = !expandAll;
    setExpandAll(next);
    if (next) {
      setExpanded(Object.fromEntries(members.map((m) => [m.employeeId, true])));
    } else {
      setExpanded({});
    }
  }

  return (
    <div className="reports-grid-bg space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-[#0f172a] to-emerald-950 px-6 py-5 text-white shadow-elevated ring-1 ring-black/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            <BarChart3 className="h-3.5 w-3.5 text-emerald-300" />
            <span>{department} Team Reports</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/team"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-md hover:bg-white/20"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Team KRA edit
            </Link>
            <button
              type="button"
              onClick={handleExpandAll}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
            >
              {expandAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expandAll ? "Collapse all" : "Expand all reports"}
            </button>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
            <Pencil className="h-4 w-4 shrink-0" />
            <span>
              <strong>Manager:</strong> Expand an employee report — edit target / achieved on each KPI card, then{" "}
              <strong>Save</strong> or <strong>Add KPI</strong>
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="Team size" value={totals.headcount} />
        <StatPill label="Total KPIs" value={totals.kpiCount} />
        <StatPill label="On track" value={totals.onTrack} tone="green" />
        <StatPill label="Off target" value={totals.offTarget} tone="red" />
        <StatPill label="Team avg %" value={`${totals.avgProgress}%`} />
      </div>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Team comparison — click row for full report
          </p>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">#</th>
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">ECN</th>
                <th className="px-3 py-3">Designation</th>
                <th className="px-3 py-3 text-center">KPIs</th>
                <th className="px-3 py-3 text-center">On track</th>
                <th className="px-3 py-3 text-center">Off target</th>
                <th className="px-3 py-3 text-center">Avg %</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr
                  key={m.employeeId}
                  className="border-b border-border/40 transition hover:bg-muted/40"
                >
                  <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-3 font-medium text-foreground">{m.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{m.ecn ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{m.designation ?? "—"}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{m.kpiCount}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-emerald-700">{m.onTrack}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-red-700">{m.offTarget}</td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                        m.avgProgress >= 20
                          ? "bg-emerald-100 text-emerald-800"
                          : m.kpiCount === 0
                            ? "bg-slate-100 text-slate-500"
                            : "bg-red-100 text-red-800"
                      )}
                    >
                      {m.kpiCount ? `${m.avgProgress}%` : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(m.employeeId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                    >
                      {expanded[m.employeeId] ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Report
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {members.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
          No employees found on your team.
        </p>
      )}

      <div className="space-y-4">
        {members.map((m) => {
          const open = expanded[m.employeeId] || expandAll;
          if (!open) return null;
          return (
            <section key={m.employeeId} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  {m.avgProgress >= 20 ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  ) : m.offTarget > 0 ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  {m.name}
                  {m.ecn ? ` · ECN ${m.ecn}` : ""}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(m.employeeId)}
                    className="text-xs text-slate-500 underline"
                  >
                    Collapse
                  </button>
                </div>
              </div>
              <EmployeeDashboardBlock
                data={m.dashboard}
                editContext={
                  canEdit
                    ? {
                        canEdit: true,
                        kpis: kpisByMember.get(m.employeeId) ?? [],
                        sheetMeta: m.sheetMeta,
                        ownerName: m.name,
                        onMutate: () => router.refresh(),
                      }
                    : undefined
                }
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
