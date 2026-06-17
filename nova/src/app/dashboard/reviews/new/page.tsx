import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CreateCycleForm } from "@/components/reviews/create-cycle-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewCyclePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard/reviews");

  const [templates, users] = await Promise.all([
    db.reviewTemplate.findMany({ where: { organizationId: user.organizationId } }),
    db.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, department: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Create review cycle"
        description="Configure workflow (self, manager, peer) and launch to Teams when ready."
      />
      <CreateCycleForm templates={templates} users={users} />
    </div>
  );
}
