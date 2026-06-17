import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_ORG_GROUPS,
  DEFAULT_STANDALONE_UNITS,
  OBSOLETE_UNIT_SLUGS,
  type DefaultOrgUnit,
} from "../src/lib/org-units-defaults";

const db = new PrismaClient();

async function upsertUnit(
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

async function main() {
  const org = await db.organization.findFirst();
  if (!org) {
    console.error("No organization found");
    process.exit(1);
  }

  for (const g of DEFAULT_ORG_GROUPS) {
    let group = await db.orgGroupMaster.findFirst({
      where: { organizationId: org.id, slug: g.slug },
    });
    if (!group) {
      group = await db.orgGroupMaster.create({
        data: {
          organizationId: org.id,
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
      await upsertUnit(org.id, group.id, u);
    }
  }

  for (const u of DEFAULT_STANDALONE_UNITS) {
    await upsertUnit(org.id, null, u);
  }

  await db.orgUnitMaster.updateMany({
    where: {
      organizationId: org.id,
      slug: { in: [...OBSOLETE_UNIT_SLUGS] },
    },
    data: { isActive: false },
  });

  const units = await db.orgUnitMaster.findMany({
    where: { organizationId: org.id, isActive: true },
    include: { group: true },
    orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  console.log("Active units:");
  for (const u of units) {
    console.log(`  ${u.group?.name ?? "Other"} — ${u.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
