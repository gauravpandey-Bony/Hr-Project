import type { DepartmentMaster, PrismaClient } from "@prisma/client";
import { getLocationVariantsForPlant } from "@/lib/org-units";
import {
  departmentMasterWhereForPlant,
  employeeMasterWhereForPlant,
  isLegacyBony37pPlant,
  plantDataScope,
  type PlantDataScope,
} from "@/lib/unit-workspace";
import { normalizeRosterDepartment } from "./37p-roster";
import { normalizeKraDepartment } from "./kra-workbook";
import { filterRealKraEmployees } from "./logistics-kra-junk";

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

const DEPT_ACRONYMS = new Set(["it", "hr", "mis", "ppc", "edp", "qa", "npd"]);

/** 3-letter department tokens (NPD, QA, etc.) render in ALL CAPS. */
function formatDepartmentWord(word: string): string {
  if (word === "&") return "&";
  const lower = word.toLowerCase();
  if (DEPT_ACRONYMS.has(lower)) return lower.toUpperCase();
  if (/^[a-zA-Z]{3}$/.test(word)) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(formatDepartmentWord)
    .join(" ");
}

function uppercaseThreeLetterTokens(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map(formatDepartmentWord)
    .join(" ");
}

/** UI label for department tabs and headers */
export function formatDepartmentDisplayName(name: string): string {
  const normalized = normalizeDepartmentMasterName(name);
  const key = departmentNameKey(normalized);
  if (key === "it" || key === "it & systems" || key === "it & system") {
    return "IT & Systems";
  }
  return uppercaseThreeLetterTokens(normalized);
}

/** One canonical display name per department (roster aliases → master name). */
export function normalizeDepartmentMasterName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const rosterKey = trimmed.toUpperCase().replace(/\s+/g, " ");
  const fromRoster = normalizeRosterDepartment(rosterKey);
  if (fromRoster.masterName !== titleCaseName(trimmed)) {
    return uppercaseThreeLetterTokens(fromRoster.masterName);
  }

  const titled = titleCaseName(trimmed);
  const key = titled.toLowerCase();
  if (key === "it" || key === "it & systems" || key === "it & system") {
    return "IT & Systems";
  }
  return uppercaseThreeLetterTokens(titled);
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
  if (/^npd\b|npd and|npd &/.test(compact)) {
    add("NPD");
    add("Npd");
  }
  if (/^admin\b|corporate office/.test(compact)) {
    add("Admin");
    add("Corporate Office");
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
  if (/^design\b|designing|desiging|design and development/.test(compact)) {
    add("Design");
    add("Designing");
    add("Desiging");
    add("Design & Development");
    add("Development");
  }
  if (/^development$|^r and d$/.test(compact)) {
    add("Development");
    add("Design & Development");
    add("Design");
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
  const scopeKey = plantUnitKey?.trim() || a?.trim() || b?.trim() || "";
  const variants = new Set(
    locationVariantsForDepartment(scopeKey, scopeKey || undefined).map((v) =>
      v.toLowerCase()
    )
  );
  const aLoc = (a ?? "").trim().toLowerCase();
  const bLoc = (b ?? "").trim().toLowerCase();

  if (!aLoc && !bLoc) return true;
  if (!aLoc || !bLoc) return isLegacyBony37pPlant(scopeKey);

  return variants.has(aLoc) && variants.has(bLoc);
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
    if (variants.includes(loc)) return true;
    if (legacy) return locationsSharePlant(location, d.location, plantUnitKey);
    return false;
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
      select: { departmentId: true, department: true, name: true },
    }),
  ]);

  const deptNameById = await loadDepartmentNameById(
    db,
    organizationId,
    activeEmployees.map((emp) => emp.departmentId)
  );
  const { staffedDeptIds, staffedDeptNames } = staffedDepartmentNamesFromEmployees(
    activeEmployees,
    deptNameById
  );

  let deactivated = 0;
  for (const dept of departments) {
    const hasStaff =
      staffedDeptIds.has(dept.id) ||
      [...staffedDeptNames].some((name) => departmentsAreEquivalent(name, dept.name));
    if (hasStaff) continue;

    await db.departmentMaster.update({
      where: { id: dept.id },
      data: archiveDepartmentRow(dept.name, dept.location, dept.id),
    });
    deactivated++;
  }

  return { deactivated };
}

export function staffedDepartmentNamesFromEmployees(
  employees: Array<{ name: string; department?: string | null; departmentId?: string | null }>,
  deptNameById: Map<string, string>
): { staffedDeptIds: Set<string>; staffedDeptNames: Set<string> } {
  const staffedDeptIds = new Set<string>();
  const staffedDeptNames = new Set<string>();

  for (const emp of filterRealKraEmployees(employees)) {
    if (emp.departmentId) staffedDeptIds.add(emp.departmentId);
    const raw =
      emp.department?.trim() ||
      (emp.departmentId ? deptNameById.get(emp.departmentId)?.trim() : undefined);
    if (raw) staffedDeptNames.add(formatDepartmentDisplayName(raw));
  }

  return { staffedDeptIds, staffedDeptNames };
}

