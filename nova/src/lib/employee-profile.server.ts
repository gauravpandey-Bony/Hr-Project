import "server-only";

import { db } from "@/lib/db";
import { personNamesMatch } from "@/lib/person-name";

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

  const kpis = await db.kpi.findMany({
    where: {
      organizationId,
      isActive: true,
      kpiLevel: "INDIVIDUAL",
      ownerName: employee.name,
    },
    select: {
      id: true,
      name: true,
      department: true,
      kraName: true,
      plantUnit: true,
    },
    orderBy: [{ kraName: "asc" }, { name: "asc" }],
  });

  const linkedUser = await db.user.findFirst({
    where: {
      organizationId,
      name: employee.name,
    },
    select: { id: true, email: true, role: true },
  });

  return { employee, kpis, linkedUser };
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
