import { PrismaClient } from "@prisma/client";
import { reconcileDepartmentAssignmentsForAllPlants } from "../src/lib/masters/department-master-sync";
import { listPlantUnitScopes } from "../src/lib/masters/plant-unit-scopes";

const db = new PrismaClient();

async function main() {
  const org = await db.organization.findFirst();
  if (!org) {
    console.log("No organization found.");
    return;
  }

  const allUnits = listPlantUnitScopes();

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
