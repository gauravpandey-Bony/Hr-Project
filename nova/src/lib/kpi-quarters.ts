import { db } from "@/lib/db";
import {
  formatKpiValue,
  kpiProgressForKra,
  kpiStatusForKra,
  latestValue,
  type KpiStatus,
} from "@/lib/kpi";
import { emptyQuarterTargets } from "@/lib/kra-sheets";
import type { KpiDirection } from "@prisma/client";

export type QuarterCell = {
  target: string;
  achieved?: string;
  /** Reporting manager entry — not used for employee scoring */
  managerAchieved?: string;
};

export type QuarterData = {
  q1: QuarterCell;
  q2: QuarterCell;
  q3: QuarterCell;
  q4: QuarterCell;
};

export const KRA_QUARTER_SYNC_NOTE = "kra-quarter-sync";

export function parseAnnualTargetText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { annualTarget?: string };
    return parsed.annualTarget?.trim() || null;
  } catch {
    return null;
  }
}

export function parseQuarterTargets(raw: string | null | undefined): QuarterData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuarterData & { annualTarget?: string };
    return {
      q1: {
        target: parsed.q1?.target ?? "",
        achieved: parsed.q1?.achieved ?? "",
        managerAchieved: parsed.q1?.managerAchieved ?? "",
      },
      q2: {
        target: parsed.q2?.target ?? "",
        achieved: parsed.q2?.achieved ?? "",
        managerAchieved: parsed.q2?.managerAchieved ?? "",
      },
      q3: {
        target: parsed.q3?.target ?? "",
        achieved: parsed.q3?.achieved ?? "",
        managerAchieved: parsed.q3?.managerAchieved ?? "",
      },
      q4: {
        target: parsed.q4?.target ?? "",
        achieved: parsed.q4?.achieved ?? "",
        managerAchieved: parsed.q4?.managerAchieved ?? "",
      },
    };
  } catch {
    return null;
  }
}

/** Annual label — prefer Excel annual text, else matching quarterly targets */
export function formatAnnualTargetLabel(
  quarters: QuarterData,
  storedAnnual: string | null,
  targetValue: number,
  unit: string
): string {
  const qt = (["q1", "q2", "q3", "q4"] as const).map((q) => quarters[q].target?.trim() || "");
  const filled = qt.filter(Boolean);
  const allSame = filled.length === 4 && filled.every((t) => t === filled[0]);

  const annual = storedAnnual?.trim() || "";
  const annualIsPlaceholder = annual === "100%" || annual === "1";

  if (annual && !annualIsPlaceholder) return annual;
  if (allSame && filled[0]) return filled[0];
  if (annualIsPlaceholder && filled[0] && filled[0] !== "100%") return filled[0];
  if (targetValue > 0) return formatKpiValue(targetValue, unit);
  return "—";
}

/** Excel/import often stores empty achieved cells as "0" — not a real measurement */
export function isPlaceholderAchieved(value: string | undefined): boolean {
  if (!value?.trim() || value.trim() === "—" || value.trim() === "-") return true;
  const t = value.trim();
  return t === "0" || t === "0.0" || t === "0%";
}

