import Image from "next/image";
import Link from "next/link";
import { BarChart3, Building2, TrendingUp } from "lucide-react";
import { BonyLogoFlip } from "@/components/brand/bony-logo-flip";

const BUILDING_IMAGE = "/brand/bony-corporate-building.jpg";
/** Native photo size — keep aspect, never stretch/crop */
const BUILDING_W = 1024;
const BUILDING_H = 502;

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
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#eef1f6] lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
      {/* Desktop: full photo (no stretch) → content starts where image ends */}
      <aside className="relative hidden h-full w-[52%] shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-[#0b1220] lg:flex xl:w-[56%]">
        <div className="relative w-full shrink-0 bg-[#0b1220]">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            width={BUILDING_W}
            height={BUILDING_H}
            priority
            className="h-auto w-full object-contain object-center"
            sizes="56vw"
          />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col justify-start bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#0b1220] px-5 pb-4 pt-3 xl:px-7 xl:pt-4">
          <div className="login-hero-glass w-full space-y-3 p-5 xl:space-y-3.5 xl:p-6">
            <p className="inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md">
              Performance management
            </p>
            <h1
              className="text-balance text-[1.85rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[2.15rem]"
              style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
            >
              KPI tracking built for every plant.
            </h1>
            <p
              className="text-sm leading-relaxed text-white/95"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}
            >
              Department master, employee KRA sheets, and quarterly reports — one
              workspace for {companyName}.
            </p>

            <div className="grid w-full grid-cols-3 gap-2 pt-0.5">
              {HIGHLIGHTS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="login-stat-tile !p-2.5">
                  <Icon className="mb-1 h-3.5 w-3.5 text-white drop-shadow" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/70">
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2 px-1 xl:mt-6">
            <p
              className="text-base font-semibold leading-snug tracking-tight text-white xl:text-lg"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.45)" }}
            >
              Engineering polymer excellence across every plant.
            </p>
            <p
              className="max-w-xl text-sm leading-relaxed text-white/75"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
            >
              From precision components to people performance — Bony Polymers
              builds quality, discipline, and accountability into every shift.
            </p>
            <p
              className="text-sm font-medium text-sky-200/90"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
            >
              One team. Many units. One standard of excellence.
            </p>
          </div>

          <p
            className="mt-auto pt-4 pl-1 text-[11px] text-white/60"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
          >
            © {new Date().getFullYear()} {companyName}
          </p>
        </div>
      </aside>

      {/* Sign-in column */}
      <div className="login-mesh relative flex min-h-[100dvh] flex-1 flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(59,130,246,0.14),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_0%_100%,rgba(245,158,11,0.08),transparent_50%)]" />

        <div className="relative w-full shrink-0 overflow-hidden bg-[#0b1220] lg:hidden">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            width={BUILDING_W}
            height={BUILDING_H}
            priority
            className="h-auto w-full object-contain object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 p-4">
            <BonyLogoFlip size="md" />
            <div>
              <p
                className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/85"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
              >
                {companyName}
              </p>
              <p
                className="text-lg font-bold text-white"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.65)" }}
              >
                {productName}
              </p>
            </div>
          </div>
        </div>

        <main className="relative flex flex-1 flex-col">
          {backHref && backLabel ? (
            <header className="flex items-center justify-end px-5 py-3 sm:px-8 lg:px-10">
              <Link
                href={backHref}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {backLabel}
              </Link>
            </header>
          ) : null}

          <div className="flex flex-1 flex-col items-center justify-start px-5 pb-8 pt-5 sm:px-8 sm:pt-7 lg:px-10 lg:pb-6 lg:pt-8 xl:px-14 xl:pt-10">
            <div className="w-full max-w-[420px] animate-fade-up">
              <div className="login-panel-scrut p-7 sm:p-8">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
