"use client";

import { cn } from "@/lib/utils";

type Segment = {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
};

export function HealthDonut({
  segments,
  total,
  centerLabel,
  centerValue,
  className,
  onCenterClick,
}: {
  segments: Segment[];
  total: number;
  centerLabel: string;
  /** When set, shown in the donut center instead of the KPI count */
  centerValue?: string;
  className?: string;
  onCenterClick?: () => void;
}) {
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  let offset = 0;

  const CenterTag = onCenterClick ? "button" : "div";

  return (
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 pointer-events-none">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
          />
          {segments.map((seg) => {
            const pct = seg.value / sum;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const circle = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <CenterTag
          type={onCenterClick ? "button" : undefined}
          onClick={onCenterClick}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center rounded-full transition",
            onCenterClick && "hover:bg-slate-50/80 cursor-pointer"
          )}
        >
          <span className="text-3xl font-bold text-foreground">{centerValue ?? total}</span>
          <span className="text-sm font-medium text-muted-foreground">
            {centerLabel}
          </span>
        </CenterTag>
      </div>
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
        {segments.map((seg) => (
          <button
            key={seg.label}
            type="button"
            onClick={seg.onClick}
            disabled={!seg.onClick}
            className={cn(
              "flex items-center gap-3 rounded-lg text-left transition",
              seg.onClick && "cursor-pointer hover:bg-slate-50 px-2 py-1 -mx-2"
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full shadow-sm"
              style={{ backgroundColor: seg.color }}
            />
            <div>
              <p className="text-base font-semibold text-foreground">{seg.label}</p>
              <p className="text-sm text-muted-foreground">
                {seg.value} KPI{seg.value !== 1 ? "s" : ""} ·{" "}
                {total ? Math.round((seg.value / total) * 100) : 0}%
                {seg.onClick && " · click"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
