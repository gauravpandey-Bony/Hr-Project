"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Filter, Loader2, Users, X } from "lucide-react";
import { Card3D } from "@/components/ui/card-3d";
import { cn } from "@/lib/utils";
import {
  formatDepartmentDisplayName,
  groupDepartmentMasterRowsForBrowser,
  type DepartmentBrowserRow,
} from "@/lib/masters/department-master-sync";
import { useOrgUnits } from "@/components/providers/org-units-provider";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
  pageSlice,
} from "@/components/ui/list-pagination";

const DEPT_CARD_PAGE_SIZE = 24;
const EMP_PAGE_SIZE = DEFAULT_PAGE_SIZE;

type DeptRow = DepartmentBrowserRow;

type DeptEmployee = {
  id: string;
  name: string;
  ecn: string | null;
  designation: string | null;
  location: string | null;
  plantLabel?: string;
  managerName: string | null;
  department: string | null;
};

function deptEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("it")) return "💻";
  if (n.includes("billing")) return "📋";
  if (n.includes("store")) return "📦";
  if (n.includes("production")) return "⚙️";
  if (n.includes("quality")) return "✅";
  if (n.includes("maintenance")) return "🔧";
  if (n.includes("plant")) return "👔";
  if (n.includes("dispatch")) return "🚚";
  if (n.includes("hr")) return "👥";
  return "🏢";
}

function DeptTile({
  dept,
  active,
  onSelect,
}: {
  dept: DeptRow;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Card3D
      as="button"
      tilt={false}
      shine={false}
      onClick={onSelect}
      className={cn(
        "w-full overflow-hidden rounded-2xl border bg-card p-0 text-left shadow-soft transition",
        active
          ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-600/30 ring-offset-2"
          : "border-border/80 hover:border-emerald-300 hover:shadow-md"
      )}
    >
      <div className="relative min-h-[96px] p-3.5 sm:min-h-[104px]">
        <div className="flex items-start justify-between gap-1.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-sm ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900">
            {deptEmoji(dept.name)}
          </span>
          {dept.employeeCount > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900">
              {dept.employeeCount}
            </span>
          )}
        </div>
        <h3 className="dept-name mt-2.5 text-xs font-bold leading-tight tracking-tight text-foreground sm:text-sm">
          {formatDepartmentDisplayName(dept.name)}
        </h3>
        {dept.headName && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {dept.headName}
          </p>
        )}
        {active ? (
          <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
            <ChevronDown className="h-3 w-3" />
            Employees shown below
          </p>
        ) : dept.employeeCount > 0 ? (
          <p className="mt-2 text-[10px] text-muted-foreground">Tap to view employees</p>
        ) : null}
      </div>
    </Card3D>
  );
}

