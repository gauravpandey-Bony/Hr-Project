import { db } from "@/lib/db";
import {
  mergeKpiWhereForWorkspace,
  reviewAssignmentWhereForUser,
} from "@/lib/access-control";
import {
  departmentMasterWhereForPlant,
  employeeMasterWhereForPlant,
} from "@/lib/unit-workspace";
import { formatKpiValue } from "@/lib/kpi";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { COMPANY } from "@/lib/company";
import { normalizePersonName } from "@/lib/person-name";
import { formatDepartmentDisplayName } from "@/lib/masters/department-master-sync";
import type { User } from "@prisma/client";

import { plantDataScope, type PlantDataScope } from "@/lib/unit-workspace";

export type WorkspaceScope = {
  plantUnitKey: string | null;
  unitName: string | null;
  dataScope: PlantDataScope | null;
};

export async function buildOrganizationContext(
  user: User,
  scope?: WorkspaceScope
) {
  const organizationId = user.organizationId;
  const scoped = user.role === "EMPLOYEE";
  const plantUnitKey = scope?.plantUnitKey ?? null;
  const unitName = scope?.unitName ?? null;
  const dataScope =
    scope?.dataScope ??
    (plantUnitKey ? plantDataScope(plantUnitKey) : null);

  const employeeWhere =
    dataScope && !scoped
      ? { ...employeeMasterWhereForPlant(organizationId, dataScope), isActive: true }
      : { organizationId, isActive: true };

  const deptWhere = dataScope
    ? { ...departmentMasterWhereForPlant(organizationId, dataScope), isActive: true }
    : { organizationId, isActive: true };

  const [
    org,
    users,
    kpis,
    goals,
    cycles,
    assignments,
    feedbackCampaigns,
    surveys,
    compensation,
    placements,
    employees,
    departments,
    plants,
  ] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId } }),
    db.user.findMany({
      where: scoped ? { id: user.id } : { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        title: true,
        department: true,
      },
    }),
    db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, dataScope),
      include: {
        entries: { orderBy: { recordedAt: "desc" }, take: 3 },
        owner: { select: { name: true } },
      },
    }),
    db.goal.findMany({
      where: scoped
        ? { organizationId, ownerId: user.id }
        : { organizationId },
      include: { owner: { select: { name: true } } },
    }),
    db.reviewCycle.findMany({
      where: { organizationId },
      include: { _count: { select: { assignments: true } } },
      ...(scoped ? { take: 0 } : {}),
    }),
    db.reviewAssignment.findMany({
      where: reviewAssignmentWhereForUser(user),
      include: {
        reviewee: { select: { name: true } },
        cycle: { select: { name: true } },
      },
      take: 50,
    }),
    db.feedback360Campaign.findMany({
      where: { organizationId },
      include: { _count: { select: { responses: true } } },
      ...(scoped ? { take: 0 } : {}),
    }),
    db.survey.findMany({
      where: { organizationId },
      include: { _count: { select: { responses: true } } },
      ...(scoped ? { take: 0 } : {}),
    }),
    db.compensationRecommendation.findMany({
      where: scoped
        ? { employeeId: user.id }
        : { employee: { organizationId } },
      include: { employee: { select: { name: true } } },
      take: 20,
    }),
    db.nineBoxPlacement.findMany({
      where: scoped
        ? { userId: user.id }
        : { session: { organizationId } },
      include: { user: { select: { name: true } } },
    }),
    db.employeeMaster.findMany({
      where: employeeWhere,
      select: {
        name: true,
        ecn: true,
        department: true,
        designation: true,
        location: true,
        managerName: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 500,
    }),
    db.departmentMaster.findMany({
      where: deptWhere,
      select: { name: true, location: true, headName: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 80,
    }),
    db.orgUnitMaster.findMany({
      where: { organizationId, isActive: true },
      select: { name: true, slug: true, plantUnitKey: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const unitNameSet = new Set(
    employees.map((e) => normalizePersonName(e.name))
  );

  const kpiOwnerNames = new Set(
    kpis
      .map((k) => k.owner?.name)
      .filter((n): n is string => Boolean(n))
      .map((n) => normalizePersonName(n))
  );

  const filteredUsers =
    dataScope && !scoped
      ? users.filter(
          (u) =>
            unitNameSet.has(normalizePersonName(u.name)) ||
            kpiOwnerNames.has(normalizePersonName(u.name))
        )
      : users;

  const kpiSummary = kpis.map((k) => {
    const { current, progressNum, status } = evaluateKpiCurrent(k);
    return {
      name: k.name,
      category: k.category,
      current: formatKpiValue(current, k.unit),
      target: formatKpiValue(k.targetValue, k.unit),
      progress: `${progressNum}%`,
      status,
      frequency: k.frequency,
      department: k.department,
      owner: k.owner?.name,
      recentEntries: k.entries.map((e) => ({
        value: e.value,
        date: e.recordedAt.toISOString().slice(0, 10),
      })),
    };
  });

  const pendingReviews = assignments.filter((a) => a.status !== "SUBMITTED");

  const departmentHeadcount: Record<string, number> = {};
  for (const emp of employees) {
    const key = emp.department?.trim();
    if (!key) continue;
    const display = formatDepartmentDisplayName(key);
    departmentHeadcount[display] = (departmentHeadcount[display] ?? 0) + 1;
  }

  const employeeLocations = [
    ...new Set(employees.map((e) => e.location).filter((l): l is string => Boolean(l?.trim()))),
  ];

  const kpiHealth = { green: 0, amber: 0, red: 0 };
  for (const k of kpiSummary) {
    if (k.status === "green") kpiHealth.green++;
    else if (k.status === "amber") kpiHealth.amber++;
    else if (k.status === "red") kpiHealth.red++;
  }

  const workspaceLabel =
    !dataScope && !scoped
      ? `${COMPANY.shortName} — all units`
      : unitName ?? plantUnitKey ?? COMPANY.shortName;

  return {
    company: org?.name ?? COMPANY.name,
    workspace: workspaceLabel,
    plantUnitKey,
    unitName,
    orgWide: Boolean(!dataScope && !scoped),
    generatedAt: new Date().toISOString(),
    stats: {
      employees: filteredUsers.length,
      employeeMaster: employees.length,
      kpis: kpis.length,
      goals: goals.length,
      activeCycles: cycles.filter((c) => c.status === "ACTIVE").length,
      pendingReviews: pendingReviews.length,
      feedbackCampaigns: feedbackCampaigns.length,
      surveys: surveys.length,
    },
    users: filteredUsers,
    employees,
    departments,
    plants,
    departmentHeadcount,
    employeeLocations,
    kpiHealth,
    kpis: kpiSummary,
    goals: goals.map((g) => ({
      title: g.title,
      level: g.level,
      owner: g.owner.name,
      progress: `${g.currentValue}/${g.targetValue ?? "—"} ${g.unit ?? ""}`,
      status: g.status,
    })),
    reviewCycles: cycles.map((c) => ({
      name: c.name,
      status: c.status,
      assignments: c._count.assignments,
    })),
    pendingReviews: pendingReviews.map((a) => ({
      type: a.reviewType,
      reviewee: a.reviewee.name,
      cycle: a.cycle.name,
      status: a.status,
    })),
    feedback: feedbackCampaigns.map((f) => ({
      name: f.name,
      status: f.status,
      responses: f._count.responses,
      aiSummary: f.aiSummary?.slice(0, 200),
    })),
    surveys: surveys.map((s) => ({
      title: s.title,
      responses: s._count.responses,
      status: s.status,
    })),
    compensation: compensation.map((c) => ({
      employee: c.employee.name,
      rating: c.performanceRating,
      merit: c.suggestedMeritPct,
      bonus: c.suggestedBonusPct,
    })),
    nineBox: placements.map((p) => ({
      employee: p.user.name,
      performance: p.performance,
      potential: p.potential,
    })),
  };
}

export type OrgContext = Awaited<ReturnType<typeof buildOrganizationContext>>;
