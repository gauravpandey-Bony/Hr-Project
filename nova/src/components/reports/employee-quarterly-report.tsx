"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, Plus, Save, Target, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeQuarterlyKpiRow } from "@/lib/ai/employee-report";
import {
  kpiMetricsForFilter,
  quarterFilterLabel,
  sortQuarterlyRowsByStatus,
  type QuarterFilter,
} from "@/lib/ai/employee-quarter-filter";
import { emptyQuarterTargets, type SheetMeta } from "@/lib/kra-sheets";
import { normalizeQuarterTargets } from "@/lib/kra/target-format";
import { FISCAL_YEAR, PLANT_UNIT } from "@/lib/plant-37p";
import type { Kpi, KpiEntry } from "@prisma/client";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

type QuarterData = {
  q1: { target: string; achieved?: string };
  q2: { target: string; achieved?: string };
  q3: { target: string; achieved?: string };
  q4: { target: string; achieved?: string };
};

type RowDraft = {
  kraName: string;
  name: string;
  unit: string;
  weightage: string;
  targetValue: string;
  quarters: QuarterData;
};

const QUARTERS = [
  { key: "q1" as const, label: "Q1", accent: "from-sky-500/15 to-sky-500/5 border-sky-200/80" },
  { key: "q2" as const, label: "Q2", accent: "from-violet-500/15 to-violet-500/5 border-violet-200/80" },
  { key: "q3" as const, label: "Q3", accent: "from-amber-500/15 to-amber-500/5 border-amber-200/80" },
  { key: "q4" as const, label: "Q4", accent: "from-emerald-500/15 to-emerald-500/5 border-emerald-200/80" },
];

const inputClass =
  "mt-0.5 w-full rounded-md border border-slate-200 !bg-white px-2 py-1 text-xs font-medium !text-slate-800 caret-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30";

function parseQuarters(raw: string | null): QuarterData {
  if (!raw) return JSON.parse(emptyQuarterTargets()) as QuarterData;
  try {
    return JSON.parse(raw) as QuarterData;
  } catch {
    return JSON.parse(emptyQuarterTargets()) as QuarterData;
  }
}

function kpiToDraft(kpi: KpiWithEntries): RowDraft {
  return {
    kraName: kpi.kraName ?? "",
    name: kpi.name,
    unit: kpi.unit,
    weightage: kpi.weightage != null ? String(kpi.weightage * 100) : "",
    targetValue: String(kpi.targetValue),
    quarters: normalizeQuarterTargets(parseQuarters(kpi.quarterTargets), kpi.unit),
  };
}

function displayCell(value: string | undefined): string {
  const t = value?.trim() ?? "";
  return t || "—";
}

function weightageForFilter(
  filter: QuarterFilter,
  kpi: EmployeeQuarterlyKpiRow,
  draftWeightage?: string
): { label: string; value: string } {
  if (filter === "annual") {
    return { label: "Annual", value: "100%" };
  }
  const quarter = QUARTERS.find((q) => q.key === filter);
  if (quarter) {
    const w = draftWeightage?.trim();
    return { label: quarter.label, value: w ? `${w}%` : kpi.weightage };
  }
  return { label: "Annual", value: kpi.weightage };
}

function WeightageBox({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 to-primary/10 p-4 text-center shadow-inner">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Target className="h-4 w-4 text-primary" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{label}</p>
      {editable && onChange ? (
        <input
          className={cn(inputClass, "mt-1 text-center font-bold")}
          value={value.replace("%", "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="5"
        />
      ) : (
        <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
      )}
    </div>
  );
}

function StatusPill({ status, progress }: { status: string; progress: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm",
        status === "green" && "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25",
        status === "amber" && "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/25",
        status === "red" && "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/25"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "green" && "bg-emerald-500",
          status === "amber" && "bg-amber-500",
          status === "red" && "bg-rose-500"
        )}
      />
      {status === "green" ? "On track" : "Off target"} · {progress}
    </span>
  );
}

