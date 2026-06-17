import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateFeedbackSummary } from "@/lib/ai/insights";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await db.feedback360Campaign.findMany({
    where: { organizationId: user.organizationId },
    include: {
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

const createSchema = z.object({
  name: z.string(),
  subjectUserId: z.string(),
  questions: z.array(z.string()),
  allowExternal: z.boolean().optional(),
  dueDate: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.parse(await request.json());
  const campaign = await db.feedback360Campaign.create({
    data: {
      organizationId: user.organizationId,
      name: body.name,
      subjectUserId: body.subjectUserId,
      questions: JSON.stringify(body.questions),
      allowExternal: body.allowExternal ?? false,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await request.json();
  const campaign = await db.feedback360Campaign.findFirst({
    where: { id: campaignId, organizationId: user.organizationId },
    include: { responses: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = JSON.parse(campaign.questions) as string[];
  const summary = generateFeedbackSummary(campaign.responses, questions);

  const updated = await db.feedback360Campaign.update({
    where: { id: campaignId },
    data: { aiSummary: summary },
  });

  return NextResponse.json(updated);
}
