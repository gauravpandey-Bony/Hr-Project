import type { KpiDirection } from "@prisma/client";

export type KpiStatus = "green" | "amber" | "red";

/** Progress below this % is marked Off target; at or above is On track. */
export const OFF_TARGET_THRESHOLD = 20;

export function kpiProgress(
  current: number,
  target: number,
  direction: KpiDirection
): number {
  if (!target) return 0;
  if (direction === "LOWER_IS_BETTER") {
    if (current <= target) return 100;
    return Math.max(0, Math.round((target / current) * 100));
  }
  return Math.min(100, Math.round((current / target) * 100));
}

export function kpiStatus(
  current: number,
  target: number,
  direction: KpiDirection
): KpiStatus {
  const progress = kpiProgress(current, target, direction);
  return kpiStatusFromProgress(progress);
}

/** KRA sheets store quarter "Achieved" as weighted score (max = weightage × 100). */
export function kraWeightedProgress(
  achieved: number,
  weightage: number | null | undefined
): number {
  if (!weightage || weightage <= 0) return 0;
  const maxScore = weightage * 100;
  if (!maxScore) return 0;
  return Math.min(100, Math.max(0, Math.round((achieved / maxScore) * 100)));
}

export function kraWeightedStatus(
  achieved: number,
  weightage: number | null | undefined
): KpiStatus {
  return kpiStatusFromProgress(kraWeightedProgress(achieved, weightage));
}

export function kpiStatusFromProgress(progress: number): KpiStatus {
  return progress >= OFF_TARGET_THRESHOLD ? "green" : "red";
}

/** Quarter achieved ≤ max weighted score → treat as KRA weighted points, not raw metric. */
export function looksLikeWeightedKraScore(
  value: number,
  weightage: number | null | undefined
): boolean {
  if (!weightage || weightage <= 0) return false;
  return value <= weightage * 100 + 0.01;
}

export function kpiProgressForKra(
  current: number,
  weightage: number | null | undefined,
  target: number,
  direction: KpiDirection
): number {
  if (looksLikeWeightedKraScore(current, weightage)) {
    return kraWeightedProgress(current, weightage);
  }
  return kpiProgress(current, target, direction);
}

export function kpiStatusForKra(
  current: number,
  weightage: number | null | undefined,
  target: number,
  direction: KpiDirection
): KpiStatus {
  return kpiStatusFromProgress(
    kpiProgressForKra(current, weightage, target, direction)
  );
}

/** API JSON returns ISO strings — never call .getTime() on raw values */
export function entryTimestamp(recordedAt: unknown): number {
  if (recordedAt == null) return 0;
  if (recordedAt instanceof Date) {
    const ms = recordedAt.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof recordedAt === "number" && Number.isFinite(recordedAt)) {
    return recordedAt;
  }
  if (typeof recordedAt === "string") {
    const ms = Date.parse(recordedAt);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

export function normalizeKpiEntryDates<T extends { recordedAt: unknown }>(
  entries: T[]
): (T & { recordedAt: Date })[] {
  return entries.map((e) => ({
    ...e,
    recordedAt:
      e.recordedAt instanceof Date
        ? e.recordedAt
        : new Date(entryTimestamp(e.recordedAt) || Date.now()),
  }));
}

export function latestValue(
  entries: { value: number; recordedAt: unknown }[]
): number {
  if (!entries.length) return 0;
  const sorted = [...entries].sort(
    (a, b) => entryTimestamp(b.recordedAt) - entryTimestamp(a.recordedAt)
  );
  return sorted[0].value;
}

export function formatKpiValue(value: number, unit: string): string {
  if (unit === "%" || /%|availability|percent/i.test(unit)) return `${value.toFixed(1)}%`;
  if (unit === "₹ Lakh" || unit === "Lakh") return `₹${value.toFixed(1)}L`;
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${unit}`;
}
