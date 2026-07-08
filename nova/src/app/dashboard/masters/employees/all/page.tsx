import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EmployeeMasterClient } from "@/components/masters/employee-master-client";
import { dedupeEmployeeMasterRows } from "@/lib/employee-master-grouping";
import { filterRealKraEmployees } from "@/lib/masters/logistics-kra-junk";
import { sanitizeKraDesignation } from "@/lib/masters/kra-workbook";

export const dynamic = "force-dynamic";

/** Organization-wide employee list — all plants, no unit filter. */
export default async function AllPlantsEmployeeMasterPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role !== "ADMIN") {
    return null;
  }

  const [employees, departments] = await Promise.all([
    db.employeeMaster.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.departmentMaster.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const rows = dedupeEmployeeMasterRows(filterRealKraEmployees(employees)).map(
    (e) => ({
      ...e,
      designation: sanitizeKraDesignation(e.designation) ?? null,
    })
  );

  return (
    <EmployeeMasterClient
      initialRows={rows}
      departments={departments}
      isAdmin={user.role === "ADMIN"}
      allPlants
    />
  );
}
