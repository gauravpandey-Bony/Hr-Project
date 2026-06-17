import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createCycleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string(),
  cycleType: z.enum(["ANNUAL", "QUARTERLY", "MONTHLY", "AD_HOC"]),
  workflow: z.object({
    self: z.boolean(),
    manager: z.boolean(),
    peer: z.boolean(),
    peerCount: z.number().optional(),
  }),
  startDate: z.string(),
  endDate: z.string(),
  participantIds: z.array(z.string()).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycles = await db.reviewCycle.findMany({
    where: { organizationId: user.organizationId },
    include: {
      template: { select: { name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cycles);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createCycleSchema.parse(await request.json());

  const cycle = await db.reviewCycle.create({
    data: {
      organizationId: user.organizationId,
      templateId: body.templateId,
      name: body.name,
      description: body.description,
      cycleType: body.cycleType,
      workflow: JSON.stringify(body.workflow),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: "DRAFT",
    },
  });

  if (body.participantIds?.length) {
    await createAssignmentsForCycle(cycle.id, body.workflow, body.participantIds);
  }

  return NextResponse.json(cycle, { status: 201 });
}

async function createAssignmentsForCycle(
  cycleId: string,
  workflow: { self: boolean; manager: boolean; peer: boolean; peerCount?: number },
  participantIds: string[]
) {
  const users = await db.user.findMany({
    where: { id: { in: participantIds } },
    include: { manager: true, reports: true },
  });

  const assignments: {
    cycleId: string;
    revieweeId: string;
    reviewerId: string;
    reviewType: "SELF" | "MANAGER" | "PEER";
    dueDate: Date;
  }[] = [];

  const cycle = await db.reviewCycle.findUnique({ where: { id: cycleId } });
  const dueDate = cycle?.endDate ?? new Date();

  for (const reviewee of users) {
    if (workflow.self) {
      assignments.push({
        cycleId,
        revieweeId: reviewee.id,
        reviewerId: reviewee.id,
        reviewType: "SELF",
        dueDate,
      });
    }
    if (workflow.manager && reviewee.managerId) {
      assignments.push({
        cycleId,
        revieweeId: reviewee.id,
        reviewerId: reviewee.managerId,
        reviewType: "MANAGER",
        dueDate,
      });
    }
  }

  if (workflow.peer) {
    for (const reviewee of users) {
      const peers = users.filter((u) => u.id !== reviewee.id).slice(0, workflow.peerCount ?? 2);
      for (const peer of peers) {
        assignments.push({
          cycleId,
          revieweeId: reviewee.id,
          reviewerId: peer.id,
          reviewType: "PEER",
          dueDate,
        });
      }
    }
  }

  if (assignments.length) {
    await db.reviewAssignment.createMany({ data: assignments });
  }
}
