import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { ADMIN_UNIT_STORAGE_KEY } from "@/lib/admin-unit";
import { OBSOLETE_UNIT_REDIRECTS } from "@/lib/org-units-defaults";
import type { OrgUnit } from "@/lib/org-units";
import { aliasesForUnit, DATA_UNIT_ID } from "@/lib/org-units";
import {
  findUnitSlugByPlantUnitKey,
  getOrgUnitBySlug,
  locationToPlantUnitKey,
} from "@/lib/org-units.server";
import { plantDataScope, type PlantDataScope } from "@/lib/unit-workspace";

export type WorkspaceContext = {
  unitId: string | null;
  plantUnitKey: string | null;
  unit: OrgUnit | undefined;
  dataScope: PlantDataScope | null;
};

function dataScopeFromUnit(unit: OrgUnit | undefined, plantUnitKey: string | null): PlantDataScope | null {
  if (!plantUnitKey) return null;
  if (unit) {
    const { locationAliases, kpiPlantAliases } = aliasesForUnit(unit);
    return plantDataScope(plantUnitKey, locationAliases, kpiPlantAliases);
  }
  return plantDataScope(plantUnitKey);
}

export async function getAdminUnitIdFromCookie(
  organizationId: string
): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ADMIN_UNIT_STORAGE_KEY)?.value;
  if (!value) return null;
  const unitSlug = OBSOLETE_UNIT_REDIRECTS[value] ?? value;
  const unit = await getOrgUnitBySlug(organizationId, unitSlug);
  return unit ? unitSlug : null;
}

export async function resolveUserPlantUnitKey(user: User): Promise<string> {
  const emp = await db.employeeMaster.findFirst({
    where: {
      organizationId: user.organizationId,
      isActive: true,
      name: user.name,
    },
    select: { location: true },
  });

  return locationToPlantUnitKey(user.organizationId, emp?.location);
}

export async function resolveWorkspace(
  user: User,
  unitIdParam?: string | null
): Promise<WorkspaceContext> {
  if (user.role === "ADMIN") {
    const fromParam =
      unitIdParam &&
      (await getOrgUnitBySlug(user.organizationId, unitIdParam))
        ? unitIdParam
        : null;
    const unitId =
      fromParam ?? (await getAdminUnitIdFromCookie(user.organizationId));
    const unit = unitId
      ? (await getOrgUnitBySlug(user.organizationId, unitId)) ?? undefined
      : undefined;
    const plantUnitKey = unit?.plantUnitKey ?? null;
    return {
      unitId: unitId ?? null,
      plantUnitKey,
      unit,
      dataScope: dataScopeFromUnit(unit, plantUnitKey),
    };
  }

  const plantUnitKey = await resolveUserPlantUnitKey(user);
  const unitId =
    (await findUnitSlugByPlantUnitKey(user.organizationId, plantUnitKey)) ??
    DATA_UNIT_ID;
  const unit =
    (await getOrgUnitBySlug(user.organizationId, unitId)) ?? undefined;
  return {
    unitId,
    plantUnitKey,
    unit,
    dataScope: dataScopeFromUnit(unit, plantUnitKey),
  };
}

export function requireAdminWorkspace(user: User, workspace: WorkspaceContext): void {
  if (user.role === "ADMIN" && !workspace.plantUnitKey) {
    redirect("/dashboard");
  }
}
