import { PrismaClient } from "@prisma/client";
import { sync37pFromDefaultFile } from "../src/lib/masters/sync-37p";

const ORG_SLUG = "bony-polymers";

async function main() {
  const db = new PrismaClient();
  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    console.error("Organization not found. Run npm run db:seed first.");
    process.exit(1);
  }

  const result = await sync37pFromDefaultFile(db, org.id);
  console.log("37P roster import:", result);
  await db.$disconnect();
  if (result.errors.length && result.employeeCount === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
