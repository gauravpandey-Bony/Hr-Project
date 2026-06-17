import { PrismaClient } from "@prisma/client";
import { syncPlantKraFromDefaultFile } from "../src/lib/masters/sync-plant-kra-workbook";

const ORG_SLUG = "bony-polymers";

async function main() {
  const db = new PrismaClient();
  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    console.error("Organization not found. Run npm run db:seed first.");
    process.exit(1);
  }

  const [admin, rajKumar] = await Promise.all([
    db.user.findFirst({
      where: { organizationId: org.id, role: "ADMIN" },
      select: { id: true },
    }),
    db.user.findFirst({
      where: { organizationId: org.id, id: "demo-raj-kumar" },
      select: { id: true },
    }),
  ]);

  const result = await syncPlantKraFromDefaultFile(
    db,
    org.id,
    undefined,
    admin?.id,
    rajKumar?.id
  );
  console.log("Plant KRA workbook import:", result);
  await db.$disconnect();
  if (result.errors.length && result.kpiCount === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
