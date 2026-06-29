/** Weightage may be stored as fraction (0.15) or percent (15). */
export function weightagePercent(weightage: number | null | undefined): number | null {
  if (weightage == null || Number.isNaN(weightage)) return null;
  return weightage <= 1 ? weightage * 100 : weightage;
}

export function formatWeightage(weightage: number | null | undefined): string {
  const pct = weightagePercent(weightage);
  if (pct == null) return "—";
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}
