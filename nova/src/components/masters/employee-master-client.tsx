"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Users,
  Upload,
  BarChart3,
  Download,
  UserCircle,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import { UploadMasterModal } from "./upload-master-modal";
import { toast } from "sonner";
import { COMPANY } from "@/lib/company";
import { downloadFromApi } from "@/lib/download-from-api";
import { appendUnitQuery } from "@/lib/unit-workspace";
import {
  confirmReportingManagerChange,
  groupEmployeesByDepartment,
} from "@/lib/employee-master-grouping";
import { resolveReportingManagerName } from "@/lib/reporting-manager";
import { sanitizeKraDesignation } from "@/lib/masters/kra-workbook";
import { StickyTableShell } from "@/components/ui/sticky-table-shell";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DepartmentMaster, EmployeeMaster } from "@prisma/client";
import {
  masterCellInput,
  MASTER_TABLE_CLASS,
  MASTER_CELL,
} from "./masters-table-styles";

type Draft = {
  name: string;
  designation: string;
  departmentId: string;
  location: string;
  doj: string;
  ecn: string;
  managerName: string;
  sortOrder: string;
  isActive: boolean;
};

function toDraft(e: EmployeeMaster): Draft {
  return {
    name: e.name,
    designation: sanitizeKraDesignation(e.designation) ?? "",
    departmentId: e.departmentId ?? "",
    location: e.location ?? "",
    doj: e.doj ?? "",
    ecn: e.ecn ?? "",
    managerName: e.managerName ?? "",
    sortOrder: String(e.sortOrder),
    isActive: e.isActive,
  };
}

function managerTeamKey(departmentId: string, managerName: string) {
  return `${departmentId}::${managerName}`;
}

