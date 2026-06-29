"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import { Card3D } from "@/components/ui/card-3d";
import { cn } from "@/lib/utils";
import { useOrgUnits } from "@/components/providers/org-units-provider";
import { UNIT_GRADIENT_PRESETS } from "@/lib/org-units-defaults";

type DeptRow = {
  id: string;
  name: string;
  headName: string | null;
  location: string | null;
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
  const [selectedDept, setSelectedDept] = useState<DeptRow | null>(null);
  const [loadingDepts, setLoadingDepts] = useState(true);

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
    const kept: DeptRow[] = [];
    for (const d of named) {
      const norm = d.name.toLowerCase();
      const overlaps = kept.some((k) => {
        const kn = k.name.toLowerCase();
        return kn === norm || kn.includes(norm) || norm.includes(kn);
      });
      if (!overlaps) kept.push(d);
    }
    return kept.sort((a, b) => a.name.localeCompare(b.name));
  }, [departments]);

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

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

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
            ? `No departments found for ${companyLabel}.`
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
        <div className="animate-fade-up rounded-2xl border border-border/80 bg-card px-4 py-4 text-sm text-muted-foreground shadow-soft sm:px-5">
          <p className="font-semibold text-foreground">{selectedDept.name}</p>
          <p className="mt-1">
            {selectedDept.headName ? `Head: ${selectedDept.headName}` : "No department head set"}
            {selectedDept.location ? ` · ${selectedDept.location}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
