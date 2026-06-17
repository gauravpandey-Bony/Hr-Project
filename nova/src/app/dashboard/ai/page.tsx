import { getCurrentUser } from "@/lib/auth";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { resolveWorkspace } from "@/lib/unit-workspace.server";

const AiChat = dynamic(
  () => import("@/components/ai/ai-chat").then((m) => m.AiChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">Loading Maya…</p>
      </div>
    ),
  }
);

export default async function AiAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Maya — AI Assistant"
        description={
          isAdmin
            ? "Ask anything — employees, departments, KPIs across all units."
            : workspace.unit
              ? `Answers for ${workspace.unit.name} and your team.`
              : "Your KPI assistant."
        }
      />
      <AiChat
        isAdmin={isAdmin}
        orgWide={isAdmin}
        unitId={workspace.unitId ?? undefined}
        unitName={workspace.unit?.name}
      />
    </div>
  );
}
