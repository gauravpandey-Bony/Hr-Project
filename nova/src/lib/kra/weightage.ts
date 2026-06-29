/** Normalize DB/API weightage to fraction (0.15 for 15%). */
export function weightageFraction(weightage: number | null | undefined): number | null {
  if (weightage == null || Number.isNaN(weightage)) return null;
  if (weightage > 1) return weightage / 100;
  return weightage;
}

/** Display percent number (15 for 15%). */
export function weightagePercent(weightage: number | null | undefined): number | null {
  const frac = weightageFraction(weightage);
  if (frac == null) return null;
  return Math.round(frac * 1000) / 10;
}

export function formatWeightage(weightage: number | null | undefined): string {
  const pct = weightagePercent(weightage);
  if (pct == null) return "—";
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** Parse user-entered percent (e.g. "15") to fraction for API. */
export function weightageFromPercentInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed);
  if (Number.isNaN(n)) return undefined;
  return n > 1 ? n / 100 : n;
}
