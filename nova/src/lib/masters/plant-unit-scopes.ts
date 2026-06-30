import {
  DEFAULT_ORG_GROUPS,
  DEFAULT_STANDALONE_UNITS,
  type DefaultOrgUnit,
} from "@/lib/org-units-defaults";
import type { PlantUnitScopeInput } from "./department-master-sync";

export function listDefaultOrgUnits(): DefaultOrgUnit[] {
  return [
    ...DEFAULT_ORG_GROUPS.flatMap((g) => g.units),
    ...DEFAULT_STANDALONE_UNITS,
  ];
}

export function listPlantUnitScopes(): PlantUnitScopeInput[] {
  return listDefaultOrgUnits().map((u) => ({
    plantUnitKey: u.plantUnitKey,
    locationAliases: u.locationAliases ? [...u.locationAliases] : undefined,
    kpiPlantAliases: u.kpiPlantAliases ? [...u.kpiPlantAliases] : undefined,
  }));
}
