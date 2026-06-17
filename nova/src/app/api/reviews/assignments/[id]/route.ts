import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const submitSchema = z.object({
  responses: z.record(z.string(), z.string()),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assignment = await db.reviewAssignment.findFirst({
    where: {
      id,
      cycle: { organizationId: user.organizationId },
    },
    include: {
      cycle: { include: { template: true } },
      reviewee: true,
    },
  });

  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(assignment);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assignment = await db.reviewAssignment.findFirst({
    where: { id, reviewerId: user.id },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { responses } = submitSchema.parse(await request.json());
  const ratingValues = Object.values(responses)
    .map((v) => parseFloat(v))
    .filter((n) => !isNaN(n));

  const updated = await db.reviewAssignment.update({
    where: { id },
    data: {
      responses: JSON.stringify(responses),
      overallRating:
        ratingValues.length > 0
          ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
          : undefined,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
