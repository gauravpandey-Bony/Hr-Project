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
