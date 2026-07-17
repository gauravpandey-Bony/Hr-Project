import type { QuarterData } from "@/lib/kpi-quarters";

function emptyQuarters(): QuarterData {
  return {
    q1: { target: "", achieved: "", managerAchieved: "" },
    q2: { target: "", achieved: "", managerAchieved: "" },
    q3: { target: "", achieved: "", managerAchieved: "" },
    q4: { target: "", achieved: "", managerAchieved: "" },
  };
}

function parseFull(raw: string | null): QuarterData & {
  annualTarget?: string;
  lastYearAchieved?: string;
} {
  if (!raw) return emptyQuarters();
  try {
    return { ...emptyQuarters(), ...(JSON.parse(raw) as object) };
  } catch {
    return emptyQuarters();
  }
}

function cell(
  target: string,
  achieved: string,
  managerAchieved: string
): QuarterData["q1"] {
  return { target, achieved, managerAchieved };
}

/** Admin: update targets and annual fields; preserve achieved + managerAchieved. */
export function mergeTargetsQuarterJson(
  existingRaw: string | null,
  incomingRaw: string
): string {
  const existing = parseFull(existingRaw);
  const incoming = parseFull(incomingRaw);
  const keys = ["q1", "q2", "q3", "q4"] as const;

  for (const q of keys) {
    existing[q] = cell(
      incoming[q]?.target ?? existing[q].target ?? "",
      existing[q]?.achieved ?? "",
      existing[q]?.managerAchieved ?? ""
    );
  }

  return JSON.stringify({
    ...existing,
    annualTarget: incoming.annualTarget ?? existing.annualTarget ?? "",
    lastYearAchieved: incoming.lastYearAchieved ?? existing.lastYearAchieved ?? "",
  });
}

/** Admin / manager: update targets, achieved, and managerAchieved. */
export function mergeFullQuarterJson(
  existingRaw: string | null,
  incomingRaw: string
): string {
  const existing = parseFull(existingRaw);
  const incoming = parseFull(incomingRaw);
  const keys = ["q1", "q2", "q3", "q4"] as const;

  for (const q of keys) {
    existing[q] = cell(
      incoming[q]?.target ?? existing[q].target ?? "",
      incoming[q]?.achieved ?? existing[q].achieved ?? "",
      incoming[q]?.managerAchieved ?? existing[q].managerAchieved ?? ""
    );
  }

  return JSON.stringify({
    ...existing,
    annualTarget: incoming.annualTarget ?? existing.annualTarget ?? "",
    lastYearAchieved: incoming.lastYearAchieved ?? existing.lastYearAchieved ?? "",
  });
}

/**
 * Employee: update achieved only.
 * Targets + managerAchieved are preserved (employees cannot overwrite RM column).
 */
export function mergeAchievedQuarterJson(
  existingRaw: string | null,
  incomingRaw: string
): string {
  const existing = parseFull(existingRaw);
  const incoming = parseFull(incomingRaw);
  const keys = ["q1", "q2", "q3", "q4"] as const;

  for (const q of keys) {
    existing[q] = cell(
      existing[q]?.target ?? "",
      incoming[q]?.achieved ?? existing[q]?.achieved ?? "",
      existing[q]?.managerAchieved ?? ""
    );
  }

  return JSON.stringify({
    annualTarget: existing.annualTarget,
    lastYearAchieved: existing.lastYearAchieved,
    ...existing,
  });
}

export { parseFull as parseQuarterJsonFull };
