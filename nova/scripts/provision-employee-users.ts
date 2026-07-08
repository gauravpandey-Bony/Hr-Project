import { PrismaClient } from "@prisma/client";
import { provisionUsersFromEmployees } from "../src/lib/auth/provision-users";

const db = new PrismaClient();

async function main() {
  const reset = process.argv.includes("--reset-passwords");
  const org = await db.organization.findFirst();
  if (!org) {
    console.error("No organization found.");
    process.exit(1);
  }

  const result = await provisionUsersFromEmployees(org.id, {
    resetPasswords: reset,
  });

  console.log("User provisioning complete:");
  console.log(`  created: ${result.created}`);
  console.log(`  updated: ${result.updated}`);
  console.log(`  managers: ${result.managers}`);
  console.log(`  skipped (no ECN): ${result.skipped}`);
  if (reset) {
    console.log("  passwords reset to ECN with mustChangePassword=true");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
