import { Suspense } from "react";
import { DemoLoginForm } from "@/components/auth/demo-login-form";
import { LoginSessionBanner } from "@/components/auth/login-session-banner";
import { LoginShell } from "@/components/auth/login-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultCompanyContext } from "@/lib/company.server";

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export default async function LoginPage() {
  const [currentUser, company] = await Promise.all([
    getCurrentUser(),
    getDefaultCompanyContext(),
  ]);

  return (
    <LoginShell productName={company.productName} companyName={company.name}>
      <div className="mb-6 text-center lg:mb-7 lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-foreground xl:text-3xl">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your {company.productName} workspace
        </p>
      </div>

      {currentUser && (
        <LoginSessionBanner name={currentUser.name} role={currentUser.role} />
      )}
      <Suspense fallback={<LoginFormFallback />}>
        <DemoLoginForm />
      </Suspense>
    </LoginShell>
  );
}
