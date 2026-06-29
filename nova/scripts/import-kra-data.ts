import { readFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { purgeLogisticsJunkData } from "../src/lib/masters/logistics-kra-junk";

const ORG_SLUG = "bony-polymers";

const BONY_37P_PLANT = "Bony Polymers";
const BONY_37P_LOCATION = "Bony Polymers 37-P";

const BONY_37P_KRA_FILES = [
  "Costing & MIS KRA KPI 26-27.xlsx",
  "New KRA KPI 2026.xlsx",
] as const;

const BONY_FLUID_58_PLANT = "Bony Fluid 58";

const BONY_FLUID_58_KRA_FILES = [
  "Suraj KRA.xlsx",
  "Raman Singh KRA.xlsx",
  "Rahul Narwar- Dispatch & Assembly.xlsx",
  "Quality.xlsx",
  "Pardeep Dagar KRA & KPI.xlsx",
  "Maintenance.XLSX",
  "Jitender KRA & KPI_Plant 58.xlsx",
  "Gulab Singh KRA & KPI_Plant 58.xlsx",
  "Dinesh KRA.xlsx",
] as const;

function readWorkbookBuffer(filePath: string): ArrayBuffer {
  const buffer = readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function importFile(
  db: PrismaClient,
  orgId: string,
  adminId: string | undefined,
  filePath: string,
  plantUnitKey: string,
  location: string
) {
  const fileName = path.basename(filePath);
  const arrayBuffer = readWorkbookBuffer(filePath);
  const result = await syncKraWorkbook(db, orgId, arrayBuffer, adminId, {
    plantUnitKey,
    location,
    sourceFileName: fileName,
  });
  return { file: fileName, unit: plantUnitKey, ...result };
}

async function main() {
  const db = new PrismaClient();
  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    console.error("Organization not found. Run npm run db:seed first.");
    process.exit(1);
  }

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const results: Record<string, unknown>[] = [];

  for (const file of BONY_37P_KRA_FILES) {
    const filePath = path.join(process.cwd(), "data/bony-37p-kra", file);
    if (!existsSync(filePath)) {
      results.push({ file, unit: BONY_37P_PLANT, error: `File not found: ${filePath}` });
      continue;
    }
    results.push(
      await importFile(db, org.id, admin?.id, filePath, BONY_37P_PLANT, BONY_37P_LOCATION)
    );
  }

  for (const file of BONY_FLUID_58_KRA_FILES) {
    const filePath = path.join(process.cwd(), "data/bony-fluid-58-kra", file);
    if (!existsSync(filePath)) {
      results.push({ file, unit: BONY_FLUID_58_PLANT, error: `File not found: ${filePath}` });
      continue;
    }
    results.push(
      await importFile(db, org.id, admin?.id, filePath, BONY_FLUID_58_PLANT, BONY_FLUID_58_PLANT)
    );
  }

  const junkPurged = await purgeLogisticsJunkData(db, org.id);
  const employeeCount = await db.employeeMaster.count({
    where: { organizationId: org.id, isActive: true },
  });
  const kpiCount = await db.kpi.count({
    where: { organizationId: org.id, isActive: true },
  });

  console.log(
    JSON.stringify({ employeeCount, kpiCount, junkPurged, imports: results }, null, 2)
  );

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
