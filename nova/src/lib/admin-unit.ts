import { mainNav, DEPARTMENT_MASTER_PATH, type NavItem } from "@/lib/navigation";
import type { OrgUnit } from "@/lib/org-units";
import { getOrgUnitFromCatalog } from "@/lib/org-units";
import { OBSOLETE_UNIT_REDIRECTS } from "@/lib/org-units-defaults";

export const ADMIN_UNIT_PICKER_PATH = "/dashboard";

export const ADMIN_UNIT_STORAGE_KEY = "nova_admin_unit";

const UNIT_SCOPED_ADMIN_PATHS = new Set([DEPARTMENT_MASTER_PATH]);

function isValidUnitId(unitId: string, catalog?: OrgUnit[]): boolean {
  if (catalog) return catalog.some((u) => u.id === unitId);
  return /^[a-z0-9][a-z0-9-]{0,47}$/.test(unitId);
}

export function parseUnitIdFromPath(
  pathname: string,
  catalog?: OrgUnit[]
): string | null {
  const match = pathname.match(/^\/dashboard\/units\/([^/]+)/);
  if (!match) return null;
  return isValidUnitId(match[1], catalog) ? match[1] : null;
}

function appendUnitQuery(path: string, unitId: string): string {
  const url = new URL(path, "http://local");
  url.searchParams.set("unit", unitId);
  return `${url.pathname}${url.search}`;
}

export function persistAdminUnitId(unitId: string, catalog?: OrgUnit[]) {
  if (typeof window === "undefined") return;
  if (!isValidUnitId(unitId, catalog)) return;
  window.localStorage.setItem(ADMIN_UNIT_STORAGE_KEY, unitId);
  document.cookie = `${ADMIN_UNIT_STORAGE_KEY}=${encodeURIComponent(unitId)};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Lax`;
}

export function resolveStoredUnitId(
  unitId: string | null,
  catalog?: OrgUnit[]
): string | null {
  if (!unitId) return null;
  const redirected = OBSOLETE_UNIT_REDIRECTS[unitId] ?? unitId;
  return isValidUnitId(redirected, catalog) ? redirected : null;
}

export function readAdminUnitId(catalog?: OrgUnit[]): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(ADMIN_UNIT_STORAGE_KEY);
  if (!stored) return null;
  const resolved = resolveStoredUnitId(stored, catalog);
  if (resolved && resolved !== stored) {
    persistAdminUnitId(resolved, catalog);
  }
  return resolved;
}

export function clearAdminUnitId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_UNIT_STORAGE_KEY);
  document.cookie = `${ADMIN_UNIT_STORAGE_KEY}=;path=/;max-age=0;SameSite=Lax`;
}

/** Admin sidebar: unit picker only until a unit workspace is chosen */
export function getAdminMainNav(
  selectedUnitId: string | null | undefined,
  catalog: OrgUnit[] = []
): NavItem[] {
  const selectUnit = mainNav.find((item) => item.href === ADMIN_UNIT_PICKER_PATH);
  if (!selectUnit) return [];

  if (!selectedUnitId) return [selectUnit];

  return mainNav.map((item) => {
    if (item.href === ADMIN_UNIT_PICKER_PATH) {
      const unit = getOrgUnitFromCatalog(catalog, selectedUnitId);
      return {
        ...item,
        label: unit?.name ?? item.label,
        keywords: [...(item.keywords ?? []), "switch unit", "change unit"],
      };
    }
    if (UNIT_SCOPED_ADMIN_PATHS.has(item.href)) {
      return { ...item, href: appendUnitQuery(item.href, selectedUnitId) };
    }
    return item;
  });
}

export function adminHasUnitWorkspace(
  selectedUnitId: string | null | undefined,
  catalog: OrgUnit[] = []
): selectedUnitId is string {
  return Boolean(selectedUnitId && isValidUnitId(selectedUnitId, catalog));
}

export function appendUnitQueryForAdmin(path: string, unitId: string): string {
  return appendUnitQuery(path, unitId);
}
