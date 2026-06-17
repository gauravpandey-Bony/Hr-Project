"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Filter, Loader2, Users } from "lucide-react";
import { Card3D } from "@/components/ui/card-3d";
import { cn } from "@/lib/utils";
import { useOrgUnits } from "@/components/providers/org-units-provider";
import { UNIT_GRADIENT_PRESETS } from "@/lib/org-units-defaults";

type DeptRow = {
  id: string;
  name: string;
  headName: string | null;
  location: string | null;
  _count: { employees: number };
};

type EmpRow = {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  location: string | null;
  ecn: string | null;
  managerName: string | null;
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
  gradient,
}: {
  dept: DeptRow;
  active: boolean;
  onSelect: () => void;
  gradient: string;
}) {
  return (
    <Card3D
      as="button"
      tilt={false}
      shine={false}
      onClick={onSelect}
      className={cn(
        "w-full overflow-hidden border-0 bg-transparent p-0 text-left shadow-none",
        active ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-black/5"
      )}
    >
      <div
        className="relative min-h-[96px] p-3 text-white sm:min-h-[104px] sm:p-3.5"
        style={{ background: gradient }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,transparent_55%)]" />
        <div className="relative flex items-start justify-between gap-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm ring-1 ring-white/25 backdrop-blur-sm">
            {deptEmoji(dept.name)}
          </span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/20">
            {dept._count.employees}
          </span>
        </div>
        <h3 className="relative mt-2 text-xs font-bold leading-tight tracking-tight sm:text-sm">
          {dept.name}
        </h3>
        {dept.headName && (
          <p className="relative mt-0.5 truncate text-[10px] text-white/75">
            {dept.headName}
          </p>
        )}
      </div>
    </Card3D>
  );
}

export function DepartmentBrowser() {
  const { groups, standaloneUnits } = useOrgUnits();
  const [companyFilter, setCompanyFilter] = useState("all");
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [selectedDept, setSelectedDept] = useState<DeptRow | null>(null);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingEmps, setLoadingEmps] = useState(false);

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
    const named = departments.filter((d) => d.name?.trim());
    const scoped =
      companyFilter === "all"
        ? named
        : named.filter((d) => d._count.employees > 0);

    const ranked = [...scoped].sort(
      (a, b) => b._count.employees - a._count.employees
    );
    const kept: DeptRow[] = [];
    for (const d of ranked) {
      const norm = d.name.toLowerCase();
      const overlaps = kept.some((k) => {
        const kn = k.name.toLowerCase();
        return kn === norm || kn.includes(norm) || norm.includes(kn);
      });
      if (!overlaps) kept.push(d);
    }
    return kept.sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, companyFilter]);

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const qs =
        companyFilter !== "all"
          ? `?unit=${encodeURIComponent(companyFilter)}`
          : "";
      const res = await fetch(`/api/departments${qs}`);
      if (res.ok) {
        setDepartments(await res.json());
      }
    } finally {
      setLoadingDepts(false);
    }
  }, [companyFilter]);

  const loadEmployees = useCallback(
    async (dept: DeptRow) => {
      setLoadingEmps(true);
      try {
        const params = new URLSearchParams({ departmentId: dept.id });
        if (companyFilter !== "all") {
          params.set("unit", companyFilter);
        }
        const res = await fetch(`/api/employees?${params}`);
        if (res.ok) {
          setEmployees(await res.json());
        }
      } finally {
        setLoadingEmps(false);
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
      setEmployees([]);
    }
  }, [selectedDept, loadEmployees]);

  function handleDeptClick(dept: DeptRow) {
    setSelectedDept((prev) => (prev?.id === dept.id ? null : dept));
  }

  function handleCompanyChange(value: string) {
    setCompanyFilter(value);
    setSelectedDept(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Departments
        </h2>
        <label className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs shadow-soft">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Company</span>
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

      {loadingDepts ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading departments…
        </div>
      ) : visibleDepartments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {companyFilter !== "all"
            ? `No employees found for ${companyLabel}. Try another company.`
            : "No departments found."}
        </p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleDepartments.map((dept, i) => (
            <DeptTile
              key={dept.id}
              dept={dept}
              gradient={UNIT_GRADIENT_PRESETS[i % UNIT_GRADIENT_PRESETS.length]}
              active={selectedDept?.id === dept.id}
              onSelect={() => handleDeptClick(dept)}
            />
          ))}
        </div>
      )}

      {selectedDept && (
        <div className="animate-fade-up rounded-2xl border border-border/80 bg-card shadow-soft">
          <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setSelectedDept(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                {selectedDept.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {companyLabel} · {selectedDept._count.employees} employee
                {selectedDept._count.employees === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="max-h-[min(420px,50vh)] overflow-y-auto p-4 sm:p-5">
            {loadingEmps ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees…
              </div>
            ) : employees.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No employees in this department
                {companyFilter !== "all" ? ` for ${companyLabel}` : ""}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Designation</th>
                      <th className="pb-2 pr-3">ECN</th>
                      <th className="pb-2 pr-3">Location</th>
                      <th className="pb-2">Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/40"
                      >
                        <td className="py-2.5 pr-3 font-medium text-foreground">
                          {emp.name}
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">
                          {emp.designation ?? "—"}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                          {emp.ecn ?? "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">
                          {emp.location ?? "—"}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {emp.managerName ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
