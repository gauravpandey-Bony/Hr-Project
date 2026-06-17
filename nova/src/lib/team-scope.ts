import type { EmployeeMaster, Kpi, Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizePersonName, personNameVariants, personNamesMatch } from "@/lib/person-name";

export const IT_TEAM_META = {
  kpiLevel: "INDIVIDUAL",
  department: "IT",
  category: "IT",
  showPerspective: true,
} as const;

/** Employees this manager can manage (KRA/KPI fill, reports) */
export async function getManagedEmployees(user: User) {
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

  const managerKey = normalizePersonName(user.name);

  return all.filter((e) => {
    if (personNamesMatch(e.name, user.name)) return false;
    if (user.department && e.department === user.department) return true;
    if (e.managerName && personNamesMatch(e.managerName, user.name)) return true;
    if (e.managerName && normalizePersonName(e.managerName).includes(managerKey)) return true;
    return false;
  });
}

export function kpiWhereForManager(user: User): Prisma.KpiWhereInput {
  const base: Prisma.KpiWhereInput = {
    organizationId: user.organizationId,
    isActive: true,
  };

  const or: Prisma.KpiWhereInput[] = [{ ownerId: user.id }];
  for (const n of personNameVariants(user.name)) {
    or.push({ ownerName: n });
  }
  if (user.department) {
    or.push({ department: user.department });
  }

  return { ...base, OR: or };
}

export async function canManageKpi(user: User, kpi: Pick<Kpi, "ownerId" | "ownerName" | "department" | "kpiLevel">) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MANAGER") return false;
  if (kpi.ownerId === user.id) return true;
  if (user.department && kpi.department === user.department) return true;

  const team = await getManagedEmployees(user);
  if (!kpi.ownerName) return false;
  return team.some((e) => personNamesMatch(kpi.ownerName!, e.name));
}

export async function canViewEmployeeReport(user: User, employeeName: string) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MANAGER") return false;
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
  return [...byKey.values()];
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
