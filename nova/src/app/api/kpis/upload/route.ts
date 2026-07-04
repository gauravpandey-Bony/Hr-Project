import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseKpiCsv } from "@/lib/kpi/csv-import";
import { resolveWorkspace } from "@/lib/unit-workspace.server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const unitSlug = String(formData.get("unit") ?? "").trim() || null;
  let plantUnitKey = String(formData.get("plantUnitKey") ?? "").trim() || null;
  if (!plantUnitKey) {
    const workspace = await resolveWorkspace(user, unitSlug);
    plantUnitKey = workspace.plantUnitKey;
  }
  if (!plantUnitKey) {
    return NextResponse.json(
      {
        error:
          "Select a plant/unit before uploading so KPIs are saved to the correct plant.",
      },
      { status: 400 }
    );
  }

  const text = await file.text();
  const { rows, errors } = parseKpiCsv(text);

  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  let kpisCreated = 0;
  let kpisUpdated = 0;
  let entriesCreated = 0;

  for (const row of rows) {
    let kpi = await db.kpi.findFirst({
      where: {
        organizationId: user.organizationId,
        name: row.name,
        plantUnit: plantUnitKey,
      },
    });

    if (!kpi) {
      // Prefer plant-scoped row; fall back to unassigned legacy row and attach plant.
      kpi = await db.kpi.findFirst({
        where: {
          organizationId: user.organizationId,
          name: row.name,
          OR: [{ plantUnit: null }, { plantUnit: "" }],
        },
      });
      if (kpi) {
        kpi = await db.kpi.update({
          where: { id: kpi.id },
          data: {
            plantUnit: plantUnitKey,
            description: row.description ?? kpi.description,
            category: row.category || kpi.category,
            unit: row.unit || kpi.unit,
            targetValue: row.targetValue ?? kpi.targetValue,
            direction: row.direction ?? kpi.direction,
            frequency: row.frequency ?? kpi.frequency,
            department: row.department ?? kpi.department,
          },
        });
        kpisUpdated++;
      }
    }

    if (!kpi) {
      kpi = await db.kpi.create({
        data: {
          organizationId: user.organizationId,
          name: row.name,
          description: row.description,
          category: row.category,
          unit: row.unit,
          targetValue: row.targetValue,
          direction: row.direction,
          frequency: row.frequency,
          department: row.department,
          plantUnit: plantUnitKey,
        },
      });
      kpisCreated++;
    }

    if (row.value !== undefined && !isNaN(row.value)) {
      await db.kpiEntry.create({
        data: {
          kpiId: kpi.id,
          value: row.value,
          recordedAt: row.recordedAt ? new Date(row.recordedAt) : new Date(),
          enteredById: user.id,
          note: "Imported from spreadsheet",
        },
      });
      entriesCreated++;
    }
  }

  revalidatePath("/dashboard/kpis", "layout");
  revalidatePath("/dashboard/units", "layout");
  revalidatePath("/dashboard/reports", "layout");

  return NextResponse.json({
    kpisCreated,
    kpisUpdated,
    entriesCreated,
    rowsProcessed: rows.length,
    plantUnitKey,
    parseErrors: errors,
  });
}
