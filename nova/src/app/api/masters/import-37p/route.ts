import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sync37pFromBuffer, sync37pFromDefaultFile } from "@/lib/masters/sync-37p";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let file: File | null = null;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const entry = formData.get("file");
      if (entry instanceof File && entry.size > 0) {
        file = entry;
      }
    }

    const result = file
      ? await sync37pFromBuffer(db, user.organizationId, await file.arrayBuffer())
      : await sync37pFromDefaultFile(db, user.organizationId);

    if (result.errors.length && result.employeeCount === 0) {
      return NextResponse.json(
        { error: result.errors.join("; "), ...result },
        { status: 400 }
      );
    }

    revalidatePath("/dashboard/masters", "layout");

    return NextResponse.json({
      ok: true,
      message: `37P roster synced: ${result.employeeCount} employees active.`,
      ...result,
    });
  } catch (err) {
    console.error("import-37p failed:", err);
    const msg = err instanceof Error ? err.message : "37P import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

