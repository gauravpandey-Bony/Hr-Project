/**
 * Create Kapil Sharma and Ishika in Corporate Design, then upload their WORK RECORD files.
 */
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  parseKraWorkbook,
  type KraWorkbookParseResult,
} from "../src/lib/masters/kra-workbook";
import { syncKraWorkbook } from "../src/lib/masters/sync-kra-workbook";
import { upsertDepartmentMaster } from "../src/lib/masters/department-master-sync";
import { personNamesMatch } from "../src/lib/person-name";

const db = new PrismaClient();

const PLANT_KEY = "Bony Corporate";
const PLANT_LOCATION = "Bony Corporate Faridabad";
const DEPARTMENT = "Design";

type NewEmployeeUpload = {
  filePath: string;
  name: string;
  ecn?: string | null;
  remapKpiOwnerFrom?: string;
};

const UPLOADS: NewEmployeeUpload[] = [
  {
    filePath:
      process.env.KAPIL_WORK_FILE ??
      "/Users/rampal/Desktop/kra/KAPIL_WORK RECORD.xlsx",
    name: "Kapil Sharma",
    ecn: null,
  },
  {
    filePath:
      process.env.ISHIKA_WORK_FILE ??
      "/Users/rampal/Desktop/kra/ISHIKA_WORK RECORD.xlsx",
    name: "Ishika",
    ecn: "101911",
    remapKpiOwnerFrom: "HARPREET",
  },
];

function readBuffer(filePath: string): ArrayBuffer {
  const buf = readFileSync(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function prepareParsed(
  parsed: KraWorkbookParseResult,
  upload: NewEmployeeUpload
): KraWorkbookParseResult {
  const employees = parsed.employees.map((e) => ({
    ...e,
    name: upload.name,
    department: DEPARTMENT,
    departmentRaw: DEPARTMENT,
    location: "Corporate",
    ecn: upload.ecn ?? undefined,
  }));

  const kpis = parsed.kpis.map((k) => {
    const ownerName =
      upload.remapKpiOwnerFrom &&
      personNamesMatch(k.ownerName, upload.remapKpiOwnerFrom)
        ? upload.name
        : k.ownerName;
    return { ...k, ownerName, department: DEPARTMENT };
  });

  return { ...parsed, employees, kpis };
}

async function ensureEmployee(
  organizationId: string,
  name: string,
  ecn: string | null | undefined,
  departmentId: string | null,
  allEmployees: { id: string; name: string; ecn: string | null }[]
) {
  const existing = allEmployees.find(
    (e) => personNamesMatch(e.name, name) || (ecn && e.ecn?.trim() === ecn)
  );
  if (existing) {
    return db.employeeMaster.findUniqueOrThrow({ where: { id: existing.id } });
  }

  if (ecn) {
    const ecnTaken = allEmployees.find((e) => e.ecn?.trim() === ecn);
    if (ecnTaken && !personNamesMatch(ecnTaken.name, name)) {
      console.log(
        `⚠️ ECN ${ecn} already used by ${ecnTaken.name} — creating ${name} without ECN`
      );
      ecn = null;
    }
  }

  const created = await db.employeeMaster.create({
    data: {
      organizationId,
      name,
      department: DEPARTMENT,
      departmentId,
      location: PLANT_LOCATION,
      ecn: ecn ?? null,
      isActive: true,
    },
  });
  allEmployees.push(created);
  return created;
}

async function main() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization");

  const admin = await db.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
    select: { id: true },
  });

  const { department } = await upsertDepartmentMaster(db, org.id, {
    name: DEPARTMENT,
    location: PLANT_LOCATION,
    plantUnitKey: PLANT_KEY,
  });

  const destDir = path.join(process.cwd(), "data", "bony-corporate-kra");
  mkdirSync(destDir, { recursive: true });

  const employees = await db.employeeMaster.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, name: true, ecn: true },
  });

  for (const upload of UPLOADS) {
    const fileName = path.basename(upload.filePath);
    console.log(`\n===== ${fileName} → ${upload.name} =====`);

    const buffer = readBuffer(upload.filePath);
    const parsed = prepareParsed(
      parseKraWorkbook(buffer, fileName),
      upload
    );

    if (!parsed.kpis.length) {
      console.log("❌ SKIP — 0 KPIs");
      continue;
    }

    const created = await ensureEmployee(
      org.id,
      upload.name,
      upload.ecn,
      department.id,
      employees
    );
    console.log(
      `Employee: ${created.name} | ${created.department} | ${created.location} | ECN ${created.ecn ?? "-"}`
    );

    copyFileSync(upload.filePath, path.join(destDir, fileName));

    const result = await syncKraWorkbook(db, org.id, buffer, admin?.id ?? null, {
      plantUnitKey: PLANT_KEY,
      location: PLANT_LOCATION,
      sourceFileName: fileName,
      preParsed: parsed,
    });

    console.log(
      `✅ UPLOADED — emp +${result.employeesCreated}/~${result.employeesUpdated}, kpi +${result.kpisCreated}/~${result.kpisUpdated}`
    );
    if (result.errors.length) {
      console.log("  issues:", result.errors.slice(0, 3));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
