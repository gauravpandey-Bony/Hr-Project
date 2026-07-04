import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { purgeLogisticsJunkData } from "../src/lib/masters/logistics-kra-junk";

const ORG_SLUG = "bony-polymers";

type PlantKraImport = {
  dataDir: string;
  plantUnitKey: string;
  location: string;
  /** When set, only these files are imported (exact filenames). Otherwise all .xlsx/.xls in folder. */
  files?: readonly string[];
};

/** KRA workbooks grouped by plant — imported on every deploy. */
const PLANT_KRA_IMPORTS: PlantKraImport[] = [
  {
    dataDir: "data/bony-37p-kra",
    plantUnitKey: "Bony Polymers",
    location: "Bony Polymers 37-P",
    files: ["Costing & MIS KRA KPI 26-27.xlsx", "New KRA KPI 2026.xlsx"],
  },
  {
    dataDir: "data/bony-corporate-kra",
    plantUnitKey: "Bony Corporate",
    location: "Bony Corporate Faridabad",
  },
  {
    dataDir: "data/bony-fluid-58-kra",
    plantUnitKey: "Bony Fluid 58",
    location: "Bony Fluid 58",
  },
  {
    dataDir: "data/saket-unit1-kra",
    plantUnitKey: "Saket Fabs Sheet Metal",
    location: "Saket Fabs Prithla",
  },
  {
    dataDir: "data/saket-unit2-kra",
    plantUnitKey: "Saket Fabs Coating",
    location: "Saket Fabs Coating",
  },
  {
    dataDir: "data/prime-india-kra",
    plantUnitKey: "Prime India",
    location: "Prime India",
  },
  {
    dataDir: "data/logistics-kra",
    plantUnitKey: "Bony Polymers",
    location: "Bony Polymers 37-P",
  },
];

function readWorkbookBuffer(filePath: string): ArrayBuffer {
  const buffer = readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function listWorkbookFiles(dirPath: string, explicit?: readonly string[]): string[] {
  if (explicit?.length) {
    return explicit.filter((name) => {
      const full = path.join(dirPath, name);
      return existsSync(full);
    });
  }
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath).filter((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith(".xlsx") || lower.endsWith(".xls");
  });
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

  for (const plant of PLANT_KRA_IMPORTS) {
    const dirPath = path.join(process.cwd(), plant.dataDir);
    const files = listWorkbookFiles(dirPath, plant.files);

    if (!files.length) {
      results.push({
        unit: plant.plantUnitKey,
        dataDir: plant.dataDir,
        error: `No workbook files found in ${dirPath}`,
      });
      continue;
    }

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        results.push(
          await importFile(db, org.id, admin?.id, filePath, plant.plantUnitKey, plant.location)
        );
      } catch (err) {
        results.push({
          file,
          unit: plant.plantUnitKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const junkPurged = await purgeLogisticsJunkData(db, org.id);
  const employeeCount = await db.employeeMaster.count({
    where: { organizationId: org.id, isActive: true },
  });
  const kpiCount = await db.kpi.count({
    where: { organizationId: org.id, isActive: true },
  });
  const kpiByPlant = await db.kpi.groupBy({
    by: ["plantUnit"],
    where: { organizationId: org.id, isActive: true },
    _count: { id: true },
  });

  console.log(
    JSON.stringify(
      { employeeCount, kpiCount, kpiByPlant, junkPurged, imports: results },
      null,
      2
    )
  );

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
