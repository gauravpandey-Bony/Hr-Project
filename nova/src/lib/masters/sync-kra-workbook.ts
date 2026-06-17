import { readFileSync, existsSync } from "fs";
import type { PrismaClient } from "@prisma/client";
import {
  parseKraWorkbook,
  kpiStableId,
  isValidKraEcn,
  normalizeKraDepartment,
  type KraWorkbookEmployee,
  type KraWorkbookKpi,
} from "./kra-workbook";
import { ROSTER_DEPARTMENTS } from "./37p-roster";

export type SyncKraWorkbookResult = {
  departmentsCreated: number;
  departmentsUpdated: number;
  employeesCreated: number;
  employeesUpdated: number;
  kpisCreated: number;
  kpisUpdated: number;
  entriesCreated: number;
  employeeCount: number;
  errors: string[];
};

async function ensureDepartments(
  db: PrismaClient,
  organizationId: string,
  employees: KraWorkbookEmployee[]
): Promise<{ deptByName: Map<string, string>; created: number; updated: number }> {
  const deptByName = new Map<string, string>();
  let created = 0;
  let updated = 0;

  const extraDepts = new Map<string, { kraSheetId: string }>();
  for (const e of employees) {
    const { masterName, kraSheetId } = normalizeKraDepartment(
      e.departmentRaw ?? e.department
    );
    extraDepts.set(masterName, { kraSheetId });
  }

  const allDefs = [
    ...ROSTER_DEPARTMENTS,
    ...[...extraDepts.entries()].map(([name, meta], i) => ({
      name,
      kraSheetId: meta.kraSheetId,
      location: "Bony Polymers",
      sortOrder: 20 + i,
    })),
  ];

  const seen = new Set<string>();
  for (const d of allDefs) {
    if (seen.has(d.name)) continue;
    seen.add(d.name);

    const existing = await db.departmentMaster.findFirst({
      where: { organizationId, name: d.name },
    });
    if (existing) {
      await db.departmentMaster.update({
        where: { id: existing.id },
        data: {
          kraSheetId: d.kraSheetId ?? existing.kraSheetId,
          isActive: true,
        },
      });
      deptByName.set(d.name, existing.id);
      updated++;
    } else {
      const row = await db.departmentMaster.create({
        data: {
          organizationId,
          name: d.name,
          location: d.location ?? "Bony Polymers",
          kraSheetId: d.kraSheetId ?? null,
          sortOrder: d.sortOrder ?? 0,
          isActive: true,
        },
      });
      deptByName.set(d.name, row.id);
      created++;
    }
  }

  return { deptByName, created, updated };
}

async function upsertEmployees(
  db: PrismaClient,
  organizationId: string,
  employees: KraWorkbookEmployee[],
  deptByName: Map<string, string>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of employees) {
    const departmentId = deptByName.get(row.department) ?? null;
    const ecnKey = isValidKraEcn(row.ecn) ? row.ecn!.trim() : null;
    const existing = ecnKey
      ? await db.employeeMaster.findFirst({
          where: { organizationId, ecn: ecnKey },
        })
      : await db.employeeMaster.findFirst({
          where: { organizationId, name: row.name, department: row.department },
        });

    const data = {
      name: row.name,
      designation: row.designation ?? null,
      departmentId,
      department: row.department,
      location: row.location ?? "Bony Polymers",
      doj: row.doj ?? null,
      ecn: ecnKey,
      managerName: row.managerName ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: existing?.isActive ?? true,
    };

    if (existing) {
      await db.employeeMaster.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.employeeMaster.create({
        data: { organizationId, ...data },
      });
      created++;
    }
  }

  return { created, updated };
}

function normalizeEmployeeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(mr|ms|mrs|dr)\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep one row per person when re-import fills ECN/DOJ */
async function dedupeKraEmployees(
  db: PrismaClient,
  organizationId: string,
  employees: KraWorkbookEmployee[]
): Promise<number> {
  const withEcn = employees.filter((e) => e.ecn);
  if (!withEcn.length) return 0;

  const keys = new Set(withEcn.map((e) => normalizeEmployeeName(e.name)));
  const legacy = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true, ecn: null },
  });

  let deactivated = 0;
  for (const emp of legacy) {
    if (keys.has(normalizeEmployeeName(emp.name))) {
      await db.employeeMaster.update({
        where: { id: emp.id },
        data: { isActive: false },
      });
      deactivated++;
    }
  }
  return deactivated;
}

