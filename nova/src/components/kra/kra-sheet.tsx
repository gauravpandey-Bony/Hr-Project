import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { Kpi, KpiEntry } from "@prisma/client";
import { formatKpiValue } from "@/lib/kpi";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { normalizeQuarterTargets } from "@/lib/kra/target-format";
import { COMPANY } from "@/lib/company";
import { RATING_SCALE } from "@/lib/company";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

type QuarterData = {
  q1: { target: string; achieved?: string };
  q2: { target: string; achieved?: string };
  q3: { target: string; achieved?: string };
  q4: { target: string; achieved?: string };
};

function parseQuarters(raw: string | null): QuarterData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuarterData;
  } catch {
    return null;
  }
}

export function KraSheetTable({
  title,
  subtitle,
  kpis,
  showPerspective = false,
}: {
  title: string;
  subtitle?: string;
  kpis: KpiWithEntries[];
  showPerspective?: boolean;
}) {
  const totalWeight = kpis.reduce((s, k) => s + (k.weightage ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-emerald-900 px-5 py-4 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
          {COMPANY.kraMasterSheetLabel}
        </p>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Sr</th>
              {showPerspective && <th className="px-3 py-2.5 font-semibold">Perspective</th>}
              <th className="px-3 py-2.5 font-semibold">KRA</th>
              <th className="px-3 py-2.5 font-semibold">KPI — Measure</th>
              <th className="px-3 py-2.5 font-semibold">UOM</th>
              <th className="px-3 py-2.5 font-semibold text-right">Wt %</th>
              <th className="border-l px-2 py-2.5 text-center font-semibold">Annual</th>
              <th className="border-l px-2 py-2.5 text-center font-semibold" colSpan={2}>
                Q1
              </th>
              <th className="border-l px-2 py-2.5 text-center font-semibold" colSpan={2}>
                Q2
              </th>
              <th className="border-l px-2 py-2.5 text-center font-semibold" colSpan={2}>
                Q3
              </th>
              <th className="border-l px-2 py-2.5 text-center font-semibold" colSpan={2}>
                Q4
              </th>
              <th className="border-l px-3 py-2.5 font-semibold">Status</th>
            </tr>
            <tr className="border-b bg-slate-50/80 text-[10px] text-slate-400">
              <th colSpan={showPerspective ? 6 : 5} />
              <th className="border-l px-2 py-1 text-center">Target</th>
              <th className="border-l px-2 py-1">Target</th>
              <th className="px-2 py-1">Achieved</th>
              <th className="border-l px-2 py-1">Target</th>
              <th className="px-2 py-1">Achieved</th>
              <th className="border-l px-2 py-1">Target</th>
              <th className="px-2 py-1">Achieved</th>
              <th className="border-l px-2 py-1">Target</th>
              <th className="px-2 py-1">Achieved</th>
              <th className="border-l" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kpis.map((kpi, idx) => {
              const { current, progressNum: progress, status } = evaluateKpiCurrent(kpi);
              const quarters = normalizeQuarterTargets(
                parseQuarters(kpi.quarterTargets) ?? {
                  q1: { target: "" },
                  q2: { target: "" },
                  q3: { target: "" },
                  q4: { target: "" },
                },
                kpi.unit
              );

              return (
                <tr key={kpi.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                  {showPerspective && (
                    <td className="px-3 py-2.5 font-medium text-slate-600">
                      {kpi.perspective ?? "—"}
                    </td>
                  )}
                  <td className="max-w-[140px] px-3 py-2.5 font-medium text-slate-800">
                    {kpi.kraName ?? "—"}
                  </td>
                  <td className="max-w-[180px] px-3 py-2.5 text-slate-900">{kpi.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{kpi.unit}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                    {kpi.weightage != null ? `${(kpi.weightage * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="border-l px-2 py-2.5 text-center font-medium text-slate-800">
                    {formatKpiValue(kpi.targetValue, kpi.unit)}
                  </td>
                  {(["q1", "q2", "q3", "q4"] as const).map((q) => (
                    <Fragment key={`${kpi.id}-${q}`}>
                      <td className="border-l px-2 py-2.5 text-center text-slate-600">
                        {quarters?.[q]?.target ?? "—"}
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-500">
                        {quarters?.[q]?.achieved || (q === "q1" ? String(current || "—") : "—")}
                      </td>
                    </Fragment>
                  ))}
                  <td className="border-l px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        status === "green" && "bg-emerald-100 text-emerald-800",
                        status === "amber" && "bg-amber-100 text-amber-800",
                        status === "red" && "bg-rose-100 text-rose-800"
                      )}
                    >
                      {progress}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totalWeight > 0 && (
            <tfoot>
              <tr className="border-t bg-slate-50 font-semibold">
                <td colSpan={showPerspective ? 5 : 4} className="px-3 py-2.5 text-right text-slate-600">
                  Total weightage
                </td>
                <td className="px-3 py-2.5 text-right text-slate-900">
                  {(totalWeight * 100).toFixed(0)}%
                </td>
                <td colSpan={9} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function RatingScaleCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Rating Scale</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-2 pr-4 font-semibold">Rating</th>
              <th className="pb-2 pr-4 font-semibold">Category</th>
              <th className="pb-2 font-semibold">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {RATING_SCALE.map((r) => (
              <tr key={r.rating}>
                <td className="py-2 pr-4">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-800">
                    {r.rating}
                  </span>
                </td>
                <td className="py-2 pr-4 font-medium text-slate-700">{r.category}</td>
                <td className="py-2 text-slate-500">{r.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
