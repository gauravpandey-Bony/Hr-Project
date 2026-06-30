import type { DepartmentMaster, PrismaClient } from "@prisma/client";
import { getLocationVariantsForPlant } from "@/lib/org-units";
import {
  departmentMasterWhereForPlant,
  isLegacyBony37pPlant,
  plantDataScope,
} from "@/lib/unit-workspace";
import { normalizeRosterDepartment } from "./37p-roster";
import { normalizeKraDepartment } from "./kra-workbook";

export type DepartmentUpsertInput = {
  name: string;
  headName?: string | null;
  location?: string | null;
  plantUnitKey?: string | null;
  kraSheetId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type DepartmentUpsertResult = {
  department: DepartmentMaster;
  created: boolean;
};

const DEPT_ACRONYMS = new Set(["it", "hr", "mis", "ppc", "edp", "qa"]);

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (w === "&") return "&";
      const lower = w.toLowerCase();
      if (DEPT_ACRONYMS.has(lower)) return lower.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/** UI label for department tabs and headers */
export function formatDepartmentDisplayName(name: string): string {
  const normalized = normalizeDepartmentMasterName(name);
  const key = departmentNameKey(normalized);
  if (key === "it" || key === "it & systems" || key === "it & system") {
    return "IT & Systems";
  }
  return normalized;
}

/** One canonical display name per department (roster aliases → master name). */
export function normalizeDepartmentMasterName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const rosterKey = trimmed.toUpperCase().replace(/\s+/g, " ");
  const fromRoster = normalizeRosterDepartment(rosterKey);
  if (fromRoster.masterName !== titleCaseName(trimmed)) {
    return fromRoster.masterName;
  }

  return titleCaseName(trimmed);
}

export function departmentNameKey(name: string): string {
  return normalizeDepartmentMasterName(name).toLowerCase();
}

/** Collect normalized keys for fuzzy department matching (IT ↔ IT & Systems, HR ↔ Human Resources, etc.). */
export function departmentMatchKeys(name: string): Set<string> {
  const keys = new Set<string>();
  const add = (raw?: string | null) => {
    if (!raw?.trim()) return;
    keys.add(departmentNameKey(raw));
  };

  add(name);
  add(normalizeDepartmentMasterName(name));
  add(normalizeKraDepartment(name).masterName);

  const compact = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(it|edp)\b|it and system|information technology/.test(compact)) {
    add("IT");
    add("IT & Systems");
    add("IT & System");
  }
  if (/^hr\b|human resource/.test(compact)) {
    add("HR");
    add("Human Resources");
  }
  if (/^quality\b|quality assurance/.test(compact)) {
    add("Quality");
    add("Quality Assurance");
  }
  if (/costing.*mis|mis.*costing/.test(compact)) {
    add("Costing & MIS");
    add("MIS");
  }
  if (/dispatch.*bill|bill.*dispatch/.test(compact)) {
    add("Dispatch & Billing");
    add("Billing");
    add("Dispatch");
  }
  if (/plant head|^operations$/.test(compact)) {
    add("Production");
    add("Plant Head");
    add("Operations");
  }
  if (/logistic/.test(compact)) {
    add("Logistics");
  }
  if (/tool room/.test(compact)) {
    add("Tool Room");
  }
  if (/maintenance/.test(compact)) {
    add("Maintenance");
  }
  if (/^store\b|bop store|compound store|green hollow|store.*purchase|purchase.*store/.test(compact)) {
    add("Store");
  }
  if (/dispatch.*assembly|production.*dispatch/.test(compact)) {
    add("Dispatch & Assembly");
  }
  if (/^production$/.test(compact)) {
    add("Production");
  }

  return keys;
}

export function departmentsAreEquivalent(a: string, b: string): boolean {
  const keysB = departmentMatchKeys(b);
  for (const key of departmentMatchKeys(a)) {
    if (keysB.has(key)) return true;
  }
  return false;
}

export function findMatchingDepartmentInList<T extends { id: string; name: string }>(
  detectedName: string | null | undefined,
  departments: T[]
): T | null {
  if (!detectedName?.trim()) return null;
  return (
    departments.find((d) => departmentsAreEquivalent(detectedName, d.name)) ?? null
  );
}

/** Collapse plant location aliases to one stored value per plant family. */
export function canonicalDepartmentLocation(
  location?: string | null,
  plantUnitKey?: string | null
): string {
  const key = (plantUnitKey?.trim() || location?.trim() || "Bony Polymers").trim();
  if (isLegacyBony37pPlant(key)) return "Bony Polymers 37-P";
  return key;
}

export function locationVariantsForDepartment(
  location?: string | null,
  plantUnitKey?: string | null
): string[] {
  const canonical = canonicalDepartmentLocation(location, plantUnitKey);
  return getLocationVariantsForPlant(canonical);
}

