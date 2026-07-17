"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Kpi, KpiEntry } from "@prisma/client";
import { normalizeKpiEntryDates, type KpiStatus } from "@/lib/kpi";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { emptyQuarterTargets, type SheetMeta } from "@/lib/kra-sheets";
import { normalizeQuarterTargets } from "@/lib/kra/target-format";
import { KraSheetTable } from "@/components/kra/kra-sheet";
import { formatWeightage, weightageFraction, weightageFromPercentInput, weightagePercent } from "@/lib/kra/weightage";
import { COMPANY } from "@/lib/company";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

type QuarterData = {
  q1: { target: string; achieved?: string; managerAchieved?: string };
  q2: { target: string; achieved?: string; managerAchieved?: string };
  q3: { target: string; achieved?: string; managerAchieved?: string };
  q4: { target: string; achieved?: string; managerAchieved?: string };
};

const QUARTERS = ["q1", "q2", "q3", "q4"] as const;
const QUARTER_LABELS = { q1: "Q1", q2: "Q2", q3: "Q3", q4: "Q4" };

function parseQuarters(raw: string | null): QuarterData {
  if (!raw) return JSON.parse(emptyQuarterTargets()) as QuarterData;
  try {
    return JSON.parse(raw) as QuarterData;
  } catch {
    return JSON.parse(emptyQuarterTargets()) as QuarterData;
  }
}

type RowDraft = {
  kraName: string;
  name: string;
  perspective: string;
  unit: string;
  weightage: string;
  targetValue: string;
  quarters: QuarterData;
};

function kpiToDraft(kpi: KpiWithEntries): RowDraft {
  return {
    kraName: kpi.kraName ?? "",
    name: kpi.name,
    perspective: kpi.perspective ?? "",
    unit: kpi.unit,
    weightage: kpi.weightage != null ? String(weightagePercent(kpi.weightage) ?? "") : "",
    targetValue: String(kpi.targetValue),
    quarters: normalizeQuarterTargets(parseQuarters(kpi.quarterTargets), kpi.unit),
  };
}

const inputBase =
  "w-full resize-none rounded-lg !bg-white px-3 py-2.5 text-sm leading-relaxed !text-slate-800 caret-slate-800 ring-1 ring-slate-200 transition placeholder:text-slate-400 hover:!bg-slate-50 focus:!bg-white focus:ring-2 focus:ring-emerald-400/35";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

function StatusBadge({ status, progress }: { status: KpiStatus; progress: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "green" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "amber" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        status === "red" && "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      )}
    >
      {status === "green" ? "On target" : "Off target"} · {progress}%
    </span>
  );
}

