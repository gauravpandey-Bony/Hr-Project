/**
 * Upload Finance KRA KPI 26-27.xlsx into Bony Corporate.
 * Matches each sheet person by ECN + Finance/Accounts department.
 * Keeps the master department name (Accounts or Finance) when uploading KPIs.
 *
 * Usage:
 *   npx tsx scripts/upload-corporate-finance-kra.ts
 *   FINANCE_KRA_FILE=/path/to/file.xlsx npx tsx scripts/upload-corporate-finance-kra.ts
 */
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseKraWorkbook } from "../src/lib/masters/kra-workbook";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { departmentsAreEquivalent } from "../src/lib/masters/department-master-sync";
import { personNamesMatch } from "../src/lib/person-name";
import { resolvePlantFromWorkingLocation } from "../src/lib/masters/employee-plant-location";

const db = new PrismaClient();

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";
const SHEET_DEPT = "Finance";

/** Known ECN corrections when the sheet points at the wrong person. */
const ECN_BY_NAME: Array<{ name: string; ecn: string }> = [
  { name: "Brij Mohan", ecn: "100648" }, // sheet wrongly used Mukesh's 100281
];

const FILE =
  process.env.FINANCE_KRA_FILE ??
  path.join(process.cwd(), "data", "bony-corporate-kra", "Finance KRA KPI 26-27.xlsx");

function isFinanceFamily(dept: string | null | undefined): boolean {
  if (!dept?.trim()) return false;
  return departmentsAreEquivalent(dept, "Finance") || departmentsAreEquivalent(dept, "Accounts");
}

function resolveSheetEcn(name: string, sheetEcn?: string | null): string | null {
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

  const masters = await db.employeeMaster.findMany({
    where: { organizationId: org.id, isActive: true },
    select: {
      id: true,
      name: true,
      ecn: true,
      department: true,
      location: true,
      designation: true,
    },
  });

  const corporate = masters.filter(
    (m) => resolvePlantFromWorkingLocation(m.location).plantUnitKey === PLANT_KEY
  );
  const byEcn = new Map(
    corporate.filter((m) => m.ecn?.trim()).map((m) => [m.ecn!.trim(), m] as const)
  );

  const fileName = path.basename(FILE);
  const buf = readFileSync(FILE);
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const parsed = parseKraWorkbook(buffer, fileName);

  const matchedEmployees: typeof parsed.employees = [];
  const skipped: string[] = [];
  const ownerMap = new Map<string, { name: string; department: string; ecn: string }>();

  for (const row of parsed.employees) {
    const sheetName = row.name?.trim() || row.sheetName;
    const ecn = resolveSheetEcn(sheetName, row.ecn);
    if (!ecn) {
      skipped.push(`${sheetName}: no ECN in sheet`);
      continue;
    }

    let master = byEcn.get(ecn) ?? null;

    // If ECN points to someone else, try Corporate Finance/Accounts by name
    if (master && !personNamesMatch(master.name, sheetName)) {
      const byName = corporate.filter(
        (m) => personNamesMatch(m.name, sheetName) && isFinanceFamily(m.department)
      );
      if (byName.length === 1) {
        master = byName[0];
      } else {
        skipped.push(
          `${sheetName}: ECN ${ecn} belongs to "${master.name}" — name/dept mismatch`
        );
        continue;
      }
    }

    if (!master) {
      const byName = corporate.filter(
        (m) => personNamesMatch(m.name, sheetName) && isFinanceFamily(m.department)
      );
      if (byName.length === 1) {
        master = byName[0];
      } else {
        skipped.push(`${sheetName}: ECN ${ecn} not found in Corporate master`);
        continue;
      }
    }

    if (!isFinanceFamily(master.department)) {
      skipped.push(
        `${sheetName}: ECN ${master.ecn} dept is "${master.department}" (not Finance/Accounts) — skipped`
      );
      continue;
    }

    if (!isFinanceFamily(row.department ?? SHEET_DEPT)) {
      skipped.push(`${sheetName}: sheet department is "${row.department}" — expected Finance`);
      continue;
    }

    const dept = master.department?.trim() || "Finance";
    matchedEmployees.push({
      ...row,
      name: master.name,
      ecn: master.ecn,
      department: dept,
      departmentRaw: dept,
      location: "Corporate",
      designation: row.designation ?? master.designation,
    });
    ownerMap.set(sheetName.toLowerCase(), {
      name: master.name,
      department: dept,
      ecn: master.ecn!,
    });
    // also map parsed owner names
    ownerMap.set(master.name.toLowerCase(), {
      name: master.name,
      department: dept,
      ecn: master.ecn!,
    });
    if (row.name) {
      ownerMap.set(row.name.toLowerCase(), {
        name: master.name,
        department: dept,
        ecn: master.ecn!,
      });
    }

    console.log(
      `✓ ${master.name} | ECN ${master.ecn} | master dept ${dept} | sheet ${row.sheetName}`
    );
  }

  const matchedNames = new Set(matchedEmployees.map((e) => e.name!.toLowerCase()));
  const kpis = parsed.kpis
    .map((k) => {
      const key = (k.ownerName ?? "").toLowerCase();
      const mapped =
        ownerMap.get(key) ||
        [...ownerMap.values()].find((o) => personNamesMatch(o.name, k.ownerName ?? ""));
      if (!mapped || !matchedNames.has(mapped.name.toLowerCase())) return null;
      return {
        ...k,
        ownerName: mapped.name,
        department: mapped.department,
      };
    })
    .filter((k): k is NonNullable<typeof k> => k != null);

  console.log(`\nMatched employees: ${matchedEmployees.length}`);
  console.log(`KPIs to upload: ${kpis.length}`);
  if (skipped.length) {
    console.log("\nSkipped:");
    for (const s of skipped) console.log(`  ✗ ${s}`);
  }

  if (!matchedEmployees.length || !kpis.length) {
    throw new Error("Nothing to upload after ECN + department matching");
  }

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
    preParsed: { employees: matchedEmployees, kpis, errors: parsed.errors },
  });

  console.log(
    `\n✅ Corporate Finance uploaded — employees +${result.employeesCreated}/~${result.employeesUpdated} | kpi +${result.kpisCreated}/~${result.kpisUpdated}`
  );
  if (result.errors.length) console.log("issues:", result.errors.slice(0, 10));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
