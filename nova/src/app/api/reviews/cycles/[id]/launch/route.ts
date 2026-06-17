import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { prepareReviewForTeams } from "@/lib/teams/reviews";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const cycle = await db.reviewCycle.update({
    where: { id, organizationId: user.organizationId },
    data: { status: "ACTIVE" },
    include: { assignments: true },
  });

  const results = { teams: 0, emailReady: 0, failed: 0 };

  for (const assignment of cycle.assignments) {
    try {
      const teamsResult = await prepareReviewForTeams(assignment.id);
      if (teamsResult.sent) results.teams++;
      else results.emailReady++;
    } catch {
      results.failed++;
    }
  }

  return NextResponse.json({ cycle, notifications: results });
}
