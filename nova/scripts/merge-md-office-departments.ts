/**
 * One-off: merge Md Office + MDO into canonical "MD Office" per plant.
 * Reassigns employees, renames keeper, archives duplicate dept rows.
 *
 * Usage:
 *   ALLOW_DATA_PURGE=1 npx tsx scripts/merge-md-office-departments.ts
 */
import { PrismaClient } from "@prisma/client";
import { dedupeDepartmentMasters } from "../src/lib/masters/department-master-sync";

const db = new PrismaClient();

async function main() {
  if (process.env.ALLOW_DATA_PURGE !== "1") {
    console.error("Refusing to run without ALLOW_DATA_PURGE=1 (needed to archive duplicate dept rows).");
    process.exit(1);
  }

  const org = await db.organization.findFirst();
  if (!org) {
    console.log("No organization found.");
    return;
  }

  const before = await db.departmentMaster.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      OR: [
        { name: { equals: "MDO" } },
        { name: { equals: "Md Office" } },
        { name: { equals: "MD Office" } },
        { name: { equals: "md office" } },
      ],
    },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ location: "asc" }, { name: "asc" }],
  });

  console.log("Before:", before.map((d) => ({
    name: d.name,
    location: d.location,
    employees: d._count.employees,
  })));

  const result = await dedupeDepartmentMasters(db, org.id);
  console.log("Dedupe result:", result);

  const after = await db.departmentMaster.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      OR: [
        { name: { equals: "MDO" } },
        { name: { equals: "Md Office" } },
        { name: { equals: "MD Office" } },
        { name: { equals: "md office" } },
      ],
    },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ location: "asc" }, { name: "asc" }],
  });

  console.log("After:", after.map((d) => ({
    name: d.name,
    location: d.location,
    employees: d._count.employees,
  })));

  const emps = await db.employeeMaster.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      OR: [
        { department: { in: ["MDO", "Md Office", "MD Office", "md office"] } },
        { dept: { name: { in: ["MDO", "Md Office", "MD Office"] } } },
      ],
    },
    select: { ecn: true, name: true, department: true, dept: { select: { name: true, location: true } } },
    orderBy: { name: "asc" },
  });

  console.log("Employees:", emps);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
