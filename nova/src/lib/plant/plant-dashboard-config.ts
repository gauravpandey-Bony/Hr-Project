import type { PlantPerformanceReport } from "@/lib/kra/plant-performance-report";
import type { PlantBusinessKpiRow, LevelKpiRow } from "@/lib/kra/plant-performance-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";

export type SpotlightIcon =
  | "sales"
  | "production"
  | "quality"
  | "delivery"
  | "dispatch"
  | "safety"
  | "finance"
  | "inventory";

export type SpotlightMetricDef = {
  id: string;
  label: string;
  shortLabel: string;
  icon: SpotlightIcon;
  gradient: string;
  glow: string;
  keywords: string[];
  preferLevel?: "PLANT" | "DEPARTMENT" | "INDIVIDUAL";
};

export type PlantDashboardProfile = {
  /** Match by unit slug first */
  unitSlugs: string[];
  /** Fallback match by plantUnitKey */
  plantUnitKeys?: string[];
  tagline: string;
  metricsSectionTitle: string;
  metricsSectionSubtitle: string;
  spotlight: SpotlightMetricDef[];
};

export const PLANT_DASHBOARD_PROFILES: PlantDashboardProfile[] = [
  {
    unitSlugs: ["bony-37p"],
    plantUnitKeys: ["Bony Polymers", "Bony 37P"],
    tagline: "Sales-driven polymer plant — revenue, delivery & quality at a glance.",
    metricsSectionTitle: "Bony 37P spotlight",
    metricsSectionSubtitle: "Sales ₹ Cr, OTD, rejection & profitability",
    spotlight: [
      {
        id: "sales",
        label: "Sales / Revenue",
        shortLabel: "Sales",
        icon: "sales",
        gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
        glow: "shadow-violet-500/30",
        keywords: ["sales", "revenue", "budget", "₹ cr", "turnover"],
        preferLevel: "PLANT",
      },
      {
        id: "otd",
        label: "On-Time Delivery",
        shortLabel: "OTD",
        icon: "delivery",
        gradient: "from-cyan-500 via-blue-500 to-indigo-500",
        glow: "shadow-cyan-500/30",
        keywords: ["otd", "delivery", "adherence", "on-time", "on time"],
        preferLevel: "PLANT",
      },
      {
        id: "rejection",
        label: "Plant Rejection",
        shortLabel: "Rejection",
        icon: "quality",
        gradient: "from-rose-500 via-red-500 to-orange-500",
        glow: "shadow-rose-500/30",
        keywords: ["rejection", "ppm", "defect", "quality"],
        preferLevel: "PLANT",
      },
      {
        id: "ebitda",
        label: "EBITDA / Profitability",
        shortLabel: "EBITDA",
        icon: "finance",
        gradient: "from-amber-500 via-orange-500 to-yellow-500",
        glow: "shadow-amber-500/30",
        keywords: ["ebitda", "profit", "profitability", "margin"],
        preferLevel: "PLANT",
      },
    ],
  },
  {
    unitSlugs: ["saket-sheet-metal"],
    plantUnitKeys: ["Saket Fabs Sheet Metal", "SF-1", "Saket Fabs"],
    tagline: "Sheet metal unit — production output, quality & tool room focus.",
    metricsSectionTitle: "Saket Unit 1 spotlight",
    metricsSectionSubtitle: "Production output, quality PPM, dispatch & maintenance",
    spotlight: [
      {
        id: "production",
        label: "Production Output",
        shortLabel: "Production",
        icon: "production",
        gradient: "from-emerald-500 via-teal-500 to-cyan-500",
        glow: "shadow-emerald-500/30",
        keywords: ["production", "output", "plan vs actual", "achievement", "oee", "productivity"],
        preferLevel: "PLANT",
      },
      {
        id: "quality",
        label: "Quality / PPM",
        shortLabel: "Quality",
        icon: "quality",
        gradient: "from-blue-500 via-indigo-500 to-violet-500",
        glow: "shadow-blue-500/30",
        keywords: ["quality", "ppm", "rejection", "defect", "customer complaint"],
        preferLevel: "PLANT",
      },
      {
        id: "dispatch",
        label: "Dispatch & Delivery",
        shortLabel: "Dispatch",
        icon: "dispatch",
        gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
        glow: "shadow-violet-500/30",
        keywords: ["dispatch", "delivery", "otd", "shipment"],
      },
      {
        id: "maintenance",
        label: "Maintenance / Downtime",
        shortLabel: "Maint.",
        icon: "safety",
        gradient: "from-orange-500 via-amber-500 to-yellow-500",
        glow: "shadow-orange-500/30",
        keywords: ["maintenance", "downtime", "breakdown", "mttr", "pm schedule", "line stoppage"],
      },
    ],
  },
  {
    unitSlugs: ["bony-fluid-58"],
    plantUnitKeys: ["Bony Fluid 58", "Plant 58"],
    tagline: "Fluid 58 plant — assembly, quality & dispatch performance.",
    metricsSectionTitle: "Bony Fluid 58 spotlight",
    metricsSectionSubtitle: "Assembly output, fluid quality, dispatch & store",
    spotlight: [
      {
        id: "assembly",
        label: "Assembly Output",
        shortLabel: "Assembly",
        icon: "production",
        gradient: "from-teal-500 via-emerald-500 to-green-500",
        glow: "shadow-teal-500/30",
        keywords: ["assembly", "production", "output", "plan vs actual"],
        preferLevel: "PLANT",
      },
      {
        id: "quality",
        label: "Quality / Rejection",
        shortLabel: "Quality",
        icon: "quality",
        gradient: "from-blue-500 to-indigo-600",
        glow: "shadow-blue-500/30",
        keywords: ["quality", "rejection", "ppm", "defect", "customer complaint"],
        preferLevel: "PLANT",
      },
      {
        id: "dispatch",
        label: "Dispatch",
        shortLabel: "Dispatch",
        icon: "dispatch",
        gradient: "from-violet-500 to-purple-600",
        glow: "shadow-violet-500/30",
        keywords: ["dispatch", "delivery", "otd"],
      },
      {
        id: "store",
        label: "Store / Inventory",
        shortLabel: "Store",
        icon: "inventory",
        gradient: "from-amber-500 to-orange-500",
        glow: "shadow-amber-500/30",
        keywords: ["store", "inventory", "stock", "grn"],
      },
    ],
  },
];

