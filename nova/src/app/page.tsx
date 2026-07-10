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
    <LoginShell
      productName={COMPANY.productName}
      companyName={COMPANY.name}
      backHref="/login"
      backLabel="Full sign in page →"
    >
      <div className="mb-6 text-center lg:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Sign in to {COMPANY.productName}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Admin quick access, employee ECN login, or reporting manager — choose your
          role below.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-elevated sm:p-7">
        <Suspense fallback={<LoginFormFallback />}>
          <DemoLoginForm />
        </Suspense>
      </div>
    </LoginShell>
  );
}