export function EmployeeMasterClient({
  initialRows,
  departments,
  isAdmin,
  unitId,
}: {
  initialRows: EmployeeMaster[];
  departments: DepartmentMaster[];
  isAdmin: boolean;
  unitId?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      initialRows.map((r) => {
        const draft = toDraft(r);
        draft.managerName =
          resolveReportingManagerName(draft.managerName, initialRows) ||
          draft.managerName;
        return [r.id, draft];
      })
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [syncing37p, setSyncing37p] = useState(false);
  const [syncingKra, setSyncingKra] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set());

  const grouped = useMemo(
    () => groupEmployeesByDepartment(rows, departments),
    [rows, departments]
  );

  const employeeNameOptions = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  const kraBaseHref = unitId ? appendUnitQuery("/dashboard/kra", unitId) : "/dashboard/kra";

  async function downloadSheet() {
    setDownloading(true);
    setError(null);
    try {
      const qs = unitId ? `?unit=${encodeURIComponent(unitId)}` : "";
      await downloadFromApi(`/api/employees/export${qs}`, "employee-master.xlsx");
      toast.success(`Downloaded ${rows.length} employee records`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function readJsonResponse(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text) as { error?: string; message?: string };
    } catch {
      throw new Error(
        res.ok
          ? "Invalid server response"
          : `Sync failed (HTTP ${res.status}). Try again or check server logs.`
      );
    }
  }

  async function syncKraWorkbook() {
    setSyncingKra(true);
    setError(null);
    try {
      const res = await fetch("/api/masters/import-kra", { method: "POST" });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error ?? "KRA import failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "KRA import failed");
    } finally {
      setSyncingKra(false);
    }
  }

  async function sync37pRoster() {
    setSyncing37p(true);
    setError(null);
    try {
      const res = await fetch("/api/masters/import-37p", { method: "POST" });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "37P import failed");
    } finally {
      setSyncing37p(false);
    }
  }

  useEffect(() => {
    setRows(initialRows);
    setDrafts(Object.fromEntries(initialRows.map((r) => [r.id, toDraft(r)])));
  }, [initialRows]);

  useEffect(() => {
    const keys = new Set<string>();
    for (const g of grouped) {
      for (const s of g.sections) {
        if (s.type === "manager-team" && s.reports.length) {
          keys.add(managerTeamKey(g.departmentId, s.managerName));
        }
      }
    }
    setExpandedTeams(keys);
  }, [grouped]);

  function patch(id: string, p: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  function toggleTeam(key: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveActive(id: string, isActive: boolean, displayName: string) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(
        isActive
          ? `${displayName} — active, shown under reporting manager`
          : `${displayName} — inactive, hidden from manager team`
      );
      router.refresh();
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [id]: { ...prev[id], isActive: !isActive },
      }));
      setError(e instanceof Error ? e.message : "Active save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function save(id: string) {
    const d = drafts[id];
    const original = rows.find((r) => r.id === id);
    if (!d?.name.trim()) {
      setError("Employee name is required");
      return;
    }
    if (
      !confirmReportingManagerChange(original?.managerName, d.managerName || null)
    ) {
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name.trim(),
          designation: d.designation || null,
          departmentId: d.departmentId || null,
          location: d.location || "",
          doj: d.doj || null,
          ecn: d.ecn || null,
          managerName: d.managerName || null,
          sortOrder: parseInt(d.sortOrder, 10) || 0,
          isActive: d.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (data.kpisAssigned > 0) {
        toast.success(
          `${data.kpisAssigned} KPI assigned — ${data.name} (${data.department ?? "department"})`
        );
      } else {
        toast.success("Employee saved");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove employee "${name}"? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  async function addRow() {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Employee",
          sortOrder: rows.length + 1,
          departmentId: departments[0]?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed");
      if (data.kpisAssigned > 0) {
        toast.success(`${data.kpisAssigned} department KPI(s) auto-assigned.`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  function profileHref(id: string) {
    return unitId
      ? `/dashboard/masters/employees/${id}?unit=${encodeURIComponent(unitId)}`
      : `/dashboard/masters/employees/${id}`;
  }

  function renderEmployeeRow(
    row: EmployeeMaster,
    rowIndex: number,
    opts?: { indent?: boolean }
  ) {
    const d = drafts[row.id] ?? toDraft(row);
    return (
      <TableRow
        key={row.id}
        className={opts?.indent ? "bg-muted/15" : undefined}
      >
        <TableCell className={`${MASTER_CELL} text-muted-foreground`}>
          {rowIndex}
        </TableCell>
        {isAdmin && (
          <TableCell className={MASTER_CELL}>
            <div className="flex items-center gap-0.5">
              <Link
                href={profileHref(row.id)}
                title="Profile & performance"
                className="rounded-md p-1.5 text-sky-600 hover:bg-sky-500/10"
              >
                <UserCircle className="h-4 w-4" />
              </Link>
              <Link
                href={profileHref(row.id)}
                title="KRA / KPI report"
                className="rounded-md p-1.5 text-violet-600 hover:bg-violet-500/10"
              >
                <BarChart3 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => save(row.id)}
                disabled={savingId === row.id}
                title="Save"
                className="rounded-md p-1.5 text-primary hover:bg-primary/10"
              >
                {savingId === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(row.id, d.name)}
                title="Delete"
                className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </TableCell>
        )}
        <TableCell className={MASTER_CELL}>
          <div className={opts?.indent ? "pl-5" : undefined}>
            {isAdmin ? (
              <input
                className={masterCellInput("min-w-[200px]")}
                value={d.name}
                onChange={(e) => patch(row.id, { name: e.target.value })}
              />
            ) : (
              <span className="block max-w-none font-medium leading-snug">{row.name}</span>
            )}
          </div>
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("min-w-[180px]")}
              value={d.designation}
              onChange={(e) => patch(row.id, { designation: e.target.value })}
            />
          ) : (
            <span className="block leading-snug">
              {sanitizeKraDesignation(row.designation) ?? "—"}
            </span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <select
              className={masterCellInput("min-w-[220px] max-w-none")}
              value={d.departmentId}
              onChange={(e) => patch(row.id, { departmentId: e.target.value })}
            >
              <option value="">—</option>
              {departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="block leading-snug">{row.department ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("min-w-[140px]")}
              value={d.location}
              onChange={(e) => patch(row.id, { location: e.target.value })}
            />
          ) : (
            <span className="block leading-snug">{row.location ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("min-w-[100px]")}
              value={d.doj}
              onChange={(e) => patch(row.id, { doj: e.target.value })}
            />
          ) : (
            <span className="block leading-snug">{row.doj ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("min-w-[110px]")}
              value={d.ecn}
              onChange={(e) => patch(row.id, { ecn: e.target.value })}
            />
          ) : (
            <span className="block font-mono text-xs leading-snug">{row.ecn ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <select
              className={masterCellInput("min-w-[180px] max-w-none")}
              value={
                resolveReportingManagerName(d.managerName, rows) || d.managerName
              }
              onChange={(e) => patch(row.id, { managerName: e.target.value })}
            >
              <option value="">— Select reporting manager —</option>
              {employeeNameOptions
                .filter((e) => e.id !== row.id)
                .map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.name}
                    {e.ecn ? ` (${e.ecn})` : ""}
                    {e.designation ? ` · ${e.designation}` : ""}
                  </option>
                ))}
            </select>
          ) : (
            <span className="block leading-snug">
              {resolveReportingManagerName(row.managerName, rows) ||
                row.managerName ||
                "—"}
            </span>
          )}
        </TableCell>
      </TableRow>
    );
  }

  let rowCounter = 0;

  return (
    <div className="space-y-6 library-grid-bg pb-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 text-white shadow-xl sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium">
              <Users className="h-3.5 w-3.5 text-indigo-300" />
              {COMPANY.shortName}
            </div>
            <h1 className="text-3xl font-bold">Employee Master</h1>
            <p className="mt-1 text-sm text-slate-300">
              {rows.length} employees · grouped by department & manager
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadSheet}
              disabled={downloading || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500/30 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Sheet
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={syncKraWorkbook}
                  disabled={syncingKra}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500/30 disabled:opacity-50"
                >
                  {syncingKra ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Sync IT KRA sheets
                </button>
                <button
                  type="button"
                  onClick={sync37pRoster}
                  disabled={syncing37p}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500/30 disabled:opacity-50"
                >
                  {syncing37p ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Sync 37P roster
                </button>
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
                >
                  <Upload className="h-4 w-4" />
                  Upload Excel
                </button>
                <button
                  type="button"
                  onClick={addRow}
                  disabled={adding || departments.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add employee
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {departments.length === 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          Add departments in Department Master first.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <StickyTableShell maxHeight="min(75vh, 900px)">
        <table className={MASTER_TABLE_CLASS}>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 shrink-0 font-bold text-foreground">#</TableHead>
              {isAdmin && (
                <TableHead className="w-[110px] shrink-0 font-bold text-foreground">
                  Actions
                </TableHead>
              )}
              <TableHead className="min-w-[200px] font-bold text-foreground">Name</TableHead>
              <TableHead className="min-w-[180px] font-bold text-foreground">
                Designation
              </TableHead>
              <TableHead className="min-w-[200px] font-bold text-foreground">
                Department
              </TableHead>
              <TableHead className="min-w-[150px] font-bold text-foreground">Location</TableHead>
              <TableHead className="min-w-[100px] font-bold text-foreground">DOJ</TableHead>
              <TableHead className="min-w-[100px] font-bold text-foreground">ECN</TableHead>
              <TableHead className="min-w-[180px] font-bold text-foreground">
                Reporting Manager
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((deptGroup) => (
              <Fragment key={`dept-${deptGroup.departmentId}`}>
                <TableRow className="bg-primary/10 hover:bg-primary/10">
                  <TableCell
                    colSpan={isAdmin ? 9 : 8}
                    className="py-2.5 text-sm font-semibold text-foreground"
                  >
                    {deptGroup.departmentName}
                    <span className="ml-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {deptGroup.totalCount}
                    </span>
                  </TableCell>
                </TableRow>

                {deptGroup.sections.map((section) => {
                  if (section.type === "manager-team") {
                    const teamKey = managerTeamKey(
                      deptGroup.departmentId,
                      section.managerName
                    );
                    const expanded = expandedTeams.has(teamKey);
                    const teamSize = section.reports.length;

                    return (
                      <Fragment key={`team-${teamKey}`}>
                        {section.managerRow &&
                          renderEmployeeRow(section.managerRow, ++rowCounter)}
                        <TableRow className="bg-muted/40 hover:bg-muted/50">
                          <TableCell
                            colSpan={isAdmin ? 9 : 8}
                            className="py-1.5 pl-4"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTeam(teamKey)}
                              className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-foreground transition hover:bg-background/60"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span>Team under {section.managerName}</span>
                              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                {teamSize}
                              </span>
                            </button>
                          </TableCell>
                        </TableRow>
                        {expanded &&
                          section.reports.map((report) =>
                            renderEmployeeRow(report, ++rowCounter, {
                              indent: true,
                            })
                          )}
                      </Fragment>
                    );
                  }

                  return (
                    <Fragment key={`standalone-${deptGroup.departmentId}-${section.employees[0]?.id ?? "empty"}`}>
                      {section.employees.map((emp) =>
                        renderEmployeeRow(emp, ++rowCounter)
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </table>
      </StickyTableShell>

      <UploadMasterModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        type="employees"
        unitId={unitId}
      />
    </div>
  );
}
