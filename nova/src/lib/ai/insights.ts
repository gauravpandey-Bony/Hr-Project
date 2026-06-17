import { parseJson } from "@/lib/utils";

/** Rule-based summary for MVP; swap with LLM when API key is configured. */
export function generateFeedbackSummary(
  responses: { responses: string }[],
  questions: string[]
): string {
  const parsed = responses.map((r) =>
    parseJson<Record<string, string>>(r.responses, {})
  );

  const themes: string[] = [];
  const allText = parsed
    .flatMap((p) => Object.values(p))
    .join(" ")
    .toLowerCase();

  if (/lead|mentor|guide/.test(allText)) themes.push("strong leadership presence");
  if (/communicat|clear|listen/.test(allText)) themes.push("effective communication");
  if (/collaborat|team|support/.test(allText)) themes.push("collaborative teamwork");
  if (/improv|grow|develop/.test(allText)) themes.push("growth opportunities identified");
  if (/deliver|result|impact/.test(allText)) themes.push("consistent delivery on outcomes");

  const count = responses.length;
  const qPreview = questions.slice(0, 2).join(", ");

  if (themes.length === 0) {
    return `AI summary (${count} responses): Feedback collected on ${qPreview}. Review individual responses for detailed themes.`;
  }

  return `AI summary (${count} responses): Recurring themes include ${themes.join(", ")}. Consider discussing strengths in 1:1s and aligning development plans with highlighted growth areas.`;
}

export function generateReviewInsights(
  avgRating: number,
  completionRate: number,
  departmentBreakdown: Record<string, number>
): string[] {
  const insights: string[] = [];

  if (completionRate < 70) {
    insights.push(
      `Review completion is at ${completionRate}% — send Teams reminders to managers with pending assignments.`
    );
  }

  if (avgRating >= 4.2) {
    insights.push("Average ratings are high; validate calibration quotas before finalizing compensation.");
  } else if (avgRating < 3) {
    insights.push("Below-target average ratings detected; schedule manager enablement on feedback quality.");
  }

  const depts = Object.entries(departmentBreakdown);
  if (depts.length > 1) {
    const [top, bottom] = [...depts].sort((a, b) => b[1] - a[1]);
    if (top[1] - bottom[1] > 0.5) {
      insights.push(
        `Rating spread between ${top[0]} (${top[1].toFixed(1)}) and ${bottom[0]} (${bottom[1].toFixed(1)}) — review for calibration bias.`
      );
    }
  }

  return insights;
}
