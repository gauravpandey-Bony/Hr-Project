import type { Kpi, User } from "@prisma/client";
import { canManageKpi } from "@/lib/team-scope";

export async function assertCanManageKpi(
  user: User,
  kpi: Pick<Kpi, "id" | "ownerId" | "ownerName" | "department" | "kpiLevel" | "organizationId">
) {
  if (user.organizationId !== kpi.organizationId) return false;
  return canManageKpi(user, kpi);
}
