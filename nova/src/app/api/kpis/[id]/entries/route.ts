import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageKpi } from "@/lib/team-scope";

const entrySchema = z.object({
  value: z.number(),
  recordedAt: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const kpiScoped = await db.kpi.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!kpiScoped) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = await db.kpiEntry.findMany({
    where: { kpiId: id },
    orderBy: { recordedAt: "desc" },
    take: 24,
  });

  return NextResponse.json(entries);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const kpi = await db.kpi.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!kpi) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canManageKpi(user, kpi))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = entrySchema.parse(await request.json());
  const entry = await db.kpiEntry.create({
    data: {
      kpiId: id,
      value: body.value,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
      note: body.note,
      enteredById: user.id,
    },
  });

  revalidatePath("/dashboard/units", "layout");
  revalidatePath("/dashboard/reports", "layout");

  return NextResponse.json(entry, { status: 201 });
}
