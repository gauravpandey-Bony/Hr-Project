"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RatingScaleCard } from "@/components/kra/kra-sheet";
import { KraSheetEditable } from "@/components/kra/kra-sheet-editable";
import { LogisticKraSheetEditable } from "@/components/kra/logistic-kra-sheet-editable";
import { DepartmentDashboardPanel } from "@/components/kra/department-dashboard-panel";
import { EmployeeKraDashboard } from "@/components/kra/employee-kra-dashboard";
import type { CompanyContext } from "@/lib/company.server";
import type { KraEmployeeRow, KraSheetFromDb } from "@/lib/kra-sheets.server";
import { kpisForSheet } from "@/lib/kra-sheets";
import { buildDepartmentDashboard } from "@/lib/kra/department-dashboard";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { departmentsAreEquivalent } from "@/lib/masters/department-master-sync";
import { personNamesMatch } from "@/lib/person-name";
import { cn } from "@/lib/utils";
import { ArrowLeft, Building2, FileSpreadsheet, Pencil, Users } from "lucide-react";
import type { Kpi, KpiEntry, UserRole } from "@prisma/client";
import { UploadKraWorkbookButton } from "@/components/kra/upload-kra-workbook-button";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

const EMPTY_EMPLOYEES: KraEmployeeRow[] = [];

function employeesForDepartment(
  employeesByDepartment: Record<string, KraEmployeeRow[]>,
  department: string
): KraEmployeeRow[] {
  const direct = employeesByDepartment[department];
  if (direct?.length) return direct;
  for (const [dept, emps] of Object.entries(employeesByDepartment)) {
    if (departmentsAreEquivalent(dept, department)) return emps;
  }
  return EMPTY_EMPLOYEES;
}

function findEmployeeSheet(
  employeeId: string,
  employeesByDepartment: Record<string, KraEmployeeRow[]>,
  sheets: KraSheetFromDb[]
): { sheetId: string; employeeId: string } | null {
  for (const [department, employees] of Object.entries(employeesByDepartment)) {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) continue;
    const sheet =
      sheets.find((s) => departmentsAreEquivalent(s.department, department)) ??
      sheets.find((s) => s.department === department) ??
      sheets.find((s) =>
        departmentsAreEquivalent(s.department, emp.department ?? "")
      );
    if (sheet) return { sheetId: sheet.id, employeeId: emp.id };
  }
  return null;
}

function findEmployeeAnywhere(
  employeeId: string,
  employeesByDepartment: Record<string, KraEmployeeRow[]>
): KraEmployeeRow | null {
  for (const employees of Object.values(employeesByDepartment)) {
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) return emp;
  }
  return null;
}

