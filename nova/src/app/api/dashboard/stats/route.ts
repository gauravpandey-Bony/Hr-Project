import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeCycles, assignments, feedbackCampaigns, goals, surveys] = await Promise.all([
    db.reviewCycle.count({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
    }),
    db.reviewAssignment.findMany({
      where: {
        cycle: { organizationId: user.organizationId },
        ...(user.role === "EMPLOYEE" ? { reviewerId: user.id } : {}),
      },
    }),
    db.feedback360Campaign.count({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
    }),
    db.goal.findMany({
      where: { organizationId: user.organizationId },
    }),
    db.survey.findMany({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
      include: { _count: { select: { responses: true } } },
    }),
  ]);

  const pending = assignments.filter((a) => a.status !== "SUBMITTED").length;
  const submitted = assignments.filter((a) => a.status === "SUBMITTED").length;
  const completionRate =
    assignments.length > 0 ? Math.round((submitted / assignments.length) * 100) : 0;

  const goalsOnTrack = goals.filter((g) => g.status === "ON_TRACK" || g.status === "COMPLETED").length;
  const goalsPct = goals.length > 0 ? Math.round((goalsOnTrack / goals.length) * 100) : 0;

  const userCount = await db.user.count({ where: { organizationId: user.organizationId } });
  const totalResponses = surveys.reduce((s, sv) => s + sv._count.responses, 0);
  const surveyParticipation =
    surveys.length && userCount
      ? Math.min(100, Math.round((totalResponses / (surveys.length * userCount)) * 100))
      : 0;

  return NextResponse.json({
    activeCycles,
    pendingReviews: pending,
    completionRate,
    openFeedback: feedbackCampaigns,
    goalsOnTrack: goalsPct,
    surveyParticipation,
  });
}
