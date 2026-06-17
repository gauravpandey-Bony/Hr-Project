import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseUploadFile } from "@/lib/masters/import";

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

  const { rows, errors } = await parseUploadFile(file, "departments");
  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await db.departmentMaster.findFirst({
      where: { organizationId: user.organizationId, name: row.name },
    });
    if (existing) {
      await db.departmentMaster.update({
        where: { id: existing.id },
        data: {
          headName: row.headName ?? null,
          location: row.location ?? "Bony Polymers",
          kraSheetId: row.kraSheetId ?? null,
          sortOrder: row.sortOrder ?? existing.sortOrder,
          isActive: row.isActive ?? true,
        },
      });
      updated++;
    } else {
      await db.departmentMaster.create({
        data: {
          organizationId: user.organizationId,
          name: row.name,
          headName: row.headName ?? null,
          location: row.location ?? "Bony Polymers",
          kraSheetId: row.kraSheetId ?? null,
          sortOrder: row.sortOrder ?? 0,
          isActive: row.isActive ?? true,
        },
      });
      created++;
    }
  }

  return NextResponse.json({
    created,
    updated,
    rowsProcessed: rows.length,
    parseErrors: errors,
  });
}
