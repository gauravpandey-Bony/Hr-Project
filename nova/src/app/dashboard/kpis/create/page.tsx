import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOrgUnitBySlug } from "@/lib/org-units.server";
import { CreateKpiForm } from "@/components/kpi/create-kpi-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function CreateKpiPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard/kpis");

  const { unit: unitId } = await searchParams;
  const unit = unitId
    ? await getOrgUnitBySlug(user.organizationId, unitId)
    : undefined;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={unit ? `Add KPI — ${unit.name}` : "Create KPI"}
        description={
          unit
            ? `New KPI will appear on the ${unit.name} dashboard once saved.`
            : "Add a new metric to track — just like SimpleKPI."
        }
      />
      <CreateKpiForm unitId={unit?.id} plantUnitKey={unit?.plantUnitKey} />
    </div>
  );
}
