import type { PrismaClient } from "@prisma/client";
import type { EmployeeImportRow } from "./import";
import {
  buildStaffDetailsEcnMap,
  isStaffDetailsBuffer,
  resolveStaffDetailsManagers,
} from "./staff-details-roster";

/** Resolve REPORTING column codes → manager names using roster + existing DB employees. */
export async function enrichStaffDetailsManagers(
  db: PrismaClient,
  organizationId: string,
  rows: EmployeeImportRow[]
): Promise<void> {
  const ecnToName = buildStaffDetailsEcnMap(rows);
  const existing = await db.employeeMaster.findMany({
    where: { organizationId, ecn: { not: null } },
    select: { ecn: true, name: true },
  });
  for (const e of existing) {
    if (e.ecn) ecnToName.set(e.ecn, e.name);
  }
  resolveStaffDetailsManagers(rows, ecnToName);
}

export async function prepareStaffDetailsRows(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer,
  rows: EmployeeImportRow[]
): Promise<EmployeeImportRow[]> {
  if (!isStaffDetailsBuffer(buffer) || !rows.length) return rows;
  await enrichStaffDetailsManagers(db, organizationId, rows);
  return rows;
}
