/** Shared org unit types — data lives in DB (see org-units.server.ts). */

import {
  DEFAULT_ORG_GROUPS,
  DEFAULT_STANDALONE_UNITS,
} from "@/lib/org-units-defaults";

export type OrgUnit = {
  id: string;
  name: string;
  subtitle?: string;
  plantUnitKey: string;
  locationAliases: string[];
  kpiPlantAliases: string[];
  gradientCss: string;
  accent: string;
  emoji: string;
  groupId?: string;
  sortOrder?: number;
};

export type OrgGroup = {
  id: string;
  name: string;
  subtitle?: string;
  gradientCss: string;
  accent: string;
  emoji: string;
  units: OrgUnit[];
  sortOrder?: number;
};

export const DATA_UNIT_ID = "bony-37p";

export const PLATFORM_NOTE =
  "All companies are live on Bony KPI. Open any unit to manage KPIs — data starts blank until HR adds KRA/KPI or uploads figures.";

export function unitDashboardPath(unitId: string): string {
  return `/dashboard/units/${unitId}`;
}

export function parseStringArrayJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function aliasesForUnit(unit: Pick<OrgUnit, "plantUnitKey" | "locationAliases" | "kpiPlantAliases">) {
  const key = unit.plantUnitKey.trim();
  return {
    locationAliases: unit.locationAliases.length > 0 ? unit.locationAliases : [key],
    kpiPlantAliases: unit.kpiPlantAliases.length > 0 ? unit.kpiPlantAliases : [key],
  };
}

/** Canonical employee.location / import target for a plant unit key. */
export function importLocationForPlantUnitKey(plantUnitKey: string): string {
  const key = plantUnitKey.trim();
  const fromDefaults = [
    ...DEFAULT_ORG_GROUPS.flatMap((g) => g.units),
    ...DEFAULT_STANDALONE_UNITS,
  ].find((u) => u.plantUnitKey === key);

  if (fromDefaults) {
    const { locationAliases } = aliasesForUnit({
      plantUnitKey: fromDefaults.plantUnitKey,
      locationAliases: [...(fromDefaults.locationAliases ?? [])],
      kpiPlantAliases: [...(fromDefaults.kpiPlantAliases ?? [])],
    });
    const specific = locationAliases.find((a) => a.trim() !== key);
    return specific ?? key;
  }

  return key;
}

export function getAllOrgUnitsFromStructure(structure: {
  groups: OrgGroup[];
  standaloneUnits: OrgUnit[];
}): OrgUnit[] {
  return [...structure.groups.flatMap((g) => g.units), ...structure.standaloneUnits];
}

export function getOrgUnitFromCatalog(
  catalog: OrgUnit[],
  unitId: string
): OrgUnit | undefined {
  return catalog.find((u) => u.id === unitId);
}

export function getOrgGroupFromStructure(
  structure: { groups: OrgGroup[] },
  groupId: string
): OrgGroup | undefined {
  return structure.groups.find((g) => g.id === groupId);
}

/** Location strings used in employee/department master for a plant */
export function getLocationVariantsForPlant(
  plantUnitKey: string,
  locationAliases?: string[]
): string[] {
  if (locationAliases?.length) return [...new Set(locationAliases)];
  const key = plantUnitKey.trim();
  const variants = new Set<string>([key]);
  if (key === "Bony Polymers" || key.includes("37")) {
    variants.add("Bony Polymers");
    variants.add("Bony 37P");
  }
  return [...variants];
}
