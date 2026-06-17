"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { formatKpiValue, type KpiStatus } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/kpi/kpi-card";
import { ProgressBar } from "./progress-bar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type ReportKpiItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current: number;
  target: number;
  progress: number;
  status: KpiStatus;
  kraName?: string | null;
  department?: string | null;
};

export function KpiDetailDrawer({
  open,
  title,
  subtitle,
  items,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  items: ReportKpiItem[];
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b bg-gradient-to-r from-sidebar to-primary/90 px-5 py-5 text-white">
          <p className="text-2xs font-semibold uppercase tracking-wider text-primary-foreground/80">
            KPI detail
          </p>
          <SheetTitle className="text-lg text-white">{title}</SheetTitle>
          {subtitle && (
            <SheetDescription className="text-white/70">{subtitle}</SheetDescription>
          )}
        </SheetHeader>

        <p className="border-b bg-muted/50 px-5 py-2 text-xs text-muted-foreground">
          {items.length} KPI{items.length !== 1 ? "s" : ""} — tap any row for full detail
        </p>

        <ScrollArea className="flex-1">
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/dashboard/kpis/${item.id}`}
                  className="group block px-5 py-4 transition hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground group-hover:text-primary">
                        {item.name}
                      </p>
                      {item.kraName && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          KRA: {item.kraName}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.category}
                        {item.department ? ` · ${item.department}` : ""}
                      </p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-muted/50 py-2">
                      <p className="text-muted-foreground">Actual</p>
                      <p className="font-bold text-foreground">
                        {formatKpiValue(item.current, item.unit)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2">
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-semibold text-foreground">
                        {formatKpiValue(item.target, item.unit)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2">
                      <p className="text-muted-foreground">Progress</p>
                      <p
                        className={cn(
                          "font-bold",
                          item.status === "green" && "text-emerald-700",
                          item.status === "amber" && "text-amber-700",
                          item.status === "red" && "text-rose-700"
                        )}
                      >
                        {item.progress}%
                      </p>
                    </div>
                  </div>
                  <ProgressBar value={item.progress} status={item.status} className="mt-3" />
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    View full KPI <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {items.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              No KPIs in this group.
            </p>
          )}
        </ScrollArea>

        <div className="border-t p-4">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/kpis">
              <ExternalLink className="h-4 w-4" />
              Open KPI library
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