export function parseQuarterNumber(value: string | undefined): number | null {
  if (isPlaceholderAchieved(value)) return null;
  const n = parseFloat(value!.replace(/[%₹,\sLakhCr]/gi, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse targets like "90", ">9%", "<= 24Hrs" into a numeric threshold */
export function parseQuarterTarget(value: string | undefined): number | null {
  if (!value?.trim() || value.trim() === "—" || value.trim() === "-") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Indian FY: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar */
export type FiscalQuarter = "q1" | "q2" | "q3" | "q4";

export const FISCAL_QUARTER_MONTHS: Record<FiscalQuarter, readonly number[]> = {
  q1: [4, 5, 6],
  q2: [7, 8, 9],
  q3: [10, 11, 12],
  q4: [1, 2, 3],
};

function entryTimestampMs(recordedAt: unknown): number {
  if (recordedAt instanceof Date) return recordedAt.getTime();
  const n = typeof recordedAt === "number" ? recordedAt : Date.parse(String(recordedAt));
  return Number.isFinite(n) ? n : NaN;
}

/** Latest KpiEntry in a fiscal quarter — for plant KPIs tracked via monthly entries. */
export function latestEntryValueForFiscalQuarter(
  entries: { value: number; recordedAt: unknown }[],
  quarter: FiscalQuarter
): number | null {
  if (!entries.length) return null;
  const months = FISCAL_QUARTER_MONTHS[quarter];
  const inQuarter = entries.filter((e) => {
    const ms = entryTimestampMs(e.recordedAt);
    if (!Number.isFinite(ms)) return false;
    const month = new Date(ms).getMonth() + 1;
    return months.includes(month);
  });
  if (!inQuarter.length) return null;
  return latestValue(inQuarter);
}

/**
 * Latest meaningful quarter achieved (Q4 → Q1).
 * Placeholder zeros in unfilled later quarters are skipped so Q1 data is not overridden.
 */
export function latestAchievedFromQuarterTargets(raw: string | null | undefined): number | null {
  const q = parseQuarterTargets(raw);
  if (!q) return null;
  let fallbackZero: number | null = null;
  for (const key of ["q4", "q3", "q2", "q1"] as const) {
    const v = parseQuarterNumber(q[key]?.achieved);
    if (v === null) continue;
    if (v !== 0) return v;
    if (fallbackZero === null) fallbackZero = 0;
  }
  return fallbackZero;
}

/** Single source of truth for KPI progress across all employees and views. */
export function evaluateKpiCurrent(kpi: {
  weightage?: number | null;
  targetValue: number;
  direction: KpiDirection;
  quarterTargets?: string | null;
  entries: { value: number; recordedAt: unknown }[];
}): { current: number; progressNum: number; status: KpiStatus } {
  const current = effectiveKpiCurrent(kpi);
  const progressNum = kpiProgressForKra(
    current,
    kpi.weightage,
    kpi.targetValue,
    kpi.direction
  );
  const status = kpiStatusForKra(
    current,
    kpi.weightage,
    kpi.targetValue,
    kpi.direction
  );
  return { current, progressNum, status };
}

export function effectiveKpiCurrent(kpi: {
  quarterTargets?: string | null;
  entries: { value: number; recordedAt: unknown }[];
}): number {
  const fromQuarter = latestAchievedFromQuarterTargets(kpi.quarterTargets);
  const fromEntry = kpi.entries.length ? latestValue(kpi.entries) : null;

  if (fromEntry !== null && fromEntry !== 0) return fromEntry;
  if (fromQuarter !== null) return fromQuarter;
  return fromEntry ?? 0;
}

/** After KRA save — push latest quarter achieved into KpiEntry so reports update */
export async function syncKpiEntryFromQuarters(
  kpiId: string,
  quarterTargets: string | null | undefined,
  enteredById: string
) {
  const achieved = latestAchievedFromQuarterTargets(quarterTargets);
  if (achieved === null) return;

  const latest = await db.kpiEntry.findFirst({
    where: { kpiId },
    orderBy: { recordedAt: "desc" },
  });

  if (latest?.note === KRA_QUARTER_SYNC_NOTE) {
    await db.kpiEntry.update({
      where: { id: latest.id },
      data: { value: achieved, recordedAt: new Date() },
    });
    return;
  }

  await db.kpiEntry.create({
    data: {
      kpiId,
      value: achieved,
      recordedAt: new Date(),
      enteredById,
      note: KRA_QUARTER_SYNC_NOTE,
    },
  });
}

/** One-time / maintenance — sync all KPIs that have quarter achieved but no entry */
export async function syncAllQuarterTargetsToEntries(organizationId: string, enteredById: string) {
  const kpis = await db.kpi.findMany({
    where: { organizationId, isActive: true, quarterTargets: { not: null } },
    select: { id: true, quarterTargets: true },
  });

  let synced = 0;
  for (const k of kpis) {
    const achieved = latestAchievedFromQuarterTargets(k.quarterTargets);
    if (achieved === null) continue;
    await syncKpiEntryFromQuarters(k.id, k.quarterTargets, enteredById);
    synced++;
  }
  return synced;
}

/** Ensure every employee-owned KPI has Q1–Q4 target/achieved slots */
export async function ensureAllKpisHaveQuarterTargets(organizationId: string) {
  const empty = emptyQuarterTargets();
  const missing = await db.kpi.findMany({
    where: {
      organizationId,
      isActive: true,
      ownerName: { not: null },
      OR: [{ quarterTargets: null }, { quarterTargets: "" }],
    },
    select: { id: true },
  });

  if (!missing.length) return 0;

  await db.kpi.updateMany({
    where: { id: { in: missing.map((k) => k.id) } },
    data: { quarterTargets: empty },
  });

  return missing.length;
}
