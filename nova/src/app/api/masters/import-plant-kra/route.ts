import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isKraEmployeeWorkbook } from "@/lib/masters/kra-workbook";
import { syncKraWorkbook } from "@/lib/masters/sync-kra-workbook";
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
  const employeeKra = isKraEmployeeWorkbook(buffer);
  const plantUnitKey = String(formData.get("plantUnitKey") ?? "").trim() || null;
  const syncOptions =
    employeeKra && plantUnitKey
      ? {
          plantUnitKey,
          location: plantUnitKey,
          sourceFileName: file.name,
        }
      : employeeKra
        ? { sourceFileName: file.name }
        : undefined;

  const result = employeeKra
    ? await syncKraWorkbook(db, user.organizationId, buffer, user.id, syncOptions)
    : await syncPlantKraWorkbook(db, user.organizationId, buffer, user.id);

  const failed = employeeKra
    ? !result.employeeCount && !("kpiCount" in result && result.kpiCount)
    : !("kpiCount" in result && result.kpiCount);

  if (
    failed &&
    result.errors.length &&
    !(employeeKra && "kpisCreated" in result && result.kpisCreated > 0)
  ) {
    return NextResponse.json(
      { error: result.errors.join("; "), ...result },
      { status: 400 }
    );
  }

  const message = employeeKra
    ? `Imported ${result.employeesCreated ?? 0} employees and ${result.kpisCreated ?? 0} KPIs (${result.entriesCreated ?? 0} entries).`
    : `Imported ${result.kpisCreated} new and ${result.kpisUpdated} updated KPIs (${result.entriesCreated} monthly entries).`;

  return NextResponse.json({
    ok: true,
    message,
    ...result,
  });
}
