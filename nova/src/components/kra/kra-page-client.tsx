"use client";

import { useEffect, useMemo, useState } from "react";
import { RatingScaleCard } from "@/components/kra/kra-sheet";
import { KraSheetEditable } from "@/components/kra/kra-sheet-editable";
import { LogisticKraSheetEditable } from "@/components/kra/logistic-kra-sheet-editable";
import type { CompanyContext } from "@/lib/company.server";
import type { KraEmployeeRow, KraSheetFromDb } from "@/lib/kra-sheets.server";
import { kpisForSheet } from "@/lib/kra-sheets";
import { cn } from "@/lib/utils";
import { Building2, FileSpreadsheet, Pencil, Users } from "lucide-react";
import type { Kpi, KpiEntry, UserRole } from "@prisma/client";
import { UploadKraWorkbookButton } from "@/components/kra/upload-kra-workbook-button";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

const EMPTY_EMPLOYEES: KraEmployeeRow[] = [];

export function KraPageClient({
  allKpis,
  sheets,
  employeesByDepartment,
  company,
  isAdmin,
  userRole,
  canEditTargets = false,
  canEditAchieved = false,
  plantUnit = "Bony Polymers",
  unitName,
}: {
  allKpis: KpiWithEntries[];
  sheets: KraSheetFromDb[];
  employeesByDepartment: Record<string, KraEmployeeRow[]>;
  company: CompanyContext;
  isAdmin: boolean;
  userRole?: UserRole;
  canEditTargets?: boolean;
  canEditAchieved?: boolean;
  plantUnit?: string;
  unitName?: string;
}) {
  const [activeSheet, setActiveSheet] = useState<string>(sheets[0]?.id ?? "plant");
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);

  const sheet = sheets.find((s) => s.id === activeSheet) ?? sheets[0];
  const deptEmployees = sheet
    ? (employeesByDepartment[sheet.department] ?? EMPTY_EMPLOYEES)
    : EMPTY_EMPLOYEES;

  const isEmployeeRole = userRole === "EMPLOYEE";

  useEffect(() => {
    if (isEmployeeRole && sheets.length > 0) {
      const deptWithEmployee = sheets.find(
        (s) => (employeesByDepartment[s.department] ?? []).length > 0
      );
      if (deptWithEmployee) setActiveSheet(deptWithEmployee.id);
    }
  }, [isEmployeeRole, sheets, employeesByDepartment]);

  useEffect(() => {
    if (deptEmployees.length > 0) {
      setActiveEmployeeId((prev) =>
        prev && deptEmployees.some((e) => e.id === prev) ? prev : deptEmployees[0].id
      );
    } else {
      setActiveEmployeeId(null);
    }
  }, [sheet?.department, deptEmployees.length, employeesByDepartment]);

  const activeEmployee = useMemo(
    () => deptEmployees.find((e) => e.id === activeEmployeeId) ?? null,
    [deptEmployees, activeEmployeeId]
  );

  if (!sheet) {
    return (
      <div className="reports-grid-bg space-y-6 pb-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-8 py-10 text-white shadow-2xl">
          <div className="relative">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {company.kraMasterSheetLabel}
            </h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              Upload your KRA / KPI Excel workbook to populate department sheets.
            </p>
            {isAdmin && (
              <div className="mt-6">
                <UploadKraWorkbookButton variant="hero" label="Upload Excel Sheet" plantUnitKey={plantUnit} />
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          No KRA departments configured yet. Upload Excel or add departments in Department Master.
        </p>
      </div>
    );
  }

  const sheetMeta = sheet.meta;
  const isEmployeeSheet = Boolean(activeEmployee);

  const individualMeta = activeEmployee
    ? {
        ...sheetMeta,
        kpiLevel: "INDIVIDUAL" as const,
        department: activeEmployee.department ?? sheet.department,
        ownerName: activeEmployee.name,
      }
    : sheetMeta;

  const virtualSheet: KraSheetFromDb = {
    ...sheet,
    meta: individualMeta,
  };

  const kpis = (
    isEmployeeSheet
      ? allKpis.filter(
          (k) =>
            k.kpiLevel === "INDIVIDUAL" &&
            k.ownerName?.toLowerCase() === activeEmployee!.name.toLowerCase()
        )
      : kpisForSheet(virtualSheet, allKpis)
  ) as KpiWithEntries[];

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
            {isEmployeeRole
              ? "View your KRA sheet — enter achieved values for each quarter"
              : `${company.name} — select department, then employee`}
          </p>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100">
                <Pencil className="h-4 w-4" />
                Upload Excel to import employee KRA sheets
              </p>
              <UploadKraWorkbookButton variant="hero-outline" label="Upload Excel" plantUnitKey={plantUnit} />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Department
        </p>
        <div className="flex flex-wrap gap-2">
          {(isEmployeeRole
            ? sheets.filter(
                (s) => (employeesByDepartment[s.department] ?? []).length > 0
              )
            : sheets
          ).map((s) => (
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
      </div>

      {deptEmployees.length > 0 && !isEmployeeRole && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {sheet.label} — Employees
          </p>
          <div className="flex flex-wrap gap-2">
            {deptEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => setActiveEmployeeId(emp.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  activeEmployeeId === emp.id
                    ? "border-sky-600 bg-sky-600 text-white shadow-md"
                    : "border-border bg-card text-foreground hover:border-sky-400/60"
                )}
              >
                {emp.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 text-emerald-600" />
        <span>
          <strong className="text-foreground">
            {activeEmployee ? activeEmployee.name : sheet.label}
          </strong>
          {activeEmployee && (
            <span className="text-muted-foreground"> · {sheet.label} department</span>
          )}
          {" — "}
          {company.kraMasterSheetLabel}
        </span>
      </div>

      {isEmployeeSheet && activeEmployee ? (
        <LogisticKraSheetEditable
          employee={activeEmployee}
          kpis={kpis}
          departmentLabel={sheet.label}
          editTargets={canEditTargets && !isEmployeeRole}
          editAchieved={canEditAchieved}
        />
      ) : (
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
      )}

      <RatingScaleCard />
    </div>
  );
}
