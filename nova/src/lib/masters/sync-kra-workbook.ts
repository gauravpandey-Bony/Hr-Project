import { readFileSync, existsSync } from "fs";
import type { PrismaClient } from "@prisma/client";
import {
  parseKraWorkbook,
  kpiStableId,
  isValidKraEcn,
  normalizeKraDepartment,
  sanitizeKraDesignation,
  type KraWorkbookEmployee,
  type KraWorkbookKpi,
  type KraWorkbookParseResult,
} from "./kra-workbook";
import { weightageFraction } from "@/lib/kra/weightage";
import { isLegacyBony37pPlant } from "@/lib/unit-workspace";
import {
  departmentMasterWhereForPlant,
  plantDataScope,
} from "@/lib/unit-workspace";
import { ROSTER_DEPARTMENTS, reconcilePlantHeadEmployeesAsProduction } from "./37p-roster";
import { purgeLogisticsJunkData } from "./logistics-kra-junk";
import {
  dedupeDepartmentMasters,
  deactivateEmptyDepartments,
  departmentsAreEquivalent,
  findMatchingDepartmentInList,
  upsertDepartmentMaster,
} from "./department-master-sync";
import { resolvePlantFromWorkingLocation } from "./employee-plant-location";
import { personNamesMatch } from "@/lib/person-name";
import { parseKraIssueLine } from "./kra-workbook";

export type SyncKraWorkbookOptions = {
  plantUnitKey?: string | null;
  location?: string | null;
  sourceFileName?: string | null;
  departmentOverrides?: Record<string, string>;
  preParsed?: KraWorkbookParseResult;
};

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
  employees: KraWorkbookEmployee[],
  defaultLocation = "Bony Polymers",
  plantUnitKey?: string | null
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

  const isBonyImport = isLegacyBony37pPlant(plantUnitKey);

  const allDefs = [
    ...(isBonyImport ? ROSTER_DEPARTMENTS : []),
    ...[...extraDepts.entries()].map(([name, meta], i) => ({
      name,
      kraSheetId: meta.kraSheetId,
      location: defaultLocation,
      sortOrder: 20 + i,
    })),
  ];

  const seen = new Set<string>();
  for (const d of allDefs) {
    const dedupeKey = d.name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { department, created: wasCreated } = await upsertDepartmentMaster(
      db,
      organizationId,
      {
        name: d.name,
        location: d.location ?? defaultLocation,
        plantUnitKey,
        kraSheetId: d.kraSheetId ?? null,
        sortOrder: d.sortOrder ?? 0,
        isActive: true,
      }
    );

    deptByName.set(d.name, department.id);
    deptByName.set(`${d.name}::${department.location ?? defaultLocation}`, department.id);
    if (wasCreated) created++;
    else updated++;
  }

  await dedupeDepartmentMasters(db, organizationId, plantUnitKey);

  return { deptByName, created, updated };
}

