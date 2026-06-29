import { parseQuarterTargets, type QuarterData } from "@/lib/kpi-quarters";

function emptyQuarters(): QuarterData {
  return {
    q1: { target: "", achieved: "" },
    q2: { target: "", achieved: "" },
    q3: { target: "", achieved: "" },
    q4: { target: "", achieved: "" },
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

/** Admin: update targets and annual fields; preserve achieved values. */
export function mergeTargetsQuarterJson(
  existingRaw: string | null,
  incomingRaw: string
): string {
  const existing = parseFull(existingRaw);
  const incoming = parseFull(incomingRaw);
  const keys = ["q1", "q2", "q3", "q4"] as const;

  for (const q of keys) {
    existing[q] = {
      target: incoming[q]?.target ?? existing[q].target ?? "",
      achieved: existing[q]?.achieved ?? "",
    };
  }

  return JSON.stringify({
    ...existing,
    annualTarget: incoming.annualTarget ?? existing.annualTarget ?? "",
    lastYearAchieved: incoming.lastYearAchieved ?? existing.lastYearAchieved ?? "",
  });
}

/** Employee: update achieved only; preserve targets. */
export function mergeAchievedQuarterJson(
  existingRaw: string | null,
  incomingRaw: string
): string {
  const existing = parseFull(existingRaw);
  const incoming = parseFull(incomingRaw);
  const keys = ["q1", "q2", "q3", "q4"] as const;

  for (const q of keys) {
    existing[q] = {
      target: existing[q]?.target ?? "",
      achieved: incoming[q]?.achieved ?? existing[q]?.achieved ?? "",
    };
  }

  return JSON.stringify({
    annualTarget: existing.annualTarget,
    lastYearAchieved: existing.lastYearAchieved,
    ...existing,
  });
}

export { parseFull as parseQuarterJsonFull };
