import "server-only";

import { cache } from "react";
import type { OrgGroupMaster, OrgUnitMaster } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DEFAULT_ORG_GROUPS,
  DEFAULT_STANDALONE_UNITS,
  OBSOLETE_UNIT_SLUGS,
  BONY_37P_KPI_PLANT_ALIASES,
  BONY_37P_LOCATION_ALIASES,
  UNIT_ACCENT_PRESETS,
  UNIT_EMOJI_PRESETS,
  UNIT_GRADIENT_PRESETS,
  type DefaultOrgUnit,
} from "@/lib/org-units-defaults";
import type { OrgGroup, OrgUnit } from "@/lib/org-units";
import { parseStringArrayJson } from "@/lib/org-units";
import { resolvePlantFromWorkingLocation } from "@/lib/masters/employee-plant-location";

function mapUnit(row: OrgUnitMaster, groupSlug?: string): OrgUnit {
  const locationAliases = parseStringArrayJson(row.locationAliases);
  const kpiPlantAliases = parseStringArrayJson(row.kpiPlantAliases);
  return {
    id: row.slug,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    plantUnitKey: row.plantUnitKey,
    locationAliases,
    kpiPlantAliases,
    gradientCss: row.gradientCss,
    accent: row.accent,
    emoji: row.emoji,
    groupId: groupSlug,
    sortOrder: row.sortOrder,
  };
}

function mapGroup(row: OrgGroupMaster, units: OrgUnit[]): OrgGroup {
  return {
    id: row.slug,
    name: row.name,
    subtitle: row.subtitle ?? `${units.length} locations`,
    gradientCss: row.gradientCss,
    accent: row.accent,
    emoji: row.emoji,
    units,
    sortOrder: row.sortOrder,
  };
}

export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function pickUnitStyle(index: number) {
  const i = index % UNIT_GRADIENT_PRESETS.length;
  return {
    gradientCss: UNIT_GRADIENT_PRESETS[i],
    accent: UNIT_ACCENT_PRESETS[i],
    emoji: UNIT_EMOJI_PRESETS[index % UNIT_EMOJI_PRESETS.length],
  };
}

/** Ensures default groups/units exist for an org (idempotent). */
export async function syncOrgUnitsFromDefaults(organizationId: string): Promise<void> {
  const existing = await db.orgGroupMaster.count({ where: { organizationId } });
  if (existing > 0) return;

  for (const g of DEFAULT_ORG_GROUPS) {
    const group = await db.orgGroupMaster.create({
      data: {
        organizationId,
        slug: g.slug,
        name: g.name,
        subtitle: g.subtitle ?? null,
        gradientCss: g.gradientCss,
        accent: g.accent,
        emoji: g.emoji,
        sortOrder: g.sortOrder,
      },
    });

    for (const u of g.units) {
      await db.orgUnitMaster.create({
        data: {
          organizationId,
          groupId: group.id,
          slug: u.slug,
          name: u.name,
          subtitle: u.subtitle ?? null,
          plantUnitKey: u.plantUnitKey,
          locationAliases: JSON.stringify(u.locationAliases ?? [u.plantUnitKey]),
          kpiPlantAliases: JSON.stringify(u.kpiPlantAliases ?? [u.plantUnitKey]),
          gradientCss: u.gradientCss,
          accent: u.accent,
          emoji: u.emoji,
          sortOrder: u.sortOrder,
        },
      });
    }
  }

  for (const u of DEFAULT_STANDALONE_UNITS) {
    await db.orgUnitMaster.create({
      data: {
        organizationId,
        groupId: null,
        slug: u.slug,
        name: u.name,
        subtitle: u.subtitle ?? null,
        plantUnitKey: u.plantUnitKey,
        locationAliases: JSON.stringify(u.locationAliases ?? [u.plantUnitKey]),
        kpiPlantAliases: JSON.stringify(u.kpiPlantAliases ?? [u.plantUnitKey]),
        gradientCss: u.gradientCss,
        accent: u.accent,
        emoji: u.emoji,
        sortOrder: u.sortOrder,
      },
    });
  }
}

