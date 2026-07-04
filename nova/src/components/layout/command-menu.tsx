"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { getCommandPaletteItemsForRole } from "@/lib/access-control";
import { useAdminSelectedUnit } from "@/hooks/use-admin-unit";
import { useOrgUnits } from "@/components/providers/org-units-provider";
import type { UserRole } from "@prisma/client";

type SearchEmployee = {
  id: string;
  name: string;
  ecn: string | null;
  department: string | null;
  designation: string | null;
  location: string | null;
  plantLabel?: string;
};

function employeeSearchValue(emp: SearchEmployee): string {
  return [
    emp.name,
    emp.ecn,
    emp.department,
    emp.designation,
    emp.location,
    emp.plantLabel,
  ]
    .filter(Boolean)
    .join(" ");
}

function employeeSubtitle(emp: SearchEmployee): string {
  const parts = [
    emp.ecn ? `ECN ${emp.ecn}` : null,
    emp.department,
    emp.designation,
    emp.plantLabel || emp.location,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function CommandMenu({ userRole = "ADMIN" }: { userRole?: UserRole }) {
  const { allUnits } = useOrgUnits();
  const adminUnitId = useAdminSelectedUnit(userRole, allUnits);
  const commandPaletteItems = getCommandPaletteItemsForRole(
    userRole,
    adminUnitId,
    allUnits
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<SearchEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openPalette = () => setOpen(true);
    document.addEventListener("keydown", down);
    document.addEventListener("nova:command-open", openPalette);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("nova:command-open", openPalette);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    let cancelled = false;
    setLoadingEmployees(true);
    void (async () => {
      try {
        const res = await fetch("/api/employees");
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as SearchEmployee[];
        if (!cancelled) setEmployees(rows);
      } finally {
        if (!cancelled) setLoadingEmployees(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const matchedEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return employees
      .filter((emp) => employeeSearchValue(emp).toLowerCase().includes(q))
      .slice(0, 25);
  }, [employees, query]);

  const run = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const groups = useMemo(
    () => Array.from(new Set(commandPaletteItems.map((i) => i.group))),
    [commandPaletteItems]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search name, emp code, department, designation, location…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loadingEmployees && query.trim()
            ? "Loading employees…"
            : "No results found."}
        </CommandEmpty>

        {matchedEmployees.length > 0 && (
          <>
            <CommandGroup heading="Employees">
              {matchedEmployees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={employeeSearchValue(emp)}
                  onSelect={() => run(`/dashboard/masters/employees/${emp.id}`)}
                >
                  <UserRound className="text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{emp.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {employeeSubtitle(emp)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {groups.map((group, idx) => (
          <div key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {commandPaletteItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                      onSelect={() => run(item.href)}
                    >
                      {Icon && <Icon className="text-muted-foreground" />}
                      <span>{item.label}</span>
                      <CommandShortcut className="hidden sm:inline">
                        ↵
                      </CommandShortcut>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
