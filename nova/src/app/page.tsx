import { Suspense } from "react";
import { DemoLoginForm } from "@/components/auth/demo-login-form";
import { LoginBrandHeader } from "@/components/auth/login-brand-header";
import { LoginShell } from "@/components/auth/login-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPANY } from "@/lib/company";

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export default function HomePage() {
  return (
    <LoginShell productName={COMPANY.productName} companyName={COMPANY.name}>
      <LoginBrandHeader
        productName={COMPANY.productName}
        companyName={COMPANY.shortName}
      />

      <div className="mb-6 text-left">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem] xl:text-[1.85rem]">
          Log into your Account
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Admin quick access, employee ECN login, or reporting manager — choose your
          role below.
        </p>
      </div>

      <Suspense fallback={<LoginFormFallback />}>
        <DemoLoginForm />
      </Suspense>
    </LoginShell>
  );
}
