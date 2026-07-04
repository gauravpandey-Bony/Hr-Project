import "server-only";

import { db } from "@/lib/db";
import { personNameVariants, personNamesMatch } from "@/lib/person-name";
import {
  buildEmployeeDashboard,
  type EmployeeDashboardData,
} from "@/lib/ai/employee-report";

export async function fetchEmployeeProfile(
  organizationId: string,
  employeeId: string
) {
  const employee = await db.employeeMaster.findFirst({
    where: { id: employeeId, organizationId },
    include: {
      dept: { select: { id: true, name: true, location: true } },
    },
  });

  if (!employee) return null;

  const nameVariants = personNameVariants(employee.name);

  const linkedUserCandidates = await db.user.findMany({
    where: {
      organizationId,
      OR: nameVariants.map((name) => ({ name })),
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      title: true,
      department: true,
      hrisExternalId: true,
      managerId: true,
    },
  });
  const linkedUser =
    linkedUserCandidates.find((u) => personNamesMatch(u.name, employee.name)) ??
    null;

  const kpiCandidates = await db.kpi.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        ...(linkedUser ? [{ ownerId: linkedUser.id }] : []),
        ...nameVariants.map((ownerName) => ({ ownerName })),
      ],
    },
    select: {
      id: true,
      name: true,
      department: true,
      kraName: true,
      plantUnit: true,
      ownerName: true,
      ownerId: true,
      kpiLevel: true,
    },
    orderBy: [{ kraName: "asc" }, { name: "asc" }],
  });

  const kpis = kpiCandidates.filter((k) => {
    if (linkedUser && k.ownerId === linkedUser.id) return true;
    return k.ownerName ? personNamesMatch(k.ownerName, employee.name) : false;
  });

  const master = {
    name: employee.name,
    ecn: employee.ecn,
    designation: employee.designation,
    department: employee.department,
    managerName: employee.managerName,
  };

  // Always resolve performance from this employee master row (never another person).
  const resolved = { kind: "master" as const, master };

  let performance: EmployeeDashboardData | null = null;
  try {
    performance = await buildEmployeeDashboard(organizationId, resolved);
  } catch {
    performance = null;
  }

  return { employee, kpis, linkedUser, performance };
}

export function formatProfileDoj(doj: string | null | undefined): string {
  if (!doj?.trim()) return "—";
  const t = doj.trim();
  if (/^\d{5}$/.test(t)) {
    const serial = parseInt(t, 10);
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + serial * 86400000);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  return t;
}

export function formatIncrementPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function formatCtc(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const t = value.trim();
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = parseFloat(t);
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} Lakh`;
    return `₹${n.toLocaleString("en-IN")}`;
  }
  return t.startsWith("₹") ? t : `₹${t}`;
}

export async function employeeMatchesKpiOwner(
  employeeName: string,
  ownerName: string | null | undefined
): Promise<boolean> {
  if (!ownerName?.trim()) return false;
  return personNamesMatch(employeeName, ownerName);
}
