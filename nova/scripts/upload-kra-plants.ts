/**
 * Match multi-sheet KRA workbooks to Employee Master by plant + department,
 * then import matching employees. Report skips clearly.
 */
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseKraWorkbook } from "../src/lib/masters/kra-workbook";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { resolvePlantFromWorkingLocation } from "../src/lib/masters/employee-plant-location";
import { personNamesMatch } from "../src/lib/person-name";
import { departmentsAreEquivalent } from "../src/lib/masters/department-master-sync";

const db = new PrismaClient();

type MasterRow = {
  id: string;
  name: string;
  department: string | null;
  location: string | null;
  ecn: string | null;
};

type PlantUpload = {
  filePath: string;
  plantUnitKey: string;
  location: string;
  dataDir: string;
};

const UPLOADS: PlantUpload[] = [
  {
    filePath:
      process.env.KRA_MANESAR_FILE ??
      "/Users/rampal/Desktop/Quality Manesar.xlsx",
    plantUnitKey: "Bony Maneshar",
    location: "Bony Maneshar",
    dataDir: "data/bony-manesar-kra",
  },
  {
    filePath:
      process.env.KRA_SF1_DEVT_FILE ??
      "/Users/rampal/Desktop/Devt Team_KRA-KPI_SF1.xlt",
    plantUnitKey: "Saket Fabs Sheet Metal",
    location: "Saket Fabs Prithla",
    dataDir: "data/saket-unit1-kra",
  },
];

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNameTokens(name: string): string[] {
  return normalizeNameKey(name)
    .split(" ")
    .filter((t) => t.length >= 3);
}

function atPlant(row: MasterRow, plantUnitKey: string): boolean {
  return resolvePlantFromWorkingLocation(row.location ?? "").plantUnitKey === plantUnitKey;
}

function nameAliases(token: string): string[] {
  const t = token.toLowerCase();
  const map: Record<string, string[]> = {
    shyamal: ["shyamal", "shymal"],
    shymal: ["shymal", "shyamal"],
    naveen: ["naveen"],
    ashok: ["ashok"],
  };
  return map[t] ?? [t];
}

function tokensMatchName(tokens: string[], masterName: string): boolean {
  const n = normalizeNameKey(masterName);
  return tokens.every((t) => nameAliases(t).some((a) => n.includes(a)));
}

function findMaster(
  employees: MasterRow[],
  parsedName: string,
  parsedDept: string,
  parsedEcn: string | null | undefined,
  plantUnitKey: string
): { master: MasterRow | null; note?: string } {
  const pool = employees.filter((e) => atPlant(e, plantUnitKey));

  if (parsedEcn?.trim()) {
    const byEcn = employees.find((e) => e.ecn?.trim() === parsedEcn.trim());
    if (byEcn) {
      if (!atPlant(byEcn, plantUnitKey)) {
        // Wrong ECN in sheet — fall back to name/plant match (e.g. Yogesh 101788 vs Saket Yogesh Joshi)
      } else if (
        personNamesMatch(byEcn.name, parsedName) ||
        departmentsAreEquivalent(byEcn.department ?? "", parsedDept)
      ) {
        return { master: byEcn };
      } else {
        return {
          master: null,
          note: `ECN ${parsedEcn} → ${byEcn.name} (${byEcn.location}) but sheet name is "${parsedName}"`,
        };
      }
    }
  }

  const deptPool = pool.filter((e) =>
    departmentsAreEquivalent(e.department ?? "", parsedDept)
  );
  const searchPools = [deptPool, pool];

  for (const search of searchPools) {
    const exact = search.find((e) => personNamesMatch(e.name, parsedName));
    if (exact) return { master: exact };
  }

  const tokens = firstNameTokens(parsedName);
  if (tokens.length) {
    for (const search of searchPools) {
      const candidates = search.filter((e) => tokensMatchName(tokens, e.name));
      if (candidates.length === 1) {
        return {
          master: candidates[0],
          note: `Fuzzy name match "${parsedName}" → ${candidates[0].name}`,
        };
      }
    }

    // First-name-only master row when sheet has full name (e.g. Ashok Kumar → Ashok)
    const first = tokens[0];
    for (const search of searchPools) {
      const firstNameOnly = search.filter((e) => {
        const parts = normalizeNameKey(e.name).split(" ").filter(Boolean);
        return parts.length === 1 && nameAliases(first).some((a) => parts[0] === a);
      });
      if (firstNameOnly.length === 1) {
        return {
          master: firstNameOnly[0],
          note: `First-name match "${parsedName}" → ${firstNameOnly[0].name}`,
        };
      }
    }
  }

  return { master: null };
}

