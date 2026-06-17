"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, CalendarRange, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_QUARTER_FILTER_OPTIONS,
  quarterFilterLabel,
  type QuarterFilter,
} from "@/lib/ai/employee-quarter-filter";
import {
  buildFilteredDashboardItems,
  type KpiWithEntries,
} from "@/lib/kpi-dashboard-filter";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { CategorySection } from "@/components/dashboard/category-section";

export function MyDashboardClient({
  kpis,
  categories,
  isEmployee,
}: {
  kpis: KpiWithEntries[];
  categories: string[];
  isEmployee: boolean;
}) {
  const [filter, setFilter] = useState<QuarterFilter>("annual");

  const items = useMemo(
    () => buildFilteredDashboardItems(kpis, filter),
    [kpis, filter]
  );

  const onTrack = items.filter((k) => k.status === "green").length;
  const offTarget = items.filter((k) => k.status === "red").length;
  const avgProgress =
    items.length > 0
      ? Math.round(items.reduce((s, k) => s + k.progress, 0) / items.length)
      : 0;

  return (
    <>
      <div className="card-raised rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm animate-fade-up">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <CalendarRange className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Report period</p>
            <p className="text-xs text-muted-foreground">
              Dashboard updates for {quarterFilterLabel(filter).toLowerCase()}
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-5"
          role="group"
          aria-label="Select report period"
        >
          {EMPLOYEE_QUARTER_FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            const shortLabel = opt.value === "annual" ? "Annual" : opt.label;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                aria-pressed={active}
                className={cn(
                  "card-raised-sm px-3 py-3 text-center transition-all duration-200",
                  active
                    ? "card-raised-sm-active bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "card-raised-interactive bg-background/90 ring-1 ring-border/60 hover:ring-primary/25"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    active ? "text-primary-foreground" : "text-foreground"
                  )}
                >
                  {shortLabel}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <DashboardStats
        items={items}
        onTrack={onTrack}
        offTarget={offTarget}
        avgProgress={avgProgress}
        categoryCount={categories.length}
      />

      <div className="flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: "200ms" }}>
        <Link
          href="/dashboard/kpis"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition hover:border-primary/30 hover:text-primary"
        >
          <Activity className="h-3.5 w-3.5" />
          KPI library
        </Link>
        <Link
          href="/dashboard/track"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition hover:border-primary/30 hover:text-primary"
        >
          <PenLine className="h-3.5 w-3.5" />
          Data entry
        </Link>
        {!isEmployee && (
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition hover:border-primary/30 hover:text-primary"
          >
            League reports
          </Link>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            KPIs by category
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
          {categories.map((cat, idx) => (
            <CategorySection
              key={cat}
              category={cat}
              kpis={kpis.filter((k) => k.category === cat)}
              filter={filter}
              delay={260 + idx * 40}
            />
          ))}
        </div>
      </div>
    </>
  );
}
