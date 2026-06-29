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

export function employeeMasterWhereForPlant(
  organizationId: string,
  scope: PlantDataScope | string
): Prisma.EmployeeMasterWhereInput {
  const resolved = typeof scope === "string" ? plantDataScope(scope) : scope;
  return {
    organizationId,
    OR: [
      ...resolved.locationAliases.map((location) => ({ location })),
      { location: null },
      { location: "" },
    ],
  };
}

export function departmentMasterWhereForPlant(
  organizationId: string,
  scope: PlantDataScope | string
): Prisma.DepartmentMasterWhereInput {
  const resolved = typeof scope === "string" ? plantDataScope(scope) : scope;
  return {
    organizationId,
    OR: resolved.locationAliases.map((location) => ({ location })),
  };
}

export function kpiWhereForPlantScope(
  scope: PlantDataScope
): Pick<Prisma.KpiWhereInput, "plantUnit" | "OR"> {
  const plantMatches = scope.kpiPlantAliases.map((plantUnit) => ({ plantUnit }));
  return {
    OR: [...plantMatches, { plantUnit: null }, { plantUnit: "" }],
  };
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
