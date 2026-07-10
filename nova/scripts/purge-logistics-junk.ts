import { PrismaClient } from "@prisma/client";
import { purgeLogisticsJunkData } from "../src/lib/masters/logistics-kra-junk";
import { requireDataPurgeAllowed } from "../src/lib/masters/data-safety";

const db = new PrismaClient();

async function main() {
  // Explicit operator command only:
  //   ALLOW_DATA_PURGE=1 npm run db:purge-junk
  requireDataPurgeAllowed("purge logistics junk data");

  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.log("No organization found — nothing to purge.");
    return;
  }
  const result = await purgeLogisticsJunkData(db, org.id);
  console.log("Purged logistics junk:", result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
