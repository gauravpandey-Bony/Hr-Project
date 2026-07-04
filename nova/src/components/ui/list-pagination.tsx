"use client";

import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE = 20;

export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function ListPagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  className,
  label = "items",
}: {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
}) {
  const pageCount = pageCountFor(total, pageSize);
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  if (total <= pageSize) return null;

  const from = safePage * pageSize + 1;
  const to = Math.min((safePage + 1) * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 text-sm",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        Page {safePage + 1} of {pageCount} · showing {from}–{to} of {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
