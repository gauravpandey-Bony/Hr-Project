import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const emps = await db.employeeMaster.count({
    where: { department: { contains: "archived" } },
  });
  const users = await db.user.count({
    where: { department: { contains: "archived" } },
  });
  const kpis = await db.kpi.count({
    where: { department: { contains: "archived" } },
  });
  const activeArchivedDepts = await db.departmentMaster.count({
    where: { isActive: true, name: { contains: "(archived" } },
  });
  const sample = await db.departmentMaster.findMany({
    where: { name: { contains: "Accounts (archived" } },
    take: 5,
    select: { id: true, name: true, isActive: true },
  });
  const empLinked = await db.employeeMaster.findMany({
    where: { dept: { name: { contains: "(archived" } } },
    take: 10,
    select: {
      name: true,
      department: true,
      dept: { select: { name: true, isActive: true } },
    },
  });
  console.log(
    JSON.stringify(
      { emps, users, kpis, activeArchivedDepts, sample, empLinked },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
