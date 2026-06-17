"use client";

import { useState, useCallback, useMemo } from "react";
import { SummaryStatCard } from "@/components/reports/summary-stat-card";
import { KpiDetailDrawer, type ReportKpiItem } from "@/components/reports/kpi-detail-drawer";
import type { KpiStatus } from "@/lib/kpi";

export function DashboardStats({
  items,
  onTrack,
  offTarget,
  avgProgress,
  categoryCount,
}: {
  items: ReportKpiItem[];
  onTrack: number;
  offTarget: number;
  avgProgress: number;
  categoryCount: number;
}) {
  const [drawer, setDrawer] = useState<{
    title: string;
    subtitle?: string;
    items: ReportKpiItem[];
  } | null>(null);

  const byStatus = useMemo(
    () => ({
      green: items.filter((k) => k.status === "green"),
      red: items.filter((k) => k.status === "red"),
    }),
    [items]
  );

  const open = useCallback(
    (status: KpiStatus | "all", title: string, subtitle?: string) => {
      const list =
        status === "all"
          ? [...items].sort((a, b) => b.progress - a.progress)
          : byStatus[status];
      setDrawer({ title, subtitle, items: list });
    },
    [items, byStatus]
  );

  const clickable = "cursor-pointer ring-0 hover:ring-2 hover:ring-emerald-400/40";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryStatCard
          label="Total KPIs"
          value={items.length}
          hint={`${categoryCount} categories · Click to view`}
          iconName="target"
          delay={60}
          floatIndex={0}
          onClick={() => open("all", "All KPIs", `${items.length} KPIs tracked`)}
          className={clickable}
        />
        <SummaryStatCard
          label="On target"
          value={onTrack}
          hint={
            items.length
              ? `${Math.round((onTrack / items.length) * 100)}% on track · Click`
              : "Click to view"
          }
          iconName="check"
          variant="success"
          delay={100}
          floatIndex={1}
          onClick={() => open("green", "On target KPIs", `${onTrack} meeting goals`)}
          className={clickable}
        />
        <SummaryStatCard
          label="Off target"
          value={offTarget}
          hint={`Avg ${avgProgress}% · Click to view`}
          iconName="x"
          variant="danger"
          delay={140}
          floatIndex={2}
          onClick={() => open("red", "Off target KPIs", "Requires review")}
          className={clickable}
        />
      </div>

      <KpiDetailDrawer
        open={drawer !== null}
        title={drawer?.title ?? ""}
        subtitle={drawer?.subtitle}
        items={drawer?.items ?? []}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}
