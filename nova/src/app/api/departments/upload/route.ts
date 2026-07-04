import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseUploadFile, type DepartmentImportRow } from "@/lib/masters/import";
import {
  dedupeDepartmentMasters,
  upsertDepartmentMaster,
} from "@/lib/masters/department-master-sync";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import { importLocationForPlantUnitKey } from "@/lib/org-units";

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
  const defaultLocation = plantUnitKey
    ? importLocationForPlantUnitKey(plantUnitKey)
    : "Bony Polymers";

  const { rows: parsedRows, errors } = await parseUploadFile(file, "departments");
  const rows = parsedRows as DepartmentImportRow[];
  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const { created: wasCreated } = await upsertDepartmentMaster(
      db,
      user.organizationId,
      {
        name: row.name,
        headName: row.headName ?? null,
        location: row.location ?? defaultLocation,
        plantUnitKey,
        kraSheetId: row.kraSheetId ?? null,
        sortOrder: row.sortOrder ?? 0,
        isActive: row.isActive ?? true,
      }
    );
    if (wasCreated) created++;
    else updated++;
  }

  const { merged } = await dedupeDepartmentMasters(
    db,
    user.organizationId,
    plantUnitKey
  );

  return NextResponse.json({
    created,
    updated,
    merged,
    rowsProcessed: rows.length,
    parseErrors: errors,
  });
}
