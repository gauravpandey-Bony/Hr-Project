import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import { canManageKpi } from "@/lib/team-scope";
import { effectiveKpiCurrent } from "@/lib/kpi-quarters";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const unitId = searchParams.get("unit");
  const workspace = await resolveWorkspace(user, unitId);

  const kpis = await db.kpi.findMany({
    where: mergeKpiWhereForWorkspace(
      user,
      workspace.dataScope,
      category ? { category } : undefined
    ),
    include: {
      entries: { orderBy: { recordedAt: "desc" }, take: 12 },
      owner: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const enriched = kpis.map((k) => ({
    ...k,
    currentValue: effectiveKpiCurrent(k),
  }));

  return NextResponse.json(enriched);
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  unit: z.string(),
  targetValue: z.number(),
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  department: z.string().optional(),
  ownerId: z.string().optional(),
  perspective: z.string().optional(),
  kraName: z.string().optional(),
  weightage: z.number().min(0).max(1).optional(),
  fiscalYear: z.string().optional(),
  plantUnit: z.string().optional(),
  kpiLevel: z.string().optional(),
  ownerName: z.string().optional(),
  quarterTargets: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createSchema.parse(await request.json());

  if (user.role !== "ADMIN") {
    if (user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const draft = {
      ownerId: body.ownerId ?? null,
      ownerName: body.ownerName ?? null,
      department: body.department ?? null,
      kpiLevel: body.kpiLevel ?? null,
    };
    if (!(await canManageKpi(user, draft))) {
      return NextResponse.json({ error: "Forbidden — not your team" }, { status: 403 });
    }
  }

  const kpi = await db.kpi.create({
    data: {
      organizationId: user.organizationId,
      ...body,
    },
  });

  return NextResponse.json(kpi, { status: 201 });
}
