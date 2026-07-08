import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import { kpiExportCsv, kpiExportFilename } from "@/lib/kpi/export-kpis";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const unitSlug = searchParams.get("unit");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const workspace = await resolveWorkspace(user, unitSlug);

  const kpis = await db.kpi.findMany({
    where: await mergeKpiWhereForWorkspace(user, workspace.dataScope, {
      ...(category && category !== "all" ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
    }),
    include: { entries: { orderBy: { recordedAt: "desc" }, take: 1 } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const csv = kpiExportCsv(
    kpis.map((kpi) => ({
      name: kpi.name,
      description: kpi.description,
      category: kpi.category,
      unit: kpi.unit,
      targetValue: kpi.targetValue,
      direction: kpi.direction,
      frequency: kpi.frequency,
      department: kpi.department,
      value: kpi.entries[0]?.value,
      recordedAt: kpi.entries[0]?.recordedAt,
    }))
  );

  const filename = kpiExportFilename(workspace.unitId);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
