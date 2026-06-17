import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { generateReviewInsights } from "@/lib/ai/insights";
import { PageHeader } from "@/components/ui/page-header";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const assignments = await db.reviewAssignment.findMany({
    where: {
      cycle: { organizationId: user.organizationId },
      status: "SUBMITTED",
      overallRating: { not: null },
    },
    include: { reviewee: { select: { department: true } } },
  });

  const allCount = await db.reviewAssignment.count({
    where: { cycle: { organizationId: user.organizationId } },
  });

  const avgRating =
    assignments.length > 0
      ? assignments.reduce((s, a) => s + (a.overallRating ?? 0), 0) / assignments.length
      : 0;

  const completionRate =
    allCount > 0 ? Math.round((assignments.length / allCount) * 100) : 0;

  const deptBreakdown: Record<string, number[]> = {};
  for (const a of assignments) {
    const dept = a.reviewee.department ?? "Unknown";
    if (!deptBreakdown[dept]) deptBreakdown[dept] = [];
    deptBreakdown[dept].push(a.overallRating ?? 0);
  }
  const deptAvgs = Object.fromEntries(
    Object.entries(deptBreakdown).map(([d, vals]) => [
      d,
      vals.reduce((x, y) => x + y, 0) / vals.length,
    ])
  );

  const insights = generateReviewInsights(avgRating, completionRate, deptAvgs);

  const frameworks = await db.competencyFramework.findMany({
    where: { organizationId: user.organizationId },
  });

  const placements = await db.nineBoxPlacement.findMany({
    where: { session: { organizationId: user.organizationId } },
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics & Insights"
        description="Trends, skill frameworks, and auto-generated insights from reviews and feedback."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Avg. rating</CardTitle>
          <CardValue>{avgRating.toFixed(1)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Completion</CardTitle>
          <CardValue>{completionRate}%</CardValue>
        </Card>
        <Card>
          <CardTitle>9-box placements</CardTitle>
          <CardValue>{placements.length}</CardValue>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Auto-generated insights</h2>
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="text-indigo-500">•</span>
              {insight}
            </li>
          ))}
          {insights.length === 0 && (
            <li className="text-sm text-slate-500">Submit more reviews to unlock insights.</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Ratings by department</h2>
        <div className="space-y-3">
          {Object.entries(deptAvgs).map(([dept, avg]) => (
            <div key={dept} className="flex items-center justify-between text-sm">
              <span>{dept}</span>
              <span className="font-medium">{avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Competency frameworks</h2>
        {frameworks.map((f) => (
          <p key={f.id} className="text-sm text-slate-600">
            {f.name} — skill gap analysis ready when review competency data is mapped.
          </p>
        ))}
      </Card>
    </div>
  );
}
