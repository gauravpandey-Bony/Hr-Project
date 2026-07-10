import { isPlaceholderAchieved, parseQuarterNumber } from "@/lib/kpi-quarters";

export type QuarterAchievementStatus =
  | "pending"
  | "met"
  | "not_met"
  | "entered";

/**
 * Excel KRA templates often paste the target text into the achieved column.
 * Exact copies are not real Q results — treat as pending until someone enters data.
 */
export function isUnfilledTemplateAchieved(
  target: string | undefined,
  achieved: string | undefined
): boolean {
  const t = target?.trim() ?? "";
  const a = achieved?.trim() ?? "";
  if (!t || !a) return false;
  return t.toLowerCase() === a.toLowerCase();
}

/** Target is a wordy goal (not a plain number / threshold) — don't auto-match on first digit. */
function isWordyTarget(target: string): boolean {
  return /[a-z]/i.test(target) && target.replace(/[^a-z]/gi, "").length >= 4;
}

function isPlainNumericValue(value: string): boolean {
  return /^[<>≤≥]?\s*\d+(\.\d+)?\s*%?$/.test(value.trim());
}

export function quarterAchievementStatus(
  target: string | undefined,
  achieved: string | undefined
): QuarterAchievementStatus {
  const t = target?.trim() ?? "";
  const a = achieved?.trim() ?? "";

  if (isPlaceholderAchieved(a)) return "pending";
  if (isUnfilledTemplateAchieved(t, a)) return "pending";

  if (!t || t === "—") return "entered";

  const targetNum = parseQuarterNumber(t);
  const achievedNum = parseQuarterNumber(a);

  if (targetNum !== null && achievedNum !== null) {
    // "20% Reduced on Last Year" vs achieved "20" is not a real comparison
    if (isWordyTarget(t) && isPlainNumericValue(a) && !isPlainNumericValue(t)) {
      return "entered";
    }
    if (t.includes("<") || t.includes("≤")) {
      return achievedNum <= targetNum ? "met" : "not_met";
    }
    if (t.includes(">") || t.includes("≥")) {
      return achievedNum >= targetNum ? "met" : "not_met";
    }
    if (isWordyTarget(t) && !isPlainNumericValue(t)) {
      return "entered";
    }
    const tolerance = Math.abs(targetNum) * 0.05;
    return Math.abs(achievedNum - targetNum) <= tolerance ? "met" : "not_met";
  }

  if (a.length > 0) return "entered";
  return "pending";
}

export function quarterStatusLabel(status: QuarterAchievementStatus): string {
  switch (status) {
    case "met":
      return "Achieved";
    case "not_met":
      return "Not achieved";
    case "entered":
      return "Entered (review)";
    default:
      return "Pending";
  }
}

export function quarterStatusClass(status: QuarterAchievementStatus): string {
  switch (status) {
    case "met":
      return "bg-emerald-100 text-emerald-800";
    case "not_met":
      return "bg-rose-100 text-rose-800";
    case "entered":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