async function upsertEmployees(
  db: PrismaClient,
  organizationId: string,
  employees: KraWorkbookEmployee[],
  deptByName: Map<string, string>,
  defaultLocation?: string | null
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  const plantLocation = defaultLocation?.trim()
    ? resolvePlantFromWorkingLocation(defaultLocation).location
    : null;
  const plantKey = plantLocation
    ? resolvePlantFromWorkingLocation(plantLocation).plantUnitKey
    : null;

  // Load master once so we map by ECN / name without creating plant duplicates.
  const masterRows = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true },
  });
  const byEcn = new Map(
    masterRows
      .filter((e) => e.ecn?.trim())
      .map((e) => [e.ecn!.trim(), e] as const)
  );

  function findExisting(row: KraWorkbookEmployee) {
    const ecnKey = isValidKraEcn(row.ecn) ? row.ecn!.trim() : null;
    if (ecnKey && byEcn.has(ecnKey)) return byEcn.get(ecnKey)!;

    const nameMatches = masterRows.filter((e) => personNamesMatch(e.name, row.name));
    if (!nameMatches.length) return null;

    if (plantKey) {
      const atPlant = nameMatches.filter(
        (e) =>
          resolvePlantFromWorkingLocation(e.location).plantUnitKey === plantKey
      );
      if (atPlant.length === 1) return atPlant[0];
      if (atPlant.length > 1) {
        const sameDept = atPlant.find((e) =>
          departmentsAreEquivalent(e.department ?? "", row.department ?? "")
        );
        return sameDept ?? atPlant[0];
      }
    }

    const sameDept = nameMatches.find((e) =>
      departmentsAreEquivalent(e.department ?? "", row.department ?? "")
    );
    return sameDept ?? nameMatches[0];
  }

  for (const row of employees) {
    const loc = plantLocation || "";
    const departmentId =
      deptByName.get(`${row.department}::${loc}`) ??
      deptByName.get(row.department) ??
      null;
    const ecnKey = isValidKraEcn(row.ecn) ? row.ecn!.trim() : null;
    const existing = findExisting(row);

    const deptName = normalizeKraDepartment(row.department ?? row.departmentRaw ?? "").masterName;
    // Plant import always assigns the plant location; never leave staff on wrong plant.
    const location =
      plantLocation ??
      (row.location?.trim()
        ? resolvePlantFromWorkingLocation(row.location).location
        : existing?.location
          ? resolvePlantFromWorkingLocation(existing.location).location
          : null);

    const data = {
      // Keep master display name when we matched an existing employee.
      name: existing?.name ?? row.name,
      designation:
        sanitizeKraDesignation(row.designation) ??
        sanitizeKraDesignation(existing?.designation) ??
        null,
      departmentId,
      department: deptName,
      location,
      doj: row.doj ?? existing?.doj ?? null,
      ecn: ecnKey ?? existing?.ecn ?? null,
      managerName: row.managerName?.trim() || existing?.managerName || null,
      sortOrder: row.sortOrder ?? existing?.sortOrder ?? 0,
      isActive: existing?.isActive ?? true,
    };

    if (existing) {
      const updatedRow = await db.employeeMaster.update({
        where: { id: existing.id },
        data,
      });
      const idx = masterRows.findIndex((e) => e.id === existing.id);
      if (idx >= 0) masterRows[idx] = updatedRow;
      if (updatedRow.ecn?.trim()) byEcn.set(updatedRow.ecn.trim(), updatedRow);
      updated++;
    } else {
      const createdRow = await db.employeeMaster.create({
        data: { organizationId, ...data },
      });
      masterRows.push(createdRow);
      if (createdRow.ecn?.trim()) byEcn.set(createdRow.ecn.trim(), createdRow);
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
  if (p.includes("freight") || p.includes("transport") || p.includes("logistic")) {
    return "Logistics";
  }
  if (p.includes("finance")) return "Finance";
  if (p.includes("quality")) return "Quality";
  if (p.includes("user") || p.includes("process")) return "Process";
  if (p.includes("security")) return "Process";
  if (p.includes("safety") || p.includes("customer")) return "Process";
  return "Logistics";
}

async function upsertIndividualKpis(
  db: PrismaClient,
  organizationId: string,
  kpis: KraWorkbookKpi[],
  adminUserId: string | null,
  plantUnitKey?: string | null
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

  const kpiIdsWithEntries: string[] = [];
  const entryRows: {
    kpiId: string;
    value: number;
    recordedAt: Date;
    enteredById: string | null | undefined;
  }[] = [];

  for (const k of kpis) {
    const id = kpiStableId(k.ownerName, k.srNo, k.name, plantUnitKey);
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
      weightage: weightageFraction(k.weightage) ?? undefined,
      plantUnit: plantUnitKey?.trim() || null,
      kpiLevel: "INDIVIDUAL",
      ownerName: k.ownerName,
      quarterTargets: JSON.stringify({
        annualTarget: k.targetAnnual,
        lastYearAchieved: k.lastYearAchieved ?? "",
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
      kpiIdsWithEntries.push(id);
      for (let i = 0; i < k.entryValues.length; i++) {
        entryRows.push({
          kpiId: id,
          value: k.entryValues[i],
          recordedAt: months[i] ?? months[months.length - 1],
          enteredById: adminUserId,
        });
      }
    }
  }

  if (kpiIdsWithEntries.length) {
    await db.kpiEntry.deleteMany({ where: { kpiId: { in: kpiIdsWithEntries } } });
    if (entryRows.length) {
      await db.kpiEntry.createMany({ data: entryRows });
      entriesCreated = entryRows.length;
    }
  }

  return { created, updated, entriesCreated };
}

function applyDepartmentOverrides(
  employees: KraWorkbookEmployee[],
  kpis: KraWorkbookKpi[],
  overrides: Record<string, string>
): void {
  if (!Object.keys(overrides).length) return;

  for (const emp of employees) {
    const picked =
      overrides[emp.sheetName] ??
      overrides[emp.name] ??
      overrides.__default__;
    if (!picked?.trim()) continue;
    const { masterName } = normalizeKraDepartment(picked);
    emp.department = masterName;
    emp.departmentRaw = picked.trim();
  }

  for (const kpi of kpis) {
    const emp = employees.find((e) => e.sheetName === kpi.sheetName);
    if (emp?.department) kpi.department = emp.department;
  }
}

async function alignEmployeesToMasterDepartments(
  db: PrismaClient,
  organizationId: string,
  employees: KraWorkbookEmployee[],
  kpis: KraWorkbookKpi[],
  plantUnitKey?: string | null
): Promise<void> {
  const where = plantUnitKey?.trim()
    ? departmentMasterWhereForPlant(organizationId, plantDataScope(plantUnitKey))
    : { organizationId };

  const departments = await db.departmentMaster.findMany({
    where: { ...where, isActive: true },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  for (const emp of employees) {
    const match =
      findMatchingDepartmentInList(emp.departmentRaw, departments) ??
      findMatchingDepartmentInList(emp.department, departments);
    if (match) {
      emp.department = match.name;
    }
  }

  for (const kpi of kpis) {
    const emp = employees.find((e) => e.sheetName === kpi.sheetName);
    if (emp?.department) kpi.department = emp.department;
  }
}

export async function syncKraWorkbook(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer,
  adminUserId?: string | null,
  options?: SyncKraWorkbookOptions
): Promise<SyncKraWorkbookResult & { parseErrors: string[] }> {
  const plantUnitKey = options?.plantUnitKey ?? null;
  const defaultLocation = options?.location ?? (plantUnitKey || "Bony Polymers");
  const sourceFile = options?.sourceFileName ?? "unknown.xlsx";
  const { employees, kpis, errors } =
    options?.preParsed ??
    parseKraWorkbook(buffer, sourceFile);
  applyDepartmentOverrides(employees, kpis, options?.departmentOverrides ?? {});
  await alignEmployeesToMasterDepartments(
    db,
    organizationId,
    employees,
    kpis,
    plantUnitKey
  );

  // Always refresh issues for this source file.
  await db.kraImportIssue.deleteMany({
    where: { organizationId, sourceFile },
  });

  if (!employees.length) {
    await persistKraImportIssues(
      db,
      organizationId,
      sourceFile,
      plantUnitKey,
      errors,
      [],
      kpis
    );
    return {
      departmentsCreated: 0,
      departmentsUpdated: 0,
      employeesCreated: 0,
      employeesUpdated: 0,
      kpisCreated: 0,
      kpisUpdated: 0,
      entriesCreated: 0,
      employeeCount: await db.employeeMaster.count({
        where: { organizationId, isActive: true },
      }),
      errors,
      parseErrors: errors,
    };
  }

  await dedupeDepartmentMasters(db, organizationId, plantUnitKey);

  const { deptByName, created: departmentsCreated, updated: departmentsUpdated } =
    await ensureDepartments(
      db,
      organizationId,
      employees,
      defaultLocation,
      plantUnitKey
    );

  const { created: employeesCreated, updated: employeesUpdated } =
    await upsertEmployees(db, organizationId, employees, deptByName, defaultLocation);

  await dedupeKraEmployees(db, organizationId, employees);

  await reconcilePlantHeadEmployeesAsProduction(db, organizationId);
  await purgeLogisticsJunkData(db, organizationId);
  await deactivateEmptyDepartments(db, organizationId, plantUnitKey);

  const {
    created: kpisCreated,
    updated: kpisUpdated,
    entriesCreated,
  } = await upsertIndividualKpis(
    db,
    organizationId,
    kpis,
    adminUserId ?? null,
    plantUnitKey
  );

  await persistKraImportIssues(
    db,
    organizationId,
    sourceFile,
    plantUnitKey,
    errors,
    employees,
    kpis
  );

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

async function persistKraImportIssues(
  db: PrismaClient,
  organizationId: string,
  sourceFile: string,
  plantUnitKey: string | null,
  errors: string[],
  employees: KraWorkbookEmployee[],
  kpis: KraWorkbookKpi[]
): Promise<void> {
  const masters = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, department: true },
  });

  for (const line of errors) {
    const parsed = parseKraIssueLine(line);
    const employeeName = parsed?.employeeName?.trim() || "Unknown";
    const sheetName = parsed?.sheetName?.trim() || null;
    const issueCode = parsed?.code || "PARSE_ERROR";
    const message =
      parsed?.message ||
      line ||
      "This KRA workbook could not be fully imported.";
    const fixHint =
      parsed?.fixHint ||
      "Upload a standard KRA/KPI Excel for this employee (Name, Department, KPI table with Weightage and Target).";

    // Skip issue if KPIs were successfully imported for this person.
    const hasKpis = kpis.some((k) => personNamesMatch(k.ownerName, employeeName));
    if (hasKpis && issueCode !== "CHECKLIST_NOT_KRA") continue;

    const master =
      masters.find((m) => personNamesMatch(m.name, employeeName)) ??
      employees
        .map((e) => masters.find((m) => personNamesMatch(m.name, e.name)))
        .find(Boolean);

    await db.kraImportIssue.create({
      data: {
        organizationId,
        employeeId: master?.id ?? null,
        employeeName: master?.name ?? employeeName,
        plantUnit: plantUnitKey,
        department: master?.department ?? null,
        sourceFile,
        sheetName,
        issueCode,
        message,
        fixHint,
        isResolved: false,
      },
    });
  }
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
