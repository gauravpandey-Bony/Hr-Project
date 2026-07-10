import { cn } from "@/lib/utils";
import { scoreFillClass } from "@/lib/score-tone";

export type QuarterScoreItem = {
  id: string;
  label: string;
  score: number | null;
};

/**
 * Solid filled color circles for Q1–Q4 achievement.
 * Empty quarters stay muted grey circles (no bare "—" text).
 */
export function QuarterScoreCircles({
  items,
  activeId,
  size = "md",
  className,
}: {
  items: QuarterScoreItem[];
  activeId?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "lg"
      ? "h-[4.5rem] w-[4.5rem] text-base"
      : size === "sm"
        ? "h-11 w-11 text-[11px]"
        : "h-14 w-14 text-sm";

  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center rounded-full font-bold tabular-nums shadow-sm ring-2 transition",
                dim,
                scoreFillClass(item.score),
                active && "scale-105 ring-4 ring-sky-400/50 shadow-md"
              )}
              title={
                item.score != null
                  ? `${item.label}: ${item.score}%`
                  : `${item.label}: no data`
              }
            >
              {item.score != null ? `${item.score}%` : "—"}
            </div>
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide",
                active ? "text-sky-700" : "text-slate-500"
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact circle for table cells. */
export function QuarterScoreDot({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ring-1 ring-inset",
        scoreFillClass(score),
        className
      )}
    >
      {score != null ? `${score}%` : "—"}
    </span>
  );
}
