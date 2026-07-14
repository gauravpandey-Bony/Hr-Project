import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageKpi, canUpdateKpi } from "@/lib/team-scope";
import { syncKpiEntryFromQuarters } from "@/lib/kpi-quarters";
import {
  mergeAchievedQuarterJson,
  mergeFullQuarterJson,
  mergeTargetsQuarterJson,
} from "@/lib/kra/quarter-merge";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  kraName: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  targetValue: z.number().optional(),
  weightage: z.number().min(0).max(1).optional(),
  perspective: z.string().optional(),
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]).optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  department: z.string().optional(),
  kpiLevel: z.string().optional(),
  ownerName: z.string().optional(),
  quarterTargets: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.kpi.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateScope = await canUpdateKpi(user, existing);
  if (!updateScope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = updateSchema.parse(await request.json());

  if (updateScope === "achieved") {
    if (body.quarterTargets === undefined) {
      return NextResponse.json(
        { error: "Employees may only update achieved values" },
        { status: 400 }
      );
    }
    const quarterTargets = mergeAchievedQuarterJson(
      existing.quarterTargets,
      body.quarterTargets
    );
    const kpi = await db.kpi.update({
      where: { id: params.id },
      data: { quarterTargets },
    });
    await syncKpiEntryFromQuarters(kpi.id, kpi.quarterTargets, user.id);
    revalidatePath("/dashboard/units", "layout");
    revalidatePath("/dashboard/reports", "layout");
    return NextResponse.json(kpi);
  }

  // Admin / manager: can update targets and achieved (and other KPI fields)
  const data: z.infer<typeof updateSchema> = { ...body };
  if (body.quarterTargets !== undefined) {
    data.quarterTargets =
      updateScope === "both"
        ? mergeFullQuarterJson(existing.quarterTargets, body.quarterTargets)
        : mergeTargetsQuarterJson(existing.quarterTargets, body.quarterTargets);
  }

  const kpi = await db.kpi.update({
    where: { id: params.id },
    data,
  });

  if (data.quarterTargets !== undefined) {
    await syncKpiEntryFromQuarters(kpi.id, kpi.quarterTargets, user.id);
  }

  revalidatePath("/dashboard/units", "layout");
  revalidatePath("/dashboard/reports", "layout");

  return NextResponse.json(kpi);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.kpi.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canManageKpi(user, existing))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.kpi.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
