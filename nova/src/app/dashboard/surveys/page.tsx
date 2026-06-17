import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { parseJson } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

export default async function SurveysPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const surveys = await db.survey.findMany({
    where: { organizationId: user.organizationId },
    include: { responses: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Engagement Surveys"
        description="Pulse surveys with heatmap analytics by dimension."
      />

      {surveys.map((survey) => {
        const questions = parseJson<{ id: string; label: string; dimension?: string }[]>(
          survey.questions,
          []
        );
        const heatmap: Record<string, number[]> = {};
        for (const q of questions) {
          const dim = q.dimension ?? q.id;
          heatmap[dim] = [];
        }
        for (const r of survey.responses) {
          const answers = parseJson<Record<string, string>>(r.answers, {});
          for (const q of questions) {
            const dim = q.dimension ?? q.id;
            const val = parseFloat(answers[q.id]);
            if (!isNaN(val)) heatmap[dim]?.push(val);
          }
        }
        const maxAvg = 5;

        return (
          <Card key={survey.id}>
            <h3 className="font-semibold">{survey.title}</h3>
            <p className="text-sm text-slate-500">
              {survey.responses.length} responses · {survey.cadence ?? "Ad hoc"}
            </p>
            <div className="mt-6 space-y-4">
              <p className="text-sm font-medium text-slate-700">Heatmap by dimension</p>
              {Object.entries(heatmap).map(([dim, vals]) => {
                const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                const width = (avg / maxAvg) * 100;
                const intensity =
                  avg >= 4 ? "bg-emerald-500" : avg >= 3 ? "bg-amber-400" : "bg-rose-400";
                return (
                  <div key={dim}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize">{dim}</span>
                      <span>{avg.toFixed(1)} avg</span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                      <div
                        className={`h-full ${intensity} transition-all`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
