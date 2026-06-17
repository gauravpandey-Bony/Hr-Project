"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { OrgUnit } from "@/lib/org-units";
import {
  clearAdminUnitId,
  parseUnitIdFromPath,
  persistAdminUnitId,
  readAdminUnitId,
  resolveStoredUnitId,
} from "@/lib/admin-unit";

export function useAdminSelectedUnit(
  userRole: UserRole,
  catalog: OrgUnit[] = []
): string | null {
  const pathname = usePathname();
  const [storedUnitId, setStoredUnitId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  function unitFromQuery(): string | null {
    if (typeof window === "undefined") return null;
    return resolveStoredUnitId(
      new URLSearchParams(window.location.search).get("unit"),
      catalog
    );
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userRole !== "ADMIN") return;

    const fromPath = parseUnitIdFromPath(pathname, catalog);
    const fromQuery = unitFromQuery();

    if (fromPath) {
      persistAdminUnitId(fromPath, catalog);
      setStoredUnitId(fromPath);
      return;
    }

    if (fromQuery) {
      persistAdminUnitId(fromQuery, catalog);
      setStoredUnitId(fromQuery);
      return;
    }

    if (pathname === "/dashboard") {
      clearAdminUnitId();
      setStoredUnitId(null);
      return;
    }

    setStoredUnitId(resolveStoredUnitId(readAdminUnitId(catalog), catalog));
  }, [pathname, userRole, catalog]);

  if (userRole !== "ADMIN") return null;
  if (pathname === "/dashboard") return null;

  const fromPath = parseUnitIdFromPath(pathname, catalog);
  if (fromPath) return fromPath;

  if (!mounted) return null;

  const fromQuery = unitFromQuery();
  if (fromQuery) return fromQuery;

  return storedUnitId;
}
