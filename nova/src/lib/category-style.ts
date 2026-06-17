/** Visual tokens per KPI category — works in light & dark */
export const CATEGORY_STYLES: Record<
  string,
  { badge: string; dot: string }
> = {
  Production: {
    badge:
      "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  Quality: {
    badge: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  Sales: {
    badge: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  Maintenance: {
    badge: "bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  Safety: {
    badge: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  Finance: {
    badge: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  Process: {
    badge: "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  Store: {
    badge: "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  Billing: {
    badge: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  HR: {
    badge: "bg-pink-500/10 text-pink-700 ring-pink-500/20 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  IT: {
    badge: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300",
    dot: "bg-blue-500",
  },
};

export const DEFAULT_CATEGORY_STYLE = {
  badge: "bg-muted text-muted-foreground ring-border",
  dot: "bg-muted-foreground",
};

export function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? DEFAULT_CATEGORY_STYLE;
}
