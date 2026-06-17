import type { KpiStatus } from "@/lib/kpi";
import { cn } from "@/lib/utils";

export function TrendBars({
  points,
  status,
}: {
  points: { label: string; value: number }[];
  status: KpiStatus;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);

  const barColor =
    status === "green"
      ? "bg-emerald-500"
      : status === "amber"
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="flex h-16 items-end gap-1">
      {points.map((p) => (
        <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn("w-full rounded-t transition-all", barColor)}
            style={{ height: `${Math.max(8, (p.value / max) * 100)}%` }}
            title={`${p.label}: ${p.value}`}
          />
          <span className="text-[9px] text-slate-400">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
