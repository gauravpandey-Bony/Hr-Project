/**
 * Hide soft-deleted department duplicates that still have isActive=true.
 * Does NOT delete employees or KPIs — only flips isActive on archived-named rows.
 *
 * Usage: ALLOW_DATA_PURGE=1 npx tsx scripts/deactivate-archived-departments.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  if (process.env.ALLOW_DATA_PURGE !== "1") {
    console.error("Refusing without ALLOW_DATA_PURGE=1");
    process.exit(1);
  }

  const rows = await db.departmentMaster.findMany({
    where: {
      isActive: true,
      name: { contains: "(archived" },
    },
    select: { id: true, name: true, location: true },
  });

  console.log(`Found ${rows.length} active archived-named departments`);
  for (const row of rows.slice(0, 30)) {
    console.log(` - ${row.name} @ ${row.location}`);
  }
  if (rows.length > 30) console.log(` ... +${rows.length - 30} more`);

  const result = await db.departmentMaster.updateMany({
    where: {
      isActive: true,
      name: { contains: "(archived" },
    },
    data: { isActive: false },
  });

  console.log(`Deactivated: ${result.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
