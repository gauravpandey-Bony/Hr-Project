import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageKpi } from "@/lib/team-scope";
import { syncKpiEntryFromQuarters } from "@/lib/kpi-quarters";

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

  if (!(await canManageKpi(user, existing))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = updateSchema.parse(await request.json());
  const kpi = await db.kpi.update({
    where: { id: params.id },
    data: body,
  });

  if (body.quarterTargets !== undefined) {
    await syncKpiEntryFromQuarters(kpi.id, kpi.quarterTargets, user.id);
  }

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
