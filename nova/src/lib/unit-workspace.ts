import type { Prisma } from "@prisma/client";
import { DEMO_ACCOUNTS, demoRoleForUserId } from "@/lib/demo-accounts";
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
    OR: resolved.locationAliases.map((location) => ({ location })),
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
  if (scope.kpiPlantAliases.length === 1) {
    return { plantUnit: scope.kpiPlantAliases[0] };
  }
  return { OR: scope.kpiPlantAliases.map((plantUnit) => ({ plantUnit })) };
}

export function resolveUserPlantUnitKeySync(userId: string): string {
  const demoKey = demoRoleForUserId(userId);
  if (demoKey) {
    return DEMO_ACCOUNTS[demoKey].location;
  }
  return "Bony 37P";
}

export function employeeDashboardPathForUser(userId: string): string {
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
