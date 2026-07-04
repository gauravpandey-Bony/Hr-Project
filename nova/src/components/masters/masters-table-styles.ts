import { cn } from "@/lib/utils";

/** Compact editable cells for master tables */
export function masterCellInput(className?: string) {
  return cn(
    "block w-full rounded-md border border-input bg-background px-2 py-1 text-xs leading-tight text-foreground caret-foreground",
    "whitespace-nowrap",
    "focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring",
    className
  );
}

export const MASTER_TABLE_CLASS = "w-max min-w-full table-auto text-xs";

export const MASTER_CELL = "px-1.5 py-1 align-middle whitespace-nowrap";

export const MASTER_HEAD =
  "h-9 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

/** Shared hero banner for Department / Employee master pages */
export const MASTER_HERO =
  "relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 px-6 py-8 text-white shadow-xl sm:px-8";

export const MASTER_HERO_BADGE =
  "mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm";

export const MASTER_HERO_SUBTITLE = "mt-1 text-sm text-emerald-50/85";

export const MASTER_HERO_BTN_SECONDARY =
  "inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50";

export const MASTER_HERO_BTN_PRIMARY =
  "inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50";
