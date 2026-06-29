import type { PrismaClient } from "@prisma/client";
import {
  isKraEmployeeWorkbook,
  isValidKraEcn,
  parseKraWorkbook,
} from "./kra-workbook";
import type { EmployeeImportRow } from "./import";

export type EmployeeUploadConflict = {
  ecn: string;
  nameInFile: string;
  existingName: string;
  existingDepartment: string | null;
};

export type EmployeeUploadPreview = {
  conflicts: EmployeeUploadConflict[];
  newCount: number;
  updateCount: number;
  totalEmployees: number;
  requiresConfirmation: boolean;
  errors: string[];
};

export async function findEmployeeEcnConflicts(
  db: PrismaClient,
  organizationId: string,
  rows: { ecn?: string | null; name: string }[]
): Promise<EmployeeUploadConflict[]> {
  const conflicts: EmployeeUploadConflict[] = [];
  const seen = new Set<string>();
  const ecnKeys: string[] = [];

  for (const row of rows) {
    const ecnKey = isValidKraEcn(row.ecn) ? row.ecn!.trim() : null;
    if (!ecnKey || seen.has(ecnKey)) continue;
    seen.add(ecnKey);
    ecnKeys.push(ecnKey);
  }

  if (!ecnKeys.length) return conflicts;

  const existingRows = await db.employeeMaster.findMany({
    where: { organizationId, ecn: { in: ecnKeys } },
  });
  const byEcn = new Map(existingRows.map((e) => [e.ecn!, e]));

  for (const row of rows) {
    const ecnKey = isValidKraEcn(row.ecn) ? row.ecn!.trim() : null;
    if (!ecnKey) continue;
    const existing = byEcn.get(ecnKey);
    if (existing) {
      conflicts.push({
        ecn: ecnKey,
        nameInFile: row.name,
        existingName: existing.name,
        existingDepartment: existing.department,
      });
    }
  }

  return conflicts;
}

function summarizePreview(
  employees: { ecn?: string | null; name: string }[],
  conflicts: EmployeeUploadConflict[],
  errors: string[] = []
): EmployeeUploadPreview {
  const withEcn = employees.filter((e) => isValidKraEcn(e.ecn));
  const updateCount = conflicts.length;
  const newCount =
    withEcn.length -
    updateCount +
    employees.filter((e) => !isValidKraEcn(e.ecn)).length;

  return {
    conflicts,
    newCount,
    updateCount,
    totalEmployees: employees.length,
    requiresConfirmation: conflicts.length > 0,
    errors,
  };
}

export async function previewKraWorkbookUpload(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer,
  sourceFileName?: string
): Promise<EmployeeUploadPreview> {
  const { employees, errors } = parseKraWorkbook(buffer, sourceFileName);
  if (!employees.length) {
    return summarizePreview([], [], errors);
  }

  const conflicts = await findEmployeeEcnConflicts(db, organizationId, employees);
  return summarizePreview(employees, conflicts, errors);
}

export async function previewEmployeeRowsUpload(
  db: PrismaClient,
  organizationId: string,
  rows: EmployeeImportRow[]
): Promise<EmployeeUploadPreview> {
  const employees = rows
    .filter((r) => r.name?.trim())
    .map((r) => ({ ecn: r.ecn, name: r.name!.trim() }));

  const conflicts = await findEmployeeEcnConflicts(db, organizationId, employees);
  return summarizePreview(employees, conflicts);
}

export function isEmployeeKraBuffer(buffer: ArrayBuffer): boolean {
  return isKraEmployeeWorkbook(buffer);
}
