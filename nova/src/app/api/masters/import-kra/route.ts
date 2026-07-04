import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { dedupeEmployeeMastersByEcn } from "@/lib/masters/dedupe-employees";
import { syncKraFromDefaultFile } from "@/lib/masters/sync-kra-workbook";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await syncKraFromDefaultFile(
      db,
      user.organizationId,
      undefined,
      user.id
    );
    await dedupeEmployeeMastersByEcn(db, user.organizationId);

    if (
      result.errors.length &&
      result.employeeCount === 0 &&
      result.kpisCreated === 0
    ) {
      return NextResponse.json(
        { error: result.errors.join("; "), ...result },
        { status: 400 }
      );
    }

    revalidatePath("/dashboard/masters", "layout");
    revalidatePath("/dashboard/kra", "layout");
    revalidatePath("/dashboard/units", "layout");

    return NextResponse.json({
      ok: true,
      message: `IT KRA synced: ${result.employeeCount} employees, ${result.kpisCreated} KPIs created / ${result.kpisUpdated} updated.`,
      ...result,
    });
  } catch (err) {
    console.error("import-kra failed:", err);
    const msg = err instanceof Error ? err.message : "KRA import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
