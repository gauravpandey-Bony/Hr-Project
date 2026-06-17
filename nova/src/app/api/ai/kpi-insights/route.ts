import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { generateKpiInsights } from "@/lib/ai/generate-kpis";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { resolveWorkspace } from "@/lib/unit-workspace.server";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const workspace = await resolveWorkspace(user, searchParams.get("unit"));

  const kpis = await db.kpi.findMany({
    where: mergeKpiWhereForWorkspace(user, workspace.dataScope),
    include: { entries: { orderBy: { recordedAt: "desc" }, take: 1 } },
  });

  const snapshot = kpis.map((k) => {
    const { current, status } = evaluateKpiCurrent(k);
    return {
      name: k.name,
      category: k.category,
      current,
      target: k.targetValue,
      direction: k.direction,
      status,
    };
  });

  const insights = await generateKpiInsights(snapshot);

  return NextResponse.json({
    insights,
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
    unitName: workspace.unit?.name ?? null,
  });
}
