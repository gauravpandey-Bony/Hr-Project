import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { personNameVariants } from "@/lib/person-name";
import { appendUnitQuery } from "@/lib/unit-workspace";

async function findEmployeeByQuery(organizationId: string, query: string) {
  const q = query.trim();
  if (!q) return null;

  const byEcn = await db.employeeMaster.findFirst({
    where: { organizationId, ecn: q },
    select: { id: true },
  });
  if (byEcn) return byEcn;

  const variants = personNameVariants(q);
  if (variants.length === 0) return null;

  return db.employeeMaster.findFirst({
    where: {
      organizationId,
      OR: variants.map((name) => ({ name })),
    },
    select: { id: true },
    orderBy: { isActive: "desc" },
  });
}

/** Legacy URL: /dashboard/reports/employee?q=ECN — redirects to employee profile */
export default async function LegacyEmployeeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === "EMPLOYEE") {
    redirect("/dashboard");
  }

  const { q, unit } = await searchParams;
  if (!q?.trim()) {
    redirect(
      unit
        ? appendUnitQuery("/dashboard/masters/employees", unit)
        : "/dashboard/masters/employees"
    );
  }

  const employee = await findEmployeeByQuery(user.organizationId, q);
  if (!employee) notFound();

  const profilePath = `/dashboard/masters/employees/${employee.id}`;
  redirect(unit ? appendUnitQuery(profilePath, unit) : profilePath);
}
