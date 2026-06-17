"use client";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import type { LucideIcon } from "lucide-react";

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
};

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  empty,
  stickyHeader = true,
  className,
  rowClassName,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  empty?: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  stickyHeader?: boolean;
  className?: string;
  rowClassName?: string | ((row: T) => string);
}) {
  if (data.length === 0 && empty) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    );
  }

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-soft",
        className
      )}
    >
      <div className="max-h-[min(70vh,800px)] overflow-auto scrollbar-thin">
        <Table>
          <TableHeader
            className={cn(
              stickyHeader && "sticky top-0 z-10 bg-muted/80 backdrop-blur-md"
            )}
          >
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.align && alignClass[col.align],
                    col.headerClassName
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={getRowKey(row)}
                className={cn(
                  typeof rowClassName === "function"
                    ? rowClassName(row)
                    : rowClassName
                )}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      col.align && alignClass[col.align],
                      col.className
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length === 0 && !empty && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No results found.
        </p>
      )}
    </div>
  );
}
