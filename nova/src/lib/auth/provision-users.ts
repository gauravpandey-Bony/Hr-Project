import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { personNamesMatch } from "@/lib/person-name";
import {
  buildEcnToNameMap,
  isEmployeeCode,
  resolveReportingManagerName,
} from "@/lib/reporting-manager";

export type ProvisionUsersResult = {
  created: number;
  updated: number;
  managers: number;
  skipped: number;
};

function userIdForEcn(ecn: string): string {
  return `emp-${ecn.trim()}`;
}

function emailForEcn(ecn: string): string {
  return `${ecn.trim()}@bonypolymers.local`;
}

/** Create or refresh login accounts from Employee Master (ECN = user id + initial password). */
export async function provisionUsersFromEmployees(
  organizationId: string,
  options?: { resetPasswords?: boolean }
): Promise<ProvisionUsersResult> {
  const employees = await db.employeeMaster.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const ecnLookup = buildEcnToNameMap(employees);
  const managerNames = new Set<string>();

  for (const emp of employees) {
    const ref = emp.managerName?.trim();
    if (!ref) continue;
    const resolved = resolveReportingManagerName(ref, employees);
    if (resolved) managerNames.add(resolved);
  }

  const result: ProvisionUsersResult = {
    created: 0,
    updated: 0,
    managers: 0,
    skipped: 0,
  };

  const userByName = new Map<string, string>();

  for (const emp of employees) {
    const ecn = emp.ecn?.trim();
    if (!ecn) {
      result.skipped++;
      continue;
    }

    const id = userIdForEcn(ecn);
    const email = emailForEcn(ecn);
    const isManager = [...managerNames].some((m) => personNamesMatch(m, emp.name));
    const role: UserRole = isManager ? "MANAGER" : "EMPLOYEE";
    if (isManager) result.managers++;

    const existing = await db.user.findFirst({
      where: {
        organizationId,
        OR: [{ id }, { hrisExternalId: ecn }, { email }],
      },
    });

    const passwordHash = await hashPassword(ecn);
    const mustChangePassword = options?.resetPasswords ? true : !existing;

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: emp.name,
          title: emp.designation,
          department: emp.department,
          hrisExternalId: ecn,
          role,
          ...(options?.resetPasswords
            ? { passwordHash, mustChangePassword: true, passwordChangedAt: null }
            : {}),
        },
      });
      userByName.set(emp.name, existing.id);
      result.updated++;
    } else {
      await db.user.create({
        data: {
          id,
          organizationId,
          email,
          name: emp.name,
          role,
          title: emp.designation,
          department: emp.department,
          hrisExternalId: ecn,
          passwordHash,
          mustChangePassword,
        },
      });
      userByName.set(emp.name, id);
      result.created++;
    }
  }

  // Link managerId on User rows from EmployeeMaster.managerName
  for (const emp of employees) {
    const ecn = emp.ecn?.trim();
    if (!ecn) continue;

    const userId = userByName.get(emp.name) ?? userIdForEcn(ecn);
    const managerRef = emp.managerName?.trim();
    if (!managerRef) continue;

    let managerName = resolveReportingManagerName(managerRef, employees);
    if (isEmployeeCode(managerRef)) {
      managerName = ecnLookup.get(managerRef) ?? managerName;
    }

    const managerUserId = [...userByName.entries()].find(([name]) =>
      personNamesMatch(name, managerName)
    )?.[1];

    if (managerUserId && managerUserId !== userId) {
      await db.user.update({
        where: { id: userId },
        data: { managerId: managerUserId },
      });
    }
  }

  return result;
}
