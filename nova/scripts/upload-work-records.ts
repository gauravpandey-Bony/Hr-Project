/**
 * Match Corporate Design WORK RECORD files to Employee Master, then import
 * matching sheets into Bony Corporate. Print mismatches clearly.
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

const FILES = [
  "/tmp/work-records/MOHIT_WORK RECORD.xlsx",
  "/tmp/work-records/HARPREET_WORK RECORD.xlsx",
  "/tmp/work-records/ISHIKA_WORK RECORD.xlsx",
  "/tmp/work-records/SUBHAM_WORK RECORD.xlsx",
  "/tmp/work-records/AN PATHAK_WORK RECORD.xlsx",
  "/tmp/work-records/RAVI_WORK RECORD.xlsx",
  "/tmp/work-records/KAPIL_WORK RECORD.xlsx",
  "/tmp/work-records/SUDHIR_WORK RECORD_1.xlsx",
];

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";

type MasterRow = {
  id: string;
  name: string;
  department: string | null;
  location: string | null;
  ecn: string | null;
};

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Common spelling aliases for first names in file stems */
function nameAliases(token: string): string[] {
  const t = token.toLowerCase();
  const map: Record<string, string[]> = {
    subham: ["subham", "shubham"],
    shubham: ["shubham", "subham"],
    an: ["an", "achyutanand"],
  };
  return map[t] ?? [t];
}

function plantIsCorporate(loc: string | null | undefined): boolean {
  return resolvePlantFromWorkingLocation(loc ?? "").plantUnitKey === PLANT_KEY;
}

function findMaster(
  employees: MasterRow[],
  sheetName: string,
  sheetDept: string
): MasterRow | null {
  const corporate = employees.filter((e) => plantIsCorporate(e.location));

  // Prefer Corporate + Design-family first
  const designFamily = corporate.filter((e) =>
    departmentsAreEquivalent(e.department ?? "", sheetDept || "Design")
  );

  const pools = [designFamily, corporate, employees];

  for (const pool of pools) {
    const exact = pool.find((e) => personNamesMatch(e.name, sheetName));
    if (exact) return exact;
  }

  const tokens = normalizeNameKey(sheetName)
    .split(" ")
    .filter((t) => t.length >= 3);

  for (const pool of pools) {
    const candidates = pool.filter((e) => {
      const n = normalizeNameKey(e.name);
      return tokens.every((t) => {
        if (t.length < 4 && tokens.length > 1) {
          // Short tokens (AN) only help with surname match
          return true;
        }
        return n.includes(t) || nameAliases(t).some((a) => n.includes(a));
      });
    });
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      // Prefer surname-complete matches within Design
      const bySurname = candidates.filter((e) => {
        const last = tokens[tokens.length - 1];
        return last.length >= 4 && normalizeNameKey(e.name).includes(last);
      });
      if (bySurname.length === 1) return bySurname[0];
      const design = candidates.filter((e) =>
        departmentsAreEquivalent(e.department ?? "", "Design")
      );
      if (design.length === 1) return design[0];
    }
  }

  // Special: "AN Pathak" → Achyutanand Pathak
  if (/pathak/i.test(sheetName)) {
    const pathaks = corporate.filter((e) => /pathak/i.test(e.name));
    const designPathak = pathaks.filter((e) =>
      departmentsAreEquivalent(e.department ?? "", sheetDept || "Design")
    );
    if (designPathak.length === 1) return designPathak[0];
    if (pathaks.length === 1) return pathaks[0];
  }

  return null;
}

