"use client";

import { Fragment } from "react";
import type { Kpi, KpiEntry } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatWeightage } from "@/lib/kra/weightage";
import type { KraEmployeeRow } from "@/lib/kra-sheets.server";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

type QuarterData = {
  annualTarget?: string;
  lastYearAchieved?: string;
  q1: { target: string; achieved?: string };
  q2: { target: string; achieved?: string };
  q3: { target: string; achieved?: string };
  q4: { target: string; achieved?: string };
};

function parseQuarters(raw: string | null): QuarterData {
  const empty = {
    q1: { target: "" },
    q2: { target: "" },
    q3: { target: "" },
    q4: { target: "" },
  };
  if (!raw) return empty;
  try {
    return { ...empty, ...(JSON.parse(raw) as QuarterData) };
  } catch {
    return empty;
  }
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

export function LogisticKraSheetView({
  employee,
  kpis,
  departmentLabel = "Logistics",
}: {
  employee: KraEmployeeRow;
  kpis: KpiWithEntries[];
  departmentLabel?: string;
}) {
  const groups = groupRows(kpis);
  const fiscalLabel = "2026-2027";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <thead>
            <tr>
              <th colSpan={15} className="border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold text-slate-900">
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
              <th colSpan={5} className="border border-slate-300 px-2 py-1 text-slate-800">
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
              <th className={cn(th, "text-center")} colSpan={2}>
                Q1
              </th>
              <th className={cn(th, "text-center")} colSpan={2}>
                Q2
              </th>
              <th className={cn(th, "text-center")} colSpan={2}>
                Q3
              </th>
              <th className={cn(th, "text-center")} colSpan={2}>
                Q4
              </th>
              <th className={th}>SCORE</th>
            </tr>
            <tr>
              <th className={th} colSpan={6} />
              <th className={cn(th, "text-center")}>Target</th>
              <th className={cn(th, "text-center")}>Achieved</th>
              <th className={cn(th, "text-center")}>Target</th>
              <th className={cn(th, "text-center")}>Achieved</th>
              <th className={cn(th, "text-center")}>Target</th>
              <th className={cn(th, "text-center")}>Achieved</th>
              <th className={cn(th, "text-center")}>Target</th>
              <th className={cn(th, "text-center")}>Achieved</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.items.map((kpi, idx) => {
                const q = parseQuarters(kpi.quarterTargets);
                return (
                  <tr key={kpi.id} className="hover:bg-slate-50/80">
                    {idx === 0 && (
                      <td rowSpan={group.items.length} className={cn(td, "text-center font-semibold")}>
                        {group.srNo}
                      </td>
                    )}
                    {idx === 0 && (
                      <td
                        rowSpan={group.items.length}
                        className={cn(td, "font-medium text-slate-700")}
                      >
                        {group.kraName}
                      </td>
                    )}
                    <td className={td}>{kpi.name}</td>
                    <td className={cn(td, "text-center font-medium")}>
                      {formatWeightage(kpi.weightage)}
                    </td>
                    <td className={td}>{q.lastYearAchieved || "—"}</td>
                    <td className={td}>{q.annualTarget || String(kpi.targetValue ?? "—")}</td>
                    {(["q1", "q2", "q3", "q4"] as const).map((key) => (
                      <Fragment key={`${kpi.id}-${key}`}>
                        <td className={cn(td, "text-center")}>{q[key]?.target || "—"}</td>
                        <td className={cn(td, "text-center")}>{q[key]?.achieved || "—"}</td>
                      </Fragment>
                    ))}
                    <td className={cn(td, "text-center text-slate-500")}>—</td>
                  </tr>
                );
              })
            )}
            {kpis.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-10 text-center text-sm text-slate-500">
                  No KPI rows — upload Excel or add data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-8 border-t border-slate-300 px-6 py-6 text-sm text-slate-700">
        <div>
          <p className="font-semibold">HOD - Signature</p>
          <div className="mt-8 border-b border-slate-400" />
        </div>
        <div>
          <p className="font-semibold">Employee Signature</p>
          <div className="mt-8 border-b border-slate-400" />
        </div>
      </div>
    </div>
  );
}
