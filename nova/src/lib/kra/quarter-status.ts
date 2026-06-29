import { isPlaceholderAchieved, parseQuarterNumber } from "@/lib/kpi-quarters";

export type QuarterAchievementStatus =
  | "pending"
  | "met"
  | "not_met"
  | "entered";

export function quarterAchievementStatus(
  target: string | undefined,
  achieved: string | undefined
): QuarterAchievementStatus {
  const t = target?.trim() ?? "";
  const a = achieved?.trim() ?? "";

  if (isPlaceholderAchieved(a)) return "pending";

  if (!t || t === "—") return "entered";

  if (t.toLowerCase() === a.toLowerCase()) return "met";

  const targetNum = parseQuarterNumber(t);
  const achievedNum = parseQuarterNumber(a);

  if (targetNum !== null && achievedNum !== null) {
    if (t.includes("<") || t.includes("≤")) {
      return achievedNum <= targetNum ? "met" : "not_met";
    }
    if (t.includes(">") || t.includes("≥")) {
      return achievedNum >= targetNum ? "met" : "not_met";
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
