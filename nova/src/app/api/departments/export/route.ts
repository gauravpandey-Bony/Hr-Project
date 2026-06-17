import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { departmentMasterWhereForPlant } from "@/lib/unit-workspace";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import {
  departmentMasterFilename,
  departmentMasterXlsxBuffer,
} from "@/lib/masters/export-departments";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitSlug = searchParams.get("unit");

  const workspace = await resolveWorkspace(user, unitSlug);

  const departments = await db.departmentMaster.findMany({
    where: workspace.dataScope
      ? departmentMasterWhereForPlant(user.organizationId, workspace.dataScope)
      : { organizationId: user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      name: true,
      headName: true,
      location: true,
      kraSheetId: true,
      sortOrder: true,
      isActive: true,
    },
  });

  const buffer = departmentMasterXlsxBuffer(departments);
  const filename = departmentMasterFilename(workspace.unitId);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