async function upsertDefaultUnit(
  organizationId: string,
  groupId: string | null,
  u: DefaultOrgUnit
) {
  const existing = await db.orgUnitMaster.findFirst({
    where: { organizationId, slug: u.slug },
  });

  const data = {
    name: u.name,
    subtitle: u.subtitle ?? null,
    plantUnitKey: u.plantUnitKey,
    locationAliases: JSON.stringify(u.locationAliases ?? [u.plantUnitKey]),
    kpiPlantAliases: JSON.stringify(u.kpiPlantAliases ?? [u.plantUnitKey]),
    gradientCss: u.gradientCss,
    accent: u.accent,
    emoji: u.emoji,
    sortOrder: u.sortOrder,
    groupId,
    isActive: true,
  };

  if (existing) {
    await db.orgUnitMaster.update({ where: { id: existing.id }, data });
  } else {
    await db.orgUnitMaster.create({
      data: { organizationId, slug: u.slug, ...data },
    });
  }
}

/** Fix names/slugs after bad seed (e.g. Bony 38P–44P) — idempotent */
export async function reconcileDefaultOrgUnits(organizationId: string): Promise<void> {
  for (const g of DEFAULT_ORG_GROUPS) {
    let group = await db.orgGroupMaster.findFirst({
      where: { organizationId, slug: g.slug },
    });
    if (!group) {
      group = await db.orgGroupMaster.create({
        data: {
          organizationId,
          slug: g.slug,
          name: g.name,
          subtitle: g.subtitle ?? null,
          gradientCss: g.gradientCss,
          accent: g.accent,
          emoji: g.emoji,
          sortOrder: g.sortOrder,
        },
      });
    } else {
      await db.orgGroupMaster.update({
        where: { id: group.id },
        data: {
          name: g.name,
          subtitle: g.subtitle ?? null,
          gradientCss: g.gradientCss,
          accent: g.accent,
          emoji: g.emoji,
          sortOrder: g.sortOrder,
          isActive: true,
        },
      });
    }

    for (const u of g.units) {
      await upsertDefaultUnit(organizationId, group.id, u);
    }
  }

  for (const u of DEFAULT_STANDALONE_UNITS) {
    await upsertDefaultUnit(organizationId, null, u);
  }

  if (OBSOLETE_UNIT_SLUGS.length > 0) {
    await db.orgUnitMaster.updateMany({
      where: {
        organizationId,
        slug: { in: [...OBSOLETE_UNIT_SLUGS] },
      },
      data: { isActive: false },
    });
  }
}

/** Backfill data-match aliases for units seeded before alias columns existed. */
async function ensureUnitDataAliases(organizationId: string): Promise<void> {
  const bony37p = await db.orgUnitMaster.findFirst({
    where: { organizationId, slug: "bony-37p" },
  });
  if (!bony37p) return;

  const needsLocations = parseStringArrayJson(bony37p.locationAliases).length === 0;
  const needsKpi = parseStringArrayJson(bony37p.kpiPlantAliases).length === 0;
  if (!needsLocations && !needsKpi) return;

  await db.orgUnitMaster.update({
    where: { id: bony37p.id },
    data: {
      ...(needsLocations
        ? { locationAliases: JSON.stringify([...BONY_37P_LOCATION_ALIASES]) }
        : {}),
      ...(needsKpi
        ? { kpiPlantAliases: JSON.stringify([...BONY_37P_KPI_PLANT_ALIASES]) }
        : {}),
    },
  });
}

function expectedDefaultUnitSlugs(): string[] {
  return [
    ...DEFAULT_ORG_GROUPS.flatMap((g) => g.units.map((u) => u.slug)),
    ...DEFAULT_STANDALONE_UNITS.map((u) => u.slug),
  ];
}

