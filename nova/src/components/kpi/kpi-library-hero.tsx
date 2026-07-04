import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";
import { Library, PenLine, Sparkles } from "lucide-react";

export function KpiLibraryHero({
  total,
  onTrack,
  offTarget,
}: {
  total: number;
  onTrack: number;
  offTarget: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
            <Library className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-blue-100">{COMPANY.shortName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">KPI Library</h1>
          <p className="mt-2 text-sm text-slate-300/90 sm:text-base">
            Browse, filter, and update every metric — {COMPANY.kraMasterSheetLabel}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/track"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md transition hover:bg-white/20"
          >
            <PenLine className="h-4 w-4" />
            Update data
          </Link>
          <Link
            href="/dashboard/ai"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-indigo-500"
          >
            <Sparkles className="h-4 w-4" />
            AI assistant
          </Link>
        </div>
      </div>

      <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total KPIs", value: total, accent: "text-white" },
          { label: "On target", value: onTrack, accent: "text-emerald-300" },
          { label: "Off target", value: offTarget, accent: "text-rose-300" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {s.label}
            </p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", s.accent)}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
