import Image from "next/image";
import Link from "next/link";
import { BarChart3, Building2, TrendingUp } from "lucide-react";
import { BonyLogoFlip } from "@/components/brand/bony-logo-flip";

const BUILDING_IMAGE = "/brand/bony-corporate-building.jpg";

const HIGHLIGHTS = [
  { icon: Building2, label: "Multi-plant", value: "12+ units" },
  { icon: BarChart3, label: "KRA / KPI", value: "Live tracking" },
  { icon: TrendingUp, label: "Performance", value: "Quarterly scores" },
] as const;

export function LoginShell({
  productName,
  companyName,
  children,
  backHref,
  backLabel,
}: {
  productName: string;
  companyName: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:min-h-[100dvh] lg:flex-row">
      {/* Desktop hero — full-height building showcase */}
      <aside className="relative hidden min-h-[100dvh] w-[54%] shrink-0 overflow-hidden lg:block xl:w-[58%]">
        <div className="absolute inset-3 overflow-hidden rounded-[1.75rem] ring-1 ring-white/20 xl:inset-4">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            fill
            priority
            className="object-cover object-[center_42%] scale-[1.02]"
            sizes="58vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-900/25 to-slate-900/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/30 via-transparent to-transparent" />
        </div>

        <div className="relative flex h-full min-h-[100dvh] flex-col justify-between p-8 xl:p-12">
          <div className="flex items-center gap-3 pl-1 pt-1">
            <BonyLogoFlip size="lg" />
            <div>
              <p className="text-lg font-bold tracking-tight text-white drop-shadow-sm">
                {productName}
              </p>
              <p className="text-sm text-white/80">{companyName}</p>
            </div>
          </div>

          <div className="max-w-xl space-y-5 pb-2 pl-1">
            <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md">
              Performance management
            </p>
            <h1 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight text-white drop-shadow-md xl:text-[2.65rem]">
              KPI tracking built for every plant.
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-white/85 xl:text-base">
              Department master, employee KRA sheets, and quarterly reports — one
              workspace for {companyName}.
            </p>

            <div className="grid max-w-lg grid-cols-3 gap-2.5 pt-1">
              {HIGHLIGHTS.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md"
                >
                  <Icon className="mb-1.5 h-4 w-4 text-white/90" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/55">
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-white xl:text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="pl-1 text-[11px] text-white/45">
            © {new Date().getFullYear()} {companyName}
          </p>
        </div>
      </aside>

      {/* Sign-in column */}
      <div className="login-mesh relative flex min-h-screen flex-1 flex-col lg:min-h-[100dvh]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_0%,hsl(221_83%_48%/0.08),transparent_55%)]" />

        {/* Mobile hero strip — unchanged, works well */}
        <div className="relative h-40 w-full shrink-0 overflow-hidden lg:hidden">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            fill
            priority
            className="object-cover object-[center_40%]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/50 to-primary/35" />
          <div className="relative z-10 flex h-full items-end gap-3 p-5">
            <BonyLogoFlip size="md" />
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                {companyName}
              </p>
              <p className="text-xl font-bold text-white">{productName}</p>
            </div>
          </div>
        </div>

        <main className="relative flex flex-1 flex-col">
          {backHref && backLabel ? (
            <header className="flex items-center justify-end px-5 py-4 sm:px-8 lg:px-10">
              <Link
                href={backHref}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {backLabel}
              </Link>
            </header>
          ) : null}

          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-2 sm:px-8 lg:px-10 lg:py-12 xl:px-14">
            <div className="w-full max-w-[440px] animate-fade-up lg:max-w-[460px] xl:max-w-[500px]">
              {/* Brand row — mobile only (desktop brand lives on hero) */}
              <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
                <BonyLogoFlip size="lg" />
                <div>
                  <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {productName}
                  </p>
                  <p className="text-sm text-muted-foreground">{companyName}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-elevated backdrop-blur-sm sm:p-7 lg:p-8">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
