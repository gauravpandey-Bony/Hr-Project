import Link from "next/link";
import { Suspense } from "react";
import { Gauge, PenLine, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { BonyLogo } from "@/components/brand/bony-logo";
import { Button } from "@/components/ui/button";
import { MotionFadeUp } from "@/components/ui/motion";
import { DemoLoginForm } from "@/components/auth/demo-login-form";

export default function HomePage() {
  return (
    <div className="min-h-screen mesh-bg">
      <header className="sticky top-0 z-50 border-b border-border/60 glass-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BonyLogo size="md" />
            <div>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {COMPANY.productName}
              </span>
              <p className="text-xs text-muted-foreground">{COMPANY.name}</p>
            </div>
          </div>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <MotionFadeUp>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Modern KPI workspace for {COMPANY.shortName}
          </p>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-foreground md:text-5xl text-balance">
            KPI software that&apos;s actually simple
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground text-balance">
            Like <strong className="font-medium text-foreground">SimpleKPI</strong> — create
            metrics, update data in seconds, and see gauges and trends on one dashboard.
          </p>
        </MotionFadeUp>

        <MotionFadeUp delay={0.1} className="mt-10">
          <Suspense
            fallback={
              <div className="max-w-lg rounded-2xl border bg-card p-6">
                <div className="mb-4 h-8 w-40 animate-pulse rounded bg-muted" />
                <div className="h-32 animate-pulse rounded-xl bg-muted" />
              </div>
            }
          >
            <div className="max-w-lg">
              <DemoLoginForm compact />
            </div>
          </Suspense>
        </MotionFadeUp>

        <MotionFadeUp delay={0.15} className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/login">
              Go to sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard/track">Update KPI data</Link>
          </Button>
        </MotionFadeUp>

        <div className="mt-16 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {[
            {
              icon: Gauge,
              title: "Visual dashboards",
              desc: "Gauges, traffic lights, and trend bars — see performance at a glance.",
            },
            {
              icon: PenLine,
              title: "Easy data entry",
              desc: "One form to log monthly or daily figures. No more spreadsheet chaos.",
            },
            {
              icon: BarChart3,
              title: "Reports & league tables",
              desc: "Compare KPIs by Production, Quality, Safety, and more.",
            },
          ].map((f, i) => (
            <MotionFadeUp key={f.title} delay={0.15 + i * 0.05}>
              <div className="h-full rounded-2xl border bg-card p-6 shadow-soft transition hover:shadow-elevated">
                <f.icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </MotionFadeUp>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "On-time dispatch", val: "94%", status: "amber" },
            { label: "Defect rate", val: "1.4%", status: "green" },
            { label: "Safety incidents", val: "0", status: "green" },
            { label: "Production (MT)", val: "2,840", status: "green" },
          ].map((k, i) => (
            <MotionFadeUp key={k.label} delay={0.25 + i * 0.04}>
              <div className="rounded-xl border bg-card p-4 text-center shadow-soft">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{k.val}</p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${
                    k.status === "green"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {k.status === "green" ? "On target" : "Off target"}
                </span>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </main>
    </div>
  );
}
