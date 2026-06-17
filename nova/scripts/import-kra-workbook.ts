import { PrismaClient } from "@prisma/client";
import { syncKraFromDefaultFile } from "../src/lib/masters/sync-kra-workbook";

const ORG_SLUG = "bony-polymers";

async function main() {
  const db = new PrismaClient();
  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    console.error("Organization not found. Run npm run db:seed first.");
    process.exit(1);
  }

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const result = await syncKraFromDefaultFile(db, org.id, undefined, admin?.id);
  console.log("KRA workbook import:", result);
  await db.$disconnect();
  if (result.errors.length && result.employeesCreated === 0 && result.employeesUpdated === 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
