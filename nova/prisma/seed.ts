import { PrismaClient } from "@prisma/client";
import { DEFAULT_DEPARTMENTS } from "../src/lib/master-defaults";
import { sync37pFromDefaultFile } from "../src/lib/masters/sync-37p";
import { hashPassword } from "../src/lib/auth/password";
import { SEED_USERS, seedPasswordForUser } from "./seed-users";
import { COMPANY } from "../src/lib/company";
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
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      tagline: COMPANY.tagline,
      emailDomain: COMPANY.emailDomain,
      productName: COMPANY.productName,
      brandName: COMPANY.brandName,
      aiAssistantName: COMPANY.aiAssistantName,
      kraMasterSheetLabel: COMPANY.kraMasterSheetLabel,
    },
    update: {
      name: ORG_NAME,
      tagline: COMPANY.tagline,
      emailDomain: COMPANY.emailDomain,
      productName: COMPANY.productName,
      brandName: COMPANY.brandName,
      aiAssistantName: COMPANY.aiAssistantName,
      kraMasterSheetLabel: COMPANY.kraMasterSheetLabel,
    },
  });

  const passwordByUserId = new Map<string, string>();
  for (const u of SEED_USERS) {
    passwordByUserId.set(
      u.id,
      await hashPassword(seedPasswordForUser(u.id, u.defaultPassword))
    );
  }
  const pwd = (id: string) => passwordByUserId.get(id)!;
  const userDef = (id: string) => SEED_USERS.find((u) => u.id === id)!;

  for (const def of SEED_USERS) {
    await db.user.deleteMany({
      where: {
        organizationId: org.id,
        email: def.email,
        id: { not: def.id },
      },
    });
  }

  async function upsertUser(
    def: (typeof SEED_USERS)[number],
    extra?: { managerId?: string; teamsUserId?: string }
  ) {
    return db.user.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        organizationId: org.id,
        email: def.email,
        name: def.name,
        role: def.role,
        title: def.title,
        department: def.department,
        passwordHash: pwd(def.id),
        hrisExternalId: def.ecn ?? undefined,
        managerId: extra?.managerId,
        teamsUserId: extra?.teamsUserId,
      },
      update: {
        email: def.email,
        name: def.name,
        role: def.role,
        title: def.title,
        department: def.department,
        passwordHash: pwd(def.id),
        hrisExternalId: def.ecn ?? undefined,
        managerId: extra?.managerId,
      },
    });
  }

  const admin = await upsertUser(userDef("demo-admin"));
  const manager = await upsertUser(userDef("demo-manager"), {
    managerId: admin.id,
    teamsUserId: "teams-praveen-kumar",
  });
  const itManager = await upsertUser(userDef("demo-it-manager"), {
    managerId: admin.id,
    teamsUserId: "teams-bhupesh-sharma",
  });
  const rajKumar = await upsertUser(userDef("demo-raj-kumar"), {
    managerId: admin.id,
    teamsUserId: "teams-raj-kumar",
  });

  await db.user.deleteMany({
    where: { id: "demo-plant-head", organizationId: org.id },
  });

  const employee = await upsertUser(userDef("demo-employee"), {
    managerId: rajKumar.id,
    teamsUserId: "teams-mahima",
  });
  const sikandarKhan = await upsertUser(userDef("demo-sikandar-khan"), {
    managerId: itManager.id,
    teamsUserId: "teams-sikandar-khan",
  });
  const sudha = await upsertUser(userDef("demo-sudha"), {
    managerId: rajKumar.id,
    teamsUserId: "teams-sudha-jetli",
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

  // Masters: 37P roster departments + legacy defaults
  const allDeptDefs = [
    ...ROSTER_DEPARTMENTS,
    ...DEFAULT_DEPARTMENTS.filter(
      (d) => !ROSTER_DEPARTMENTS.some((r) => r.name === d.name)
    ),
  ];
  for (const d of allDeptDefs) {
    const kraSheetId = "kraSheetId" in d ? (d.kraSheetId ?? null) : null;
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
          sortOrder: d.sortOrder,
          kraSheetId,
        },
      });
    } else if (kraSheetId && !exists.kraSheetId) {
      await db.departmentMaster.update({
        where: { id: exists.id },
        data: { kraSheetId, location: exists.location ?? "Bony Polymers 37-P" },
      });
    }
  }
  const deptCount = await db.departmentMaster.count({
    where: { organizationId: org.id },
  });

  await db.kpiEntry.deleteMany({ where: { kpi: { organizationId: org.id } } });
  await db.kpi.deleteMany({ where: { organizationId: org.id } });
  await db.employeeMaster.deleteMany({ where: { organizationId: org.id } });

  const rosterSync = await sync37pFromDefaultFile(db, org.id);

  console.log("Seed complete:", {
    org: ORG_NAME,
    admin: admin.email,
    departments: deptCount,
    roster37p: rosterSync,
  });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
