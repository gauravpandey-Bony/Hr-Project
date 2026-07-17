"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Kpi, KpiEntry } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatWeightage } from "@/lib/kra/weightage";
import type { KraEmployeeRow } from "@/lib/kra-sheets.server";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

type QuarterSide = "target" | "achieved" | "managerAchieved";

type QuarterData = {
  annualTarget?: string;
  lastYearAchieved?: string;
  q1: { target: string; achieved?: string; managerAchieved?: string };
  q2: { target: string; achieved?: string; managerAchieved?: string };
  q3: { target: string; achieved?: string; managerAchieved?: string };
  q4: { target: string; achieved?: string; managerAchieved?: string };
};

function parseQuarters(raw: string | null): QuarterData {
  const empty = {
    q1: { target: "", achieved: "", managerAchieved: "" },
    q2: { target: "", achieved: "", managerAchieved: "" },
    q3: { target: "", achieved: "", managerAchieved: "" },
    q4: { target: "", achieved: "", managerAchieved: "" },
  };
  if (!raw) return empty;
  try {
    return { ...empty, ...(JSON.parse(raw) as QuarterData) };
  } catch {
    return empty;
  }
}

function serializeQuarters(q: QuarterData): string {
  return JSON.stringify(q);
}

function groupRows(kpis: KpiWithEntries[]) {
  const groups: { kraName: string; srNo: number; items: KpiWithEntries[] }[] = [];
  for (const kpi of kpis) {
    const kra = kpi.kraName?.trim() || "—";
    const last = groups[groups.length - 1];
    if (last && last.kraName === kra) {
      last.items.push(kpi);
    } else {
      groups.push({
        kraName: kra,
        srNo: groups.length + 1,
        items: [kpi],
      });
    }
  }
  return groups;
}

const th =
  "border border-slate-300 bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700";
const td = "border border-slate-300 px-2 py-1.5 text-[11px] text-slate-800 align-middle";
const COL_COUNT = 19;

function CellInput({
  value,
  onChange,
  editable,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  className?: string;
}) {
  if (!editable) {
    return <span className={className}>{value || "—"}</span>;
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full min-w-[48px] rounded border border-sky-300 bg-sky-50/80 px-1.5 py-0.5 text-center text-[11px] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-400",
        className
      )}
    />
  );
}

