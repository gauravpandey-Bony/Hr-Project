import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildOrganizationContext } from "@/lib/ai/db-context";
import { processChatMessage, type ChatMessage } from "@/lib/ai/chat";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import type { WorkspaceScope } from "@/lib/ai/db-context";

const schema = z.object({
  message: z.string().min(1),
  unit: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

/** Admin Maya: full org data. Managers/others: current unit only. */
function novaContextScope(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  workspace: Awaited<ReturnType<typeof resolveWorkspace>>
): WorkspaceScope {
  if (user.role === "ADMIN") {
    return { plantUnitKey: null, unitName: null, dataScope: null };
  }
  return {
    plantUnitKey: workspace.plantUnitKey,
    unitName: workspace.unit?.name ?? null,
    dataScope: workspace.dataScope,
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.parse(await request.json());
  const workspace = await resolveWorkspace(user, body.unit);
  const scope = novaContextScope(user, workspace);

  const [ctx, existingKpis] = await Promise.all([
    buildOrganizationContext(user, scope),
    db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, scope.dataScope),
      select: { name: true },
    }),
  ]);

  const reply = await processChatMessage(
    body.message,
    user.organizationId,
    ctx,
    (body.history ?? []) as ChatMessage[],
    existingKpis.map((k) => k.name),
    user.role,
    scope.plantUnitKey,
    scope.unitName
  );

  return NextResponse.json({
    reply,
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
    orgWide: user.role === "ADMIN",
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const workspace = await resolveWorkspace(user, searchParams.get("unit"));
  const scope = novaContextScope(user, workspace);

  const ctx = await buildOrganizationContext(user, scope);
  return NextResponse.json({
    stats: ctx.stats,
    company: ctx.company,
    orgWide: user.role === "ADMIN",
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
  });
}