export function KraPageClient({
  allKpis,
  sheets,
  employeesByDepartment,
  company,
  isAdmin,
  userRole,
  viewerName,
  canEditTargets = false,
  canEditAchieved = false,
  canFillKra = false,
  plantUnit = "Bony Polymers",
  unitName,
  unitId,
  initialEmployeeId = null,
}: {
  allKpis: KpiWithEntries[];
  sheets: KraSheetFromDb[];
  employeesByDepartment: Record<string, KraEmployeeRow[]>;
  company: CompanyContext;
  isAdmin: boolean;
  userRole?: UserRole;
  viewerName?: string | null;
  canEditTargets?: boolean;
  canEditAchieved?: boolean;
  canFillKra?: boolean;
  plantUnit?: string;
  unitName?: string;
  unitId?: string | null;
  initialEmployeeId?: string | null;
}) {
  const initialTarget = useMemo(
    () =>
      initialEmployeeId
        ? findEmployeeSheet(initialEmployeeId, employeesByDepartment, sheets)
        : null,
    [initialEmployeeId, employeesByDepartment, sheets]
  );

  const [activeSheet, setActiveSheet] = useState<string>(
    () =>
      initialTarget?.sheetId ??
      sheets.find((s) => s.id === "production")?.id ??
      sheets[0]?.id ??
      "production"
  );
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(
    () => initialTarget?.employeeId ?? null
  );
  const [activeSubSheetId, setActiveSubSheetId] = useState<string | null>(null);
  const [quarter, setQuarter] = useState<FiscalQuarter>("q1");
  const appliedInitialEmployee = useRef(Boolean(initialTarget));

  const isEmployeeRole = userRole === "EMPLOYEE";
  const isManagerRole = userRole === "MANAGER";

  // Managers only see departments where they have team members (or their own dept).
  const visibleSheets = useMemo(() => {
    if (isAdmin) return sheets;
    if (isManagerRole || isEmployeeRole) {
      return sheets.filter(
        (s) => employeesForDepartment(employeesByDepartment, s.department).length > 0
      );
    }
    return sheets;
  }, [sheets, employeesByDepartment, isAdmin, isManagerRole, isEmployeeRole]);

  const sheet =
    visibleSheets.find((s) => s.id === activeSheet) ??
    sheets.find((s) => s.id === activeSheet) ??
    visibleSheets[0];
  const activeSubSheet =
    sheet?.subSheets?.find((s) => s.id === activeSubSheetId) ?? sheet?.subSheets?.[0] ?? null;

  const deptEmployeesRaw = sheet
    ? employeesForDepartment(employeesByDepartment, sheet.department)
    : EMPTY_EMPLOYEES;

  // Server already scopes managers to direct reports + self (org-wide).
  // Do not re-filter here — plant/name variants would drop valid reports.
  const deptEmployees = deptEmployeesRaw;

  useEffect(() => {
    if (!initialEmployeeId) return;
    const target = findEmployeeSheet(
      initialEmployeeId,
      employeesByDepartment,
      sheets
    );
    if (!target) return;
    appliedInitialEmployee.current = true;
    setActiveSheet(target.sheetId);
    setActiveEmployeeId(target.employeeId);
  }, [initialEmployeeId, employeesByDepartment, sheets]);

  useEffect(() => {
    if ((isEmployeeRole || isManagerRole) && visibleSheets.length > 0 && !initialEmployeeId) {
      const deptWithEmployee = visibleSheets[0];
      if (deptWithEmployee) setActiveSheet(deptWithEmployee.id);
    }
  }, [isEmployeeRole, isManagerRole, visibleSheets, initialEmployeeId]);

  useEffect(() => {
    if (visibleSheets.length === 0) return;
    if (visibleSheets.some((s) => s.id === activeSheet)) return;
    // Keep deep-linked employee sheet even if department key matching is delayed
    if (activeEmployeeId && sheets.some((s) => s.id === activeSheet)) return;
    if (initialEmployeeId && activeEmployeeId === initialEmployeeId) return;
    setActiveSheet(visibleSheets[0]!.id);
  }, [visibleSheets, activeSheet, sheets, activeEmployeeId, initialEmployeeId]);

  useEffect(() => {
    setActiveSubSheetId(sheet?.subSheets?.[0]?.id ?? null);
  }, [activeSheet, sheet?.subSheets]);

  useEffect(() => {
    if (isEmployeeRole && deptEmployees.length === 1 && !initialEmployeeId) {
      setActiveEmployeeId(deptEmployees[0].id);
      return;
    }
    // Keep the selected employee when they belong to the active department;
    // never drop a deep-linked employee from the profile quick link.
    setActiveEmployeeId((prev) => {
      if (prev && deptEmployees.some((e) => e.id === prev)) return prev;
      if (prev && initialEmployeeId && prev === initialEmployeeId) return prev;
      return null;
    });
  }, [sheet?.department, isEmployeeRole, deptEmployees, initialEmployeeId]);

  const activeEmployee = useMemo(() => {
    if (!activeEmployeeId) return null;
    return (
      deptEmployees.find((e) => e.id === activeEmployeeId) ??
      findEmployeeAnywhere(activeEmployeeId, employeesByDepartment)
    );
  }, [deptEmployees, activeEmployeeId, employeesByDepartment]);

  const departmentDashboard = useMemo(() => {
    if (!sheet?.department) return null;
    return buildDepartmentDashboard(
      allKpis,
      sheet.department,
      quarter,
      deptEmployees.map((e) => ({
        id: e.id,
        name: e.name,
        designation: e.designation,
        managerName: e.managerName,
        ecn: e.ecn,
      }))
    );
  }, [allKpis, sheet?.department, quarter, deptEmployees]);

  if (!sheet) {
    return (
      <div className="reports-grid-bg space-y-6 pb-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-8 py-10 text-white shadow-2xl">
          <div className="relative">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {company.kraMasterSheetLabel}
            </h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              Upload your KRA / KPI Excel workbook to populate department sheets.
            </p>
            {isAdmin && (
              <div className="mt-6">
                <UploadKraWorkbookButton
                  variant="hero"
                  label="Upload Excel Sheet"
                  plantUnitKey={plantUnit}
                  unitId={unitId}
                />
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

  const sheetMeta = activeSubSheet?.meta ?? sheet.meta;
  const sheetTitle = activeSubSheet?.label ?? sheet.label;
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
    label: sheetTitle,
    meta: individualMeta,
  };

  const kpis = (
    isEmployeeSheet
      ? allKpis.filter(
          (k) =>
            k.kpiLevel === "INDIVIDUAL" &&
            k.ownerName &&
            personNamesMatch(k.ownerName, activeEmployee!.name)
        )
      : kpisForSheet(virtualSheet, allKpis)
  ) as KpiWithEntries[];

  const showDeptDashboard =
    !isEmployeeSheet && deptEmployees.length > 0 && departmentDashboard;

  const managerCanFillEmployee =
    isManagerRole &&
    Boolean(activeEmployee) &&
    deptEmployees.some((e) => e.id === activeEmployee!.id);

  const showFillSection =
    activeEmployee &&
    (canFillKra || isAdmin || managerCanFillEmployee || (isEmployeeRole && canEditAchieved));

  return (
    <div className="reports-grid-bg space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-8 py-10 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-300" />
            <span>{company.shortName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {company.kraMasterSheetLabel}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            {unitName ? `${unitName} — ` : ""}
            {isEmployeeRole
              ? "View your KRA sheet — enter achieved values for each quarter"
              : "Select department → employee → fill Q1–Q4 achieved (same as employee fill). Admins can also edit targets."}
          </p>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100">
                <Pencil className="h-4 w-4" />
                Upload Excel to import employee KRA sheets
              </p>
              <UploadKraWorkbookButton
                variant="hero-outline"
                label="Upload Excel"
                plantUnitKey={plantUnit}
                unitId={unitId}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Department
        </p>
        <div className="flex flex-wrap gap-2">
          {visibleSheets.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveSheet(s.id);
                setActiveEmployeeId(null);
              }}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                activeSheet === s.id
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sheet.subSheets && sheet.subSheets.length > 1 && !isEmployeeRole && !activeEmployee && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {sheet.label} — KRA sheet
          </p>
          <div className="flex flex-wrap gap-2">
            {sheet.subSheets.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubSheetId(sub.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  (activeSubSheetId ?? sheet.subSheets?.[0]?.id) === sub.id
                    ? "border-violet-600 bg-violet-600 text-white shadow-md"
                    : "border-border bg-card text-foreground hover:border-violet-400/60"
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 text-primary" />
        <span>
          <strong className="text-foreground">
            {activeEmployee ? activeEmployee.name : sheet.label}
          </strong>
          {activeEmployee && (
            <span className="text-muted-foreground"> · {sheet.label} department</span>
          )}
          {!activeEmployee && " — Department dashboard"}
        </span>
        {activeEmployee && !isEmployeeRole && (
          <button
            type="button"
            onClick={() => setActiveEmployeeId(null)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to department
          </button>
        )}
      </div>

      {showDeptDashboard && departmentDashboard && (
        <DepartmentDashboardPanel
          data={departmentDashboard}
          quarter={quarter}
          onQuarterChange={setQuarter}
          onSelectEmployee={setActiveEmployeeId}
          selectedEmployeeId={activeEmployeeId}
        />
      )}

      {isEmployeeSheet && activeEmployee && (
        <>
          <EmployeeKraDashboard
            employeeName={activeEmployee.name}
            departmentLabel={sheet.label}
            kpis={kpis}
            quarter={quarter}
          />

          {showFillSection && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {isAdmin || managerCanFillEmployee
                    ? `Fill KPI on behalf of ${activeEmployee.name}`
                    : "Fill your KPI — enter Q1–Q4 achieved"}
                </p>
                {(isAdmin || managerCanFillEmployee) && (
                  <p className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Admin / Manager fill
                  </p>
                )}
              </div>
              <LogisticKraSheetEditable
                employee={activeEmployee}
                kpis={kpis}
                departmentLabel={sheet.label}
                editTargets={canEditTargets && (isAdmin || managerCanFillEmployee)}
                editAchieved={
                  canEditAchieved || isAdmin || Boolean(managerCanFillEmployee)
                }
                editManagerAchieved={isAdmin || Boolean(managerCanFillEmployee)}
              />
            </div>
          )}
        </>
      )}

      {!isEmployeeSheet && !deptEmployees.length && (
        <KraSheetEditable
          key={`${activeSheet}-${activeSubSheetId ?? "default"}`}
          title={sheetTitle}
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
