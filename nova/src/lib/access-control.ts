import type { Prisma, User, UserRole } from "@prisma/client";
import {
  mainNav,
  hrNav,
  settingsNav,
  DEPARTMENT_MASTER_PATH,
  type NavItem,
} from "@/lib/navigation";
import { adminHasUnitWorkspace, getAdminMainNav } from "@/lib/admin-unit";
import type { OrgUnit } from "@/lib/org-units";
import { kpiWhereForPlantScope, type PlantDataScope } from "@/lib/unit-workspace";
import { kpiWhereForManager } from "@/lib/team-scope";

export const ROLE_COOKIE = "nova_user_role";

/** Admin-only unit tile picker */
export const UNIT_PICKER_PATH = "/dashboard";

const REVIEWS_PATH = "/dashboard/reviews";

/** KPI/KRA features removed — redirect these paths */
export const REMOVED_KPI_PATH_PREFIXES = [
  "/dashboard/kpis",
  "/dashboard/kra",
  "/dashboard/track",
  "/dashboard/reports",
  "/dashboard/ai",
  "/dashboard/units/",
  "/dashboard/masters/employees",
  "/dashboard/reports/employee",
  "/dashboard/team",
] as const;

export function isRemovedKpiPath(pathname: string): boolean {
  return REMOVED_KPI_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

/** Dashboard paths employees may open */
const EMPLOYEE_ALLOWED = [REVIEWS_PATH] as const;

/** Managers cannot edit department master */
const MANAGER_BLOCKED_PREFIXES = [DEPARTMENT_MASTER_PATH] as const;

/** Blocked for employees (checked before allow-list) */
const EMPLOYEE_BLOCKED_PREFIXES = [
  "/dashboard/masters",
  "/dashboard/feedback",
  "/dashboard/goals",
  "/dashboard/surveys",
  "/dashboard/analytics",
  "/dashboard/calibration",
  "/dashboard/compensation",
  "/dashboard/settings",
  "/dashboard/reviews/new",
  ...REMOVED_KPI_PATH_PREFIXES,
];

export function isEmployeeRole(role: UserRole): boolean {
  return role === "EMPLOYEE";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canAccessUnitPicker(role: UserRole): boolean {
  return role === "ADMIN";
}

/** Default landing page after login, by role */
export function roleHomeRedirect(role: UserRole): string {
  if (role === "ADMIN") return UNIT_PICKER_PATH;
  return REVIEWS_PATH;
}

export function departmentMasterRedirect(unitId?: string | null): string {
  if (!unitId) return DEPARTMENT_MASTER_PATH;
  return `${DEPARTMENT_MASTER_PATH}?unit=${encodeURIComponent(unitId)}`;
}

export function canAccessDashboardPath(role: UserRole, pathname: string): boolean {
  if (isRemovedKpiPath(pathname)) return false;

  if (pathname === UNIT_PICKER_PATH && !canAccessUnitPicker(role)) {
    return false;
  }

  if (role === "ADMIN") return true;

  if (role === "MANAGER") {
    for (const blocked of MANAGER_BLOCKED_PREFIXES) {
      if (pathname === blocked || pathname.startsWith(`${blocked}/`)) {
        return false;
      }
    }
    return true;
  }

  if (role !== "EMPLOYEE") return true;

  for (const blocked of EMPLOYEE_BLOCKED_PREFIXES) {
    if (pathname === blocked || pathname.startsWith(`${blocked}/`)) {
      return false;
    }
  }

  if (pathname === UNIT_PICKER_PATH) return false;

  for (const allowed of EMPLOYEE_ALLOWED) {
    if (pathname === allowed || pathname.startsWith(`${allowed}/`)) {
      return true;
    }
  }

  return false;
}

export function employeeDashboardRedirect(_userId?: string): string {
  return REVIEWS_PATH;
}

export function managerDashboardRedirect(pathname: string): string {
  if (pathname === UNIT_PICKER_PATH || isRemovedKpiPath(pathname)) {
    return REVIEWS_PATH;
  }
  return roleHomeRedirect("MANAGER");
}

export function kpiWhereForUser(user: User): Prisma.KpiWhereInput {
  const base: Prisma.KpiWhereInput = {
    organizationId: user.organizationId,
    isActive: true,
  };

  if (user.role === "MANAGER") return kpiWhereForManager(user);

  if (user.role !== "EMPLOYEE") return base;

  const or: Prisma.KpiWhereInput[] = [{ ownerId: user.id }];
  const name = user.name?.trim();
  if (name) or.push({ ownerName: name });

  return { ...base, OR: or };
}

export function mergeKpiWhere(
  user: User,
  extra?: Prisma.KpiWhereInput
): Prisma.KpiWhereInput {
  const scoped = kpiWhereForUser(user);
  if (!extra || Object.keys(extra).length === 0) return scoped;
  return { AND: [scoped, extra] };
}

export function mergeKpiWhereForUnit(
  user: User,
  scope: PlantDataScope | string,
  extra?: Prisma.KpiWhereInput
): Prisma.KpiWhereInput {
  const plantFilter =
    typeof scope === "string"
      ? { plantUnit: scope }
      : kpiWhereForPlantScope(scope);
  return mergeKpiWhere(user, { ...plantFilter, ...extra });
}

export function mergeKpiWhereForWorkspace(
  user: User,
  dataScope: PlantDataScope | null | undefined,
  extra?: Prisma.KpiWhereInput
): Prisma.KpiWhereInput {
  if (dataScope) {
    return mergeKpiWhereForUnit(user, dataScope, extra);
  }
  return mergeKpiWhere(user, extra);
}

export function reviewAssignmentWhereForUser(
  user: User
): Prisma.ReviewAssignmentWhereInput {
  const base: Prisma.ReviewAssignmentWhereInput = {
    cycle: { organizationId: user.organizationId },
  };

  if (user.role === "ADMIN") return base;

  return {
    ...base,
    OR: [{ reviewerId: user.id }, { revieweeId: user.id }],
  };
}

export function canAccessReviewAssignment(
  user: User,
  assignment: { reviewerId: string; revieweeId: string }
): boolean {
  if (user.role === "ADMIN") return true;
  return (
    assignment.reviewerId === user.id || assignment.revieweeId === user.id
  );
}

export async function employeeMasterWhereForUserAsync(
  user: User
): Promise<Prisma.EmployeeMasterWhereInput> {
  return { organizationId: user.organizationId, id: "__none__" };
}

export function employeeMasterWhereForUser(
  user: User
): Prisma.EmployeeMasterWhereInput {
  return { organizationId: user.organizationId, id: "__none__" };
}

export function getMainNavForRole(role: UserRole): NavItem[] {
  if (role === "ADMIN") {
    return mainNav;
  }

  if (role === "MANAGER") {
    return mainNav.filter((item) => item.href !== UNIT_PICKER_PATH);
  }

  return [];
}

export function getHrNavForRole(role: UserRole): NavItem[] {
  if (role !== "EMPLOYEE") return hrNav;
  return hrNav
    .filter((item) => item.href === REVIEWS_PATH)
    .map((item) => ({ ...item, label: "My Reviews" }));
}

export function getSettingsNavForRole(role: UserRole): NavItem | null {
  if (role === "EMPLOYEE") return null;
  return settingsNav;
}

export function getCommandPaletteItemsForRole(
  role: UserRole,
  adminUnitId?: string | null,
  catalog: OrgUnit[] = []
) {
  const main =
    role === "ADMIN"
      ? getAdminMainNav(adminUnitId, catalog)
      : getMainNavForRole(role);

  const hr =
    role === "ADMIN" && !adminHasUnitWorkspace(adminUnitId, catalog)
      ? []
      : getHrNavForRole(role);

  const items = [
    ...main,
    ...hr,
    ...(getSettingsNavForRole(role) ? [getSettingsNavForRole(role)!] : []),
  ];

  return items.map((item) => ({
    ...item,
    group: main.some((m) => m.href === item.href)
      ? "Master data"
      : item.href === settingsNav.href
        ? "System"
        : "People & HR",
  }));
}
