import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { syncPlantKraWorkbook } from "@/lib/masters/sync-plant-kra-workbook";

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

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Upload an Excel file (.xlsx or .xls)" },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();
  const result = await syncPlantKraWorkbook(
    db,
    user.organizationId,
    buffer,
    user.id
  );

  if (!result.kpiCount && result.errors.length) {
    return NextResponse.json(
      { error: result.errors.join("; "), ...result },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Imported ${result.kpisCreated} new and ${result.kpisUpdated} updated KPIs (${result.entriesCreated} monthly entries).`,
    ...result,
  });
}