async function loadOrgStructureRows(organizationId: string) {
  return Promise.all([
    db.orgGroupMaster.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.orgUnitMaster.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { group: true },
    }),
  ]);
}

function mapOrgStructure(
  groupRows: OrgGroupMaster[],
  unitRows: (OrgUnitMaster & { group: OrgGroupMaster | null })[]
) {
  const groupSlugById = new Map(groupRows.map((g) => [g.id, g.slug]));
  const unitsByGroupSlug = new Map<string, OrgUnit[]>();
  const standaloneUnits: OrgUnit[] = [];

  for (const row of unitRows) {
    const unit = mapUnit(row, row.groupId ? groupSlugById.get(row.groupId) : undefined);
    if (row.groupId) {
      const gSlug = groupSlugById.get(row.groupId)!;
      const list = unitsByGroupSlug.get(gSlug) ?? [];
      list.push(unit);
      unitsByGroupSlug.set(gSlug, list);
    } else {
      standaloneUnits.push(unit);
    }
  }

  const groups = groupRows.map((g) =>
    mapGroup(g, unitsByGroupSlug.get(g.slug) ?? [])
  );
  const allUnits = [...groups.flatMap((g) => g.units), ...standaloneUnits];
  return { groups, standaloneUnits, allUnits };
}

/**
 * Fast read path for dashboard layout. Avoids rewriting every org unit on each
 * navigation — only seeds/reconciles when units are missing.
 */
export const fetchOrgStructure = cache(async (organizationId: string) => {
  let [groupRows, unitRows] = await loadOrgStructureRows(organizationId);

  if (unitRows.length === 0) {
    await syncOrgUnitsFromDefaults(organizationId);
    await reconcileDefaultOrgUnits(organizationId);
    await ensureUnitDataAliases(organizationId);
    [groupRows, unitRows] = await loadOrgStructureRows(organizationId);
  } else {
    const slugSet = new Set(unitRows.map((u) => u.slug));
    const missingDefault = expectedDefaultUnitSlugs().some((slug) => !slugSet.has(slug));
    if (missingDefault) {
      await reconcileDefaultOrgUnits(organizationId);
      await ensureUnitDataAliases(organizationId);
      [groupRows, unitRows] = await loadOrgStructureRows(organizationId);
    } else {
      const bony37p = unitRows.find((u) => u.slug === "bony-37p");
      const needsAliases =
        bony37p &&
        (parseStringArrayJson(bony37p.locationAliases).length === 0 ||
          parseStringArrayJson(bony37p.kpiPlantAliases).length === 0);
      if (needsAliases) {
        await ensureUnitDataAliases(organizationId);
        [groupRows, unitRows] = await loadOrgStructureRows(organizationId);
      }
    }
  }

  return mapOrgStructure(groupRows, unitRows);
});

export async function getOrgUnitBySlug(
  organizationId: string,
  unitSlug: string
): Promise<OrgUnit | null> {
  const { allUnits } = await fetchOrgStructure(organizationId);
  return allUnits.find((u) => u.id === unitSlug) ?? null;
}

export async function getOrgGroupBySlug(
  organizationId: string,
  groupSlug: string
): Promise<OrgGroup | null> {
  const { groups } = await fetchOrgStructure(organizationId);
  return groups.find((g) => g.id === groupSlug) ?? null;
}

export async function findUnitSlugByPlantUnitKey(
  organizationId: string,
  plantUnitKey: string
): Promise<string | null> {
  const trimmed = plantUnitKey.trim();
  if (!trimmed) return null;

  const row = await db.orgUnitMaster.findFirst({
    where: { organizationId, plantUnitKey: trimmed, isActive: true },
    select: { slug: true },
  });
  if (row) return row.slug;

  const { allUnits } = await fetchOrgStructure(organizationId);
  const aliasMatch = allUnits.find((u) =>
    u.kpiPlantAliases.some((alias) => alias.toLowerCase() === trimmed.toLowerCase())
  );
  return aliasMatch?.id ?? null;
}

