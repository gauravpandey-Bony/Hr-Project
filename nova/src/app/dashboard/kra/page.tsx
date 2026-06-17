import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import {
  employeeMasterWhereForPlant,
} from "@/lib/unit-workspace";
import {
  resolveWorkspace,
  requireAdminWorkspace,
} from "@/lib/unit-workspace.server";
import { KraPageClient } from "@/components/kra/kra-page-client";

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

  const [kpis, employees] = await Promise.all([
    db.kpi.findMany({
      where: mergeKpiWhereForWorkspace(user, workspace.dataScope),
      include: { entries: { orderBy: { recordedAt: "desc" }, take: 12 } },
      orderBy: [{ kpiLevel: "asc" }, { weightage: "desc" }],
    }),
    db.employeeMaster.findMany({
      where: workspace.dataScope
        ? employeeMasterWhereForPlant(user.organizationId, workspace.dataScope)
        : { organizationId: user.organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <KraPageClient
      allKpis={kpis}
      employees={employees}
      isAdmin={user.role === "ADMIN"}
      plantUnit={workspace.plantUnitKey ?? "Bony Polymers"}
      unitName={workspace.unit?.name}
    />
  );
}
