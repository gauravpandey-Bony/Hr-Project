"use client";

import { useState, useCallback, useMemo } from "react";
import { CategoryReportCard } from "./category-report-card";
import { HealthDonut } from "./health-donut";
import { SummaryStatCard } from "./summary-stat-card";
import { TopPerformersSpotlight } from "./top-performers-spotlight";
import { KpiDetailDrawer, type ReportKpiItem } from "./kpi-detail-drawer";
import { KPI_CATEGORIES } from "@/lib/company";
import { cn } from "@/lib/utils";
import { XCircle } from "lucide-react";
import type { KpiStatus } from "@/lib/kpi";

type DrawerState = {
  title: string;
  subtitle?: string;
  items: ReportKpiItem[];
};

export function ReportsPageClient({
  items,
  onTrack,
  offTarget,
  avgProgress,
  categoriesWithData,
  topPerformers,
}: {
  items: ReportKpiItem[];
  onTrack: number;
  offTarget: number;
  avgProgress: number;
  categoriesWithData: number;
  topPerformers: ReportKpiItem[];
}) {
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const openDrawer = useCallback((state: DrawerState) => {
    setDrawer(state);
  }, []);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const byStatus = useMemo(
    () => ({
      green: items.filter((k) => k.status === "green"),
      red: items.filter((k) => k.status === "red"),
    }),
    [items]
  );

  const categoryRanked = useMemo(() => {
    const map: Record<string, ReportKpiItem[]> = {};
    for (const cat of KPI_CATEGORIES) {
      map[cat] = items
        .filter((k) => k.category === cat)
        .sort((a, b) => b.progress - a.progress);
    }
    return map;
  }, [items]);

  function openStatus(
    status: KpiStatus | "all",
    title: string,
    subtitle?: string
  ) {
    const list =
      status === "all"
        ? [...items].sort((a, b) => b.progress - a.progress)
        : byStatus[status];
    openDrawer({ title, subtitle, items: list });
  }

  function openCategory(category: string) {
    openDrawer({
      title: `${category} KPIs`,
      subtitle: `${categoryRanked[category]?.length ?? 0} metrics in this category`,
      items: categoryRanked[category] ?? [],
    });
  }

  const clickableCard = "cursor-pointer ring-0 hover:ring-2 hover:ring-emerald-400/40";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStatCard
          label="Total KPIs"
          value={items.length}
          hint={`${categoriesWithData} active categories · Click to view all`}
          iconName="target"
          delay={80}
          floatIndex={0}
          onClick={() => openStatus("all", "All KPIs", `${items.length} total tracked`)}
          className={clickableCard}
        />
        <SummaryStatCard
          label="On target"
          value={onTrack}
          hint={
            items.length
              ? `${Math.round((onTrack / items.length) * 100)}% · Click for list`
              : undefined
          }
          iconName="check"
          variant="success"
          delay={120}
          floatIndex={1}
          onClick={() =>
            openStatus("green", "On target KPIs", `${onTrack} meeting goals`)
          }
          className={clickableCard}
        />
        <SummaryStatCard
          label="Avg progress"
          value={`${avgProgress}%`}
          iconName="trend"
          variant="accent"
          progress={avgProgress}
          delay={200}
          floatIndex={2}
          onClick={() =>
            openStatus(
              "all",
              "All KPIs by progress",
              `Sorted highest to lowest · avg ${avgProgress}%`
            )
          }
          className={clickableCard}
        />
      </div>

      <div
        className="grid gap-6 lg:grid-cols-5 animate-fade-up"
        style={{ animationDelay: "240ms" }}
      >
        <div className="surface-card p-6 lg:col-span-3">
          <h3 className="mb-1 text-base font-bold text-foreground">Overall health mix</h3>
          <p className="mb-6 text-sm text-muted-foreground">Click a segment to see those KPIs</p>
          <HealthDonut
            total={items.length}
            centerLabel="KPIs"
            segments={[
              {
                label: "On target",
                value: onTrack,
                color: "#10b981",
                onClick: () => openStatus("green", "On target", `${onTrack} KPIs`),
              },
              {
                label: "Off target",
                value: offTarget,
                color: "#f43f5e",
                onClick: () => openStatus("red", "Off target", `${offTarget} KPIs`),
              },
            ]}
            onCenterClick={() => openStatus("all", "All KPIs", "Full portfolio")}
          />
        </div>

        <div className="flex flex-col gap-3 lg:col-span-2">
          <button
            type="button"
            onClick={() =>
              openStatus("red", "Off target KPIs", "Requires immediate review")
            }
            className={cn(
              "flex flex-1 flex-col justify-center rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
              clickableCard
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-rose-700">Off target</p>
              <XCircle className="h-5 w-5 text-rose-500" />
            </div>
            <p className="mt-2 text-4xl font-bold text-rose-800">{offTarget}</p>
            <p className="mt-1 text-xs text-rose-600">Click to review →</p>
          </button>
          <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
            <StatusChip
              label="green"
              count={onTrack}
              className="text-emerald-700"
              onClick={() => openStatus("green", "On target", `${onTrack} KPIs`)}
            />
            <StatusChip
              label="red"
              count={offTarget}
              className="text-rose-700"
              onClick={() => openStatus("red", "Off target", `${offTarget} KPIs`)}
            />
          </div>
        </div>
      </div>

      <TopPerformersSpotlight
        performers={topPerformers}
        onViewAll={() =>
          openStatus("all", "Top performers", "Highest progress across plant")
        }
      />

      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            By category — click header or row
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        {KPI_CATEGORIES.map((cat, idx) => {
          const ranked = categoryRanked[cat];
          if (!ranked.length) return null;

          return (
            <div
              key={cat}
              className="animate-fade-up"
              style={{ animationDelay: `${300 + idx * 60}ms` }}
            >
              <CategoryReportCard
                category={cat}
                ranked={ranked}
                onHeaderClick={() => openCategory(cat)}
              />
            </div>
          );
        })}
      </div>

      <KpiDetailDrawer
        open={drawer !== null}
        title={drawer?.title ?? ""}
        subtitle={drawer?.subtitle}
        items={drawer?.items ?? []}
        onClose={closeDrawer}
      />
    </>
  );
}

function StatusChip({
  label,
  count,
  className,
  onClick,
}: {
  label: string;
  count: number;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold transition hover:border-emerald-300 hover:shadow-sm",
        className
      )}
    >
      {count} {label}
    </button>
  );
}
