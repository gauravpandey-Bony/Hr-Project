/**
 * Upload LAB -26-27.xlsx into Bony Corporate (Laboratory team).
 * Fixes known wrong ECNs in the sheet (Manish / Prince / Ranjeet all had 100121).
 *
 * Usage:
 *   npx tsx scripts/upload-corporate-lab-kra.ts
 *   LAB_KRA_FILE=/path/to/file.xlsx npx tsx scripts/upload-corporate-lab-kra.ts
 */
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseKraWorkbook } from "../src/lib/masters/kra-workbook";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { personNamesMatch } from "../src/lib/person-name";

const db = new PrismaClient();

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";
const DEPARTMENT = "Laboratory";

/** Correct ECN overrides when the Excel sheet has wrong/shared codes. */
const ECN_BY_NAME: Array<{ name: string; ecn: string }> = [
  { name: "Santosh Kumar Verma", ecn: "100019" },
  { name: "Anil Kumar Patel", ecn: "100034" },
  { name: "Jitender Singh", ecn: "100036" },
  { name: "Manish Kumar", ecn: "101271" },
  { name: "Prince K George", ecn: "100114" },
  { name: "Ranjeet Kumar Jha", ecn: "100121" },
];

const FILE =
  process.env.LAB_KRA_FILE ??
  path.join(process.cwd(), "data", "bony-corporate-kra", "LAB -26-27.xlsx");

function resolveEcn(name: string, sheetEcn?: string | null): string | null {
  const known = ECN_BY_NAME.find((e) => personNamesMatch(e.name, name));
  if (known) return known.ecn;
  return sheetEcn?.trim() || null;
}

async function main() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization");

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const fileName = path.basename(FILE);
  const buf = readFileSync(FILE);
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const parsed = parseKraWorkbook(buffer, fileName);

  if (!parsed.employees.length) {
    throw new Error("No employees parsed from LAB workbook");
  }

  const employees = parsed.employees.map((e) => {
    const ecn = resolveEcn(e.name ?? "", e.ecn);
    return {
      ...e,
      department: DEPARTMENT,
      departmentRaw: "LABORATORY",
      location: "Corporate",
      ecn,
    };
  });

  const kpis = parsed.kpis.map((k) => {
    const owner = employees.find((e) => personNamesMatch(e.name ?? "", k.ownerName ?? ""));
    return {
      ...k,
      ownerName: owner?.name ?? k.ownerName,
      department: DEPARTMENT,
    };
  });

  console.log("Employees to import:");
  for (const e of employees) {
    console.log(`  - ${e.name} | ECN ${e.ecn ?? "-"} | ${DEPARTMENT}`);
  }
  console.log(`KPIs: ${kpis.length}`);

  const destDir = path.join(process.cwd(), "data", "bony-corporate-kra");
  mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, fileName);
  if (path.resolve(FILE) !== path.resolve(destPath)) {
    copyFileSync(FILE, destPath);
  }

  const result = await syncKraWorkbook(db, org.id, buffer, admin?.id ?? null, {
    plantUnitKey: PLANT_KEY,
    location: PLANT_LOCATION,
    sourceFileName: fileName,
    preParsed: { employees, kpis, errors: parsed.errors },
  });

  console.log(
    `✅ Corporate LAB uploaded — employees +${result.employeesCreated}/~${result.employeesUpdated} | kpi +${result.kpisCreated}/~${result.kpisUpdated}`
  );
  if (result.errors.length) {
    console.log("issues:", result.errors.slice(0, 10));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
