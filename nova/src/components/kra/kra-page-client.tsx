"use client";

import { useState } from "react";
import { RatingScaleCard } from "@/components/kra/kra-sheet";
import { KraSheetEditable } from "@/components/kra/kra-sheet-editable";
import { COMPANY } from "@/lib/company";
import { KRA_SHEETS } from "@/lib/plant-37p";
import { DEFAULT_EMPLOYEES } from "@/lib/master-defaults";
import { kpisForSheet, SHEET_META } from "@/lib/kra-sheets";
import { cn } from "@/lib/utils";
import { Building2, FileSpreadsheet, Users, Pencil } from "lucide-react";
import type { EmployeeMaster, Kpi, KpiEntry } from "@prisma/client";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

const SHEET_DEPARTMENT: Record<string, string> = {
  store: "Store",
  billing: "Billing",
};

export function KraPageClient({
  allKpis,
  employees: dbEmployees,
  isAdmin,
  plantUnit = "Bony Polymers",
  unitName,
}: {
  allKpis: KpiWithEntries[];
  employees: EmployeeMaster[];
  isAdmin: boolean;
  plantUnit?: string;
  unitName?: string;
}) {
  const [activeSheet, setActiveSheet] = useState<string>("plant");

  const sheet = KRA_SHEETS.find((s) => s.id === activeSheet) ?? KRA_SHEETS[0];
  const sheetMeta = SHEET_META[activeSheet] ?? SHEET_META.plant;
  const kpis = kpisForSheet(activeSheet, allKpis) as KpiWithEntries[];

  const isIndividual = sheet.id === "store" || sheet.id === "billing";
  const deptName = SHEET_DEPARTMENT[sheet.id];
  const employeeFromDb = deptName
    ? dbEmployees.find((e) => e.department === deptName)
    : undefined;
  const employeeFallback = deptName
    ? DEFAULT_EMPLOYEES.find((e) => e.department === deptName)
    : undefined;
  const employee = employeeFromDb
    ? {
        department: employeeFromDb.department ?? deptName ?? "",
        designation: employeeFromDb.designation ?? "",
        location: employeeFromDb.location ?? "Bony Polymers",
      }
    : employeeFallback
      ? {
          department: employeeFallback.department,
          designation: employeeFallback.designation,
          location: employeeFallback.location,
        }
      : undefined;

  return (
    <div className="reports-grid-bg space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-8 py-10 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" />
            <span>{COMPANY.shortName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {COMPANY.kraMasterSheetLabel}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            {unitName ? `${unitName} — ` : ""}
            {COMPANY.name} — select a department below
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
        {KRA_SHEETS.map((s) => (
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

      {isIndividual && employee && (
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="font-semibold text-foreground">{employee.department}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Designation</p>
            <p className="font-medium text-foreground">{employee.designation}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p className="font-medium text-foreground">{employee.location}</p>
          </div>
        </div>
      )}

      {!isIndividual && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 text-emerald-600" />
          <span>
            <strong className="text-foreground">{sheet.label}</strong> —{" "}
            {COMPANY.kraMasterSheetLabel}
          </span>
        </div>
      )}

      <KraSheetEditable
        key={activeSheet}
        title={sheet.label}
        subtitle={COMPANY.shortName}
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