function perspectiveToCategory(perspective?: string): string {
  const p = (perspective ?? "").toLowerCase();
  if (p.includes("finance")) return "Finance";
  if (p.includes("quality")) return "Quality";
  if (p.includes("user") || p.includes("process")) return "Process";
  if (p.includes("security")) return "Process";
  return "IT";
}

async function upsertIndividualKpis(
  db: PrismaClient,
  organizationId: string,
  kpis: KraWorkbookKpi[],
  adminUserId: string | null
): Promise<{ created: number; updated: number; entriesCreated: number }> {
  let created = 0;
  let updated = 0;
  let entriesCreated = 0;

  const months = [
    new Date(2026, 0, 28),
    new Date(2026, 1, 28),
    new Date(2026, 2, 28),
    new Date(2026, 3, 28),
  ];

  for (const k of kpis) {
    const id = kpiStableId(k.ownerName, k.srNo, k.name);
    const category = perspectiveToCategory(k.perspective);

    const existing = await db.kpi.findUnique({ where: { id } });

    const data = {
      organizationId,
      name: k.name,
      description: k.kraName,
      category,
      unit: k.unit,
      targetValue: k.targetValue,
      direction: k.direction,
      frequency: "MONTHLY" as const,
      department: k.department,
      perspective: k.perspective?.replace(/\s*\([^)]*\)/g, "").trim() || null,
      kraName: k.kraName,
      weightage: k.weightage,
      plantUnit: "Bony Polymers",
      kpiLevel: "INDIVIDUAL",
      ownerName: k.ownerName,
      quarterTargets: JSON.stringify({
        annualTarget: k.targetAnnual,
        ...k.quarterTargets,
      }),
      isActive: true,
    };

    if (existing) {
      await db.kpi.update({ where: { id }, data });
      updated++;
    } else {
      await db.kpi.create({ data: { id, ...data } });
      created++;
    }

    if (k.entryValues.length) {
      await db.kpiEntry.deleteMany({ where: { kpiId: id } });
      for (let i = 0; i < k.entryValues.length; i++) {
        await db.kpiEntry.create({
          data: {
            kpiId: id,
            value: k.entryValues[i],
            recordedAt: months[i] ?? months[months.length - 1],
            enteredById: adminUserId,
          },
        });
        entriesCreated++;
      }
    }
  }

  return { created, updated, entriesCreated };
}

export async function syncKraWorkbook(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer,
  adminUserId?: string | null
): Promise<SyncKraWorkbookResult & { parseErrors: string[] }> {
  const { employees, kpis, errors } = parseKraWorkbook(buffer);
  if (!employees.length) {
    return {
      departmentsCreated: 0,
      departmentsUpdated: 0,
      employeesCreated: 0,
      employeesUpdated: 0,
      kpisCreated: 0,
      kpisUpdated: 0,
      entriesCreated: 0,
      employeeCount: 0,
      errors,
      parseErrors: errors,
    };
  }

  const { deptByName, created: departmentsCreated, updated: departmentsUpdated } =
    await ensureDepartments(db, organizationId, employees);

  const { created: employeesCreated, updated: employeesUpdated } =
    await upsertEmployees(db, organizationId, employees, deptByName);

  await dedupeKraEmployees(db, organizationId, employees);

  const {
    created: kpisCreated,
    updated: kpisUpdated,
    entriesCreated,
  } = await upsertIndividualKpis(db, organizationId, kpis, adminUserId ?? null);

  const employeeCount = await db.employeeMaster.count({
    where: { organizationId, isActive: true },
  });

  return {
    departmentsCreated,
    departmentsUpdated,
    employeesCreated,
    employeesUpdated,
    kpisCreated,
    kpisUpdated,
    entriesCreated,
    employeeCount,
    errors,
    parseErrors: errors,
  };
}

export async function syncKraFromDefaultFile(
  db: PrismaClient,
  organizationId: string,
  filePath?: string,
  adminUserId?: string | null
): Promise<SyncKraWorkbookResult & { parseErrors: string[] }> {
  const path = filePath ?? `${process.cwd()}/data/kra-it-13-4-26.xlsx`;
  if (!existsSync(path)) {
    return {
      departmentsCreated: 0,
      departmentsUpdated: 0,
      employeesCreated: 0,
      employeesUpdated: 0,
      kpisCreated: 0,
      kpisUpdated: 0,
      entriesCreated: 0,
      employeeCount: 0,
      errors: [`KRA workbook not found: ${path}`],
      parseErrors: [],
    };
  }
  const buffer = readFileSync(path);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return syncKraWorkbook(db, organizationId, arrayBuffer, adminUserId);
}
