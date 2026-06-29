import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { KraPageClient } from "@/components/kra/kra-page-client";
import { getCompanyContext } from "@/lib/company.server";
import { fetchKraSheets, fetchKraEmployeesByDepartment } from "@/lib/kra-sheets.server";

export default async function KraPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  requireAdminWorkspace(user, workspace);

  const [kpis, sheets, employeesByDepartment, company] = await Promise.all([
    db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, workspace.dataScope, {}),
      include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
      orderBy: [{ kpiLevel: "asc" }, { weightage: "desc" }],
    }),
    fetchKraSheets(user.organizationId),
    fetchKraEmployeesByDepartment(user.organizationId),
    getCompanyContext(user.organizationId),
  ]);

  return (
    <KraPageClient
      allKpis={kpis}
      sheets={sheets}
      employeesByDepartment={employeesByDepartment}
      company={company}
      isAdmin={user.role === "ADMIN"}
      plantUnit={workspace.plantUnitKey ?? "Bony Polymers"}
      unitName={workspace.unit?.name}
    />
  );
}
