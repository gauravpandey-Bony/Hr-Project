import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { OrgUnitsProvider } from "@/components/providers/org-units-provider";
import { CompanyProvider } from "@/components/providers/company-provider";
import { getCurrentUser } from "@/lib/auth";
import { fetchOrgStructure } from "@/lib/org-units.server";
import { getCompanyContext } from "@/lib/company.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [structure, company] = await Promise.all([
    fetchOrgStructure(user.organizationId),
    getCompanyContext(user.organizationId),
  ]);

  return (
    <CompanyProvider company={company}>
      <OrgUnitsProvider structure={structure}>
        <AppShell currentName={user.name} currentRole={user.role}>
          {children}
        </AppShell>
      </OrgUnitsProvider>
    </CompanyProvider>
  );
}
