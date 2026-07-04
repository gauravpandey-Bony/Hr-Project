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
} from "lucide-react";
import Link from "next/link";
import { UploadMasterModal } from "./upload-master-modal";
import { toast } from "sonner";
import { COMPANY } from "@/lib/company";
import { downloadFromApi } from "@/lib/download-from-api";
import {
  confirmReportingManagerChange,
  groupEmployeesByDepartment,
} from "@/lib/employee-master-grouping";
import { resolveReportingManagerName } from "@/lib/reporting-manager";
import { sanitizeKraDesignation } from "@/lib/masters/kra-workbook";
import { appendQueryParams } from "@/lib/unit-workspace";
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
  MASTER_HEAD,
  MASTER_HERO,
  MASTER_HERO_BADGE,
  MASTER_HERO_SUBTITLE,
  MASTER_HERO_BTN_SECONDARY,
  MASTER_HERO_BTN_PRIMARY,
} from "./masters-table-styles";
import {
  ListPagination,
  pageSlice,
} from "@/components/ui/list-pagination";

const DEPT_PAGE_SIZE = 3;

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
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [page, setPage] = useState(0);

  const grouped = useMemo(
    () => groupEmployeesByDepartment(rows, departments),
    [rows, departments]
  );

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchEmp = (e: EmployeeMaster) => {
      if (!q) return true;
      const d = drafts[e.id];
      const hay = [
        e.name,
        e.ecn,
        e.designation,
        e.department,
        e.location,
        e.managerName,
        d?.name,
        d?.ecn,
        d?.designation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    };

    return grouped
      .filter((g) => deptFilter === "all" || g.departmentId === deptFilter)
      .map((g) => {
        const sections = g.sections
          .map((section) => {
            if (section.type === "manager-team") {
              const managerMatches = section.managerRow
                ? matchEmp(section.managerRow)
                : false;
              const reports = section.reports.filter(
                (r) => r.id !== section.managerRow?.id && matchEmp(r)
              );
              if (!managerMatches && !reports.length) return null;
              return {
                ...section,
                // Keep manager row for team context when any report matches.
                managerRow: section.managerRow,
                reports: [
                  ...(managerMatches && section.managerRow
                    ? [section.managerRow]
                    : []),
                  ...reports,
                ],
              };
            }
            const employees = section.employees.filter(matchEmp);
            if (!employees.length) return null;
            return { ...section, employees };
          })
          .filter(Boolean) as typeof g.sections;
        if (!sections.length) return null;
        const totalCount = sections.reduce((n, s) => {
          if (s.type === "manager-team") {
            return (
              n +
              (s.managerRow ? 1 : 0) +
              s.reports.filter((r) => r.id !== s.managerRow?.id).length
            );
          }
          return n + s.employees.length;
        }, 0);
        return { ...g, sections, totalCount };
      })
      .filter(Boolean) as typeof grouped;
  }, [grouped, deptFilter, search, drafts]);

  const pageGroups = useMemo(
    () => pageSlice(filteredGrouped, page, DEPT_PAGE_SIZE),
    [filteredGrouped, page]
  );

  const employeeNameOptions = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

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
    return appendQueryParams(`/dashboard/masters/employees/${id}`, {
      unit: unitId,
    });
  }

  function kraHref(id: string) {
    return appendQueryParams("/dashboard/kra", {
      unit: unitId,
      employee: id,
    });
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
                className="rounded p-1 text-sky-600 hover:bg-sky-500/10"
              >
                <UserCircle className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={kraHref(row.id)}
                title="KRA / KPI sheet"
                className="rounded p-1 text-violet-600 hover:bg-violet-500/10"
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => save(row.id)}
                disabled={savingId === row.id}
                title="Save"
                className="rounded p-1 text-primary hover:bg-primary/10"
              >
                {savingId === row.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(row.id, d.name)}
                title="Delete"
                className="rounded p-1 text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </TableCell>
        )}
        <TableCell className={MASTER_CELL}>
          <div className={opts?.indent ? "pl-4" : undefined}>
            {isAdmin ? (
              <input
                className={masterCellInput("min-w-[140px]")}
                value={d.name}
                onChange={(e) => patch(row.id, { name: e.target.value })}
              />
            ) : (
              <span className="font-medium">{row.name}</span>
            )}
          </div>
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("min-w-[120px]")}
              value={d.designation}
              onChange={(e) => patch(row.id, { designation: e.target.value })}
            />
          ) : (
            <span>{sanitizeKraDesignation(row.designation) ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <select
              className={masterCellInput("min-w-[130px]")}
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
            <span>{row.department ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("min-w-[110px]")}
              value={d.location}
              onChange={(e) => patch(row.id, { location: e.target.value })}
            />
          ) : (
            <span>{row.location ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("w-[5.5rem] min-w-0")}
              value={d.doj}
              onChange={(e) => patch(row.id, { doj: e.target.value })}
            />
          ) : (
            <span>{row.doj ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <input
              className={masterCellInput("w-[4.5rem] min-w-0 font-mono")}
              value={d.ecn}
              onChange={(e) => patch(row.id, { ecn: e.target.value })}
            />
          ) : (
            <span className="font-mono">{row.ecn ?? "—"}</span>
          )}
        </TableCell>
        <TableCell className={MASTER_CELL}>
          {isAdmin ? (
            <select
              className={masterCellInput("min-w-[130px]")}
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
      <div className={MASTER_HERO}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={MASTER_HERO_BADGE}>
              <Users className="h-3.5 w-3.5 text-emerald-100" />
              {COMPANY.shortName}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Employee Master</h1>
            <p className={MASTER_HERO_SUBTITLE}>
              {rows.length} employees · grouped by department & manager
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadSheet}
              disabled={downloading || rows.length === 0}
              className={MASTER_HERO_BTN_SECONDARY}
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
                  onClick={() => setUploadOpen(true)}
                  className={MASTER_HERO_BTN_SECONDARY}
                >
                  <Upload className="h-4 w-4" />
                  Upload Excel
                </button>
                <button
                  type="button"
                  onClick={addRow}
                  disabled={adding || departments.length === 0}
                  className={MASTER_HERO_BTN_PRIMARY}
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-soft">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search name, ECN, designation…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
        />
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Department
          </span>
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(0);
            }}
            className="min-w-[160px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All departments</option>
            {grouped.map((g) => (
              <option key={g.departmentId} value={g.departmentId}>
                {g.departmentName} ({g.totalCount})
              </option>
            ))}
          </select>
        </label>
      </div>

      <ListPagination
        page={page}
        pageSize={DEPT_PAGE_SIZE}
        total={filteredGrouped.length}
        onPageChange={setPage}
        label="departments"
      />

      <StickyTableShell maxHeight="min(75vh, 900px)">
        <table className={MASTER_TABLE_CLASS}>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${MASTER_HEAD} w-8 shrink-0`}>#</TableHead>
              {isAdmin && (
                <TableHead className={`${MASTER_HEAD} w-[88px] shrink-0`}>
                  Actions
                </TableHead>
              )}
              <TableHead className={MASTER_HEAD}>Name</TableHead>
              <TableHead className={MASTER_HEAD}>Designation</TableHead>
              <TableHead className={MASTER_HEAD}>Department</TableHead>
              <TableHead className={MASTER_HEAD}>Location</TableHead>
              <TableHead className={`${MASTER_HEAD} w-[5.5rem]`}>DOJ</TableHead>
              <TableHead className={`${MASTER_HEAD} w-[4.5rem]`}>ECN</TableHead>
              <TableHead className={MASTER_HEAD}>Reporting Manager</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageGroups.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No employees match your search.
                </TableCell>
              </TableRow>
            )}
            {pageGroups.map((deptGroup) => (
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
                    const managerId = section.managerRow?.id;
                    const reportRows = section.reports.filter(
                      (r) => r.id !== managerId
                    );

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
                          reportRows.map((report) =>
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

      <ListPagination
        page={page}
        pageSize={DEPT_PAGE_SIZE}
        total={filteredGrouped.length}
        onPageChange={setPage}
        label="departments"
      />

      <UploadMasterModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        type="employees"
        unitId={unitId}
      />
    </div>
  );
}
