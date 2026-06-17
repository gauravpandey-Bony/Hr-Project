"use client";

import { createContext, useContext, useMemo } from "react";
import type { OrgGroup, OrgUnit } from "@/lib/org-units";
import { getAllOrgUnitsFromStructure } from "@/lib/org-units";

type OrgStructure = {
  groups: OrgGroup[];
  standaloneUnits: OrgUnit[];
};

const OrgUnitsContext = createContext<{
  groups: OrgGroup[];
  standaloneUnits: OrgUnit[];
  allUnits: OrgUnit[];
}>({
  groups: [],
  standaloneUnits: [],
  allUnits: [],
});

export function OrgUnitsProvider({
  structure,
  children,
}: {
  structure: OrgStructure;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      groups: structure.groups,
      standaloneUnits: structure.standaloneUnits,
      allUnits: getAllOrgUnitsFromStructure(structure),
    }),
    [structure]
  );

  return <OrgUnitsContext.Provider value={value}>{children}</OrgUnitsContext.Provider>;
}

export function useOrgUnits() {
  return useContext(OrgUnitsContext);
}

export function useOrgUnit(unitId: string | null | undefined): OrgUnit | undefined {
  const { allUnits } = useOrgUnits();
  if (!unitId) return undefined;
  return allUnits.find((u) => u.id === unitId);
}
