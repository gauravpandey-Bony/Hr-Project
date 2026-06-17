import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await db.calibrationSession.findMany({
    where: { organizationId: user.organizationId },
    include: {
      placements: {
        include: { user: { select: { id: true, name: true, department: true, title: true } } },
      },
    },
  });

  return NextResponse.json(sessions);
}

const placementSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  performance: z.number().min(1).max(3),
  potential: z.number().min(1).max(3),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = placementSchema.parse(await request.json());

  const placement = await db.nineBoxPlacement.upsert({
    where: {
      sessionId_userId: { sessionId: body.sessionId, userId: body.userId },
    },
    create: body,
    update: {
      performance: body.performance,
      potential: body.potential,
      notes: body.notes,
    },
  });

  return NextResponse.json(placement);
}
