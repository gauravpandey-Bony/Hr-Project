import { cn } from "@/lib/utils";
import type { KpiStatus } from "@/lib/kpi";

const statusColors: Record<KpiStatus, string> = {
  green: "text-emerald-600",
  amber: "text-amber-500",
  red: "text-rose-500",
};

const ringColors: Record<KpiStatus, string> = {
  green: "stroke-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]",
  amber: "stroke-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]",
  red: "stroke-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.35)]",
};

export function KpiGauge({
  progress,
  status,
  size = 120,
}: {
  progress: number;
  status: KpiStatus;
  size?: number;
}) {
  const strokeW = size <= 72 ? 6 : 8;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          className="text-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-all duration-500", ringColors[status])}
        />
      </svg>
      <span
        className={cn(
          "absolute font-bold",
          size <= 72 ? "text-sm" : "text-lg",
          statusColors[status]
        )}
      >
        {progress}%
      </span>
    </div>
  );
}
