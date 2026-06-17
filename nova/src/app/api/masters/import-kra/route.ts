import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { syncKraFromDefaultFile, syncKraWorkbook } from "@/lib/masters/sync-kra-workbook";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  const result = file
    ? await syncKraWorkbook(
        db,
        user.organizationId,
        await file.arrayBuffer(),
        user.id
      )
    : await syncKraFromDefaultFile(db, user.organizationId, undefined, user.id);

  if (
    result.errors.length &&
    result.employeesCreated === 0 &&
    result.employeesUpdated === 0
  ) {
    return NextResponse.json({ error: result.errors.join("; "), ...result }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `KRA import: ${result.employeesCreated + result.employeesUpdated} employees, ${result.kpisCreated + result.kpisUpdated} KPIs.`,
    ...result,
  });
}
