"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, FileSpreadsheet, BarChart3, Pencil } from "lucide-react";
import { KraSheetEditable } from "@/components/kra/kra-sheet-editable";
import { RatingScaleCard } from "@/components/kra/kra-sheet";
import { IT_TEAM_META, kpisForTeamMember } from "@/lib/team-scope";
import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";
import type { EmployeeMaster, Kpi, KpiEntry } from "@prisma/client";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

export function TeamKraClient({
  managerName,
  department,
  team,
  allKpis,
  canEdit,
}: {
  managerName: string;
  department: string;
  team: EmployeeMaster[];
  allKpis: KpiWithEntries[];
  canEdit: boolean;
}) {
  const [activeId, setActiveId] = useState(team[0]?.id ?? "");

  const active = team.find((e) => e.id === activeId) ?? team[0];
  const memberKpis = useMemo(
    () => (active ? kpisForTeamMember(allKpis, active.name) : []),
    [active, allKpis]
  );

  const totalKpis = team.reduce(
    (s, e) => s + kpisForTeamMember(allKpis, e.name).length,
    0
  );

  return (
    <div className="reports-grid-bg space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 px-8 py-10 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            <Users className="h-3.5 w-3.5 text-violet-300" />
            <span>{department} Team</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Team — KRA / KPI</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            <strong>{managerName}</strong> — {team.length} team members · {totalKpis} KPIs loaded.
            Edit each employee&apos;s sheet to fill targets and achieved values.
          </p>
          {canEdit && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-500/25 px-3 py-1.5 text-sm text-violet-100">
              <Pencil className="h-4 w-4" />
              Add row · Edit KRA/KPI · Q1–Q4 targets/achieved · Save per row
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/team/reports"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-md hover:bg-white/20"
            >
              <BarChart3 className="h-4 w-4" />
              Team reports
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {team.map((e) => {
          const count = kpisForTeamMember(allKpis, e.name).length;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setActiveId(e.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                active?.id === e.id
                  ? "border-violet-600 bg-violet-600 text-white shadow-md"
                  : "border-border bg-card text-foreground hover:border-violet-400/60"
              )}
            >
              {e.name}
              {e.ecn ? ` · ${e.ecn}` : ""}
              <span className="ml-1.5 opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {active && (
        <>
          <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Employee</p>
              <p className="font-semibold text-foreground">{active.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Designation</p>
              <p className="font-medium">{active.designation ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ECN</p>
              <p className="font-medium">{active.ecn ?? "—"}</p>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Link
                href="/dashboard/team/reports"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Team report
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4 text-violet-600" />
            <span>
              <strong className="text-foreground">{active.name}</strong> — individual KRA sheet ·{" "}
              {COMPANY.kraMasterSheetLabel}
            </span>
          </div>

          <KraSheetEditable
            key={active.id}
            title={`${active.name} — KRA / KPI`}
            subtitle={active.designation ?? department}
            kpis={memberKpis}
            showPerspective={IT_TEAM_META.showPerspective}
            sheetMeta={IT_TEAM_META}
            canEdit={canEdit}
            ownerName={active.name}
          />
        </>
      )}

      <RatingScaleCard />
    </div>
  );
}
