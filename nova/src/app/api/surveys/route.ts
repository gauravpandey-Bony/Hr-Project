import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJson } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const surveys = await db.survey.findMany({
    where: { organizationId: user.organizationId },
    include: { responses: true },
  });

  const enriched = surveys.map((s) => {
    const questions = parseJson<{ id: string; dimension?: string }[]>(s.questions, []);
    const heatmap: Record<string, number[]> = {};

    for (const q of questions) {
      const dim = q.dimension ?? q.id;
      heatmap[dim] = [];
    }

    for (const r of s.responses) {
      const answers = parseJson<Record<string, string>>(r.answers, {});
      for (const q of questions) {
        const dim = q.dimension ?? q.id;
        const val = parseFloat(answers[q.id]);
        if (!isNaN(val)) heatmap[dim]?.push(val);
      }
    }

    const averages = Object.fromEntries(
      Object.entries(heatmap).map(([k, vals]) => [
        k,
        vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      ])
    );

    return { ...s, heatmap: averages, responseCount: s.responses.length };
  });

  return NextResponse.json(enriched);
}
