/**
 * Fix Finance upload leftovers:
 * - Move Sheetal Khatri (101619) HR → Finance
 * - Add Shashikant Sahoo (101166) to Corporate Finance master
 * - Re-upload their Finance KRAs from the workbook
 *
 * Usage: npx tsx scripts/fix-corporate-finance-sheetal-sahoo.ts
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseKraWorkbook } from "../src/lib/masters/kra-workbook";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { upsertDepartmentMaster } from "../src/lib/masters/department-master-sync";
import { personNamesMatch } from "../src/lib/person-name";

const db = new PrismaClient();

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";
const DEPT = "Finance";

const FILE =
  process.env.FINANCE_KRA_FILE ??
  path.join(process.cwd(), "data", "bony-corporate-kra", "Finance KRA KPI 26-27.xlsx");

async function main() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization");

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const { department } = await upsertDepartmentMaster(db, org.id, {
    name: DEPT,
    location: PLANT_LOCATION,
    plantUnitKey: PLANT_KEY,
    kraSheetId: "finance",
    isActive: true,
  });

  // 1) Move Sheetal Khatri to Finance
  const sheetal = await db.employeeMaster.findFirst({
    where: { organizationId: org.id, isActive: true, ecn: "101619" },
  });
  if (!sheetal) throw new Error("Sheetal Khatri ECN 101619 not found");

  await db.employeeMaster.update({
    where: { id: sheetal.id },
    data: {
      departmentId: department.id,
      department: DEPT,
      location: PLANT_LOCATION,
      designation: sheetal.designation || "SENIOR OFFICER",
    },
  });
  console.log(`✓ Sheetal Khatri moved: ${sheetal.department} → ${DEPT}`);

  // 2) Add / upsert Shashikant Sahoo
  const existingSahoo = await db.employeeMaster.findFirst({
    where: { organizationId: org.id, isActive: true, ecn: "101166" },
  });

  let sahooId = existingSahoo?.id;
  if (existingSahoo) {
    await db.employeeMaster.update({
      where: { id: existingSahoo.id },
      data: {
        name: "Shashikant Sahoo",
        departmentId: department.id,
        department: DEPT,
        location: PLANT_LOCATION,
        designation: existingSahoo.designation || "CFO",
        doj: existingSahoo.doj || "07.10.2021",
      },
    });
    console.log(`✓ Shashikant Sahoo updated (ECN 101166) → ${DEPT}`);
  } else {
    const created = await db.employeeMaster.create({
      data: {
        organizationId: org.id,
        name: "Shashikant Sahoo",
        ecn: "101166",
        departmentId: department.id,
        department: DEPT,
        location: PLANT_LOCATION,
        designation: "CFO",
        doj: "07.10.2021",
        isActive: true,
        sortOrder: 0,
      },
    });
    sahooId = created.id;
    console.log(`✓ Shashikant Sahoo added (ECN 101166) → ${DEPT}`);
  }

  // 3) Re-upload KRAs for Sheetal (+ Sahoo if sheet has any)
  const fileName = path.basename(FILE);
  const buf = readFileSync(FILE);
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const parsed = parseKraWorkbook(buffer, fileName);

  const targets = parsed.employees.filter(
    (e) =>
      personNamesMatch(e.name ?? "", "Sheetal Khatri") ||
      personNamesMatch(e.name ?? "", "Shashikant Sahoo") ||
      e.ecn === "101619" ||
      e.ecn === "101166"
  );

  const employees = targets.map((e) => {
    const isSheetal =
      personNamesMatch(e.name ?? "", "Sheetal Khatri") || e.ecn === "101619";
    return {
      ...e,
      name: isSheetal ? "Sheetal Khatri" : "Shashikant Sahoo",
      ecn: isSheetal ? "101619" : "101166",
      department: DEPT,
      departmentRaw: "FINANCE",
      location: "Corporate",
      designation: isSheetal ? "SENIOR OFFICER" : "CFO",
    };
  });

  const allowed = new Set(employees.map((e) => e.name!.toLowerCase()));
  const kpis = parsed.kpis
    .map((k) => {
      const owner = employees.find((e) => personNamesMatch(e.name ?? "", k.ownerName ?? ""));
      if (!owner || !allowed.has(owner.name!.toLowerCase())) return null;
      return { ...k, ownerName: owner.name, department: DEPT };
    })
    .filter((k): k is NonNullable<typeof k> => k != null);

  console.log(`Re-upload targets: ${employees.map((e) => e.name).join(", ")} | KPIs ${kpis.length}`);

  if (employees.length && kpis.length) {
    const result = await syncKraWorkbook(db, org.id, buffer, admin?.id ?? null, {
      plantUnitKey: PLANT_KEY,
      location: PLANT_LOCATION,
      sourceFileName: fileName,
      preParsed: { employees, kpis, errors: parsed.errors },
    });
    console.log(
      `✅ KRAs synced — emp +${result.employeesCreated}/~${result.employeesUpdated} | kpi +${result.kpisCreated}/~${result.kpisUpdated}`
    );
  } else if (employees.length && !kpis.length) {
    console.log("No KPI rows in sheet for these people (Sahoo sheet empty) — master only updated.");
  }

  console.log({ sheetalId: sheetal.id, sahooId });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