const DEFAULT_PROFILE: PlantDashboardProfile = {
  unitSlugs: [],
  tagline: "Plant health, departments & employee KRA performance.",
  metricsSectionTitle: "Plant spotlight metrics",
  metricsSectionSubtitle: "Key business KPIs for this unit",
  spotlight: [
    {
      id: "sales",
      label: "Sales / Revenue",
      shortLabel: "Sales",
      icon: "sales",
      gradient: "from-violet-500 to-fuchsia-600",
      glow: "shadow-violet-500/30",
      keywords: ["sales", "revenue"],
      preferLevel: "PLANT",
    },
    {
      id: "production",
      label: "Production",
      shortLabel: "Production",
      icon: "production",
      gradient: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/30",
      keywords: ["production", "output"],
      preferLevel: "PLANT",
    },
    {
      id: "quality",
      label: "Quality",
      shortLabel: "Quality",
      icon: "quality",
      gradient: "from-blue-500 to-indigo-600",
      glow: "shadow-blue-500/30",
      keywords: ["quality", "rejection", "ppm", "defect", "customer complaint"],
      preferLevel: "PLANT",
    },
    {
      id: "delivery",
      label: "Delivery / OTD",
      shortLabel: "OTD",
      icon: "delivery",
      gradient: "from-cyan-500 to-blue-600",
      glow: "shadow-cyan-500/30",
      keywords: ["delivery", "otd", "dispatch"],
      preferLevel: "PLANT",
    },
  ],
};

export function getPlantDashboardProfile(
  unitSlug: string,
  plantUnitKey: string
): PlantDashboardProfile {
  const bySlug = PLANT_DASHBOARD_PROFILES.find((p) => p.unitSlugs.includes(unitSlug));
  if (bySlug) return bySlug;
  const byKey = PLANT_DASHBOARD_PROFILES.find((p) =>
    p.plantUnitKeys?.some(
      (k) => k.toLowerCase() === plantUnitKey.toLowerCase()
    )
  );
  return byKey ?? DEFAULT_PROFILE;
}