async function loadDepartmentNameById(
  db: PrismaClient,
  organizationId: string,
  departmentIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = [...new Set(departmentIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();

  const rows = await db.departmentMaster.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, name: true },
  });

  return new Map(rows.map((row) => [row.id, row.name]));
}

export function resolveEmployeeDepartmentName(
  employee: { department?: string | null; departmentId?: string | null },
  deptNameById: Map<string, string>
): string | null {
  const fromText = employee.department?.trim();
  if (fromText) return fromText;
  if (!employee.departmentId) return null;
  return deptNameById.get(employee.departmentId)?.trim() ?? null;
}

export type DepartmentBrowserRow = {
  id: string;
  name: string;
  headName: string | null;
  location: string | null;
  employeeCount: number;
  departmentIds: string[];
};

/** Group plant-scoped department master rows by canonical name for dashboard tiles. */
export function groupDepartmentMasterRowsForBrowser(
  rows: Array<{
    id: string;
    name: string;
    headName: string | null;
    location: string | null;
    employeeCount: number;
  }>
): DepartmentBrowserRow[] {
  const groups = new Map<string, DepartmentBrowserRow>();

  for (const row of rows) {
    if (!row.name?.trim()) continue;
    const key = departmentNameKey(row.name);
    const existing = groups.get(key);
    if (existing) {
      existing.employeeCount += row.employeeCount;
      existing.departmentIds.push(row.id);
      if (!existing.headName && row.headName) existing.headName = row.headName;
      continue;
    }
    groups.set(key, {
      id: row.id,
      name: row.name,
      headName: row.headName,
      location: row.location,
      employeeCount: row.employeeCount,
      departmentIds: [row.id],
    });
  }

  return [...groups.values()];
}

export function employeeMatchesDepartmentGroup(
  employee: {
    department?: string | null;
    departmentId?: string | null;
    dept?: { name: string } | null;
  },
  departmentName: string,
  departmentIds: Iterable<string>
): boolean {
  const idSet = new Set(departmentIds);
  if (employee.departmentId && idSet.has(employee.departmentId)) return true;
  const resolved =
    employee.department?.trim() || employee.dept?.name?.trim() || "";
  return resolved ? departmentsAreEquivalent(resolved, departmentName) : false;
}

/** Ensure each active employee in a plant links to a department row at that plant's location. */
export async function reconcileDepartmentAssignmentsForPlant(
  db: PrismaClient,
  organizationId: string,
  scope: PlantDataScope
): Promise<{ created: number; reassigned: number }> {
  const canonicalLocation = canonicalDepartmentLocation(
    scope.locationAliases[0] ?? scope.plantUnitKey,
    scope.plantUnitKey
  );

  const employees = await db.employeeMaster.findMany({
    where: {
      ...employeeMasterWhereForPlant(organizationId, scope),
      isActive: true,
    },
    select: {
      id: true,
      department: true,
      departmentId: true,
      location: true,
    },
  });

  const deptNameById = await loadDepartmentNameById(
    db,
    organizationId,
    employees.map((emp) => emp.departmentId)
  );

  let created = 0;
  let reassigned = 0;

  for (const emp of employees) {
    const deptName = resolveEmployeeDepartmentName(emp, deptNameById);
    if (!deptName) continue;

    const location = emp.location?.trim() || canonicalLocation;
    const { department, created: wasCreated } = await upsertDepartmentMaster(
      db,
      organizationId,
      {
        name: deptName,
        location,
        plantUnitKey: scope.plantUnitKey,
        isActive: true,
      }
    );

    if (wasCreated) created++;

    const needsUpdate =
      emp.departmentId !== department.id ||
      emp.department !== department.name;
    if (needsUpdate) {
      await db.employeeMaster.update({
        where: { id: emp.id },
        data: {
          departmentId: department.id,
          department: department.name,
        },
      });
      reassigned++;
    }
  }

  return { created, reassigned };
}

export type PlantUnitScopeInput = {
  plantUnitKey: string;
  locationAliases?: string[];
  kpiPlantAliases?: string[];
};

/** Reconcile department ↔ employee links for every configured plant unit. */
export async function reconcileDepartmentAssignmentsForAllPlants(
  db: PrismaClient,
  organizationId: string,
  units: PlantUnitScopeInput[]
): Promise<{ plants: number; created: number; reassigned: number }> {
  let created = 0;
  let reassigned = 0;
  let plants = 0;

  for (const unit of units) {
    const locationAliases =
      unit.locationAliases?.length ? unit.locationAliases : [unit.plantUnitKey];
    const kpiPlantAliases =
      unit.kpiPlantAliases?.length ? unit.kpiPlantAliases : [unit.plantUnitKey];
    const scope = plantDataScope(unit.plantUnitKey, locationAliases, kpiPlantAliases);

    const result = await reconcileDepartmentAssignmentsForPlant(
      db,
      organizationId,
      scope
    );
    if (result.created > 0 || result.reassigned > 0) {
      plants++;
      created += result.created;
      reassigned += result.reassigned;
    }
  }

  return { plants, created, reassigned };
}
