import { Suspense } from "react";
import { DemoLoginForm } from "@/components/auth/demo-login-form";
import { LoginBrandHeader } from "@/components/auth/login-brand-header";
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
      <LoginBrandHeader
        productName={company.productName}
        companyName={company.shortName ?? company.name}
      />

      <div className="mb-5 text-left">
        <h2 className="text-balance text-[1.65rem] font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
          Log into your Account
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Enter employee code registered on {company.productName}
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
