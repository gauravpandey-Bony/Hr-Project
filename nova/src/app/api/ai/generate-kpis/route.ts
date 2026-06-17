import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { generateKpiSuggestions } from "@/lib/ai/generate-kpis";
import { resolveWorkspace } from "@/lib/unit-workspace.server";

const bodySchema = z.object({
  focus: z.string().optional(),
  apply: z.boolean().optional(),
  unit: z.string().optional(),
  selected: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        category: z.string(),
        unit: z.string(),
        targetValue: z.number(),
        direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]),
        frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
        department: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = bodySchema.parse(await request.json());
  const workspace = await resolveWorkspace(user, body.unit);
  const plantUnit = workspace.plantUnitKey ?? "Bony Polymers";

  const existing = await db.kpi.findMany({
    where: mergeKpiWhereForWorkspace(user, workspace.dataScope),
    select: { name: true },
  });
  const existingNames = existing.map((k) => k.name);

  if (body.apply && body.selected?.length) {
    const created = await db.$transaction(
      body.selected.map((k) =>
        db.kpi.create({
          data: {
            organizationId: user.organizationId,
            name: k.name,
            description: k.description,
            category: k.category,
            unit: k.unit,
            targetValue: k.targetValue,
            direction: k.direction,
            frequency: k.frequency,
            department: k.department,
            plantUnit,
          },
        })
      )
    );
    return NextResponse.json({ created: created.length, kpis: created });
  }

  const { suggestions, source } = await generateKpiSuggestions(
    existingNames,
    body.focus
  );

  return NextResponse.json({
    suggestions,
    source,
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
  });
}