export function KraSheetEditable({
  title,
  subtitle,
  kpis: initialKpis,
  showPerspective,
  sheetMeta,
  canEdit,
  isAdmin,
  ownerName,
  plantUnit = COMPANY.shortName,
}: {
  title: string;
  subtitle?: string;
  kpis: KpiWithEntries[];
  showPerspective: boolean;
  sheetMeta: SheetMeta;
  /** @deprecated use canEdit */
  isAdmin?: boolean;
  canEdit?: boolean;
  ownerName?: string;
  plantUnit?: string;
}) {
  const router = useRouter();
  const editable = canEdit ?? isAdmin ?? false;

  function withNormalizedEntries(list: KpiWithEntries[]): KpiWithEntries[] {
    return list.map((k) => ({
      ...k,
      entries: normalizeKpiEntryDates(k.entries ?? []),
    }));
  }

  const [kpis, setKpis] = useState(() => withNormalizedEntries(initialKpis));
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(withNormalizedEntries(initialKpis).map((k) => [k.id, kpiToDraft(k)]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = withNormalizedEntries(initialKpis);
    setKpis(normalized);
    setDrafts(Object.fromEntries(normalized.map((k) => [k.id, kpiToDraft(k)])));
  }, [initialKpis]);

  function updateDraft(id: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function updateQuarter(
    id: string,
    q: keyof QuarterData,
    field: "target" | "achieved" | "managerAchieved",
    value: string
  ) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        quarters: {
          ...prev[id].quarters,
          [q]: { ...prev[id].quarters[q], [field]: value },
        },
      },
    }));
  }

  async function saveRow(kpi: KpiWithEntries) {
    const d = drafts[kpi.id];
    if (!d) return;
    setSavingId(kpi.id);
    setError(null);
    const weight = weightageFromPercentInput(d.weightage);
    const res = await fetch(`/api/kpis/${kpi.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kraName: d.kraName,
        name: d.name,
        perspective: d.perspective || undefined,
        unit: d.unit,
        weightage: weight,
        targetValue: parseFloat(d.targetValue) || 0,
        quarterTargets: JSON.stringify(d.quarters),
      }),
    });
    setSavingId(null);
    if (!res.ok) {
      setError("Save failed — check values and try again.");
      return;
    }
    router.refresh();
  }

  async function removeRow(kpi: KpiWithEntries) {
    if (!confirm(`Remove this KPI row?`)) return;
    setSavingId(kpi.id);
    const res = await fetch(`/api/kpis/${kpi.id}`, { method: "DELETE" });
    setSavingId(null);
    if (!res.ok) {
      setError("Could not remove row.");
      return;
    }
    setKpis((prev) => prev.filter((k) => k.id !== kpi.id));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[kpi.id];
      return next;
    });
    router.refresh();
  }

  async function addRow() {
    setAdding(true);
    setError(null);
    const res = await fetch("/api/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New KPI measure",
        kraName: "New KRA",
        category: sheetMeta.category,
        unit: "%",
        targetValue: 100,
        direction: "HIGHER_IS_BETTER",
        frequency: "MONTHLY",
        department: sheetMeta.department,
        kpiLevel: sheetMeta.kpiLevel,
        plantUnit,
        weightage: 0.05,
        quarterTargets: emptyQuarterTargets(),
        perspective: showPerspective ? "Process" : undefined,
        ownerName: ownerName ?? undefined,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      setError("Could not add row.");
      return;
    }
    const created = await res.json();
    router.refresh();
    setKpis((prev) => [...prev, { ...created, entries: [] }]);
    setDrafts((prev) => ({ ...prev, [created.id]: kpiToDraft({ ...created, entries: [] }) }));
  }

  const totalWeight = kpis.reduce((s, k) => {
    const w = drafts[k.id]?.weightage;
    if (w?.trim()) {
      return s + (weightageFromPercentInput(w) ?? 0);
    }
    return s + (weightageFraction(k.weightage) ?? 0);
  }, 0);

  if (!editable) {
    return (
      <KraSheetTable
        title={title}
        subtitle={subtitle}
        kpis={kpis}
        showPerspective={showPerspective}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-5 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300/90">
            {COMPANY.kraMasterSheetLabel}
            <span className="ml-2 rounded-md bg-amber-500/25 px-2 py-0.5 text-amber-100">
              Edit mode · Save = report update
            </span>
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={adding}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add KPI row
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3 text-sm">
        <span className="text-muted-foreground">
          <strong className="text-foreground">{kpis.length}</strong> KPI rows
        </span>
        <span
          className={cn(
            "font-semibold",
            totalWeight > 1.05 ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"
          )}
        >
          Total weightage: {(totalWeight * 100).toFixed(0)}%
        </span>
      </div>

      {error && (
        <p className="border-b border-rose-500/20 bg-rose-500/10 px-5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="space-y-4 p-4 sm:p-5">
        {kpis.map((kpi, idx) => {
          const d = drafts[kpi.id] ?? kpiToDraft(kpi);
          const { progressNum: progress, status } = evaluateKpiCurrent(kpi);
          const busy = savingId === kpi.id;

          return (
            <article
              key={kpi.id}
              className={cn(
                "overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm transition",
                busy && "opacity-60",
                idx % 2 === 0 ? "bg-background" : "bg-muted/20"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                    {idx + 1}
                  </span>
                  <StatusBadge status={status} progress={progress} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveRow(kpi)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(kpi)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-12">
                {showPerspective && (
                  <div className="lg:col-span-2">
                    <FieldLabel>Perspective</FieldLabel>
                    <textarea
                      rows={2}
                      className={inputBase}
                      value={d.perspective}
                      onChange={(e) => updateDraft(kpi.id, { perspective: e.target.value })}
                      placeholder="Finance"
                    />
                  </div>
                )}
                <div className={cn(showPerspective ? "lg:col-span-3" : "lg:col-span-4")}>
                  <FieldLabel>KRA</FieldLabel>
                  <textarea
                    rows={2}
                    className={inputBase}
                    value={d.kraName}
                    onChange={(e) => updateDraft(kpi.id, { kraName: e.target.value })}
                  />
                </div>
                <div className={cn(showPerspective ? "lg:col-span-4" : "lg:col-span-5")}>
                  <FieldLabel>KPI — Measure</FieldLabel>
                  <textarea
                    rows={3}
                    className={inputBase}
                    value={d.name}
                    onChange={(e) => updateDraft(kpi.id, { name: e.target.value })}
                  />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Wt %</FieldLabel>
                  <input
                    className={cn(inputBase, "text-center font-semibold")}
                    value={d.weightage}
                    onChange={(e) => updateDraft(kpi.id, { weightage: e.target.value })}
                    placeholder="15"
                  />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Annual target</FieldLabel>
                  <input
                    className={cn(inputBase, "text-center font-semibold")}
                    value={d.targetValue}
                    onChange={(e) => updateDraft(kpi.id, { targetValue: e.target.value })}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="border-t border-border/60 bg-muted/10 px-4 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Annual &amp; quarterly targets &amp; achieved (Q1–Q4)
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {QUARTERS.map((q) => (
                    <div
                      key={q}
                      className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                    >
                      <p className="mb-2 text-center text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {QUARTER_LABELS[q]}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <FieldLabel>Target</FieldLabel>
                          <textarea
                            rows={2}
                            className={inputBase}
                            value={d.quarters[q].target}
                            onChange={(e) =>
                              updateQuarter(kpi.id, q, "target", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>Achieved</FieldLabel>
                          <textarea
                            rows={2}
                            className={inputBase}
                            value={d.quarters[q].achieved ?? ""}
                            onChange={(e) =>
                              updateQuarter(kpi.id, q, "achieved", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>Manager Achieved</FieldLabel>
                          <textarea
                            rows={2}
                            className={cn(inputBase, "border-amber-300/80")}
                            value={d.quarters[q].managerAchieved ?? ""}
                            onChange={(e) =>
                              updateQuarter(kpi.id, q, "managerAchieved", e.target.value)
                            }
                            disabled={!editable}
                            title={
                              editable
                                ? "Reporting manager / admin entry"
                                : "Only reporting manager can fill"
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}

        {kpis.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No KPI rows — click <strong className="text-foreground">Add KPI row</strong> to start.
          </p>
        )}
      </div>
    </div>
  );
}
