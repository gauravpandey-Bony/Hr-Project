import Image from "next/image";
import Link from "next/link";
import { BarChart3, Building2, TrendingUp } from "lucide-react";
import { BonyLogo } from "@/components/brand/bony-logo";

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
  backHref = "/",
  backLabel = "Back to home",
}: {
  productName: string;
  companyName: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Hero — building photo (desktop) */}
      <aside className="relative hidden min-h-screen w-[48%] shrink-0 overflow-hidden lg:block xl:w-[52%]">
        <Image
          src={BUILDING_IMAGE}
          alt={`${companyName} corporate office`}
          fill
          priority
          className="object-cover object-center"
          sizes="52vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/75 via-slate-900/45 to-primary/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-900/25" />

        <div className="relative flex h-full min-h-screen flex-col justify-between p-10 text-white xl:p-14">
          <div className="flex items-center gap-3">
            <BonyLogo size="lg" variant="full" priority className="brightness-0 invert" />
            <div>
              <p className="text-lg font-bold tracking-tight">{productName}</p>
              <p className="text-sm text-white/75">{companyName}</p>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                Performance management
              </p>
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight xl:text-[2.75rem]">
                KPI tracking built for every plant.
              </h1>
              <p className="text-base leading-relaxed text-white/80">
                Department master, employee KRA sheets, and quarterly reports — one
                workspace for {companyName}.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {HIGHLIGHTS.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md"
                >
                  <Icon className="mb-2 h-5 w-5 text-white/90" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                    {label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/50">© {new Date().getFullYear()} {companyName}</p>
        </div>
      </aside>

      {/* Sign-in column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile hero strip */}
        <div className="relative h-40 w-full shrink-0 lg:hidden">
          <Image
            src={BUILDING_IMAGE}
            alt={`${companyName} corporate office`}
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/50 to-primary/35" />
          <div className="relative flex h-full flex-col justify-end p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
              {companyName}
            </p>
            <p className="text-xl font-bold text-white">{productName}</p>
          </div>
        </div>

        <main className="flex flex-1 flex-col">
          <header className="flex items-center justify-end px-5 py-4 sm:px-8">
            <Link
              href={backHref}
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              {backLabel}
            </Link>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-2 sm:px-8">
            <div className="w-full max-w-[440px] animate-fade-up">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
