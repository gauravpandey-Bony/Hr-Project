/** Excel often stores 100% as decimal 1 — detect percent-style UOMs. */
export function isPercentUnit(uom: string): boolean {
  const u = uom.toLowerCase();
  return u.includes("%") || u.includes("percent") || u.includes("availability");
}

/**
 * Normalize a KRA/KPI cell from Excel import or legacy DB storage.
 * Decimal 1 with a percent UOM becomes "100"; SLA text like "<= 24Hrs" is kept as-is.
 */
export function normalizeKraCellValue(raw: string, unit: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";

  if (/per\s+(quarter|month|year|annum)/i.test(trimmed)) {
    return trimmed;
  }

  if (/\/\s*quarter/i.test(trimmed)) {
    return trimmed;
  }

  if (/[<>]=|≤|≥|<|>|hour|day|hr|min|zero/i.test(trimmed)) {
    return trimmed;
  }

  const n = parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return trimmed;

  if (isPercentUnit(unit) && n > 0 && n <= 1) {
    const pct = n * 100;
    return Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(2)));
  }

  if (Number.isFinite(n) && /^-?\d/.test(trimmed)) {
    return Number.isInteger(n) ? String(Math.round(n)) : String(Number(n.toFixed(2)));
  }

  return trimmed;
}

export type QuarterCellData = {
  q1: { target: string; achieved?: string; managerAchieved?: string };
  q2: { target: string; achieved?: string; managerAchieved?: string };
  q3: { target: string; achieved?: string; managerAchieved?: string };
  q4: { target: string; achieved?: string; managerAchieved?: string };
};

export function normalizeQuarterTargets(
  quarters: QuarterCellData,
  unit: string
): QuarterCellData {
  const norm = (val: string | undefined) =>
    val != null && val !== "" ? normalizeKraCellValue(val, unit) : val ?? "";

  return {
    q1: {
      target: quarters.q1.target ?? "",
      achieved: norm(quarters.q1.achieved),
      managerAchieved: quarters.q1.managerAchieved ?? "",
    },
    q2: {
      target: quarters.q2.target ?? "",
      achieved: norm(quarters.q2.achieved),
      managerAchieved: quarters.q2.managerAchieved ?? "",
    },
    q3: {
      target: quarters.q3.target ?? "",
      achieved: norm(quarters.q3.achieved),
      managerAchieved: quarters.q3.managerAchieved ?? "",
    },
    q4: {
      target: quarters.q4.target ?? "",
      achieved: norm(quarters.q4.achieved),
      managerAchieved: quarters.q4.managerAchieved ?? "",
    },
  };
}
