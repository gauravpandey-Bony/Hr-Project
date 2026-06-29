"use client";

import { motion } from "framer-motion";
import {
  Factory,
  IndianRupee,
  Package,
  Shield,
  Target,
  TrendingUp,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/ui/card-3d";
import { quarterStatusClass } from "@/lib/kra/quarter-status";
import type { ResolvedSpotlightMetric, SpotlightIcon } from "@/lib/plant/plant-dashboard-config";

const ICONS: Record<SpotlightIcon, typeof Target> = {
  sales: IndianRupee,
  production: Factory,
  quality: Target,
  delivery: Truck,
  dispatch: Package,
  safety: Shield,
  finance: TrendingUp,
  inventory: Warehouse,
};

function SpotlightCard({
  metric,
  index,
}: {
  metric: ResolvedSpotlightMetric;
  index: number;
}) {
  const Icon = ICONS[metric.icon];
  const kpi = metric.resolved;
  const onTrack = kpi?.status === "met";
  const pending = !kpi || kpi.status === "pending";

  return (
    <Card3D
      floatIndex={index}
      className={cn(
        "relative overflow-hidden border-0 bg-gradient-to-br p-5 text-white",
        metric.gradient,
        metric.glow,
        "shadow-xl"
      )}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm"
            style={{ transform: "translateZ(32px)" }}
          >
            <Icon className="h-6 w-6" />
          </div>
          {kpi ? (
            <span
              className={cn(
                "rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase backdrop-blur-sm",
                quarterStatusClass(kpi.status as "met")
              )}
            >
              {kpi.statusLabel}
            </span>
          ) : (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase text-white/70">
              No data
            </span>
          )}
        </div>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">
          {metric.shortLabel}
        </p>
        <p className="mt-0.5 text-lg font-bold leading-tight">{metric.label}</p>

        {kpi ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2" style={{ transform: "translateZ(20px)" }}>
              <div className="rounded-xl bg-black/20 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                <p className="text-[10px] text-white/50">Achieved</p>
                <p className="font-mono text-base font-black">{kpi.achieved}</p>
              </div>
              <div className="rounded-xl bg-black/20 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                <p className="text-[10px] text-white/50">Target</p>
                <p className="font-mono text-base font-black">{kpi.target}</p>
              </div>
            </div>
            <p className="mt-2 truncate text-[10px] text-white/45">
              {kpi.kraName} · via {metric.matchSource}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  onTrack ? "bg-white" : pending ? "bg-white/40" : "bg-rose-200"
                )}
                initial={{ width: 0 }}
                animate={{ width: onTrack ? "100%" : pending ? "20%" : "40%" }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              />
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-white/60">
            Import plant or department KRA data matching: {metric.keywords.slice(0, 2).join(", ")}…
          </p>
        )}
      </div>
    </Card3D>
  );
}

export function PlantSpotlightMetrics({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle: string;
  metrics: ResolvedSpotlightMetric[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m, i) => (
          <SpotlightCard key={m.id} metric={m} index={i} />
        ))}
      </div>
    </section>
  );
}
