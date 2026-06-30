import type { PrismaClient } from "@prisma/client";
import {
  isKraEmployeeWorkbook,
  isValidKraEcn,
  parseKraWorkbook,
} from "./kra-workbook";
import type { EmployeeImportRow } from "./import";
import { summarizePlantAssignments } from "./employee-plant-location";

export type EmployeeUploadConflict = {
  ecn: string;
  nameInFile: string;
  existingName: string;
  existingDepartment: string | null;
  existingLocation?: string | null;
  plantUnitKey?: string | null;
};

export type EmployeeUploadDuplicateInFile = {
  ecn: string;
  names: string[];
};

export type EmployeeUploadPreview = {
  conflicts: EmployeeUploadConflict[];
  duplicatesInFile: EmployeeUploadDuplicateInFile[];
  plantSummary: Record<string, number>;
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
        existingLocation: existing.location,
        plantUnitKey: "plantUnitKey" in row ? (row as { plantUnitKey?: string }).plantUnitKey : null,
      });
    }
  }

  return conflicts;
}

function findDuplicateEcnsInFile(
  rows: { ecn?: string | null; name: string }[]
): EmployeeUploadDuplicateInFile[] {
  const byEcn = new Map<string, string[]>();
  for (const row of rows) {
    const ecnKey = isValidKraEcn(row.ecn) ? row.ecn!.trim() : null;
    if (!ecnKey) continue;
    const list = byEcn.get(ecnKey) ?? [];
    list.push(row.name);
    byEcn.set(ecnKey, list);
  }
  return [...byEcn.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([ecn, names]) => ({ ecn, names }));
}

function summarizePreview(
  employees: { ecn?: string | null; name: string; location?: string | null }[],
  conflicts: EmployeeUploadConflict[],
  errors: string[] = [],
  duplicatesInFile: EmployeeUploadDuplicateInFile[] = []
): EmployeeUploadPreview {
  const withEcn = employees.filter((e) => isValidKraEcn(e.ecn));
  const updateCount = conflicts.length;
  const newCount =
    withEcn.length -
    updateCount +
    employees.filter((e) => !isValidKraEcn(e.ecn)).length;

  return {
    conflicts,
    duplicatesInFile,
    plantSummary: summarizePlantAssignments(employees),
    newCount,
    updateCount,
    totalEmployees: employees.length,
    requiresConfirmation: conflicts.length > 0 || duplicatesInFile.length > 0,
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
  const duplicatesInFile = findDuplicateEcnsInFile(employees);
  return summarizePreview(employees, conflicts, errors, duplicatesInFile);
}

export async function previewEmployeeRowsUpload(
  db: PrismaClient,
  organizationId: string,
  rows: EmployeeImportRow[]
): Promise<EmployeeUploadPreview> {
  const employees = rows
    .filter((r) => r.name?.trim())
    .map((r) => ({
      ecn: r.ecn,
      name: r.name!.trim(),
      location: r.location,
      plantUnitKey: r.plantUnitKey,
    }));

  const conflicts = await findEmployeeEcnConflicts(db, organizationId, employees);
  const duplicatesInFile = findDuplicateEcnsInFile(employees);
  return summarizePreview(employees, conflicts, [], duplicatesInFile);
}

export function isEmployeeKraBuffer(buffer: ArrayBuffer): boolean {
  return isKraEmployeeWorkbook(buffer);
}
