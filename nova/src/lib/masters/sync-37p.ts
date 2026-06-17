import { readFileSync, existsSync } from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import {
  parse37pRoster,
  ROSTER_DEPARTMENTS,
  type Roster37pRow,
} from "./37p-roster";

export type Sync37pResult = {
  departmentsCreated: number;
  departmentsUpdated: number;
  employeesCreated: number;
  employeesUpdated: number;
  kpisLinked: number;
  employeeCount: number;
  errors: string[];
};

async function upsertDepartments(
  db: PrismaClient,
  organizationId: string
): Promise<{ deptByName: Map<string, string>; created: number; updated: number }> {
  const deptByName = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const d of ROSTER_DEPARTMENTS) {
    const existing = await db.departmentMaster.findFirst({
      where: { organizationId, name: d.name },
    });
    if (existing) {
      await db.departmentMaster.update({
        where: { id: existing.id },
        data: {
          location: d.location ?? existing.location,
          kraSheetId: d.kraSheetId ?? existing.kraSheetId,
          sortOrder: d.sortOrder ?? existing.sortOrder,
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
          location: d.location ?? "Bony Polymers 37-P",
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
  rows: Roster37pRow[],
  deptByName: Map<string, string>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const departmentId = deptByName.get(row.department) ?? null;
    const existing = row.ecn
      ? await db.employeeMaster.findFirst({
          where: { organizationId, ecn: row.ecn },
        })
      : await db.employeeMaster.findFirst({
          where: { organizationId, name: row.name, department: row.department },
        });

    const data = {
      name: row.name,
      designation: row.designation ?? null,
      departmentId,
      department: row.department,
      location: row.location ?? "Bony Polymers 37-P",
      doj: row.doj ?? null,
      ecn: row.ecn ?? null,
      managerName: row.managerName ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: row.isActive ?? true,
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

/** Deactivate legacy placeholder rows when roster has same person with ECN */
async function dedupeLegacyEmployees(
  db: PrismaClient,
  organizationId: string,
  rows: Roster37pRow[]
): Promise<number> {
  const rosterKeys = new Set(
    rows.filter((r) => r.ecn).map((r) => normalizeEmployeeName(r.name))
  );
  if (!rosterKeys.size) return 0;

  const legacy = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true, ecn: null },
  });

  let deactivated = 0;
  for (const emp of legacy) {
    const key = normalizeEmployeeName(emp.name);
    if (rosterKeys.has(key)) {
      await db.employeeMaster.update({
        where: { id: emp.id },
        data: { isActive: false },
      });
      deactivated++;
    }
  }
  return deactivated;
}

/** Normalize KPI.department labels to KRA master department names */
async function linkKpisToDepartments(
  db: PrismaClient,
  organizationId: string
): Promise<number> {
  const renames: [string, string][] = [
    ["Quality", "Quality Assurance"],
  ];

  let linked = 0;
  for (const [from, to] of renames) {
    const res = await db.kpi.updateMany({
      where: { organizationId, department: from },
      data: { department: to },
    });
    linked += res.count;
  }
  return linked;
}

export async function sync37pRoster(
  db: PrismaClient,
  organizationId: string,
  rows: Roster37pRow[]
): Promise<Sync37pResult> {
  const { deptByName, created: departmentsCreated, updated: departmentsUpdated } =
    await upsertDepartments(db, organizationId);

  const { created: employeesCreated, updated: employeesUpdated } = await upsertEmployees(
    db,
    organizationId,
    rows,
    deptByName
  );

  await dedupeLegacyEmployees(db, organizationId, rows);

  const kpisLinked = await linkKpisToDepartments(db, organizationId);
  const employeeCount = await db.employeeMaster.count({
    where: { organizationId, isActive: true },
  });

  return {
    departmentsCreated,
    departmentsUpdated,
    employeesCreated,
    employeesUpdated,
    kpisLinked,
    employeeCount,
    errors: [],
  };
}

export async function sync37pFromBuffer(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer
): Promise<Sync37pResult & { parseErrors: string[] }> {
  const { rows, errors } = parse37pRoster(buffer);
  if (!rows.length) {
    return {
      departmentsCreated: 0,
      departmentsUpdated: 0,
      employeesCreated: 0,
      employeesUpdated: 0,
      kpisLinked: 0,
      employeeCount: 0,
      errors,
      parseErrors: errors,
    };
  }
  const result = await sync37pRoster(db, organizationId, rows);
  return { ...result, parseErrors: errors };
}

export function default37pRosterPath(): string {
  return path.join(process.cwd(), "data", "roster-37p.xlsx");
}

export async function sync37pFromDefaultFile(
  db: PrismaClient,
  organizationId: string,
  filePath = default37pRosterPath()
): Promise<Sync37pResult & { parseErrors: string[] }> {
  if (!existsSync(filePath)) {
    return {
      departmentsCreated: 0,
      departmentsUpdated: 0,
      employeesCreated: 0,
      employeesUpdated: 0,
      kpisLinked: 0,
      employeeCount: 0,
      errors: [`Roster file not found: ${filePath}`],
      parseErrors: [],
    };
  }
  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return sync37pFromBuffer(db, organizationId, arrayBuffer);
}
