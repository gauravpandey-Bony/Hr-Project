import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

const DEPT_NAME_ALIASES: Record<string, string[]> = {
  "Quality Assurance": ["Quality", "QA", "Quality Assurance"],
  Production: ["Production"],
  Billing: ["Billing"],
  Store: ["Store"],
  Maintenance: ["Maintenance"],
  IT: ["IT", "Information Technology"],
  "MD Office": ["MD Office", "Md Office", "MDO"],
};

function departmentVariants(departmentName: string): string[] {
  const base = departmentName.trim();
  const aliases = DEPT_NAME_ALIASES[base] ?? [base];
  return [...new Set([base, ...aliases])];
}

async function findLinkedUserId(
  organizationId: string,
  employeeName: string,
  ecn: string | null | undefined
) {
  if (ecn) {
    const byEcn = await db.user.findFirst({
      where: { organizationId, hrisExternalId: ecn },
      select: { id: true },
    });
    if (byEcn) return byEcn.id;
  }
  const byName = await db.user.findFirst({
    where: { organizationId, name: employeeName },
    select: { id: true },
  });
  return byName?.id ?? null;
}

type KpiCreatePayload = {
  organizationId: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  targetValue: number;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  department: string;
  perspective: string | null;
  kraName: string | null;
  weightage: number | null;
  plantUnit: string | null;
  kpiLevel: string;
  ownerName: string;
  ownerId: string | null;
  quarterTargets: string | null;
};

function fromDbTemplate(
  template: {
    name: string;
    description: string | null;
    category: string;
    unit: string;
    targetValue: number;
    direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    perspective: string | null;
    kraName: string | null;
    weightage: number | null;
    plantUnit: string | null;
    quarterTargets: string | null;
  },
  organizationId: string,
  departmentName: string,
  employeeName: string,
  ownerUserId: string | null
): KpiCreatePayload {
  return {
    organizationId,
    name: template.name,
    description: template.description,
    category: template.category,
    unit: template.unit,
    targetValue: template.targetValue,
    direction: template.direction,
    frequency: template.frequency,
    department: departmentName,
    perspective: template.perspective,
    kraName: template.kraName,
    weightage: template.weightage,
    plantUnit: template.plantUnit,
    kpiLevel: "INDIVIDUAL",
    ownerName: employeeName,
    ownerId: ownerUserId,
    quarterTargets: template.quarterTargets,
  };
}

export type AssignDepartmentKpisResult = {
  assigned: number;
  skipped: number;
  kpiNames: string[];
};

/** Clone department-level KPI templates from DB onto an employee. */
export async function assignDepartmentKpisToEmployee(
  organizationId: string,
  employee: {
    name: string;
    department: string | null;
    ecn?: string | null;
  },
  client: PrismaClient = db
): Promise<AssignDepartmentKpisResult> {
  const departmentName = employee.department?.trim();
  if (!departmentName) {
    return { assigned: 0, skipped: 0, kpiNames: [] };
  }

  const employeeName = employee.name.trim();
  const ownerUserId = await findLinkedUserId(
    organizationId,
    employeeName,
    employee.ecn
  );

  const existing = await client.kpi.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { ownerName: employeeName },
        ...(ownerUserId ? [{ ownerId: ownerUserId }] : []),
      ],
    },
    select: { name: true },
  });
  const existingNames = new Set(
    existing.map((k) => k.name.trim().toLowerCase())
  );

  const deptKpis = await client.kpi.findMany({
    where: {
      organizationId,
      isActive: true,
      department: { in: departmentVariants(departmentName) },
    },
  });

  const dbTemplates = deptKpis.filter(
    (k) =>
      k.kpiLevel === "DEPARTMENT" ||
      (!k.ownerName?.trim() && k.kpiLevel !== "PLANT")
  );

  const toCreate: KpiCreatePayload[] = [];

  for (const t of dbTemplates) {
    const key = t.name.trim().toLowerCase();
    if (existingNames.has(key)) continue;
    existingNames.add(key);
    toCreate.push(
      fromDbTemplate(t, organizationId, departmentName, employeeName, ownerUserId)
    );
  }

  if (toCreate.length === 0) {
    return { assigned: 0, skipped: existing.size, kpiNames: [] };
  }

  await client.$transaction(
    toCreate.map((data) => client.kpi.create({ data }))
  );

  return {
    assigned: toCreate.length,
    skipped: existing.size,
    kpiNames: toCreate.map((k) => k.name),
  };
}
