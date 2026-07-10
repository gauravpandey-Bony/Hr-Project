import { cn } from "@/lib/utils";

/** Shared score → color mapping (90 / 70 thresholds). */
export function scoreToneClass(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-rose-600";
}

export function scoreFillClass(score: number | null): string {
  if (score == null) return "bg-slate-200 text-slate-500 ring-slate-300/80";
  if (score >= 90) return "bg-emerald-500 text-white ring-emerald-600/30";
  if (score >= 70) return "bg-amber-500 text-white ring-amber-600/30";
  return "bg-rose-500 text-white ring-rose-600/30";
}

export function scoreSoftBgClass(score: number | null): string {
  if (score == null) return "bg-slate-100 text-slate-500";
  if (score >= 90) return "bg-emerald-500/15 text-emerald-700";
  if (score >= 70) return "bg-amber-500/15 text-amber-800";
  return "bg-rose-500/15 text-rose-700";
}
