import { PrismaClient } from "@prisma/client";
import { ALL_PLANT_KPIS, PLANT_UNIT } from "../src/lib/plant-37p";
import { DEFAULT_DEPARTMENTS, DEFAULT_EMPLOYEES } from "../src/lib/master-defaults";
import { sync37pFromDefaultFile } from "../src/lib/masters/sync-37p";
import { syncKraFromDefaultFile } from "../src/lib/masters/sync-kra-workbook";
import { syncPlantKraFromDefaultFile } from "../src/lib/masters/sync-plant-kra-workbook";
import {
  ensureAllKpisHaveQuarterTargets,
  syncAllQuarterTargetsToEntries,
} from "../src/lib/kpi-quarters";
import { DEMO_ACCOUNTS } from "../src/lib/demo-accounts";
import { ROSTER_DEPARTMENTS } from "../src/lib/masters/37p-roster";

const db = new PrismaClient();

const ORG_SLUG = "bony-polymers";
const ORG_NAME = "Bony Polymers Pvt Ltd";

const defaultFormSchema = JSON.stringify({
  sections: [
    {
      id: "accomplishments",
      title: "Accomplishments",
      questions: [
        {
          id: "key_wins",
          type: "textarea",
          label: "What were your top accomplishments this period?",
          required: true,
        },
        {
          id: "impact",
          type: "textarea",
          label: "How did your work support plant, quality, or business goals?",
          required: true,
        },
      ],
    },
    {
      id: "competencies",
      title: "Competencies",
      questions: [
        {
          id: "safety",
          type: "rating",
          label: "Safety & compliance mindset",
          required: true,
        },
        {
          id: "quality",
          type: "rating",
          label: "Quality & process discipline",
          required: true,
        },
        {
          id: "teamwork",
          type: "rating",
          label: "Teamwork & communication",
          required: true,
        },
      ],
    },
    {
      id: "development",
      title: "Development",
      questions: [
        {
          id: "strengths",
          type: "textarea",
          label: "Key strengths to leverage",
          required: false,
        },
        {
          id: "development_areas",
          type: "textarea",
          label: "Areas for development",
          required: false,
        },
      ],
    },
  ],
});

const defaultRatingScale = JSON.stringify({
  type: "likert",
  min: 1,
  max: 5,
  labels: ["Needs improvement", "Developing", "Meets expectations", "Exceeds", "Exceptional"],
});

