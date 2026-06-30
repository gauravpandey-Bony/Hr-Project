import { PrismaClient } from "@prisma/client";
import { deactivateEmptyDepartments } from "../src/lib/masters/department-master-sync";

const db = new PrismaClient();

async function main() {
  const org = await db.organization.findFirst();
  if (!org) {
    console.log("No organization found.");
    return;
  }

  const result = await deactivateEmptyDepartments(db, org.id, "Bony Polymers");
  console.log(`Deactivated ${result.deactivated} empty department(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
