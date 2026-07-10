import type { PrismaClient } from "@prisma/client";
import { isDataPurgeAllowed } from "./data-safety";

/** Logistics workbook KPI tab names mistaken as employees — never show or import. */
const LOGISTICS_JUNK_PATTERN =
  /stock|ageing|vehicle|freight|gprs|vro|ship\s*to|safety|check\s*list|check\s*sheet|monitoring|capacity|route\s*optim|verif/i;

const EXACT_JUNK_NAMES = new Set([
  "vro",
  "gprs",
  "safety",
  "stock ageing",
  "stockageing monitoring logistic",
  "vehicle capacity",
  "vehicle route optimization",
  "freight invoice verification",
  "ship to local",
  "ship to out stn",
  "vehicles gprs status",
  "freight invoice verif",
  "safety no of major accidents",
  "veh check list",
  "vehicle check sheet",
]);

/** Departments that only held logistics KPI tabs — hide from KRA master sheet. */
export const KRA_HIDDEN_DEPARTMENTS = new Set(["general", "logistics"]);

export function normalizeJunkNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isLogisticsJunkName(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return true;
  const key = normalizeJunkNameKey(trimmed);
  if (EXACT_JUNK_NAMES.has(key)) return true;
  return LOGISTICS_JUNK_PATTERN.test(trimmed);
}

export function isHiddenKraDepartment(name: string | null | undefined): boolean {
  const key = (name ?? "").trim().toLowerCase();
  return !key || KRA_HIDDEN_DEPARTMENTS.has(key);
}

export function filterRealKraEmployees<T extends { name: string }>(rows: T[]): T[] {
  return rows.filter((row) => !isLogisticsJunkName(row.name));
}

/**
 * Deactivates logistics junk rows. NEVER runs unless ALLOW_DATA_PURGE=1
 * (or SEED_RESET_DATA=1). Deploy/import must not call this blindly.
 */
export async function purgeLogisticsJunkData(
  db: PrismaClient,
  organizationId: string
): Promise<{ employeesDeactivated: number; kpisDeactivated: number; skipped?: boolean }> {
  if (!isDataPurgeAllowed()) {
    console.log(
      "purgeLogisticsJunkData: skipped (set ALLOW_DATA_PURGE=1 to run explicitly)"
    );
    return { employeesDeactivated: 0, kpisDeactivated: 0, skipped: true };
  }

  const employees = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true },
  });

  const junkEmployeeIds = employees
    .filter((e) => isLogisticsJunkName(e.name))
    .map((e) => e.id);

  if (junkEmployeeIds.length) {
    await db.employeeMaster.updateMany({
      where: { id: { in: junkEmployeeIds } },
      data: { isActive: false },
    });
  }

  const kpis = await db.kpi.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, ownerName: true, name: true, kpiLevel: true },
  });

  const junkKpiIds = kpis
    .filter((k) => isLogisticsJunkName(k.ownerName))
    .map((k) => k.id);

  if (junkKpiIds.length) {
    await db.kpi.updateMany({
      where: { id: { in: junkKpiIds } },
      data: { isActive: false },
    });
  }

  await db.kpi.updateMany({
    where: {
      organizationId,
      isActive: true,
      department: { in: ["General", "Logistics"] },
      kpiLevel: "INDIVIDUAL",
    },
    data: { isActive: false },
  });

  await db.departmentMaster.updateMany({
    where: { organizationId, name: "Logistics" },
    data: { isActive: false },
  });

  const generalActiveCount = await db.employeeMaster.count({
    where: { organizationId, isActive: true, department: "General" },
  });
  if (generalActiveCount === 0) {
    await db.departmentMaster.updateMany({
      where: { organizationId, name: "General" },
      data: { isActive: false },
    });
  }

  return {
    employeesDeactivated: junkEmployeeIds.length,
    kpisDeactivated: junkKpiIds.length,
  };
}
