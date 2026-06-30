import { PrismaClient } from "@prisma/client";
import { reconcileDepartmentAssignmentsForAllPlants } from "../src/lib/masters/department-master-sync";
import { DEFAULT_ORG_GROUPS, DEFAULT_STANDALONE_UNITS } from "../src/lib/org-units-defaults";

const db = new PrismaClient();

async function main() {
  const org = await db.organization.findFirst();
  if (!org) {
    console.log("No organization found.");
    return;
  }

  const allUnits = [
    ...DEFAULT_ORG_GROUPS.flatMap((g) => g.units),
    ...DEFAULT_STANDALONE_UNITS,
  ].map((u) => ({
    plantUnitKey: u.plantUnitKey,
    locationAliases: u.locationAliases ? [...u.locationAliases] : undefined,
    kpiPlantAliases: u.kpiPlantAliases ? [...u.kpiPlantAliases] : undefined,
  }));

  const result = await reconcileDepartmentAssignmentsForAllPlants(
    db,
    org.id,
    allUnits
  );

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
