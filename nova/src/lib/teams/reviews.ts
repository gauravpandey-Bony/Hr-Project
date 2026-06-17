import { db } from "@/lib/db";
import { buildReviewAdaptiveCard } from "./cards";
import { format } from "date-fns";

/** Teams delivery uses Bot Framework; store card payload for webhook simulation in dev. */
export async function prepareReviewForTeams(assignmentId: string) {
  const assignment = await db.reviewAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      cycle: true,
      reviewee: true,
    },
  });
  if (!assignment) throw new Error("Assignment not found");

  const reviewer = await db.user.findUnique({
    where: { id: assignment.reviewerId },
  });

  const card = buildReviewAdaptiveCard({
    cycleName: assignment.cycle.name,
    revieweeName: assignment.reviewee.name,
    reviewType: assignment.reviewType.toLowerCase(),
    assignmentId,
    dueDate: assignment.dueDate ? format(assignment.dueDate, "MMM d, yyyy") : undefined,
  });

  await db.reviewAssignment.update({
    where: { id: assignmentId },
    data: { status: "IN_PROGRESS", teamsActivityId: `teams-${assignmentId}` },
  });

  return {
    sent: Boolean(reviewer?.teamsUserId),
    teamsUserId: reviewer?.teamsUserId,
    card,
  };
}
