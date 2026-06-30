import { PrismaClient } from "@prisma/client";
import {
  departmentMasterWhereForPlant,
  employeeMasterWhereForPlant,
  plantDataScope,
} from "../src/lib/unit-workspace";
import { aliasesForUnit, parseStringArrayJson } from "../src/lib/org-units";
import { DEFAULT_ORG_GROUPS, DEFAULT_STANDALONE_UNITS } from "../src/lib/org-units-defaults";

const db = new PrismaClient();

type UnitLike = {
  slug: string;
  plantUnitKey: string;
  locationAliases: string[];
  kpiPlantAliases: string[];
};

async function loadUnits(orgId: string): Promise<UnitLike[]> {
  const rows = await db.orgUnitMaster.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      slug: true,
      plantUnitKey: true,
      locationAliases: true,
      kpiPlantAliases: true,
    },
  });

  if (rows.length > 0) {
    return rows.map((r) => ({
      slug: r.slug,
      plantUnitKey: r.plantUnitKey,
      locationAliases: parseStringArrayJson(r.locationAliases),
      kpiPlantAliases: parseStringArrayJson(r.kpiPlantAliases),
    }));
  }

  const defaults: UnitLike[] = [];
  for (const g of DEFAULT_ORG_GROUPS) {
    for (const u of g.units) {
      defaults.push({
        slug: u.slug,
        plantUnitKey: u.plantUnitKey,
        locationAliases: u.locationAliases ?? [u.plantUnitKey],
        kpiPlantAliases: u.kpiPlantAliases ?? [u.plantUnitKey],
      });
    }
  }
  for (const u of DEFAULT_STANDALONE_UNITS) {
    defaults.push({
      slug: u.slug,
      plantUnitKey: u.plantUnitKey,
      locationAliases: u.locationAliases ?? [u.plantUnitKey],
      kpiPlantAliases: u.kpiPlantAliases ?? [u.plantUnitKey],
    });
  }
  return defaults;
}

async function checkPlant(orgId: string, unit: UnitLike) {
  const { locationAliases, kpiPlantAliases } = aliasesForUnit(unit);
  const scope = plantDataScope(unit.plantUnitKey, locationAliases, kpiPlantAliases);

  const deptWhere = departmentMasterWhereForPlant(orgId, scope);
  const empWhere = employeeMasterWhereForPlant(orgId, scope);

  const [depts, emps] = await Promise.all([
    db.departmentMaster.findMany({
      where: { ...deptWhere, isActive: true },
      select: { id: true, name: true, location: true },
    }),
    db.employeeMaster.findMany({
      where: { ...empWhere, isActive: true },
      select: { departmentId: true, department: true, location: true },
    }),
  ]);

  const deptIds = new Set(depts.map((d) => d.id));
  const orphanDeptIds = [
    ...new Set(emps.map((e) => e.departmentId).filter(Boolean)),
  ].filter((id) => !deptIds.has(id!));

  const orphanDetails =
    orphanDeptIds.length > 0
      ? await db.departmentMaster.findMany({
          where: { id: { in: orphanDeptIds as string[] } },
          select: { id: true, name: true, location: true, isActive: true },
        })
      : [];

  const deptNamesFromEmps = [...new Set(emps.map((e) => e.department).filter(Boolean))];
  const missingDeptNames = deptNamesFromEmps.filter(
    (n) => !depts.some((d) => d.name.toLowerCase() === n!.toLowerCase())
  );

  if (emps.length === 0 && depts.length === 0) return;

  console.log(`\n=== ${unit.slug} ===`);
  console.log("plantUnitKey:", unit.plantUnitKey);
  console.log("locationAliases:", locationAliases);
  console.log("Active departments in scope:", depts.length, depts.map((d) => d.name));
  console.log("Active employees in scope:", emps.length);
  console.log("Employee dept names:", deptNamesFromEmps);
  if (missingDeptNames.length) console.log("MISSING dept names:", missingDeptNames);
  if (orphanDetails.length) console.log("ORPHAN dept refs:", orphanDetails);
}

async function main() {
  const org = await db.organization.findFirst();
  if (!org) {
    console.log("No organization");
    return;
  }

  const units = await loadUnits(org.id);
  for (const unit of units) {
    await checkPlant(org.id, unit);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
