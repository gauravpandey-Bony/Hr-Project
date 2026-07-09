import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, Building2, Sparkles, TrendingUp } from "lucide-react";
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

const HIGHLIGHTS = [
  {
    icon: Building2,
    label: "Multi-plant",
    value: "12+ units",
    detail: "37P, Corporate, Fluid 58 & more",
  },
  {
    icon: BarChart3,
    label: "KRA / KPI",
    value: "Live tracking",
    detail: "Department & individual sheets",
  },
  {
    icon: TrendingUp,
    label: "Performance",
    value: "Quarterly",
    detail: "Targets, achieved & scores",
  },
] as const;

export default async function LoginPage() {
  const [currentUser, company] = await Promise.all([
    getCurrentUser(),
    getDefaultCompanyContext(),
  ]);

  return (
    <div className="login-mesh flex min-h-screen">
      {/* Brand panel — light Redo-style hero */}
      <aside className="relative hidden w-[46%] overflow-hidden border-r border-border/60 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 top-16 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-8 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex items-center gap-3">
            <BonyLogo size="lg" variant="full" priority />
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground">
                {company.productName}
              </p>
              <p className="text-sm text-muted-foreground">{company.name}</p>
            </div>
          </Link>

          <div className="max-w-lg space-y-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Bony performance platform
              </p>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground xl:text-[2.85rem] xl:leading-[1.12]">
                KPI tracking built for every plant.
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                Department master, employee KRA sheets, and quarterly reports — one
                modern workspace for {company.name}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {HIGHLIGHTS.map(({ icon: Icon, label, value, detail }) => (
                <div key={label} className="stat-pill">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/80">
            Sign in with your user ID and password
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="mesh-bg flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/50 bg-white/60 px-4 py-4 backdrop-blur-sm sm:px-8 lg:border-0 lg:bg-transparent">
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
          <div className="w-full max-w-[520px] animate-fade-up">
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to your {company.productName} workspace
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-elevated backdrop-blur-sm sm:p-8">
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
        </div>
      </main>
    </div>
  );
}
