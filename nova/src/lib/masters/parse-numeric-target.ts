import { isPercentUnit } from "@/lib/kra/target-format";

export function parseNumericTarget(val: unknown, uom = ""): number {
  const asString = String(val ?? "").trim();
  if (!asString) return 0;
  if (/^zero$/i.test(asString)) return 0;

  const perQuarter = asString.match(/(\d+(?:\.\d+)?)\s*(?:per|\/)\s*quarter/i);
  if (perQuarter) return parseFloat(perQuarter[1]) * 4;

  if (/[<>]=|≤|≥|<|>|hour|day|hr|min/i.test(asString)) {
    const n = parseFloat(asString.replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  }

  if (typeof val === "number" && !Number.isNaN(val)) {
    if (isPercentUnit(uom) && val > 0 && val <= 1) return val * 100;
    return val;
  }

  const n = parseFloat(asString.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(n) && n > 0) {
    if (isPercentUnit(uom) && n <= 1) return n * 100;
    return n;
  }
  return 0;
}

/** Annual col often has template 100% while real targets sit in Q1–Q4 */
export function resolveImportTargetValue(
  annualText: string,
  q1Target: string,
  unit: string
): number {
  const annual = annualText.trim();
  const q1 = q1Target.trim();
  const annualIsPlaceholder =
    annual === "100%" || annual === "1" || annual === "";

  if (annualIsPlaceholder && q1 && q1 !== "100%") {
    return parseNumericTarget(q1, unit);
  }
  return parseNumericTarget(annual || q1, unit);
}