export function DepartmentBrowser() {
  const { groups, standaloneUnits } = useOrgUnits();
  const [companyFilter, setCompanyFilter] = useState("all");
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [selectedDept, setSelectedDept] = useState<DeptRow | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<DeptEmployee[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [deptPage, setDeptPage] = useState(0);
  const [empPage, setEmpPage] = useState(0);
  const [deptSearch, setDeptSearch] = useState("");
  const employeePanelRef = useRef<HTMLDivElement>(null);

  const companyOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "all", label: "All companies" },
    ];
    for (const g of groups) {
      for (const u of g.units) {
        opts.push({ value: u.id, label: `${g.name} · ${u.name}` });
      }
    }
    for (const u of standaloneUnits) {
      opts.push({ value: u.id, label: u.name });
    }
    return opts;
  }, [groups, standaloneUnits]);

  const companyLabel =
    companyOptions.find((o) => o.value === companyFilter)?.label ?? "All companies";

  const visibleDepartments = useMemo(() => {
    const grouped = groupDepartmentMasterRowsForBrowser(departments);
    const q = deptSearch.trim().toLowerCase();
    const sorted = grouped.sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        formatDepartmentDisplayName(d.name).toLowerCase().includes(q) ||
        (d.headName?.toLowerCase().includes(q) ?? false)
    );
  }, [departments, deptSearch]);

  const pageDepartments = useMemo(
    () => pageSlice(visibleDepartments, deptPage, DEPT_CARD_PAGE_SIZE),
    [visibleDepartments, deptPage]
  );

  const pageEmployees = useMemo(
    () => pageSlice(deptEmployees, empPage, EMP_PAGE_SIZE),
    [deptEmployees, empPage]
  );

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const qs =
        companyFilter !== "all"
          ? `?unit=${encodeURIComponent(companyFilter)}`
          : "";
      const res = await fetch(`/api/departments${qs}`);
      if (res.ok) {
        const raw = (await res.json()) as Array<{
          id: string;
          name: string;
          headName: string | null;
          location: string | null;
          _count?: { employees?: number };
        }>;
        setDepartments(
          raw.map((d) => ({
            id: d.id,
            name: d.name,
            headName: d.headName,
            location: d.location,
            employeeCount: d._count?.employees ?? 0,
            departmentIds: [d.id],
          }))
        );
      }
    } finally {
      setLoadingDepts(false);
    }
  }, [companyFilter]);

  const loadEmployees = useCallback(
    async (dept: DeptRow) => {
      setLoadingEmployees(true);
      setDeptEmployees([]);
      try {
        const params = new URLSearchParams();
        params.set("department", dept.name);
        if (dept.departmentIds.length) {
          params.set("departmentIds", dept.departmentIds.join(","));
        }
        if (companyFilter !== "all") {
          params.set("unit", companyFilter);
        }
        const res = await fetch(`/api/employees?${params}`);
        if (res.ok) {
          setDeptEmployees(await res.json());
        }
      } finally {
        setLoadingEmployees(false);
      }
    },
    [companyFilter]
  );

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (selectedDept) {
      void loadEmployees(selectedDept);
    } else {
      setDeptEmployees([]);
    }
  }, [selectedDept, loadEmployees]);

  useEffect(() => {
    if (!selectedDept) return;
    const scrollToPanel = () => {
      employeePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    const openTimer = window.setTimeout(scrollToPanel, 80);
    const loadedTimer = loadingEmployees
      ? undefined
      : window.setTimeout(scrollToPanel, 200);
    return () => {
      window.clearTimeout(openTimer);
      if (loadedTimer !== undefined) window.clearTimeout(loadedTimer);
    };
  }, [selectedDept, loadingEmployees]);

  function handleCompanyChange(value: string) {
    setCompanyFilter(value);
    setSelectedDept(null);
    setDeptPage(0);
  }

  function handleDeptClick(dept: DeptRow) {
    setSelectedDept((prev) => {
      if (prev?.id === dept.id) return null;
      return dept;
    });
    setEmpPage(0);
  }

  const employeesByPlant = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of deptEmployees) {
      const key = e.plantLabel || e.location || "Unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [deptEmployees]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-800/70">
          Departments
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={deptSearch}
            onChange={(e) => {
              setDeptSearch(e.target.value);
              setDeptPage(0);
            }}
            placeholder="Search department…"
            className="min-w-[160px] rounded-full border border-emerald-200/80 bg-card px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
          />
          <label className="flex items-center gap-2 rounded-full border border-emerald-200/80 bg-card px-3 py-1.5 text-xs shadow-soft">
            <Filter className="h-3.5 w-3.5 text-emerald-700" />
            <span className="font-medium text-emerald-800/70">Company</span>
            <select
              value={companyFilter}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="max-w-[200px] truncate border-0 bg-transparent text-xs font-semibold text-foreground outline-none sm:max-w-[260px]"
            >
              {companyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loadingDepts ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading departments…
        </div>
      ) : visibleDepartments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {companyFilter !== "all"
            ? `No departments found for ${companyLabel}.`
            : "No departments found."}
        </p>
      ) : (
        <>
          {!selectedDept && (
            <p className="rounded-xl border border-dashed border-emerald-200/80 bg-emerald-50/40 px-4 py-2.5 text-center text-xs text-emerald-900/80">
              Tap any department card to open its employee list below.
            </p>
          )}

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {pageDepartments.map((dept) => (
              <DeptTile
                key={`${dept.name}-${dept.id}`}
                dept={dept}
                active={selectedDept?.id === dept.id}
                onSelect={() => handleDeptClick(dept)}
              />
            ))}
          </div>

          {selectedDept ? (
            <div
              ref={employeePanelRef}
              className="scroll-mt-24 animate-fade-up overflow-hidden rounded-2xl border-2 border-emerald-500/70 bg-card shadow-elevated ring-4 ring-emerald-500/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/40 px-4 py-3.5 sm:px-5 dark:border-emerald-900/40 dark:from-emerald-950/50 dark:to-emerald-950/20">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
                    <Users className="h-4 w-4 text-emerald-700" />
                    <span className="dept-name">
                      {formatDepartmentDisplayName(selectedDept.name)}
                    </span>
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                      {loadingEmployees ? "…" : deptEmployees.length} employees
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedDept.headName
                      ? `Head: ${selectedDept.headName}`
                      : "No department head"}
                    {companyFilter !== "all" ? ` · ${companyLabel}` : " · All plants"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDept(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>

              {loadingEmployees ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading employees…
                </div>
              ) : deptEmployees.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
                  No active employees in this department
                  {companyFilter !== "all" ? ` for ${companyLabel}` : ""}.
                </p>
              ) : (
                <>
                  {employeesByPlant.length > 1 && (
                    <div className="flex flex-wrap gap-2 border-b border-border/50 px-4 py-2.5 sm:px-5">
                      {employeesByPlant.map(([plant, count]) => (
                        <span
                          key={plant}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-foreground dark:border-emerald-800 dark:bg-emerald-950/40"
                        >
                          {plant}{" "}
                          <span className="text-muted-foreground">({count})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="max-h-[min(420px,50vh)] overflow-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                        <tr className="border-b border-border/60 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="px-4 py-2.5 sm:px-5">Employee</th>
                          <th className="hidden px-3 py-2.5 sm:table-cell">ECN</th>
                          <th className="px-3 py-2.5">Plant</th>
                          <th className="hidden px-3 py-2.5 md:table-cell">Designation</th>
                          <th className="hidden px-3 py-2.5 lg:table-cell">Reporting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageEmployees.map((emp) => (
                          <tr
                            key={emp.id}
                            className="border-b border-border/40 transition hover:bg-muted/40"
                          >
                            <td className="px-4 py-2.5 sm:px-5">
                              <Link
                                href={`/dashboard/masters/employees/${emp.id}`}
                                className="font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {emp.name}
                              </Link>
                            </td>
                            <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
                              {emp.ecn ?? "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex max-w-[140px] truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                {emp.plantLabel || emp.location || "—"}
                              </span>
                            </td>
                            <td className="hidden max-w-[160px] truncate px-3 py-2.5 text-muted-foreground md:table-cell">
                              {emp.designation ?? "—"}
                            </td>
                            <td className="hidden max-w-[140px] truncate px-3 py-2.5 text-muted-foreground lg:table-cell">
                              {emp.managerName ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-border/60 px-4 py-2 sm:px-5">
                    <ListPagination
                      page={empPage}
                      pageSize={EMP_PAGE_SIZE}
                      total={deptEmployees.length}
                      onPageChange={setEmpPage}
                      label="employees"
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}

          <ListPagination
            page={deptPage}
            pageSize={DEPT_CARD_PAGE_SIZE}
            total={visibleDepartments.length}
            onPageChange={setDeptPage}
            label="departments"
          />
        </>
      )}
    </div>
  );
}