export async function locationToPlantUnitKey(
  organizationId: string,
  location: string | null | undefined
): Promise<string> {
  const trimmed = location?.trim();
  if (!trimmed) return "Bony 37P";

  const fromRules = resolvePlantFromWorkingLocation(trimmed);
  const { allUnits } = await fetchOrgStructure(organizationId);

  const exact = allUnits.find(
    (u) => u.plantUnitKey.toLowerCase() === fromRules.plantUnitKey.toLowerCase()
  );
  if (exact) return exact.plantUnitKey;

  const aliasMatch = allUnits.find((u) =>
    u.locationAliases.some(
      (alias) =>
        alias.toLowerCase() === trimmed.toLowerCase() ||
        alias.toLowerCase() === fromRules.location.toLowerCase()
    )
  );
  if (aliasMatch) return aliasMatch.plantUnitKey;

  const partial = allUnits.find((u) =>
    trimmed.toLowerCase().includes(u.plantUnitKey.toLowerCase())
  );
  if (partial) return partial.plantUnitKey;

  return fromRules.plantUnitKey;
}

export type CreateOrgGroupInput = {
  name: string;
  subtitle?: string;
  emoji?: string;
};

export async function createOrgGroup(
  organizationId: string,
  input: CreateOrgGroupInput
): Promise<OrgGroup> {
  const baseSlug = slugifyOrgName(input.name);
  let slug = baseSlug;
  let n = 1;
  while (
    await db.orgGroupMaster.findFirst({ where: { organizationId, slug } })
  ) {
    slug = `${baseSlug}-${n++}`;
  }

  const count = await db.orgGroupMaster.count({ where: { organizationId } });
  const style = pickUnitStyle(count);

  const row = await db.orgGroupMaster.create({
    data: {
      organizationId,
      slug,
      name: input.name.trim(),
      subtitle: input.subtitle?.trim() || null,
      gradientCss: style.gradientCss,
      accent: style.accent,
      emoji: input.emoji ?? style.emoji,
      sortOrder: count,
    },
  });

  return mapGroup(row, []);
}

export type CreateOrgUnitInput = {
  name: string;
  subtitle?: string;
  groupSlug?: string | null;
  plantUnitKey?: string;
  emoji?: string;
};

export async function createOrgUnit(
  organizationId: string,
  input: CreateOrgUnitInput
): Promise<OrgUnit> {
  const name = input.name.trim();
  const plantUnitKey = (input.plantUnitKey?.trim() || name).slice(0, 120);

  const baseSlug = slugifyOrgName(name);
  let slug = baseSlug;
  let n = 1;
  while (
    await db.orgUnitMaster.findFirst({ where: { organizationId, slug } })
  ) {
    slug = `${baseSlug}-${n++}`;
  }

  let groupId: string | null = null;
  let groupSlug: string | undefined;
  if (input.groupSlug) {
    const group = await db.orgGroupMaster.findFirst({
      where: { organizationId, slug: input.groupSlug, isActive: true },
    });
    if (!group) throw new Error("Company group not found");
    groupId = group.id;
    groupSlug = group.slug;
  }

  const count = await db.orgUnitMaster.count({
    where: { organizationId, groupId },
  });
  const style = pickUnitStyle(count + (groupId ? 0 : 5));

  const row = await db.orgUnitMaster.create({
    data: {
      organizationId,
      groupId,
      slug,
      name,
      subtitle: input.subtitle?.trim() || null,
      plantUnitKey,
      locationAliases: JSON.stringify([plantUnitKey]),
      kpiPlantAliases: JSON.stringify([plantUnitKey]),
      gradientCss: style.gradientCss,
      accent: style.accent,
      emoji: input.emoji ?? style.emoji,
      sortOrder: count,
    },
  });

  return mapUnit(row, groupSlug);
}
