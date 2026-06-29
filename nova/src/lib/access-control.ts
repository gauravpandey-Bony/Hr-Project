import type { Prisma, User, UserRole } from "@prisma/client";
import { mainNav, hrNav, settingsNav, type NavItem } from "@/lib/navigation";
import { adminHasUnitWorkspace, getAdminMainNav } from "@/lib/admin-unit";
import type { OrgUnit } from "@/lib/org-units";
import { DATA_UNIT_ID } from "@/lib/org-units";
import { employeeDashboardPathForUser, kpiWhereForPlantScope, type PlantDataScope } from "@/lib/unit-workspace";
import { kpiWhereForManager } from "@/lib/team-scope";

export const ROLE_COOKIE = "nova_user_role";

/** KPI dashboard with uploaded data (Bony 37P) */
export const KPI_DASHBOARD_PATH = `/dashboard/units/${DATA_UNIT_ID}`;

/** Admin-only unit tile picker */
export const UNIT_PICKER_PATH = "/dashboard";

/** Dashboard paths employees may open */
const EMPLOYEE_ALLOWED = [
  KPI_DASHBOARD_PATH,
  "/dashboard/kpis",
  "/dashboard/track",
  "/dashboard/reviews",
  "/dashboard/kra",
  "/dashboard/reports/quarterly",
] as const;

/** Managers cannot edit department master */
const MANAGER_BLOCKED_PREFIXES = ["/dashboard/masters/departments"] as const;

/** Blocked for employees (checked before allow-list) */
const EMPLOYEE_BLOCKED_PREFIXES = [
  "/dashboard/masters",
  "/dashboard/reports",
  "/dashboard/ai",
  "/dashboard/feedback",
  "/dashboard/goals",
  "/dashboard/surveys",
  "/dashboard/analytics",
  "/dashboard/calibration",
  "/dashboard/compensation",
  "/dashboard/settings",
  "/dashboard/kpis/create",
  "/dashboard/reviews/new",
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
  if (role === "MANAGER") return KPI_DASHBOARD_PATH;
  return KPI_DASHBOARD_PATH;
}

export function canAccessDashboardPath(role: UserRole, pathname: string): boolean {
  if (pathname === UNIT_PICKER_PATH && !canAccessUnitPicker(role)) {
    return false;
  }

  if (role === "MANAGER") {
    for (const blocked of MANAGER_BLOCKED_PREFIXES) {
      if (pathname === blocked || pathname.startsWith(`${blocked}/`)) {
        return false;
      }
    }
    return true;
  }

  if (role !== "EMPLOYEE") return true;

  if (pathname.startsWith("/dashboard/units/")) return true;

  if (
    pathname === "/dashboard/reports/quarterly" ||
    pathname.startsWith("/dashboard/reports/quarterly/")
  ) {
    return true;
  }

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

export function employeeDashboardRedirect(userId?: string): string {
  if (userId) return employeeDashboardPathForUser(userId);
  return KPI_DASHBOARD_PATH;
}

export function managerDashboardRedirect(pathname: string): string {
  if (pathname === UNIT_PICKER_PATH) {
    return KPI_DASHBOARD_PATH;
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

/** Scope KPI queries to a plant / unit workspace */
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
  const base = { organizationId: user.organizationId };
  if (user.role === "ADMIN") return base;
  if (user.role === "MANAGER" && user.department) {
    return { ...base, department: user.department, isActive: true };
  }
  if (user.role === "EMPLOYEE" && user.name?.trim()) {
    return { ...base, name: user.name.trim() };
  }
  if (user.role === "EMPLOYEE") return { ...base, id: "__none__" };
  return base;
}

export function employeeMasterWhereForUser(
  user: User
): Prisma.EmployeeMasterWhereInput {
  const base = { organizationId: user.organizationId };
  if (user.role !== "EMPLOYEE") {
    if (user.role === "MANAGER" && user.department) {
      return { ...base, department: user.department, isActive: true };
    }
    return base;
  }

  if (user.name?.trim()) {
    return { ...base, name: user.name.trim() };
  }

  return { ...base, id: "__none__" };
}

export function getMainNavForRole(role: UserRole): NavItem[] {
  if (role === "EMPLOYEE") {
    return mainNav
      .filter((item) =>
        [
          KPI_DASHBOARD_PATH,
          "/dashboard/kpis",
          "/dashboard/track",
          "/dashboard/kra",
        ].includes(item.href)
      )
      .concat([
        {
          href: "/dashboard/reports/quarterly",
          label: "Quarterly Report",
          icon: mainNav.find((i) => i.href === "/dashboard/reports")?.icon,
          keywords: ["quarter", "q1", "q2", "achievement", "report"],
        },
      ])
      .map((item) =>
        item.href === KPI_DASHBOARD_PATH
          ? { ...item, label: "My Dashboard" }
          : item.href === "/dashboard/kpis"
            ? { ...item, label: "My KPIs" }
            : item.href === "/dashboard/kra"
              ? { ...item, label: "My KRA Sheet" }
              : item
      );
  }

  if (role === "MANAGER") {
    return mainNav.filter(
      (item) =>
        item.href !== UNIT_PICKER_PATH &&
        item.href !== "/dashboard/masters/departments"
    );
  }

  return mainNav;
}

export function getHrNavForRole(role: UserRole): NavItem[] {
  if (role !== "EMPLOYEE") return hrNav;
  return hrNav
    .filter((item) => item.href === "/dashboard/reviews")
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
      ? "KPI tracking"
      : item.href === settingsNav.href
        ? "System"
        : "People & HR",
  }));
}