function locationsSharePlant(
  a?: string | null,
  b?: string | null,
  plantUnitKey?: string | null
): boolean {
  const variants = new Set(
    locationVariantsForDepartment(a, plantUnitKey).map((v) => v.toLowerCase())
  );
  const other = (b ?? "").trim().toLowerCase();
  if (!other) return true;
  return variants.has(other) || canonicalDepartmentLocation(b, plantUnitKey).toLowerCase() === canonicalDepartmentLocation(a, plantUnitKey).toLowerCase();
}

export async function findExistingDepartmentMaster(
  db: PrismaClient,
  organizationId: string,
  name: string,
  location?: string | null,
  plantUnitKey?: string | null
): Promise<DepartmentMaster | null> {
  const canonicalName = normalizeDepartmentMasterName(name);
  const nameKey = departmentNameKey(canonicalName);
  const variants = locationVariantsForDepartment(location, plantUnitKey).map((v) =>
    v.toLowerCase()
  );
  const legacy = isLegacyBony37pPlant(plantUnitKey ?? location);

  const candidates = await db.departmentMaster.findMany({
    where: { organizationId },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const matches = candidates.filter((d) => {
    if (!departmentsAreEquivalent(d.name, canonicalName)) return false;
    const loc = (d.location ?? "").trim().toLowerCase();
    if (!loc) return legacy;
    return variants.includes(loc) || locationsSharePlant(location, d.location, plantUnitKey);
  });

  return matches[0] ?? null;
}

export async function upsertDepartmentMaster(
  db: PrismaClient,
  organizationId: string,
  input: DepartmentUpsertInput
): Promise<DepartmentUpsertResult> {
  const name = normalizeDepartmentMasterName(input.name);
  const location = canonicalDepartmentLocation(input.location, input.plantUnitKey);
  const existing = await findExistingDepartmentMaster(
    db,
    organizationId,
    name,
    location,
    input.plantUnitKey
  );

  const canonicalRow = await db.departmentMaster.findFirst({
    where: { organizationId, name, location },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });

  if (canonicalRow && existing && canonicalRow.id !== existing.id) {
    await db.departmentMaster.update({
      where: { id: existing.id },
      data: archiveDepartmentRow(existing.name, existing.location, existing.id),
    });
    const department = await db.departmentMaster.update({
      where: { id: canonicalRow.id },
      data: {
        headName: input.headName ?? canonicalRow.headName,
        kraSheetId: input.kraSheetId ?? canonicalRow.kraSheetId,
        sortOrder: input.sortOrder ?? canonicalRow.sortOrder,
        isActive: input.isActive ?? true,
      },
    });
    return { department, created: false };
  }

  if (existing) {
    const department = await db.departmentMaster.update({
      where: { id: existing.id },
      data: {
        name,
        headName: input.headName ?? existing.headName,
        location: existing.location === location ? location : existing.location ?? location,
        kraSheetId: input.kraSheetId ?? existing.kraSheetId,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        isActive: input.isActive ?? true,
      },
    });
    return { department, created: false };
  }

  if (canonicalRow) {
    const department = await db.departmentMaster.update({
      where: { id: canonicalRow.id },
      data: {
        headName: input.headName ?? canonicalRow.headName,
        kraSheetId: input.kraSheetId ?? canonicalRow.kraSheetId,
        sortOrder: input.sortOrder ?? canonicalRow.sortOrder,
        isActive: input.isActive ?? true,
      },
    });
    return { department, created: false };
  }

  try {
    const department = await db.departmentMaster.create({
      data: {
        organizationId,
        name,
        headName: input.headName ?? null,
        location,
        kraSheetId: input.kraSheetId ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    return { department, created: true };
  } catch (err) {
    const isUnique =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002";
    if (!isUnique) throw err;

    const fallback = await db.departmentMaster.findFirst({
      where: { organizationId, name, location },
    });
    if (!fallback) throw err;
    const department = await db.departmentMaster.update({
      where: { id: fallback.id },
      data: {
        kraSheetId: input.kraSheetId ?? fallback.kraSheetId,
        sortOrder: input.sortOrder ?? fallback.sortOrder,
        isActive: input.isActive ?? true,
      },
    });
    return { department, created: false };
  }
}

type DeptCluster = DepartmentWithCount[];

function clusterDepartmentsByPlant(
  rows: DepartmentWithCount[],
  plantUnitKey?: string | null
): DeptCluster[] {
  const clusters: DeptCluster[] = [];

  for (const row of rows) {
    let placed = false;
    for (const cluster of clusters) {
      if (locationsSharePlant(cluster[0]?.location, row.location, plantUnitKey)) {
        cluster.push(row);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([row]);
  }

  return clusters;
}

function archiveDepartmentRow(name: string, location: string | null, id: string) {
  return {
    isActive: false as const,
    name: `${name} (archived ${id.slice(-6)})`,
    location: `${location ?? "unknown"}#${id.slice(-6)}`,
  };
}

function pickCanonicalDepartment(cluster: DepartmentWithCount[]): DepartmentMaster {
  return [...cluster].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const empDiff = (b._count?.employees ?? 0) - (a._count?.employees ?? 0);
    if (empDiff !== 0) return empDiff;
    const sortDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (sortDiff !== 0) return sortDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0]!;
}

/** Merge duplicate department rows (same name + same plant) across the org. */
export async function dedupeDepartmentMasters(
  db: PrismaClient,
  organizationId: string,
  plantUnitKey?: string | null
): Promise<{ merged: number; deactivated: number }> {
  const all = await db.departmentMaster.findMany({
    where: { organizationId },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const byName = new Map<string, DepartmentMaster[]>();
  for (const row of all) {
    const key = departmentNameKey(row.name);
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }

  let merged = 0;
  let deactivated = 0;

  for (const rows of Array.from(byName.values())) {
    const clusters = clusterDepartmentsByPlant(rows, plantUnitKey);
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      const keeper = pickCanonicalDepartment(cluster);
      const duplicates = cluster.filter((d) => d.id !== keeper.id);

      for (const dup of duplicates) {
        await db.employeeMaster.updateMany({
          where: { organizationId, departmentId: dup.id },
          data: {
            departmentId: keeper.id,
            department: keeper.name,
          },
        });

        await db.employeeMaster.updateMany({
          where: {
            organizationId,
            departmentId: null,
            department: dup.name,
          },
          data: {
            departmentId: keeper.id,
            department: keeper.name,
          },
        });

        await db.departmentMaster.update({
          where: { id: dup.id },
          data: archiveDepartmentRow(dup.name, dup.location, dup.id),
        });

        merged++;
        deactivated++;
      }

      const canonicalName = normalizeDepartmentMasterName(keeper.name);
      const canonicalLoc = canonicalDepartmentLocation(keeper.location, plantUnitKey);
      const mergedKraSheetId =
        keeper.kraSheetId ?? duplicates.find((d) => d.kraSheetId)?.kraSheetId ?? null;

      const conflict = await db.departmentMaster.findFirst({
        where: {
          organizationId,
          name: canonicalName,
          location: canonicalLoc,
          id: { notIn: [keeper.id, ...duplicates.map((d) => d.id)] },
        },
      });

      if (conflict) {
        await db.employeeMaster.updateMany({
          where: { organizationId, departmentId: keeper.id },
          data: { departmentId: conflict.id, department: conflict.name },
        });
        await db.departmentMaster.update({
          where: { id: keeper.id },
          data: archiveDepartmentRow(keeper.name, keeper.location, keeper.id),
        });
        await db.departmentMaster.update({
          where: { id: conflict.id },
          data: {
            kraSheetId: mergedKraSheetId ?? conflict.kraSheetId,
            isActive: true,
          },
        });
      } else {
        await db.departmentMaster.update({
          where: { id: keeper.id },
          data: {
            name: canonicalName,
            location: canonicalLoc,
            isActive: true,
            kraSheetId: mergedKraSheetId,
          },
        });
      }
    }
  }

  return { merged, deactivated };
}

/** Deactivate department master rows in plant scope that have no active employees. */
export async function deactivateEmptyDepartments(
  db: PrismaClient,
  organizationId: string,
  plantUnitKey?: string | null
): Promise<{ deactivated: number }> {
  const where = plantUnitKey?.trim()
    ? departmentMasterWhereForPlant(organizationId, plantDataScope(plantUnitKey))
    : { organizationId };

  const [departments, activeEmployees] = await Promise.all([
    db.departmentMaster.findMany({
      where: { ...where, isActive: true },
      select: { id: true, name: true, location: true },
    }),
    db.employeeMaster.findMany({
      where: { organizationId, isActive: true },
      select: { departmentId: true, department: true },
    }),
  ]);

  const staffedDeptIds = new Set<string>();
  const staffedDeptNames = new Set<string>();
  for (const emp of activeEmployees) {
    if (emp.departmentId) staffedDeptIds.add(emp.departmentId);
    const name = emp.department?.trim();
    if (name) staffedDeptNames.add(departmentNameKey(name));
  }

  let deactivated = 0;
  for (const dept of departments) {
    const hasStaff =
      staffedDeptIds.has(dept.id) ||
      staffedDeptNames.has(departmentNameKey(dept.name));
    if (hasStaff) continue;

    await db.departmentMaster.update({
      where: { id: dept.id },
      data: archiveDepartmentRow(dept.name, dept.location, dept.id),
    });
    deactivated++;
  }

  return { deactivated };
}
