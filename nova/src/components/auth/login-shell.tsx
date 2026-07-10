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
    <div className="flex min-h-screen flex-col bg-[#eef1f6] lg:min-h-[100dvh] lg:flex-row">
      {/* Desktop hero */}
      <aside className="relative hidden min-h-[100dvh] w-[54%] shrink-0 overflow-hidden lg:block xl:w-[58%]">
        <div className="absolute inset-0 overflow-hidden bg-[#0b1220]">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            fill
            priority
            className="object-cover object-top"
            sizes="58vw"
          />
          {/* Scrim stronger at bottom where glass text sits */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        <div className="relative flex h-full min-h-[100dvh] flex-col justify-end p-8 xl:p-12">
          {/* Glass panel anchored at bottom — no top logo */}
          <div className="max-w-xl space-y-4 pb-1">
            <div className="login-hero-glass space-y-5 p-6 xl:p-7">
              <p className="inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md">
                Performance management
              </p>
              <h1
                className="text-balance text-3xl font-bold leading-[1.12] tracking-tight text-white xl:text-[2.65rem]"
                style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
              >
                KPI tracking built for every plant.
              </h1>
              <p
                className="max-w-lg text-sm leading-relaxed text-white/95 xl:text-base"
                style={{ textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}
              >
                Department master, employee KRA sheets, and quarterly reports — one
                workspace for {companyName}.
              </p>

              <div className="grid max-w-lg grid-cols-3 gap-2.5 pt-1">
                {HIGHLIGHTS.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="login-stat-tile">
                    <Icon className="mb-1.5 h-4 w-4 text-white drop-shadow" />
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/70">
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-white xl:text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <p
              className="pl-1 text-[11px] text-white/70"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
            >
              © {new Date().getFullYear()} {companyName}
            </p>
          </div>
        </div>
      </aside>

      {/* Sign-in column */}
      <div className="login-mesh relative flex min-h-screen flex-1 flex-col lg:min-h-[100dvh]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(59,130,246,0.14),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_0%_100%,rgba(245,158,11,0.08),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.55),transparent_65%)]" />

        {/* Mobile hero */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-[#0b1220] lg:hidden">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            fill
            priority
            className="object-contain object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />
          <div className="relative z-10 flex h-full items-end gap-3 p-5">
            <BonyLogoFlip size="md" />
            <div>
              <p
                className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/85"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
              >
                {companyName}
              </p>
              <p
                className="text-xl font-bold text-white"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.65)" }}
              >
                {productName}
              </p>
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
              <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
                <BonyLogoFlip size="lg" />
                <div>
                  <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {productName}
                  </p>
                  <p className="text-sm text-muted-foreground">{companyName}</p>
                </div>
              </div>

              {/* Apple-style elevated glass panel */}
              <div className="login-panel-3d p-6 sm:p-7 lg:p-8">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
