export function isTeamsConfigured(): boolean {
  return Boolean(process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD);
}

export function getTeamsReviewDeepLink(assignmentId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/dashboard/reviews/${assignmentId}`;
}
