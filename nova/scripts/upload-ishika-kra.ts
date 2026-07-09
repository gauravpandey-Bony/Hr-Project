/**
 * Replace Ishika's wrongly-uploaded WORK RECORD (Harpreet data) with her actual KRA-KPI file.
 */
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseKraWorkbook } from "../src/lib/masters/kra-workbook";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";

const db = new PrismaClient();

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";
const EMPLOYEE_NAME = "Ishika";
const ECN = "101911";
const FILE =
  process.env.ISHIKA_KRA_FILE ??
  "/Users/rampal/Desktop/desktop/ISHIKA FY27/ISHIKA_KRA-KPI.xlsx";

async function main() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization");

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const employee = await db.employeeMaster.findFirst({
    where: { organizationId: org.id, isActive: true, ecn: ECN },
  });
  if (!employee) throw new Error(`Employee ECN ${ECN} not found`);

  const removed = await db.kpi.deleteMany({
    where: {
      organizationId: org.id,
      ownerName: { in: ["Ishika", "ISHIKA"] },
      plantUnit: PLANT_KEY,
    },
  });
  console.log(`Removed ${removed.count} old KPI rows for Ishika`);

  await db.employeeMaster.update({
    where: { id: employee.id },
    data: { name: EMPLOYEE_NAME, department: "Design", location: PLANT_LOCATION },
  });

  const fileName = path.basename(FILE);
  const buf = readFileSync(FILE);
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const parsed = parseKraWorkbook(buffer, fileName);

  const employees = parsed.employees.map((e) => ({
    ...e,
    name: EMPLOYEE_NAME,
    department: "Design",
    location: "Corporate",
    ecn: ECN,
  }));
  const kpis = parsed.kpis.map((k) => ({
    ...k,
    ownerName: EMPLOYEE_NAME,
    department: "Design",
  }));

  const destDir = path.join(process.cwd(), "data", "bony-corporate-kra");
  mkdirSync(destDir, { recursive: true });
  copyFileSync(FILE, path.join(destDir, fileName));

  const result = await syncKraWorkbook(db, org.id, buffer, admin?.id ?? null, {
    plantUnitKey: PLANT_KEY,
    location: PLANT_LOCATION,
    sourceFileName: fileName,
    preParsed: { employees, kpis, errors: parsed.errors },
  });

  console.log(
    `✅ Ishika KRA uploaded — ${kpis.length} KPIs | emp ~${result.employeesUpdated} | kpi +${result.kpisCreated}/~${result.kpisUpdated}`
  );
  if (result.errors.length) console.log("issues:", result.errors.slice(0, 5));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
