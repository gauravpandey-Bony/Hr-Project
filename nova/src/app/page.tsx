import { Suspense } from "react";
import { DemoLoginForm } from "@/components/auth/demo-login-form";
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
      <div className="mb-6 text-center lg:mb-7 lg:text-left">
        <p className="mb-2 inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_4px_10px_-6px_rgba(15,23,42,0.12)]">
          Secure access
        </p>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem] xl:text-[1.85rem]">
          Sign in to {COMPANY.productName}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
