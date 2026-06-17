import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateSummaryButton } from "@/components/feedback/generate-summary-button";
import { PageHeader } from "@/components/ui/page-header";

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const campaigns = await db.feedback360Campaign.findMany({
    where: { organizationId: user.organizationId },
    include: {
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const subjects = await db.user.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="360° Feedback"
        description="Launch multi-rater feedback in minutes. Request from anyone inside or outside the org."
      />

      <div className="space-y-4">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <Badge variant="success">{c.status}</Badge>
                  {c.allowExternal && <Badge variant="info">External OK</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Subject: {subjectMap[c.subjectUserId] ?? "Unknown"} · {c._count.responses}{" "}
                  responses
                </p>
                {c.aiSummary && (
                  <div className="mt-4 rounded-lg bg-indigo-50 p-4 text-sm text-slate-700">
                    <p className="mb-1 font-medium text-indigo-900">AI Summary</p>
                    {c.aiSummary}
                  </div>
                )}
              </div>
              <GenerateSummaryButton campaignId={c.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
