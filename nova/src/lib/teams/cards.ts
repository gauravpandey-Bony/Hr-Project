import { getTeamsReviewDeepLink } from "./client";

export function buildReviewAdaptiveCard(params: {
  cycleName: string;
  revieweeName: string;
  reviewType: string;
  assignmentId: string;
  dueDate?: string;
}) {
  const { cycleName, revieweeName, reviewType, assignmentId, dueDate } = params;

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "Performance review ready",
        weight: "Bolder",
        size: "Medium",
      },
      {
        type: "TextBlock",
        text: `${cycleName} — ${reviewType} review for ${revieweeName}`,
        wrap: true,
      },
      ...(dueDate
        ? [{ type: "TextBlock", text: `Due: ${dueDate}`, isSubtle: true, spacing: "Small" }]
        : []),
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "Complete review",
        url: getTeamsReviewDeepLink(assignmentId),
      },
      {
        type: "Action.Submit",
        title: "Mark started",
        data: { action: "nova_review_started", assignmentId },
      },
    ],
  };
}