export function LogisticKraSheetEditable({
  employee,
  kpis: initialKpis,
  departmentLabel = "Logistics",
  editTargets = false,
  editAchieved = false,
  editManagerAchieved = false,
}: {
  employee: KraEmployeeRow;
  kpis: KpiWithEntries[];
  departmentLabel?: string;
  editTargets?: boolean;
  editAchieved?: boolean;
  /** Only reporting manager / admin */
  editManagerAchieved?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, QuarterData>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const next: Record<string, QuarterData> = {};
    for (const kpi of initialKpis) {
      next[kpi.id] = parseQuarters(kpi.quarterTargets);
    }
    setRows(next);
    setDirty(false);
  }, [initialKpis]);

  const groups = useMemo(() => groupRows(initialKpis), [initialKpis]);
  const fiscalLabel = "2026-2027";
  const canSave = dirty && (editTargets || editAchieved || editManagerAchieved);

  const updateCell = useCallback(
    (
      kpiId: string,
      field:
        | "lastYearAchieved"
        | "annualTarget"
        | { quarter: "q1" | "q2" | "q3" | "q4"; side: QuarterSide },
      value: string
    ) => {
      setRows((prev) => {
        const q = { ...prev[kpiId] };
        if (field === "lastYearAchieved") q.lastYearAchieved = value;
        else if (field === "annualTarget") q.annualTarget = value;
        else {
          q[field.quarter] = {
            ...q[field.quarter],
            [field.side]: value,
          };
        }
        return { ...prev, [kpiId]: q };
      });
      setDirty(true);
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = initialKpis.map(async (kpi) => {
        const quarterTargets = serializeQuarters(rows[kpi.id] ?? parseQuarters(kpi.quarterTargets));
        const res = await fetch(`/api/kpis/${kpi.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quarterTargets }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed to save ${kpi.name}`);
        }
        return res.json();
      });
      await Promise.all(updates);
      toast.success("KRA sheet saved");
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const helpText = (() => {
    const bits: string[] = [];
    if (editTargets) bits.push("Target");
    if (editAchieved) bits.push("Achieved");
    if (editManagerAchieved) bits.push("Manager Achieved (RM only)");
    if (bits.length === 0) return null;
    return `Edit: ${bits.join(" · ")}`;
  })();

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      {(editTargets || editAchieved || editManagerAchieved) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <p className="text-xs text-slate-600">{helpText}</p>
          {canSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save changes
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse text-left">
          <thead>
            <tr>
              <th
                colSpan={COL_COUNT}
                className="border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold text-slate-900"
              >
                KRA/ KPI-{fiscalLabel} -{departmentLabel}
              </th>
            </tr>
            <tr className="bg-white text-[11px]">
              <th colSpan={2} className="border border-slate-300 px-2 py-1 font-semibold text-slate-600">
                NAME
              </th>
              <th colSpan={3} className="border border-slate-300 px-2 py-1 font-bold text-slate-900">
                {employee.name}
              </th>
              <th className="border border-slate-300 px-2 py-1 font-semibold text-slate-600">DOJ</th>
              <th className="border border-slate-300 px-2 py-1 text-slate-800">{employee.doj ?? "—"}</th>
              <th className="border border-slate-300 px-2 py-1 font-semibold text-slate-600">E.code</th>
              <th className="border border-slate-300 px-2 py-1 text-slate-800">{employee.ecn ?? "—"}</th>
              <th className="border border-slate-300 px-2 py-1 font-semibold text-slate-600">Department</th>
              <th className="border border-slate-300 px-2 py-1 text-slate-800">{employee.department ?? "—"}</th>
              <th className="border border-slate-300 px-2 py-1 font-semibold text-slate-600">DESIGNATION</th>
              <th colSpan={7} className="border border-slate-300 px-2 py-1 text-slate-800">
                {employee.designation ?? "—"}
              </th>
            </tr>
            <tr>
              <th className={th}>Sno</th>
              <th className={th}>Primary: KRA</th>
              <th className={cn(th, "min-w-[180px]")}>KPI / Measurement</th>
              <th className={th}>Weightage (%)</th>
              <th className={cn(th, "min-w-[100px]")}>Last Year Achieved 2025-2026</th>
              <th className={cn(th, "min-w-[100px]")}>Current Year Target {fiscalLabel}</th>
              <th className={cn(th, "text-center")} colSpan={3}>
                Q1
              </th>
              <th className={cn(th, "text-center")} colSpan={3}>
                Q2
              </th>
              <th className={cn(th, "text-center")} colSpan={3}>
                Q3
              </th>
              <th className={cn(th, "text-center")} colSpan={3}>
                Q4
              </th>
              <th className={th}>SCORE</th>
            </tr>
            <tr>
              <th className={th} colSpan={6} />
              {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                <Fragment key={q}>
                  <th className={cn(th, "text-center")}>Target</th>
                  <th className={cn(th, "text-center")}>Achieved</th>
                  <th className={cn(th, "text-center text-amber-800")}>Manager Achieved</th>
                </Fragment>
              ))}
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.items.map((kpi, idx) => {
                const q = rows[kpi.id] ?? parseQuarters(kpi.quarterTargets);
                return (
                  <tr key={kpi.id} className="hover:bg-slate-50/80">
                    {idx === 0 && (
                      <td rowSpan={group.items.length} className={cn(td, "text-center font-semibold")}>
                        {group.srNo}
                      </td>
                    )}
                    {idx === 0 && (
                      <td rowSpan={group.items.length} className={cn(td, "font-medium text-slate-700")}>
                        {group.kraName}
                      </td>
                    )}
                    <td className={td}>{kpi.name}</td>
                    <td className={cn(td, "text-center font-medium")}>
                      {formatWeightage(kpi.weightage)}
                    </td>
                    <td className={td}>
                      <CellInput
                        value={q.lastYearAchieved ?? ""}
                        editable={editTargets}
                        onChange={(v) => updateCell(kpi.id, "lastYearAchieved", v)}
                      />
                    </td>
                    <td className={td}>
                      <CellInput
                        value={q.annualTarget ?? String(kpi.targetValue ?? "")}
                        editable={editTargets}
                        onChange={(v) => updateCell(kpi.id, "annualTarget", v)}
                      />
                    </td>
                    {(["q1", "q2", "q3", "q4"] as const).map((key) => (
                      <Fragment key={`${kpi.id}-${key}`}>
                        <td className={cn(td, "text-center")}>
                          <CellInput
                            value={q[key]?.target ?? ""}
                            editable={editTargets}
                            onChange={(v) => updateCell(kpi.id, { quarter: key, side: "target" }, v)}
                          />
                        </td>
                        <td className={cn(td, "text-center", editAchieved && "bg-emerald-50/50")}>
                          <CellInput
                            value={q[key]?.achieved ?? ""}
                            editable={editAchieved}
                            onChange={(v) =>
                              updateCell(kpi.id, { quarter: key, side: "achieved" }, v)
                            }
                            className={editAchieved ? "border-emerald-400 bg-white" : undefined}
                          />
                        </td>
                        <td
                          className={cn(
                            td,
                            "text-center",
                            editManagerAchieved && "bg-amber-50/70"
                          )}
                        >
                          <CellInput
                            value={q[key]?.managerAchieved ?? ""}
                            editable={editManagerAchieved}
                            onChange={(v) =>
                              updateCell(kpi.id, { quarter: key, side: "managerAchieved" }, v)
                            }
                            className={
                              editManagerAchieved
                                ? "border-amber-400 bg-white"
                                : undefined
                            }
                          />
                        </td>
                      </Fragment>
                    ))}
                    <td className={cn(td, "text-center text-slate-500")}>—</td>
                  </tr>
                );
              })
            )}
            {initialKpis.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-sm text-slate-500">
                  No KPI rows — upload Excel or add data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
