"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Pencil, Search, UserRound } from "lucide-react";
import { EmployeeDashboardBlock } from "@/components/ai/employee-dashboard-block";
import { KraSheetEditable } from "@/components/kra/kra-sheet-editable";
import type { EmployeeDashboardData } from "@/lib/ai/employee-report";
import { normalizeKpiEntryDates } from "@/lib/kpi";
import type { SheetMeta } from "@/lib/kra-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Kpi, KpiEntry } from "@prisma/client";

type KpiWithEntries = Kpi & { entries: KpiEntry[] };

export type EmployeePickerRow = {
  id: string;
  name: string;
  ecn: string | null;
  department: string | null;
  designation: string | null;
};

type ReportPayload = {
  dashboard: EmployeeDashboardData;
  canEdit: boolean;
  kpis: KpiWithEntries[];
  ownerName: string;
  sheetMeta: SheetMeta | null;
};

function queryForEmployee(e: EmployeePickerRow): string {
  return e.ecn?.trim() || e.name.trim();
}

function findEmployeeByQuery(employees: EmployeePickerRow[], q: string): EmployeePickerRow | undefined {
  const t = q.trim().toLowerCase();
  return employees.find(
    (e) =>
      e.ecn?.trim() === q.trim() ||
      e.name.trim().toLowerCase() === t ||
      e.name.toLowerCase().includes(t)
  );
}

export function EmployeeReportPicker({
  employees,
  initialQuery,
  plantUnit,
  unitId,
}: {
  employees: EmployeePickerRow[];
  initialQuery?: string;
  plantUnit?: string;
  unitId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLoaded = useRef(false);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.ecn?.toLowerCase().includes(q) ?? false) ||
        (e.department?.toLowerCase().includes(q) ?? false)
    );
  }, [employees, search]);

  const loadReport = useCallback(
    async (query: string, employeeId?: string) => {
      const q = query.trim();
      if (!q) return;
      if (employeeId) setSelectedId(employeeId);
      setLoading(true);
      setError(null);
      try {
        const unitQs = unitId ? `&unit=${encodeURIComponent(unitId)}` : "";
        const res = await fetch(`/api/reports/employee?q=${encodeURIComponent(q)}${unitQs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Report load failed");
        const kpis = (data.kpis ?? []).map(
          (k: KpiWithEntries) =>
            ({
              ...k,
              entries: normalizeKpiEntryDates(k.entries ?? []),
            }) as KpiWithEntries
        );
        setPayload({
          dashboard: data.dashboard,
          canEdit: Boolean(data.canEdit),
          kpis,
          ownerName: data.ownerName ?? data.dashboard.employee.name,
          sheetMeta: data.sheetMeta ?? null,
        });
        if (searchParams.get("mode") === "edit" && data.canEdit) {
          requestAnimationFrame(() => {
            document.getElementById("kra-edit-section")?.scrollIntoView({ behavior: "smooth" });
          });
        }
        const unitParam = unitId ? `&unit=${encodeURIComponent(unitId)}` : "";
        router.replace(`/dashboard/reports/employee?q=${encodeURIComponent(q)}${unitParam}`, {
          scroll: false,
        });
      } catch (e) {
        setPayload(null);
        setError(e instanceof Error ? e.message : "Report load failed");
      } finally {
        setLoading(false);
      }
    },
    [router, searchParams, unitId]
  );

  useEffect(() => {
    if (initialLoaded.current || employees.length === 0) return;
    initialLoaded.current = true;

    const fromUrl = searchParams.get("q")?.trim() || initialQuery?.trim() || "";
    if (fromUrl) {
      const emp = findEmployeeByQuery(employees, fromUrl);
      if (emp) setSelectedId(emp.id);
      void loadReport(fromUrl, emp?.id);
      return;
    }

    const first = employees.find((e) => e.ecn?.trim()) ?? employees[0];
    if (first) {
      setSelectedId(first.id);
      void loadReport(queryForEmployee(first), first.id);
    }
  }, [employees, initialQuery, loadReport, searchParams]);

  function onSelectChange(employeeId: string) {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    void loadReport(queryForEmployee(emp), emp.id);
  }

  const selectedEmployee = employees.find((e) => e.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <UserRound className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Select employee</h2>
            <p className="text-xs text-slate-500">Choose from list or search by name / ECN</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Employee
            </label>
            <select
              value={selectedId}
              onChange={(e) => onSelectChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-foreground shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.ecn ? ` · ECN ${e.ecn}` : ""}
                  {e.department ? ` · ${e.department}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Search / ECN
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    const hit = findEmployeeByQuery(employees, search.trim());
                    void loadReport(search.trim(), hit?.id);
                  }
                }}
                placeholder="Type name or ECN, then Enter or Show report…"
                className="rounded-xl pl-9"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              const trimmed = search.trim();
              if (trimmed) {
                const hit = findEmployeeByQuery(employees, trimmed);
                void loadReport(trimmed, hit?.id);
                return;
              }
              if (selectedEmployee) {
                void loadReport(queryForEmployee(selectedEmployee), selectedEmployee.id);
              }
            }}
            disabled={loading || (!search.trim() && !selectedEmployee)}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md hover:from-violet-500 hover:to-indigo-500"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Show report"}
          </Button>
        </div>

        {search && options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {options.slice(0, 10).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => loadReport(queryForEmployee(e), e.id)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:border-violet-200 hover:bg-violet-50"
              >
                {e.name}
                {e.ecn ? ` (${e.ecn})` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </p>
      )}

      {loading && !payload && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <p className="text-sm font-medium text-slate-500">Building performance report…</p>
        </div>
      )}

      {payload && (
        <div className="space-y-6">
          {payload.canEdit && (
            <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50 px-4 py-3 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <Pencil className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Admin:</strong> Edit target / achieved on each KPI card — click{" "}
                  <strong>Save</strong> or <strong>Remove</strong> right there
                </span>
              </p>
            </div>
          )}

          <EmployeeDashboardBlock
            data={payload.dashboard}
            editContext={
              payload.canEdit && payload.sheetMeta
                ? {
                    canEdit: true,
                    kpis: payload.kpis,
                    sheetMeta: payload.sheetMeta,
                    ownerName: payload.ownerName,
                    plantUnit,
                    onMutate: () => {
                      if (selectedEmployee) {
                        void loadReport(queryForEmployee(selectedEmployee), selectedEmployee.id);
                      }
                    },
                  }
                : undefined
            }
          />

          {payload.canEdit && payload.sheetMeta && (
            <details id="kra-edit-section" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-emerald-600" />
                  Full KRA editor (KRA name, perspective, all fields)
                </span>
              </summary>
              <div className="border-t border-slate-100">
                <KraSheetEditable
                  key={payload.ownerName}
                  title={`${payload.ownerName} — KRA / KPI`}
                  subtitle={
                    payload.dashboard.employee.designation ??
                    payload.dashboard.employee.department ??
                    ""
                  }
                  kpis={payload.kpis}
                  showPerspective={payload.sheetMeta.showPerspective}
                  sheetMeta={payload.sheetMeta}
                  canEdit
                  ownerName={payload.ownerName}
                  plantUnit={plantUnit}
                />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
