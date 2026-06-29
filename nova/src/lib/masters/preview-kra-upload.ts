import type { PrismaClient } from "@prisma/client";
import { departmentMasterWhereForPlant, plantDataScope } from "@/lib/unit-workspace";
import {
  departmentNameKey,
  normalizeDepartmentMasterName,
} from "./department-master-sync";
import { parseKraWorkbook } from "./kra-workbook";
import type { KraWorkbookParseResult } from "./kra-workbook";
import { findEmployeeEcnConflicts } from "./preview-employee-upload";

export type KraUploadEmployeePreview = {
  sheetName: string;
  name: string;
  detectedDepartment: string | null;
  detectedDepartmentRaw: string | null;
  matchedDepartmentId: string | null;
  matchedDepartmentName: string | null;
  needsDepartmentPick: boolean;
};

export type KraUploadPreview = {
  employeeKra: boolean;
  employees: KraUploadEmployeePreview[];
  departments: { id: string; name: string }[];
  needsDepartmentPick: boolean;
  conflicts: Awaited<ReturnType<typeof findEmployeeEcnConflicts>>;
  newCount: number;
  updateCount: number;
  requiresConfirmation: boolean;
  kpiCount: number;
  errors: string[];
};

async function listDepartmentsForPlant(
  db: PrismaClient,
  organizationId: string,
  plantUnitKey?: string | null
) {
  const where = plantUnitKey?.trim()
    ? departmentMasterWhereForPlant(organizationId, plantDataScope(plantUnitKey))
    : { organizationId, isActive: true };

  return db.departmentMaster.findMany({
    where: { ...where, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

async function matchToMasterDepartment(
  departmentName: string | null | undefined,
  departments: { id: string; name: string }[]
): Promise<{ id: string | null; name: string | null; matched: boolean }> {
  if (!departmentName?.trim()) {
    return { id: null, name: null, matched: false };
  }

  const normalized = normalizeDepartmentMasterName(departmentName);
  const key = departmentNameKey(normalized);
  const fuzzy = departments.find((d) => departmentNameKey(d.name) === key);
  if (fuzzy) {
    return { id: fuzzy.id, name: fuzzy.name, matched: true };
  }

  return { id: null, name: normalized, matched: false };
}

export async function previewKraUpload(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer,
  options?: { plantUnitKey?: string | null; sourceFileName?: string },
  preParsed?: KraWorkbookParseResult
): Promise<KraUploadPreview> {
  const { employees, kpis, errors } =
    preParsed ?? parseKraWorkbook(buffer, options?.sourceFileName);
  const employeeKra = employees.length > 0;
  const departments = await listDepartmentsForPlant(
    db,
    organizationId,
    options?.plantUnitKey
  );

  if (!employeeKra) {
    return {
      employeeKra: false,
      employees: [],
      departments,
      needsDepartmentPick: false,
      conflicts: [],
      newCount: 0,
      updateCount: 0,
      requiresConfirmation: false,
      kpiCount: 0,
      errors,
    };
  }

  const employeePreviews: KraUploadEmployeePreview[] = [];
  for (const emp of employees) {
    const match = await matchToMasterDepartment(
      emp.department ?? emp.departmentRaw,
      departments
    );
    employeePreviews.push({
      sheetName: emp.sheetName,
      name: emp.name,
      detectedDepartment: emp.department ?? null,
      detectedDepartmentRaw: emp.departmentRaw ?? null,
      matchedDepartmentId: match.id,
      matchedDepartmentName: match.name,
      needsDepartmentPick: !match.matched,
    });
  }

  const conflicts = await findEmployeeEcnConflicts(db, organizationId, employees);
  const withEcn = employees.filter((e) => e.ecn);
  const updateCount = conflicts.length;
  const newCount =
    withEcn.length -
    updateCount +
    employees.filter((e) => !e.ecn).length;

  return {
    employeeKra: true,
    employees: employeePreviews,
    departments,
    needsDepartmentPick: employeePreviews.some((e) => e.needsDepartmentPick),
    conflicts,
    newCount,
    updateCount,
    requiresConfirmation: conflicts.length > 0,
    kpiCount: kpis.length,
    errors,
  };
}

export function parseDepartmentOverrides(
  raw: FormDataEntryValue | null
): Record<string, string> {
  if (!raw || typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        out[key.trim()] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}