type KpiLike = {
  kpiId: string;
  kraName: string;
  kpiName: string;
  achieved: string;
  target: string;
  status: string;
  statusLabel: string;
  category: string;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function matchScore(text: string, keywords: string[]): number {
  const n = normalize(text);
  let score = 0;
  for (const kw of keywords) {
    if (n.includes(normalize(kw))) score += kw.length;
  }
  return score;
}

/** Reject Design/activity KRAs that only mention "quality" loosely. */
function isExcludedSpotlightNoise(def: SpotlightMetricDef, row: KpiLike): boolean {
  const blob = normalize(`${row.kraName} ${row.kpiName} ${row.target} ${row.achieved}`);

  // Long sentence targets are almost never plant spotlight metrics
  if ((row.target?.trim().length ?? 0) > 48 && !/\d/.test(row.target)) return true;
  if ((row.target?.trim().length ?? 0) > 80) return true;

  if (def.id === "quality" || def.icon === "quality") {
    // Drawing / ECN / NPD activity — not plant quality (PPM/rejection)
    if (
      /\b(ecn|drawing|drawings|revised drawing|distributed|concern department|npd|design release)\b/.test(
        blob
      )
    ) {
      return true;
    }
    // Require a real quality signal beyond the word alone in category
    const strong =
      /\b(ppm|rejection|defect|customer complaint|quality assurance|qa\b|incoming|in process|final inspection)\b/.test(
        blob
      );
    const onlyWeakCategory =
      normalize(row.category).includes("quality") &&
      matchScore(`${row.kraName} ${row.kpiName}`, def.keywords) < 7;
    if (!strong && onlyWeakCategory) return true;
    if (!strong && matchScore(`${row.kraName} ${row.kpiName}`, ["quality"]) > 0) {
      // "quality" alone in name without PPM/rejection — skip for spotlight
      const nameScore = matchScore(`${row.kraName} ${row.kpiName}`, [
        "ppm",
        "rejection",
        "defect",
        "complaint",
      ]);
      if (nameScore === 0) return true;
    }
  }

  if (def.id === "sales" || def.icon === "sales") {
    if (/\b(manpower|cost control|headcount|recruitment)\b/.test(blob)) return true;
  }

  return false;
}

function rowToKpiLike(row: PlantBusinessKpiRow | LevelKpiRow): KpiLike {
  return {
    kpiId: row.kpiId,
    kraName: row.kraName,
    kpiName: row.kpiName,
    achieved: row.achieved,
    target: row.target,
    status: row.status,
    statusLabel: row.statusLabel,
    category: "category" in row ? (row.category ?? "—") : "—",
  };
}

export type ResolvedSpotlightMetric = SpotlightMetricDef & {
  resolved: KpiLike | null;
  matchSource: "plant" | "department" | "employee" | "none";
};

export function resolveSpotlightMetrics(
  profile: PlantDashboardProfile,
  report: PlantPerformanceReport
): ResolvedSpotlightMetric[] {
  const plantPool = report.plantKpis.rows;
  const deptPool = report.departments.cards.flatMap((d) => d.kpiRows);
  const empPool = report.employees.rows.flatMap((e) =>
    e.breakdown.map((b) => ({
      ...rowToKpiLike(b),
      kpiId: b.kpiId,
    }))
  );

  return profile.spotlight.map((def) => {
    const pools: { source: ResolvedSpotlightMetric["matchSource"]; rows: KpiLike[] }[] = [
      { source: "plant", rows: plantPool.map(rowToKpiLike) },
      { source: "department", rows: deptPool.map(rowToKpiLike) },
      { source: "employee", rows: empPool },
    ];

    // Business spotlights: plant → department first; employee only as last resort
    // and only with a stronger keyword score (avoids Design "quality" false matches).
    const order =
      def.preferLevel === "DEPARTMENT"
        ? [pools[1], pools[0], pools[2]]
        : def.preferLevel === "INDIVIDUAL"
          ? [pools[2], pools[1], pools[0]]
          : pools;

    let best: { row: KpiLike; source: ResolvedSpotlightMetric["matchSource"]; score: number } | null =
      null;

    for (const pool of order) {
      for (const row of pool.rows) {
        if (isExcludedSpotlightNoise(def, row)) continue;
        const text = `${row.kraName} ${row.kpiName} ${row.category}`;
        let score = matchScore(text, def.keywords);
        if (score <= 0) continue;

        // Prefer plant/dept over weak employee matches
        if (pool.source === "employee") {
          score -= 3;
          if (score < 6) continue;
        }
        if (pool.source === "plant") score += 4;
        if (pool.source === "department") score += 2;

        if (!best || score > best.score) {
          best = { row, source: pool.source, score };
        }
      }
      // Stop early only when we already have a solid plant/dept hit
      if (best && best.source !== "employee" && best.score >= 6) break;
    }

    return {
      ...def,
      resolved: best?.row ?? null,
      matchSource: best?.source ?? "none",
    };
  });
}
