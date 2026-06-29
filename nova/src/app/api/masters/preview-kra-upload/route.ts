import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { previewKraUpload } from "@/lib/masters/preview-kra-upload";

export const maxDuration = 60;

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

  const plantUnitKey = String(formData.get("plantUnitKey") ?? "").trim() || null;
  const buffer = await file.arrayBuffer();
  const preview = await previewKraUpload(db, user.organizationId, buffer, {
    plantUnitKey,
    sourceFileName: file.name,
  });

  if (!preview.employeeKra) {
    return NextResponse.json(
      {
        error:
          preview.errors[0] ??
          "No employee KRA sheets found. Use employee workbook or pick department after upload.",
        ...preview,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, ...preview });
}
