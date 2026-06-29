import type { Prisma } from "@prisma/client";
import { DATA_UNIT_ID } from "@/lib/org-units";

export type PlantDataScope = {
  plantUnitKey: string;
  locationAliases: string[];
  kpiPlantAliases: string[];
};

export function plantDataScope(
  plantUnitKey: string,
  locationAliases?: string[],
  kpiPlantAliases?: string[]
): PlantDataScope {
  const key = plantUnitKey.trim();
  return {
    plantUnitKey: key,
    locationAliases: locationAliases?.length ? locationAliases : [key],
    kpiPlantAliases: kpiPlantAliases?.length ? kpiPlantAliases : [key],
  };
}

/** Bony 37P keeps legacy rows with blank plant/location; other units are strict. */
export function plantScopeIncludesUnassigned(scope: PlantDataScope): boolean {
  const key = scope.plantUnitKey.toLowerCase();
  return (
    key.includes("bony") ||
    key.includes("37p") ||
    scope.kpiPlantAliases.some((a) => /bony|37p/i.test(a))
  );
}

function locationOrClauses(
  aliases: string[]
): Prisma.EmployeeMasterWhereInput[] {
  return aliases.map((location) => ({ location }));
}

export function employeeMasterWhereForPlant(
  organizationId: string,
  scope: PlantDataScope | string
): Prisma.EmployeeMasterWhereInput {
  const resolved = typeof scope === "string" ? plantDataScope(scope) : scope;
  const locationMatches = locationOrClauses(resolved.locationAliases);

  if (plantScopeIncludesUnassigned(resolved)) {
    return {
      organizationId,
      OR: [...locationMatches, { location: null }, { location: "" }],
    };
  }

  return {
    organizationId,
    OR: locationMatches,
  };
}

export function departmentMasterWhereForPlant(
  organizationId: string,
  scope: PlantDataScope | string
): Prisma.DepartmentMasterWhereInput {
  const resolved = typeof scope === "string" ? plantDataScope(scope) : scope;
  const locationMatches = locationOrClauses(resolved.locationAliases);

  if (plantScopeIncludesUnassigned(resolved)) {
    return {
      organizationId,
      OR: [...locationMatches, { location: null }, { location: "" }],
    };
  }

  return {
    organizationId,
    OR: locationMatches,
  };
}

export function kpiWhereForPlantScope(
  scope: PlantDataScope
): Pick<Prisma.KpiWhereInput, "plantUnit" | "OR"> {
  const plantMatches = scope.kpiPlantAliases.map((plantUnit) => ({ plantUnit }));

  if (plantScopeIncludesUnassigned(scope)) {
    return {
      OR: [...plantMatches, { plantUnit: null }, { plantUnit: "" }],
    };
  }

  return { OR: plantMatches };
}

export function resolveUserPlantUnitKeySync(_userId: string): string {
  return "Bony 37P";
}

export function employeeDashboardPathForUser(_userId: string): string {
  return `/dashboard/units/${DATA_UNIT_ID}`;
}

export function appendUnitQuery(path: string, unitId: string): string {
  if (path.startsWith("/dashboard/units/")) {
    return `/dashboard/units/${unitId}`;
  }
  const url = new URL(path, "http://local");
  url.searchParams.set("unit", unitId);
  return `${url.pathname}${url.search}`;
}
