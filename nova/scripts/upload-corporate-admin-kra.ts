/**
 * Upload Corporate Admin KRA files with ECN + plant + department confirmation.
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

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";

const UPLOADS = [
  {
    filePath:
      process.env.KRA_SANJANA_FILE ??
      "/Users/rampal/Desktop/Sanjana KPI-KRA.xlsx",
    expectedEcn: "100960",
    expectedName: "Sanjana Bisht",
  },
  {
    filePath:
      process.env.KRA_SUSHMA_FILE ??
      "/Users/rampal/Desktop/KRA-KPI_Sushma Negi_2026-2027.xlsx",
    expectedEcn: "100004",
    expectedName: "Sushma Negi",
  },
];

async function main() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization");

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const destDir = path.join(process.cwd(), "data", "bony-corporate-kra");
  mkdirSync(destDir, { recursive: true });

  const uploaded: string[] = [];
  const skipped: string[] = [];

  for (const job of UPLOADS) {
    const fileName = path.basename(job.filePath);
    console.log(`\n===== ${fileName} =====`);

    const buf = readFileSync(job.filePath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const parsed = parseKraWorkbook(ab, fileName);
    const emp = parsed.employees[0];

    if (!emp) {
      console.log("❌ SKIP — no employee parsed");
      skipped.push(`${fileName}: no employee header`);
      continue;
    }

    const kpiCount = parsed.kpis.filter((k) =>
      personNamesMatch(k.ownerName, emp.name ?? "")
    ).length;

    console.log(
      `Sheet: ${emp.name} | ${emp.department} | ECN ${emp.ecn ?? "-"} | ${kpiCount} KPIs`
    );

    if (!kpiCount) {
      skipped.push(`${fileName}: 0 KPIs`);
      continue;
    }

    if (emp.ecn?.trim() !== job.expectedEcn) {
      console.log(
        `❌ SKIP — ECN mismatch: file=${emp.ecn ?? "-"} expected=${job.expectedEcn}`
      );
      skipped.push(
        `${fileName}: ECN mismatch — file ${emp.ecn} vs expected ${job.expectedEcn}`
      );
      continue;
    }

    const master = await db.employeeMaster.findFirst({
      where: { organizationId: org.id, isActive: true, ecn: job.expectedEcn },
    });

    if (!master) {
      console.log(`❌ SKIP — ECN ${job.expectedEcn} not in Employee Master`);
      skipped.push(`${fileName}: ECN ${job.expectedEcn} not in master`);
      continue;
    }

    if (!personNamesMatch(master.name, job.expectedName)) {
      console.log(
        `❌ SKIP — name mismatch: master="${master.name}" file="${job.expectedName}"`
      );
      skipped.push(
        `${fileName}: Name mismatch — master "${master.name}" vs file "${job.expectedName}"`
      );
      continue;
    }

    const plantOk =
      resolvePlantFromWorkingLocation(master.location ?? "").plantUnitKey === PLANT_KEY;
    const deptOk = departmentsAreEquivalent(
      master.department ?? "",
      emp.department ?? "Admin"
    );

    console.log(
      `Master: ${master.name} | ${master.department} | ${master.location} | ECN ${master.ecn}`
    );
    console.log(`Plant: ${plantOk ? "YES" : "NO"} | Dept: ${deptOk ? "YES" : "NO"}`);

    if (!plantOk || !deptOk) {
      skipped.push(
        `${fileName}: Plant/Dept mismatch — master(${master.department}, ${master.location})`
      );
      continue;
    }

    copyFileSync(job.filePath, path.join(destDir, fileName));

    const result = await syncKraWorkbook(db, org.id, ab, admin?.id ?? null, {
      plantUnitKey: PLANT_KEY,
      location: PLANT_LOCATION,
      sourceFileName: fileName,
    });

    console.log(
      `✅ UPLOADED — kpi +${result.kpisCreated}/~${result.kpisUpdated}, emp ~${result.employeesUpdated}`
    );
    uploaded.push(
      `${fileName} → ${master.name} (ECN ${master.ecn}, ${master.department}, ${master.location}) — ${kpiCount} KPIs`
    );
  }

  console.log("\n========== SUMMARY ==========");
  for (const u of uploaded) console.log("  ✅", u);
  for (const s of skipped) console.log("  ❌", s);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
