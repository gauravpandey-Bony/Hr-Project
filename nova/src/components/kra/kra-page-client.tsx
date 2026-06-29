"use client";

import { useState } from "react";
import { RatingScaleCard } from "@/components/kra/kra-sheet";
import { KraSheetEditable } from "@/components/kra/kra-sheet-editable";
import type { CompanyContext } from "@/lib/company.server";
import type { KraSheetFromDb } from "@/lib/kra-sheets.server";
import { kpisForSheet } from "@/lib/kra-sheets";
import { cn } from "@/lib/utils";
import { Building2, FileSpreadsheet, Pencil } from "lucide-react";
import type { Kpi, KpiEntry } from "@prisma/client";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

export function KraPageClient({
  allKpis,
  sheets,
  company,
  isAdmin,
  plantUnit = "Bony Polymers",
  unitName,
}: {
  allKpis: KpiWithEntries[];
  sheets: KraSheetFromDb[];
  company: CompanyContext;
  isAdmin: boolean;
  plantUnit?: string;
  unitName?: string;
}) {
  const [activeSheet, setActiveSheet] = useState<string>(sheets[0]?.id ?? "plant");

  const sheet = sheets.find((s) => s.id === activeSheet) ?? sheets[0];
  if (!sheet) {
    return (
      <p className="text-sm text-muted-foreground">
        No KRA departments configured. Add departments in Master Data.
      </p>
    );
  }

  const sheetMeta = sheet.meta;
  const kpis = kpisForSheet(sheet, allKpis) as KpiWithEntries[];

  return (
    <div className="reports-grid-bg space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-8 py-10 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" />
            <span>{company.shortName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {company.kraMasterSheetLabel}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            {unitName ? `${unitName} — ` : ""}
            {company.name} — select a department below
          </p>
          {isAdmin && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100">
              <Pencil className="h-4 w-4" />
              Admin: edit fields, add rows, or remove rows — then click Save on each row
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sheets.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSheet(s.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              activeSheet === s.id
                ? "border-emerald-600 bg-emerald-600 text-white shadow-md"
                : "border-border bg-card text-foreground hover:border-emerald-400/60"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 text-emerald-600" />
        <span>
          <strong className="text-foreground">{sheet.label}</strong> —{" "}
          {company.kraMasterSheetLabel}
        </span>
      </div>

      <KraSheetEditable
        key={activeSheet}
        title={sheet.label}
        subtitle={company.shortName}
        kpis={kpis}
        showPerspective={sheetMeta.showPerspective}
        sheetMeta={sheetMeta}
        isAdmin={isAdmin}
        canEdit={isAdmin}
        plantUnit={plantUnit}
      />

      <RatingScaleCard />
    </div>
  );
}
