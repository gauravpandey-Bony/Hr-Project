/**
 * Ensure permanent super-admin ECNs are ADMIN with fixed ECN password.
 *
 * Usage: npx tsx scripts/ensure-permanent-super-admins.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  PERMANENT_SUPER_ADMIN_ECNS,
  permanentSuperAdminPassword,
} from "../src/lib/auth/permanent-super-admins";

const db = new PrismaClient();

function userIdForEcn(ecn: string): string {
  return `emp-${ecn}`;
}

function emailForEcn(ecn: string): string {
  return `${ecn}@bonypolymers.local`;
}

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("No organization found.");
    process.exit(1);
  }

  for (const ecn of PERMANENT_SUPER_ADMIN_ECNS) {
    const emp = await db.employeeMaster.findFirst({
      where: { organizationId: org.id, ecn, isActive: true },
    });

    const existing = await db.user.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          { id: userIdForEcn(ecn) },
          { hrisExternalId: ecn },
          { email: emailForEcn(ecn) },
        ],
      },
    });

    const passwordHash = await hashPassword(permanentSuperAdminPassword(ecn));
    const name = emp?.name ?? existing?.name ?? `Super Admin ${ecn}`;
    const title = emp?.designation ?? existing?.title ?? "System Admin";
    const department = emp?.department ?? existing?.department ?? "IT";

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name,
          title,
          department,
          hrisExternalId: ecn,
          role: "ADMIN",
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: null,
        },
      });
      console.log(`updated ADMIN ${ecn} → ${existing.id} (${name})`);
    } else {
      const id = userIdForEcn(ecn);
      await db.user.create({
        data: {
          id,
          organizationId: org.id,
          email: emailForEcn(ecn),
          name,
          role: "ADMIN",
          title,
          department,
          hrisExternalId: ecn,
          passwordHash,
          mustChangePassword: false,
        },
      });
      console.log(`created ADMIN ${ecn} → ${id} (${name})`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
