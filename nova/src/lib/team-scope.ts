import type { EmployeeMaster, Kpi, Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";
import {
  managerNamesMatch,
  normalizePersonName,
  personNameVariants,
  personNamesMatch,
} from "@/lib/person-name";

type TeamScopeUser = Pick<
  User,
  "id" | "name" | "role" | "organizationId" | "department"
>;

export function canEmployeeEditKpiAchieved(
  user: User,
  kpi: Pick<Kpi, "ownerName" | "kpiLevel">
): boolean {
  if (user.role !== "EMPLOYEE") return false;
  if (kpi.kpiLevel !== "INDIVIDUAL") return false;
  if (!kpi.ownerName?.trim() || !user.name?.trim()) return false;
  return personNamesMatch(kpi.ownerName, user.name);
}

export function canEditKpiTargets(user: User): boolean {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

/** Who may update a KPI, and which fields they can change. */
export async function canUpdateKpi(
  user: User,
  kpi: Pick<Kpi, "ownerId" | "ownerName" | "department" | "kpiLevel">
): Promise<"targets" | "achieved" | "both" | null> {
  // Admin can fill targets and achieved (on behalf of any employee)
  if (user.role === "ADMIN") return "both";
  // Employee fills own achieved values only
  if (canEmployeeEditKpiAchieved(user, kpi)) return "achieved";
  // Manager fills targets + achieved for self / direct reports
  if (user.role === "MANAGER" && (await canManageKpi(user, kpi))) return "both";
  return null;
}

export async function canViewEmployeeMaster(
  user: TeamScopeUser,
  employeeId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role === "EMPLOYEE") {
    const self = await db.employeeMaster.findFirst({
      where: { id: employeeId, organizationId: user.organizationId },
      select: { name: true },
    });
    return Boolean(self && personNamesMatch(self.name, user.name));
  }
  if (user.role === "MANAGER") {
    const viewable = await getViewableEmployees(user);
    return viewable.some((e) => e.id === employeeId);
  }
  return false;
}

export const IT_TEAM_META = {
  kpiLevel: "INDIVIDUAL",
  department: "IT",
  category: "IT",
  showPerspective: true,
} as const;

/** Employees this manager can manage — direct reports via reporting manager name */
export async function getManagedEmployees(user: TeamScopeUser) {
  if (user.role === "ADMIN") {
    return db.employeeMaster.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  if (user.role !== "MANAGER") return [];

  const all = await db.employeeMaster.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return all.filter((e) => {
    if (personNamesMatch(e.name, user.name)) return false;
    if (!e.managerName?.trim()) return false;
    return managerNamesMatch(e.managerName, user.name);
  });
}

/**
 * Employees a manager may view in reports / Maya: direct reports + self.
 * Admins get all active employees.
 */
export async function getViewableEmployees(
  user: TeamScopeUser
): Promise<EmployeeMaster[]> {
  if (user.role === "ADMIN") {
    return getManagedEmployees(user);
  }
  if (user.role !== "MANAGER") return [];

  const team = await getManagedEmployees(user);
  const all = await db.employeeMaster.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const self = all.filter((e) => personNamesMatch(e.name, user.name));
  return dedupeTeamMembers([...team, ...self]);
}

export async function kpiWhereForManager(user: User): Promise<Prisma.KpiWhereInput> {
  const base: Prisma.KpiWhereInput = {
    organizationId: user.organizationId,
    isActive: true,
  };

  const or: Prisma.KpiWhereInput[] = [{ ownerId: user.id }];
  for (const n of personNameVariants(user.name)) {
    or.push({ ownerName: n });
  }

  const team = await getManagedEmployees(user);
  for (const e of team) {
    for (const n of personNameVariants(e.name)) {
      or.push({ ownerName: n });
    }
  }

  return { ...base, OR: or };
}

export async function canManageKpi(user: User, kpi: Pick<Kpi, "ownerId" | "ownerName" | "department" | "kpiLevel">) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MANAGER") return false;
  if (kpi.ownerId === user.id) return true;

  const team = await getManagedEmployees(user);
  if (!kpi.ownerName) return false;
  return team.some((e) => personNamesMatch(kpi.ownerName!, e.name));
}

export async function canViewEmployeeReport(
  user: TeamScopeUser,
  employeeName: string
) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MANAGER") return false;
  if (personNamesMatch(employeeName, user.name)) return true;
  const team = await getManagedEmployees(user);
  return team.some((e) => personNamesMatch(e.name, employeeName));
}

export function dedupeTeamMembers(team: EmployeeMaster[]): EmployeeMaster[] {
  const byKey = new Map<string, EmployeeMaster>();
  for (const e of team) {
    const key = normalizePersonName(e.name);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, e);
      continue;
    }
    if (!prev.ecn?.trim() && e.ecn?.trim()) byKey.set(key, e);
  }
  return Array.from(byKey.values());
}

export function displayTeamForUser(user: User, team: EmployeeMaster[]): EmployeeMaster[] {
  const deduped = dedupeTeamMembers(team);
  if (user.role === "ADMIN") {
    const it = deduped.filter((e) => e.department === "IT");
    return it.length > 0 ? it : deduped.slice(0, 12);
  }
  return deduped;
}

export function kpisForTeamMember<T extends Kpi>(
  allKpis: T[],
  employeeName: string
): T[] {
  return allKpis.filter(
    (k) =>
      k.kpiLevel === IT_TEAM_META.kpiLevel &&
      k.department === IT_TEAM_META.department &&
      k.ownerName &&
      personNamesMatch(k.ownerName, employeeName)
  );
}
