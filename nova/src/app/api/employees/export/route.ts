import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { employeeMasterWhereForUserAsync } from "@/lib/access-control";
import { employeeMasterWhereForPlant } from "@/lib/unit-workspace";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import {
  employeeMasterFilename,
  employeeMasterXlsxBuffer,
} from "@/lib/masters/export-employees";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitSlug = searchParams.get("unit");

  const workspace = await resolveWorkspace(user, unitSlug);

  const employeeWhere =
    user.role === "ADMIN" && workspace.dataScope
      ? employeeMasterWhereForPlant(user.organizationId, workspace.dataScope)
      : await employeeMasterWhereForUserAsync(user);

  const employeesExport = await db.employeeMaster.findMany({
    where:
      searchParams.get("all") === "1" && user.role === "ADMIN"
        ? { organizationId: user.organizationId, isActive: true }
        : employeeWhere,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      name: true,
      designation: true,
      department: true,
      location: true,
      doj: true,
      ecn: true,
      managerName: true,
      sortOrder: true,
      isActive: true,
    },
  });

  const buffer = employeeMasterXlsxBuffer(employeesExport);
  const filename =
    searchParams.get("all") === "1"
      ? employeeMasterFilename("all-plants")
      : employeeMasterFilename(workspace.unitId);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
