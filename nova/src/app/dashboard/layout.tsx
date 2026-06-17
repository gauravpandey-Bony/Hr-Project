import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { OrgUnitsProvider } from "@/components/providers/org-units-provider";
import { getCurrentUser } from "@/lib/auth";
import { fetchOrgStructure } from "@/lib/org-units.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const structure = await fetchOrgStructure(user.organizationId);

  return (
    <OrgUnitsProvider structure={structure}>
      <AppShell currentName={user.name} currentRole={user.role}>
        {children}
      </AppShell>
    </OrgUnitsProvider>
  );
}
