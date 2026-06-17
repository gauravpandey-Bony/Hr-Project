import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sync37pFromBuffer, sync37pFromDefaultFile } from "@/lib/masters/sync-37p";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  const result = file
    ? await sync37pFromBuffer(db, user.organizationId, await file.arrayBuffer())
    : await sync37pFromDefaultFile(db, user.organizationId);

  if (result.errors.length && result.employeeCount === 0) {
    return NextResponse.json({ error: result.errors.join("; "), ...result }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `37P roster synced: ${result.employeeCount} employees active.`,
    ...result,
  });
}