function QuarterCell({
  label,
  target,
  achieved,
  accent,
  editable,
  onTargetChange,
  onAchievedChange,
}: {
  label: string;
  target: string;
  achieved: string;
  accent: string;
  editable?: boolean;
  onTargetChange?: (v: string) => void;
  onAchievedChange?: (v: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-gradient-to-b p-3 shadow-sm",
        accent,
        editable && "ring-2 ring-emerald-200/80"
      )}
    >
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="space-y-2">
        <div className="rounded-lg bg-white/80 px-2 py-1.5 ring-1 ring-black/5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Target</p>
          {editable && onTargetChange ? (
            <input
              className={inputClass}
              value={target === "—" ? "" : target}
              onChange={(e) => onTargetChange(e.target.value)}
            />
          ) : (
            <p className="mt-0.5 text-xs font-medium leading-snug text-slate-800">{target}</p>
          )}
        </div>
        <div className="rounded-lg bg-white/60 px-2 py-1.5 ring-1 ring-black/5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Achieved</p>
          {editable && onAchievedChange ? (
            <input
              className={inputClass}
              value={achieved === "—" ? "" : achieved}
              onChange={(e) => onAchievedChange(e.target.value)}
            />
          ) : (
            <p className="mt-0.5 text-xs font-medium leading-snug text-slate-600">{achieved}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiReportCard({
  kpi,
  index,
  filter,
  kpiRecord,
  canEdit,
  onSaved,
  onRemoved,
}: {
  kpi: EmployeeQuarterlyKpiRow;
  index: number;
  filter: QuarterFilter;
  kpiRecord?: KpiWithEntries;
  canEdit?: boolean;
  onSaved?: () => void;
  onRemoved?: () => void;
}) {
  const editable = Boolean(canEdit && kpiRecord);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kpiRecord) setDraft(kpiToDraft(kpiRecord));
  }, [kpiRecord]);

  const statusMeta = useMemo(() => {
    const metrics = kpiMetricsForFilter(kpi, filter);
    return { status: metrics.status, progress: `${metrics.progressNum}%` };
  }, [filter, kpi]);

  const activeQuarter =
    filter !== "all" && filter !== "annual"
      ? QUARTERS.find((q) => q.key === filter)
      : null;
  const weightageMeta = weightageForFilter(filter, kpi, draft?.weightage);

  function updateQuarter(q: keyof QuarterData, field: "target" | "achieved", value: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            quarters: {
              ...prev.quarters,
              [q]: { ...prev.quarters[q], [field]: value },
            },
          }
        : prev
    );
  }

  async function saveRow() {
    if (!kpiRecord || !draft) return;
    setSaving(true);
    setError(null);
    const weight = draft.weightage.trim() ? parseFloat(draft.weightage) / 100 : undefined;
    const res = await fetch(`/api/kpis/${kpiRecord.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kraName: draft.kraName,
        name: draft.name,
        unit: draft.unit,
        weightage: weight,
        targetValue: parseFloat(draft.targetValue) || 0,
        quarterTargets: JSON.stringify(draft.quarters),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Save failed");
      return;
    }
    onSaved?.();
  }

  async function removeRow() {
    if (!kpiRecord || !confirm(`Remove "${kpi.name}"?`)) return;
    setSaving(true);
    const res = await fetch(`/api/kpis/${kpiRecord.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setError("Remove failed");
      return;
    }
    onRemoved?.();
  }

  const qDraft = (key: keyof QuarterData) => ({
    target: displayCell(draft?.quarters[key].target),
    achieved: displayCell(draft?.quarters[key].achieved),
  });

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md",
        editable ? "border-emerald-200/80" : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-snug text-slate-900">{kpi.name}</h4>
            {kpi.kraName && (
              <p className="mt-0.5 text-xs text-slate-500">KRA · {kpi.kraName}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {kpi.unit}
              </span>
              <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                Weightage {weightageMeta.value}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editable && (
            <>
              <button
                type="button"
                onClick={() => void saveRow()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => void removeRow()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </>
          )}
          <StatusPill status={statusMeta.status} progress={statusMeta.progress} />
        </div>
      </div>

      {error && (
        <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>
      )}

      {filter === "annual" ? (
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div className="flex flex-col justify-center rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50/50 p-4 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Annual target</p>
            <p className="mt-1 text-sm font-bold text-indigo-900">{kpi.annualTarget}</p>
          </div>
          <div className="flex flex-col justify-center rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Latest achieved</p>
            <p className="mt-1 text-sm font-bold text-emerald-900">{kpi.currentFormatted}</p>
          </div>
        </div>
      ) : filter !== "all" && activeQuarter ? (
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,140px)_1fr] sm:px-5">
          <WeightageBox
            label={weightageMeta.label}
            value={weightageMeta.value}
            editable={editable}
            onChange={(v) => setDraft((prev) => (prev ? { ...prev, weightage: v } : prev))}
          />
          <QuarterCell
            label={activeQuarter.label}
            target={editable ? qDraft(activeQuarter.key).target : kpi.quarters[activeQuarter.key].target}
            achieved={
              editable ? qDraft(activeQuarter.key).achieved : kpi.quarters[activeQuarter.key].achieved
            }
            accent={activeQuarter.accent}
            editable={editable}
            onTargetChange={(v) => updateQuarter(activeQuarter.key, "target", v)}
            onAchievedChange={(v) => updateQuarter(activeQuarter.key, "achieved", v)}
          />
        </div>
      ) : (
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,140px)_1fr] sm:px-5">
          <WeightageBox label={weightageMeta.label} value={weightageMeta.value} />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUARTERS.map((q) => (
              <QuarterCell
                key={q.key}
                label={q.label}
                target={kpi.quarters[q.key].target}
                achieved={kpi.quarters[q.key].achieved}
                accent={q.accent}
              />
            ))}
          </div>
        </div>
      )}

      {editable && filter === "annual" && draft && (
        <div className="border-t border-emerald-100 bg-emerald-50/30 px-4 py-4 sm:px-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            Edit quarterly values
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUARTERS.map((q) => (
              <QuarterCell
                key={q.key}
                label={q.label}
                target={qDraft(q.key).target}
                achieved={qDraft(q.key).achieved}
                accent={q.accent}
                editable
                onTargetChange={(v) => updateQuarter(q.key, "target", v)}
                onAchievedChange={(v) => updateQuarter(q.key, "achieved", v)}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export type EmployeeReportEditContext = {
  canEdit: boolean;
  kpis: KpiWithEntries[];
  sheetMeta: SheetMeta;
  ownerName: string;
  plantUnit?: string;
  onMutate: () => void;
};

export function EmployeeQuarterlyReport({
  rows,
  filter,
  editContext,
}: {
  rows: EmployeeQuarterlyKpiRow[];
  filter: QuarterFilter;
  editContext?: EmployeeReportEditContext;
}) {
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const kpiById = useMemo(() => {
    const map = new Map<string, KpiWithEntries>();
    for (const k of editContext?.kpis ?? []) map.set(k.id, k);
    return map;
  }, [editContext?.kpis]);

  const sortedRows = useMemo(
    () => sortQuarterlyRowsByStatus(rows, filter),
    [rows, filter]
  );

  async function addKpiRow() {
    if (!editContext?.sheetMeta) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New KPI measure",
        kraName: "New KRA",
        category: editContext.sheetMeta.category,
        unit: "%",
        targetValue: 100,
        direction: "HIGHER_IS_BETTER",
        frequency: "MONTHLY",
        department: editContext.sheetMeta.department,
        kpiLevel: editContext.sheetMeta.kpiLevel,
        plantUnit: editContext.plantUnit ?? PLANT_UNIT,
        ...(FISCAL_YEAR ? { fiscalYear: FISCAL_YEAR } : {}),
        weightage: 0.05,
        quarterTargets: emptyQuarterTargets(),
        perspective: editContext.sheetMeta.showPerspective ? "Process" : undefined,
        ownerName: editContext.ownerName,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      setAddError("Could not add KPI row");
      return;
    }
    editContext.onMutate();
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
        <CalendarRange className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">No KPIs for quarterly tracking</p>
        {editContext?.canEdit && (
          <button
            type="button"
            onClick={() => void addKpiRow()}
            disabled={adding}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add KPI row
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <CalendarRange className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Annual &amp; Quarterly Performance</h3>
            <p className="text-xs text-slate-500">
              {quarterFilterLabel(filter)} view · {rows.length} KPIs
              {editContext?.canEdit && " · edit & save on each card"}
            </p>
          </div>
        </div>
        {editContext?.canEdit && (
          <button
            type="button"
            onClick={() => void addKpiRow()}
            disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add KPI
          </button>
        )}
      </div>

      {addError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {addError}
        </p>
      )}

      <div className="space-y-3">
        {sortedRows.map((kpi, idx) => (
          <KpiReportCard
            key={kpi.id}
            kpi={kpi}
            index={idx}
            filter={filter}
            kpiRecord={kpiById.get(kpi.id)}
            canEdit={editContext?.canEdit}
            onSaved={editContext?.onMutate}
            onRemoved={editContext?.onMutate}
          />
        ))}
      </div>
    </div>
  );
}