function fileNameLooksCompatible(fileStem: string, names: string[]): boolean {
  const stemTokens = normalizeNameKey(fileStem)
    .split(" ")
    .filter(Boolean);
  return stemTokens.some((token) => {
    const aliases = nameAliases(token);
    return names.some((name) => {
      const n = normalizeNameKey(name);
      return aliases.some((a) => a.length >= 3 && n.includes(a));
    });
  });
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

  const destDir = path.join(process.cwd(), "data", "bony-corporate-kra");
  mkdirSync(destDir, { recursive: true });

  const uploaded: string[] = [];
  const skipped: string[] = [];

  for (const fp of FILES) {
    const fileName = path.basename(fp);
    const buf = readFileSync(fp);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const parsed = parseKraWorkbook(ab, fileName);
    const sheetEmp = parsed.employees[0];

    console.log(`\n===== ${fileName} =====`);

    if (!sheetEmp) {
      console.log("❌ SKIP — no employee header parsed");
      skipped.push(`${fileName}: no employee header`);
      continue;
    }

    if (!parsed.kpis.length) {
      console.log(
        `❌ SKIP — ${sheetEmp.name} | ${sheetEmp.department} | ${sheetEmp.location} — 0 KPIs`
      );
      skipped.push(`${fileName}: 0 KPIs (${sheetEmp.name})`);
      continue;
    }

    const fileStem = fileName
      .replace(/_WORK RECORD(_1)?\.xlsx$/i, "")
      .replace(/_/g, " ")
      .trim();

    const master = findMaster(
      employees,
      sheetEmp.name,
      sheetEmp.department ?? "Design"
    );
    if (!master) {
      console.log(
        `❌ SKIP — not in Employee Master: sheet="${sheetEmp.name}" dept=${sheetEmp.department} loc=${sheetEmp.location}`
      );
      skipped.push(
        `${fileName}: Employee Master me nahi mila — "${sheetEmp.name}" (${sheetEmp.department}, ${sheetEmp.location})`
      );
      continue;
    }

    if (!fileNameLooksCompatible(fileStem, [sheetEmp.name, master.name])) {
      console.log(
        `❌ SKIP — file name "${fileStem}" does not match sheet/master "${sheetEmp.name}" / "${master.name}"`
      );
      skipped.push(
        `${fileName}: File name vs sheet mismatch — file="${fileStem}", sheet="${sheetEmp.name}", master="${master.name}" (galat file content? e.g. Ishika file mein Harpreet data)`
      );
      continue;
    }

    const plantOk =
      plantIsCorporate(master.location) && plantIsCorporate(sheetEmp.location);
    const deptOk = departmentsAreEquivalent(
      master.department ?? "",
      sheetEmp.department ?? "Design"
    );

    console.log(
      `Sheet: ${sheetEmp.name} | ${sheetEmp.department} | ${sheetEmp.location}`
    );
    console.log(
      `Master: ${master.name} | ${master.department} | ${master.location} | ECN ${master.ecn}`
    );
    console.log(
      `Plant match: ${plantOk ? "YES" : "NO"} | Dept match: ${deptOk ? "YES" : "NO"} | KPIs: ${parsed.kpis.length}`
    );

    if (!plantOk || !deptOk) {
      console.log("❌ SKIP — plant/department match nahi hua");
      skipped.push(
        `${fileName}: Plant/Dept mismatch — sheet(${sheetEmp.department}, ${sheetEmp.location}) vs master(${master.department}, ${master.location})`
      );
      continue;
    }

    const dest = path.join(destDir, fileName);
    copyFileSync(fp, dest);

    const result = await syncKraWorkbook(db, org.id, ab, admin?.id ?? null, {
      plantUnitKey: PLANT_KEY,
      location: PLANT_LOCATION,
      sourceFileName: fileName,
    });

    console.log(
      `✅ UPLOADED — emp +${result.employeesCreated}/~${result.employeesUpdated}, kpi +${result.kpisCreated}/~${result.kpisUpdated}`
    );
    if (result.errors.length) {
      console.log("  issues:", result.errors.slice(0, 3));
    }
    uploaded.push(
      `${fileName} → ${master.name} (${master.department}, ${master.location}) — ${parsed.kpis.length} KPIs`
    );
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
