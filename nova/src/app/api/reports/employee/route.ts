import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getEmployeeReportByQuery,
  resolveEmployeeFromQuery,
  fetchKpisForEmployee,
  resolvedOwnerName,
  resolvedUserId,
} from "@/lib/ai/employee-report";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import { sheetMetaForDepartment } from "@/lib/kra-sheets";
import { IT_TEAM_META } from "@/lib/team-scope";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (user.role === "MANAGER") {
    return NextResponse.json(
      { error: "Use Team Reports for your team" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? searchParams.get("ecn") ?? searchParams.get("name") ?? "").trim();
  const unitId = searchParams.get("unit");
  if (!q) {
    return NextResponse.json({ error: "Missing q, ecn, or name" }, { status: 400 });
  }

  const workspace = await resolveWorkspace(user, unitId);

  const resolved = await resolveEmployeeFromQuery(q, user.organizationId);
  if (!resolved) {
    return NextResponse.json({ error: "Employee not found", query: q }, { status: 404 });
  }

  const dashboard = await getEmployeeReportByQuery(q, user.organizationId, user.role, user);
  if (!dashboard) {
    return NextResponse.json({ error: "Report unavailable" }, { status: 404 });
  }

  const ownerName = resolvedOwnerName(resolved);
  const canEdit = user.role === "ADMIN";

  const kpis = canEdit
    ? await fetchKpisForEmployee(
        user.organizationId,
        ownerName,
        resolvedUserId(resolved),
        workspace.plantUnitKey
      )
    : [];

  return NextResponse.json({
    dashboard,
    query: q,
    canEdit,
    ownerName,
    sheetMeta: canEdit
      ? dashboard.employee.department === "IT"
        ? IT_TEAM_META
        : sheetMetaForDepartment(dashboard.employee.department)
      : null,
    kpis: canEdit ? kpis : [],
  });
}
