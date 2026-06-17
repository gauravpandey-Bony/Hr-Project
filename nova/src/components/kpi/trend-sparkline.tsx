import type { KpiStatus } from "@/lib/kpi";
import { cn } from "@/lib/utils";

const stroke: Record<KpiStatus, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#f43f5e",
};

const fill: Record<KpiStatus, string> = {
  green: "rgba(16,185,129,0.15)",
  amber: "rgba(245,158,11,0.15)",
  red: "rgba(244,63,94,0.15)",
};

export function TrendSparkline({
  points,
  status,
  className,
}: {
  points: { label: string; value: number }[];
  status: KpiStatus;
  className?: string;
}) {
  if (points.length < 2) return null;

  const w = 280;
  const h = 56;
  const pad = { t: 6, r: 4, b: 4, l: 4 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad.l + (i / (points.length - 1)) * innerW;
    const y = pad.t + innerH - ((p.value - min) / range) * innerH;
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${h - pad.b} L ${coords[0].x} ${h - pad.b} Z`;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none">
        <path d={areaPath} fill={fill[status]} />
        <path
          d={linePath}
          fill="none"
          stroke={stroke[status]}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 4 : 2.5}
            fill={stroke[status]}
            className={i === coords.length - 1 ? "drop-shadow-sm" : ""}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-0.5">
        {points.map((p) => (
          <span key={p.label} className="text-[9px] font-medium text-slate-400">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
