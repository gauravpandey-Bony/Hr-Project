import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseUploadFile, type EmployeeImportRow } from "@/lib/masters/import";
import {
  isEmployeeKraBuffer,
  previewEmployeeRowsUpload,
  previewKraWorkbookUpload,
} from "@/lib/masters/preview-employee-upload";

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

  const buffer = await file.arrayBuffer();

  if (isEmployeeKraBuffer(buffer)) {
    const preview = await previewKraWorkbookUpload(
      db,
      user.organizationId,
      buffer,
      file.name
    );
    return NextResponse.json({ ok: true, ...preview });
  }

  const blob = new Blob([buffer]);
  const clone = new File([blob], file.name, { type: file.type });
  const { rows: parsedRows, errors } = await parseUploadFile(clone, "employees");
  const rows = parsedRows as EmployeeImportRow[];
  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  const preview = await previewEmployeeRowsUpload(db, user.organizationId, rows);
  return NextResponse.json({ ok: true, ...preview, parseErrors: errors });
}
