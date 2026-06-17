import { cn } from "@/lib/utils";

/** Full-width editable cells — no truncation inside table columns */
export function masterCellInput(className?: string) {
  return cn(
    "block w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm leading-normal text-foreground caret-foreground",
    "whitespace-normal break-words",
    "focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring",
    className
  );
}

export const MASTER_TABLE_CLASS = "w-max min-w-full table-auto text-sm";

export const MASTER_CELL = "p-2 align-top whitespace-normal";
