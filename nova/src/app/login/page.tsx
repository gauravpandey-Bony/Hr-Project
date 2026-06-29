import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, Sparkles } from "lucide-react";
import { BonyLogo } from "@/components/brand/bony-logo";
import { DemoLoginForm } from "@/components/auth/demo-login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { LoginSessionBanner } from "@/components/auth/login-session-banner";
import { getDefaultCompanyContext } from "@/lib/company.server";

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export default async function LoginPage() {
  const [currentUser, company] = await Promise.all([
    getCurrentUser(),
    getDefaultCompanyContext(),
  ]);

  return (
    <div className="mesh-bg flex min-h-screen">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,hsl(var(--sidebar))_0%,hsl(224_47%_4%)_50%,hsl(162_72%_20%/0.15)_100%)]" />
        <div className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex items-center gap-3">
            <BonyLogo size="lg" variant="full" priority />
            <div>
              <p className="text-lg font-bold tracking-tight">{company.productName}</p>
              <p className="text-sm text-sidebar-foreground/50">{company.name}</p>
            </div>
          </Link>

          <div className="max-w-md space-y-6">
            <h1 className="text-4xl font-bold tracking-tight xl:text-[2.75rem] xl:leading-tight">
              Performance tracking, reimagined.
            </h1>
            <p className="text-base leading-relaxed text-sidebar-foreground/65">
              KRAs, quarterly targets, team reports — one modern workspace for{" "}
              {company.name}.
            </p>
            <ul className="space-y-3 text-sm text-sidebar-foreground/75">
              <li className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
                Dashboards & league reports
              </li>
              <li className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                AI-assisted KPI generation
              </li>
            </ul>
          </div>

          <p className="text-xs text-sidebar-foreground/40">
            Sign in with your user ID and password
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="mesh-bg flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/50 px-4 py-4 sm:px-8 lg:border-0">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <BonyLogo size="sm" />
            <span className="font-semibold text-foreground">{company.productName}</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            ← Back to home
          </Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[540px] rounded-3xl border border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur-xl sm:p-8">
            {currentUser && (
              <LoginSessionBanner
                name={currentUser.name}
                role={currentUser.role}
              />
            )}
            <Suspense fallback={<LoginFormFallback />}>
              <DemoLoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