function sheetNameHintsEmployee(sheetName: string, employeeName: string): boolean {
  const sheetTokens = normalizeNameKey(sheetName)
    .split(" ")
    .filter((t) => t.length >= 4);
  if (!sheetTokens.length) return true;
  const emp = normalizeNameKey(employeeName);
  return sheetTokens.some((t) => emp.includes(t) || nameAliases(t).some((a) => emp.includes(a)));
}

async function main() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization");

  const employees = await db.employeeMaster.findMany({
    where: { organizationId: org.id, isActive: true },
    select: {
      id: true,
      name: true,
      department: true,
      location: true,
      ecn: true,
    },
  });

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const uploaded: string[] = [];
  const skipped: string[] = [];

  for (const job of UPLOADS) {
    const fileName = path.basename(job.filePath);
    console.log(`\n########## ${fileName} → ${job.plantUnitKey} ##########`);

    const buf = readFileSync(job.filePath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const parsed = parseKraWorkbook(ab, fileName);

    if (parsed.errors.length) {
      console.log("Parse issues:", parsed.errors);
    }

    const sheetMatches = new Map<string, MasterRow>();
    const sheetNotes = new Map<string, string>();

    for (const emp of parsed.employees) {
      const kpiCount = parsed.kpis.filter((k) => personNamesMatch(k.ownerName, emp.name)).length;
      const { master, note } = findMaster(
        employees,
        emp.name,
        emp.department ?? "General",
        emp.ecn,
        job.plantUnitKey
      );

      console.log(`\n--- Sheet: ${emp.sheetName} ---`);
      console.log(`Parsed: ${emp.name} | ${emp.department} | ECN ${emp.ecn ?? "-"} | ${kpiCount} KPIs`);

      if (!kpiCount) {
        console.log("❌ SKIP — 0 KPIs");
        skipped.push(`${fileName} / ${emp.sheetName}: 0 KPIs (${emp.name})`);
        continue;
      }

      if (!master) {
        console.log(`❌ SKIP — not in Employee Master at ${job.plantUnitKey}`);
        skipped.push(
          `${fileName} / ${emp.sheetName}: Employee Master me nahi mila — "${emp.name}" (${emp.department})${note ? ` — ${note}` : ""}`
        );
        continue;
      }

      if (note) console.log(`Note: ${note}`);

      if (!sheetNameHintsEmployee(emp.sheetName, master.name)) {
        console.log(
          `⚠️ Sheet tab "${emp.sheetName}" does not match master "${master.name}" — using sheet content`
        );
      }

      console.log(
        `Master: ${master.name} | ${master.department} | ${master.location} | ECN ${master.ecn}`
      );
      sheetMatches.set(emp.sheetName, master);
      if (note) sheetNotes.set(emp.sheetName, note);
    }

    const matchedSheets = parsed.employees.filter((e) => sheetMatches.has(e.sheetName));
    if (!matchedSheets.length) {
      console.log("No sheets to upload.");
      continue;
    }

    const destDir = path.join(process.cwd(), job.dataDir);
    mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, fileName);
    copyFileSync(job.filePath, dest);

    const result = await syncKraWorkbook(db, org.id, ab, admin?.id ?? null, {
      plantUnitKey: job.plantUnitKey,
      location: job.location,
      sourceFileName: fileName,
    });

    console.log(
      `\n✅ SYNC — emp +${result.employeesCreated}/~${result.employeesUpdated}, kpi +${result.kpisCreated}/~${result.kpisUpdated}`
    );
    if (result.errors.length) {
      console.log("  issues:", result.errors.slice(0, 5));
    }

    for (const emp of matchedSheets) {
      const master = sheetMatches.get(emp.sheetName)!;
      const kpiCount = parsed.kpis.filter((k) => personNamesMatch(k.ownerName, emp.name)).length;
      uploaded.push(
        `${fileName} / ${emp.sheetName} → ${master.name} (${master.department}, ${master.location}) — ${kpiCount} KPIs`
      );
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Uploaded (${uploaded.length}):`);
  for (const u of uploaded) console.log("  ✅", u);
  console.log(`Skipped (${skipped.length}):`);
  for (const s of skipped) console.log("  ❌", s);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
