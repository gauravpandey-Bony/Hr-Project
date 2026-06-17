"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export function CommandMenu({ userRole = "ADMIN" }: { userRole?: UserRole }) {
  const { allUnits } = useOrgUnits();
  const adminUnitId = useAdminSelectedUnit(userRole, allUnits);
  const commandPaletteItems = getCommandPaletteItemsForRole(
    userRole,
    adminUnitId,
    allUnits
  );
  const [open, setOpen] = useState(false);
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

  const run = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const groups = Array.from(
    new Set(commandPaletteItems.map((i) => i.group))
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, KPIs, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