async function main() {
  const org = await db.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: ORG_NAME, slug: ORG_SLUG },
    update: { name: ORG_NAME },
  });

  const adminDef = DEMO_ACCOUNTS.admin;
  const managerDef = DEMO_ACCOUNTS.manager;
  const itManagerDef = DEMO_ACCOUNTS.itManager;
  const rajKumarDef = DEMO_ACCOUNTS.rajKumar;
  const employeeDef = DEMO_ACCOUNTS.employee;
  const sikandarKhanDef = DEMO_ACCOUNTS.sikandarKhan;
  const sudhaDef = DEMO_ACCOUNTS.sudhaJetli;

  for (const def of [
    adminDef,
    managerDef,
    itManagerDef,
    rajKumarDef,
    employeeDef,
    sikandarKhanDef,
    sudhaDef,
  ]) {
    await db.user.deleteMany({
      where: {
        organizationId: org.id,
        email: def.email,
        id: { not: def.userId },
      },
    });
  }

  const admin = await db.user.upsert({
    where: { id: adminDef.userId },
    create: {
      id: adminDef.userId,
      organizationId: org.id,
      email: adminDef.email,
      name: adminDef.name,
      role: adminDef.role,
      title: adminDef.title,
      department: adminDef.department,
      hrisExternalId: adminDef.ecn,
    },
    update: {
      email: adminDef.email,
      name: adminDef.name,
      role: adminDef.role,
      title: adminDef.title,
      department: adminDef.department,
      hrisExternalId: adminDef.ecn,
    },
  });

  const manager = await db.user.upsert({
    where: { id: managerDef.userId },
    create: {
      id: managerDef.userId,
      organizationId: org.id,
      email: managerDef.email,
      name: managerDef.name,
      role: managerDef.role,
      title: managerDef.title,
      department: managerDef.department,
      managerId: admin.id,
      hrisExternalId: managerDef.ecn,
      teamsUserId: "teams-praveen-kumar",
    },
    update: {
      email: managerDef.email,
      name: managerDef.name,
      role: managerDef.role,
      title: managerDef.title,
      department: managerDef.department,
      managerId: admin.id,
      hrisExternalId: managerDef.ecn,
    },
  });

  const itManager = await db.user.upsert({
    where: { id: itManagerDef.userId },
    create: {
      id: itManagerDef.userId,
      organizationId: org.id,
      email: itManagerDef.email,
      name: itManagerDef.name,
      role: itManagerDef.role,
      title: itManagerDef.title,
      department: itManagerDef.department,
      managerId: admin.id,
      hrisExternalId: itManagerDef.ecn,
      teamsUserId: "teams-bhupesh-sharma",
    },
    update: {
      email: itManagerDef.email,
      name: itManagerDef.name,
      role: itManagerDef.role,
      title: itManagerDef.title,
      department: itManagerDef.department,
      managerId: admin.id,
      hrisExternalId: itManagerDef.ecn,
    },
  });

  const rajKumar = await db.user.upsert({
    where: { id: rajKumarDef.userId },
    create: {
      id: rajKumarDef.userId,
      organizationId: org.id,
      email: rajKumarDef.email,
      name: rajKumarDef.name,
      role: rajKumarDef.role,
      title: rajKumarDef.title,
      department: rajKumarDef.department,
      managerId: admin.id,
      hrisExternalId: rajKumarDef.ecn,
      teamsUserId: "teams-raj-kumar",
    },
    update: {
      email: rajKumarDef.email,
      name: rajKumarDef.name,
      role: rajKumarDef.role,
      title: rajKumarDef.title,
      department: rajKumarDef.department,
      managerId: admin.id,
    },
  });

  await db.user.deleteMany({
    where: { id: "demo-plant-head", organizationId: org.id },
  });

  const employee = await db.user.upsert({
    where: { id: employeeDef.userId },
    create: {
      id: employeeDef.userId,
      organizationId: org.id,
      email: employeeDef.email,
      name: employeeDef.name,
      role: employeeDef.role,
      title: employeeDef.title,
      department: employeeDef.department,
      managerId: rajKumar.id,
      teamsUserId: "teams-mahima",
    },
    update: {
      email: employeeDef.email,
      name: employeeDef.name,
      role: employeeDef.role,
      title: employeeDef.title,
      department: employeeDef.department,
      managerId: rajKumar.id,
    },
  });

  const sikandarKhan = await db.user.upsert({
    where: { id: sikandarKhanDef.userId },
    create: {
      id: sikandarKhanDef.userId,
      organizationId: org.id,
      email: sikandarKhanDef.email,
      name: sikandarKhanDef.name,
      role: sikandarKhanDef.role,
      title: sikandarKhanDef.title,
      department: sikandarKhanDef.department,
      managerId: itManager.id,
      teamsUserId: "teams-sikandar-khan",
    },
    update: {
      email: sikandarKhanDef.email,
      name: sikandarKhanDef.name,
      role: sikandarKhanDef.role,
      title: sikandarKhanDef.title,
      department: sikandarKhanDef.department,
      managerId: itManager.id,
    },
  });

  const sudha = await db.user.upsert({
    where: { id: sudhaDef.userId },
    create: {
      id: sudhaDef.userId,
      organizationId: org.id,
      email: sudhaDef.email,
      name: sudhaDef.name,
      role: sudhaDef.role,
      title: sudhaDef.title,
      department: sudhaDef.department,
      managerId: rajKumar.id,
      teamsUserId: "teams-sudha-jetli",
    },
    update: {
      email: sudhaDef.email,
      name: sudhaDef.name,
      role: sudhaDef.role,
      title: sudhaDef.title,
      department: sudhaDef.department,
      managerId: rajKumar.id,
    },
  });

  const template = await db.reviewTemplate.upsert({
    where: { id: "default-template" },
    create: {
      id: "default-template",
      organizationId: org.id,
      name: "Bony Polymers — Standard Review",
      description: "Annual / quarterly review for plant and office roles",
      formSchema: defaultFormSchema,
      ratingScale: defaultRatingScale,
      isDefault: true,
    },
    update: {
      name: "Bony Polymers — Standard Review",
      formSchema: defaultFormSchema,
    },
  });

  const cycle = await db.reviewCycle.upsert({
    where: { id: "q2-2026-cycle" },
    create: {
      id: "q2-2026-cycle",
      organizationId: org.id,
      templateId: template.id,
      name: "Q2 FY26 Performance Review",
      description: "Quarterly review for all Bony Polymers employees — complete in Teams or web",
      cycleType: "QUARTERLY",
      status: "ACTIVE",
      workflow: JSON.stringify({ self: true, manager: true, peer: true, peerCount: 2 }),
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-06-30"),
    },
    update: {
      status: "ACTIVE",
      name: "Q2 FY26 Performance Review",
      description:
        "Quarterly review for all Bony Polymers employees — complete in Teams or web",
    },
  });

  const assignments = [
    {
      id: "assign-self",
      revieweeId: employee.id,
      reviewerId: employee.id,
      reviewType: "SELF" as const,
    },
    {
      id: "assign-mgr",
      revieweeId: employee.id,
      reviewerId: manager.id,
      reviewType: "MANAGER" as const,
    },
  ];

  for (const a of assignments) {
    await db.reviewAssignment.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        cycleId: cycle.id,
        revieweeId: a.revieweeId,
        reviewerId: a.reviewerId,
        reviewType: a.reviewType,
        status: a.reviewType === "SELF" ? "IN_PROGRESS" : "PENDING",
        dueDate: new Date("2026-06-15"),
      },
      update: {},
    });
  }

  const existingGoals = await db.goal.count({ where: { organizationId: org.id } });
  if (existingGoals === 0) {
    const companyGoal = await db.goal.create({
      data: {
        organizationId: org.id,
        ownerId: admin.id,
        level: "COMPANY",
        title: "Achieve 98% on-time dispatch to customers",
        targetValue: 98,
        currentValue: 94,
        unit: "%",
        status: "ON_TRACK",
        quarter: "Q2 FY26",
      },
    });

    await db.goal.create({
      data: {
        organizationId: org.id,
        ownerId: manager.id,
        parentId: companyGoal.id,
        level: "TEAM",
        title: "Reduce polymer line defect rate below 1.2%",
        targetValue: 1.2,
        currentValue: 1.45,
        unit: "%",
        status: "AT_RISK",
        quarter: "Q2 FY26",
      },
    });

    await db.goal.create({
      data: {
        organizationId: org.id,
        ownerId: employee.id,
        level: "INDIVIDUAL",
        title: "Optimize extrusion line changeover time",
        targetValue: 30,
        currentValue: 24,
        unit: "min reduction",
        status: "ON_TRACK",
        quarter: "Q2 FY26",
      },
    });
  }

  const existingCampaigns = await db.feedback360Campaign.count({
    where: { organizationId: org.id },
  });
  if (existingCampaigns === 0) {
    const feedbackCampaign = await db.feedback360Campaign.create({
      data: {
        organizationId: org.id,
        name: `360° — ${employeeDef.name}`,
        subjectUserId: employee.id,
        questions: JSON.stringify([
          "What should this person continue doing?",
          "What should they start doing?",
          "What should they stop doing?",
        ]),
        status: "ACTIVE",
        allowExternal: false,
      },
    });

    await db.feedback360Response.create({
      data: {
        campaignId: feedbackCampaign.id,
        giverId: manager.id,
        receiverId: employee.id,
        responses: JSON.stringify({
          q0: "Continue strong ownership of line efficiency and SOP adherence.",
          q1: "Start mentoring junior operators on troubleshooting.",
          q2: "Stop skipping pre-shift safety checks when under time pressure.",
        }),
      },
    });
  }

  await db.compensationRecommendation.upsert({
    where: { id: "comp-amit-q2" },
    create: {
      id: "comp-amit-q2",
      employeeId: employee.id,
      managerId: manager.id,
      cycleId: cycle.id,
      performanceRating: 4.2,
      suggestedMeritPct: 5.0,
      suggestedBonusPct: 12,
      managerRecommendation:
        "Consistent performer on production KPIs — recommend merit at mid-to-upper band.",
    },
    update: {},
  });

  const existingSurveys = await db.survey.count({ where: { organizationId: org.id } });
  if (existingSurveys === 0) {
    const survey = await db.survey.create({
      data: {
        organizationId: org.id,
        title: "June Pulse — Employee Engagement",
        description: "Quick pulse across plant and office",
        questions: JSON.stringify([
          {
            id: "enps",
            label: "I would recommend Bony Polymers as a place to work",
            dimension: "engagement",
          },
          { id: "safety", label: "I feel safe at work", dimension: "safety" },
          { id: "manager", label: "My manager supports me", dimension: "manager" },
        ]),
        cadence: "monthly",
        isPulse: true,
        status: "ACTIVE",
      },
    });

    const users = await db.user.findMany({ where: { organizationId: org.id } });
    for (const u of users.slice(0, 3)) {
      await db.surveyResponse.create({
        data: {
          surveyId: survey.id,
          userId: u.id,
          answers: JSON.stringify({
            enps: String(3 + Math.floor(Math.random() * 3)),
            safety: String(4 + Math.floor(Math.random() * 2)),
            manager: String(4 + Math.floor(Math.random() * 2)),
          }),
        },
      });
    }
  }

  const existingCal = await db.calibrationSession.count({
    where: { organizationId: org.id },
  });
  if (existingCal === 0) {
    const calSession = await db.calibrationSession.create({
      data: {
        organizationId: org.id,
        name: "Q2 FY26 Talent Calibration",
        cycleId: cycle.id,
        quotaRules: JSON.stringify({ highPotential: 0.15, core: 0.6, develop: 0.25 }),
      },
    });

    await db.nineBoxPlacement.createMany({
      data: [
        { sessionId: calSession.id, userId: employee.id, performance: 3, potential: 3 },
        { sessionId: calSession.id, userId: manager.id, performance: 3, potential: 2 },
      ],
    });
  }

  await db.competencyFramework.upsert({
    where: { id: "competency-bony" },
    create: {
      id: "competency-bony",
      organizationId: org.id,
      name: "Bony Polymers — Core Competencies",
      schema: JSON.stringify({
        competencies: [
          { id: "safety", name: "Safety & EHS", levels: [] },
          { id: "quality", name: "Quality & Standards", levels: [] },
          { id: "production", name: "Production Excellence", levels: [] },
          { id: "customer", name: "Customer Focus", levels: [] },
        ],
      }),
    },
    update: {},
  });

  await db.hrisConnection.upsert({
    where: { id: "hris-bony" },
    create: {
      id: "hris-bony",
      organizationId: org.id,
      provider: "CUSTOM",
      syncDirection: "BIDIRECTIONAL",
      fieldMapping: JSON.stringify({
        externalId: "employeeCode",
        email: "officialEmail",
        name: "fullName",
        title: "designation",
        department: "department",
        managerId: "reportingManagerCode",
      }),
      isActive: true,
    },
    update: {},
  });

  await db.integrationConnection.upsert({
    where: {
      organizationId_provider: { organizationId: org.id, provider: "TEAMS" },
    },
    create: {
      organizationId: org.id,
      provider: "TEAMS",
      workspaceName: "Bony Polymers — Microsoft Teams",
      isActive: true,
    },
    update: { workspaceName: "Bony Polymers — Microsoft Teams" },
  });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((_, i) => new Date(2026, i, 28));

  for (const def of ALL_PLANT_KPIS) {
    await db.kpi.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        organizationId: org.id,
        name: def.name,
        description: def.kraName,
        category: def.category,
        unit: def.unit,
        targetValue: def.targetValue,
        direction: def.direction,
        frequency: "MONTHLY",
        department: def.department,
        perspective: def.perspective,
        kraName: def.kraName,
        weightage: def.weightage,
        fiscalYear: def.fiscalYear ?? null,
        plantUnit: def.plantUnit ?? PLANT_UNIT,
        kpiLevel: def.kpiLevel,
        ownerName: def.ownerName,
        quarterTargets: JSON.stringify(def.quarterTargets),
      },
      update: {
        name: def.name,
        description: def.kraName,
        category: def.category,
        unit: def.unit,
        targetValue: def.targetValue,
        direction: def.direction,
        department: def.department,
        perspective: def.perspective,
        kraName: def.kraName,
        weightage: def.weightage,
        fiscalYear: null,
        plantUnit: PLANT_UNIT,
        kpiLevel: def.kpiLevel,
        ownerName: def.ownerName,
        quarterTargets: JSON.stringify(def.quarterTargets),
      },
    });

    if (def.values?.length) {
      await db.kpiEntry.deleteMany({ where: { kpiId: def.id } });
      for (let i = 0; i < def.values.length; i++) {
        await db.kpiEntry.create({
          data: {
            kpiId: def.id,
            value: def.values[i],
            recordedAt: months[i],
            enteredById: admin.id,
          },
        });
      }
    }
  }

  await db.kpi.updateMany({
    where: { organizationId: org.id, ownerName: "Ms. Mahima" },
    data: { ownerId: employee.id },
  });

  await db.kpi.updateMany({
    where: { organizationId: org.id, ownerName: "Sikandar Khan" },
    data: { ownerId: sikandarKhan.id },
  });

  await db.kpi.updateMany({
    where: { organizationId: org.id, ownerName: "Ms. Sudha Jetli" },
    data: { ownerId: sudha.id },
  });

  // Masters: 37P roster departments + legacy defaults
  const allDeptDefs = [
    ...ROSTER_DEPARTMENTS,
    ...DEFAULT_DEPARTMENTS.filter(
      (d) => !ROSTER_DEPARTMENTS.some((r) => r.name === d.name)
    ),
  ];
  for (const d of allDeptDefs) {
    const exists = await db.departmentMaster.findFirst({
      where: { organizationId: org.id, name: d.name },
    });
    if (!exists) {
      await db.departmentMaster.create({
        data: {
          organizationId: org.id,
          name: d.name,
          headName: "headName" in d ? (d.headName || null) : null,
          location: "location" in d ? (d.location ?? "Bony Polymers 37-P") : "Bony Polymers 37-P",
          kraSheetId: d.kraSheetId,
          sortOrder: d.sortOrder,
        },
      });
    }
  }
  const deptCount = await db.departmentMaster.count({
    where: { organizationId: org.id },
  });

  const rosterSync = await sync37pFromDefaultFile(db, org.id);
  const kraSync = await syncKraFromDefaultFile(db, org.id, undefined, admin.id);
  const plantKraSync = await syncPlantKraFromDefaultFile(
    db,
    org.id,
    undefined,
    admin.id,
    rajKumar.id
  );
  let empCount = kraSync.employeeCount || rosterSync.employeeCount;
  if (empCount === 0) {
    const deptRows = await db.departmentMaster.findMany({
      where: { organizationId: org.id },
    });
    const deptByName = new Map(deptRows.map((x) => [x.name, x.id]));
    for (const e of DEFAULT_EMPLOYEES) {
      const departmentId = deptByName.get(e.department);
      await db.employeeMaster.create({
        data: {
          organizationId: org.id,
          name: e.name,
          designation: e.designation,
          departmentId: departmentId ?? null,
          department: e.department,
          location: e.location,
          doj: e.doj,
          ecn: e.ecn || null,
          managerName: e.managerName || null,
          sortOrder: e.sortOrder,
          isActive: true,
        },
      });
    }
    empCount = DEFAULT_EMPLOYEES.length;
  }

  const quarterTargetsBackfilled = await ensureAllKpisHaveQuarterTargets(org.id);
  const quarterEntriesSynced = await syncAllQuarterTargetsToEntries(org.id, admin.id);

  console.log("Seed complete:", {
    org: ORG_NAME,
    admin: admin.email,
    kpis: ALL_PLANT_KPIS.length,
    departments: deptCount,
    employees: empCount,
    quarterTargetsBackfilled,
    quarterEntriesSynced,
    roster37p: rosterSync,
    kraWorkbook: kraSync,
    plantKraWorkbook: plantKraSync,
  });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
