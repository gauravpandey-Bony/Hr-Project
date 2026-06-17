import { cn } from "@/lib/utils";
import type { KpiStatus } from "@/lib/kpi";

const fill: Record<KpiStatus, string> = {
  green: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  amber: "bg-gradient-to-r from-amber-500 to-amber-400",
  red: "bg-gradient-to-r from-rose-500 to-rose-400",
};

const glow: Record<KpiStatus, string> = {
  green: "shadow-[0_0_12px_rgba(16,185,129,0.35)]",
  amber: "shadow-[0_0_12px_rgba(245,158,11,0.35)]",
  red: "shadow-[0_0_12px_rgba(244,63,94,0.35)]",
};

export function ProgressBar({
  value,
  status,
  className,
}: {
  value: number;
  status: KpiStatus;
  className?: string;
}) {
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700",
          fill[status],
          value >= 90 && glow[status]
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
