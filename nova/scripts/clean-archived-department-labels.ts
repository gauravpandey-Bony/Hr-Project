/**
 * Strip repeated `(archived …)` junk from employee.department and departmentMaster.name.
 * Also deactivate any still-active archived-named department rows.
 *
 * Usage: ALLOW_DATA_PURGE=1 npx tsx scripts/clean-archived-department-labels.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function stripArchived(name: string): string {
  return name
    .replace(/\s*\(archived[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  if (process.env.ALLOW_DATA_PURGE !== "1") {
    console.error("Refusing without ALLOW_DATA_PURGE=1");
    process.exit(1);
  }

  const employees = await db.employeeMaster.findMany({
    where: { department: { contains: "(archived" } },
    select: { id: true, department: true, departmentId: true, name: true },
  });
  console.log(`Employees with archived department text: ${employees.length}`);

  let empFixed = 0;
  for (const emp of employees) {
    const cleaned = stripArchived(emp.department ?? "");
    if (!cleaned || cleaned === emp.department) continue;

    let departmentId = emp.departmentId;
    if (departmentId) {
      const linked = await db.departmentMaster.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true, isActive: true },
      });
      if (!linked || !linked.isActive || /\(archived\b/i.test(linked.name)) {
        const canonical = await db.departmentMaster.findFirst({
          where: {
            isActive: true,
            name: { equals: cleaned, mode: "insensitive" },
            NOT: { name: { contains: "(archived" } },
          },
          select: { id: true },
        });
        departmentId = canonical?.id ?? null;
      }
    } else {
      const canonical = await db.departmentMaster.findFirst({
        where: {
          isActive: true,
          name: { equals: cleaned, mode: "insensitive" },
          NOT: { name: { contains: "(archived" } },
        },
        select: { id: true },
      });
      departmentId = canonical?.id ?? null;
    }

    await db.employeeMaster.update({
      where: { id: emp.id },
      data: { department: cleaned, departmentId },
    });
    empFixed += 1;
    if (empFixed <= 20) {
      console.log(`  ${emp.name}: "${emp.department}" → "${cleaned}"`);
    }
  }
  console.log(`Employee department labels cleaned: ${empFixed}`);

  const depts = await db.departmentMaster.findMany({
    where: { name: { contains: "(archived" } },
    select: { id: true, name: true, isActive: true },
  });
  console.log(`Department rows with archived in name: ${depts.length}`);

  let deptFixed = 0;
  let deactivated = 0;
  for (const dept of depts) {
    const base = stripArchived(dept.name);
    const suffix = `(archived ${dept.id.slice(-6)})`;
    const nextName = base ? `${base} ${suffix}` : `${dept.name}`;
    const needsRename = dept.name !== nextName;
    const needsDeactivate = dept.isActive;

    if (!needsRename && !needsDeactivate) continue;

    await db.departmentMaster.update({
      where: { id: dept.id },
      data: {
        ...(needsRename ? { name: nextName } : {}),
        ...(needsDeactivate ? { isActive: false } : {}),
      },
    });
    if (needsRename) deptFixed += 1;
    if (needsDeactivate) deactivated += 1;
  }
  console.log(`Department names normalized to single archive suffix: ${deptFixed}`);
  console.log(`Archived-named departments deactivated: ${deactivated}`);
  console.log("DONE");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
