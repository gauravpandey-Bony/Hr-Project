import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseKpiCsv } from "@/lib/kpi/csv-import";

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

  const text = await file.text();
  const { rows, errors } = parseKpiCsv(text);

  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  let kpisCreated = 0;
  let entriesCreated = 0;

  for (const row of rows) {
    let kpi = await db.kpi.findFirst({
      where: {
        organizationId: user.organizationId,
        name: row.name,
      },
    });

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

  return NextResponse.json({
    kpisCreated,
    entriesCreated,
    rowsProcessed: rows.length,
    parseErrors: errors,
  });
}
