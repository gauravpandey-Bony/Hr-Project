import { OFF_TARGET_THRESHOLD } from "@/lib/kpi";
import type { ChatBlock } from "./chat";
import type { OrgContext } from "./db-context";

export type DepartmentDashboardData = {
  department: string;
  headline: string;
  stats: { label: string; value: string; sub?: string; tone: "green" | "amber" | "red" | "neutral" }[];
  statusSegments: { label: string; value: number; color: string }[];
  categoryBars: { label: string; progress: number }[];
  kpiBars: { name: string; progress: number; status: string }[];
  highlights: { name: string; actual: string; target: string; progress: string; status: string }[];
  concerns: { name: string; actual: string; target: string; progress: string; status: string }[];
};

const DEPT_ALIASES: Record<string, string[]> = {
  Production: ["production", "manufacturing", "plant ops", "polymer line"],
  PPC: ["ppc", "planning", "production planning"],
  Development: ["development", "r&d", "rd"],
  "Quality Assurance": ["quality assurance", "quality", "qa", "qc"],
  Billing: ["billing", "invoice", "accounts"],
  "Dispatch & Billing": ["dispatch & billing", "dispatch and billing"],
  Dispatch: ["dispatch"],
  MIS: ["mis", "management information"],
  IT: ["it", "information technology", "systems"],
  Operations: ["operations", "agm operations"],
  "Human Resources": ["human resources", "hr"],
  "Plant Head": ["plant head", "plant overall"],
  Sales: ["sales", "dispatch", "customer"],
  Maintenance: ["maintenance", "breakdown", "mtbf"],
  Safety: ["safety", "ltifr", "incident"],
  Finance: ["finance", "cost", "budget"],
  IT: ["it", "information technology", "uptime", "erp"],
  "Human Resources": ["human resources", "hr", "people", "training"],
  Store: ["store", "inventory", "warehouse"],
  Billing: ["billing", "invoice", "accounts"],
  "Plant Head": ["plant head", "plant overall"],
  Process: ["process", "efficiency"],
};

function parseProgress(progress: string): number {
  return parseInt(progress.replace("%", "").trim(), 10) || 0;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function wantsDepartmentReport(q: string): boolean {
  return (
    /report|dashboard|chart|graph|visual|summary|overview|performance|format|status|show|view/i.test(
      q
    ) ||
    /department|dept|vibhag|division/i.test(q)
  );
}

export function resolveDepartmentFromQuery(
  message: string,
  kpis: OrgContext["kpis"]
): string | null {
  const q = normalize(message);
  if (!wantsDepartmentReport(q)) return null;

  const fromDb = Array.from(
    new Set(kpis.map((k) => k.department).filter((d): d is string => Boolean(d)))
  );

  for (const [dept, aliases] of Object.entries(DEPT_ALIASES)) {
    if (aliases.some((a) => q.includes(normalize(a)))) return dept;
    if (q.includes(normalize(dept))) return dept;
  }

  for (const dept of fromDb) {
    const n = normalize(dept);
    if (n && q.includes(n)) return dept;
  }

  for (const dept of fromDb) {
    const first = normalize(dept).split(" ")[0];
    if (first.length > 3 && q.includes(first)) return dept;
  }

  return null;
}

function filterKpisForDepartment(dept: string, kpis: OrgContext["kpis"]) {
  const key = normalize(dept);
  return kpis.filter((k) => {
    const d = normalize(k.department ?? "");
    const c = normalize(k.category ?? "");
    if (d === key || d.includes(key) || key.includes(d)) return true;
    const aliases = DEPT_ALIASES[dept] ?? [];
    return aliases.some((a) => c.includes(normalize(a)) || d.includes(normalize(a)));
  });
}

export function buildDepartmentDashboard(
  department: string,
  kpis: OrgContext["kpis"]
): DepartmentDashboardData | null {
  const rows = filterKpisForDepartment(department, kpis);
  if (!rows.length) return null;

  const withProgress = rows.map((k) => ({
    ...k,
    progressNum: parseProgress(k.progress),
  }));

  const green = withProgress.filter((k) => k.status === "green").length;
  const red = withProgress.filter((k) => k.status === "red").length;
  const avg =
    withProgress.length > 0
      ? Math.round(
          withProgress.reduce((s, k) => s + k.progressNum, 0) / withProgress.length
        )
      : 0;

  const byCategory = new Map<string, number[]>();
  for (const k of withProgress) {
    const cat = k.category || "Other";
    const list = byCategory.get(cat) ?? [];
    list.push(k.progressNum);
    byCategory.set(cat, list);
  }

  const categoryBars = Array.from(byCategory.entries())
    .map(([label, vals]) => ({
      label,
      progress: Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length),
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6);

  const kpiBars = [...withProgress]
    .sort((a, b) => b.progressNum - a.progressNum)
    .slice(0, 10)
    .map((k) => ({
      name: k.name,
      progress: k.progressNum,
      status: k.status,
    }));

  const sorted = [...withProgress].sort((a, b) => a.progressNum - b.progressNum);
  const concerns = sorted
    .filter((k) => k.status !== "green")
    .slice(0, 5)
    .map((k) => ({
      name: k.name,
      actual: k.current,
      target: k.target,
      progress: k.progress,
      status: k.status,
    }));

  const highlights = [...withProgress]
    .filter((k) => k.status === "green")
    .sort((a, b) => b.progressNum - a.progressNum)
    .slice(0, 4)
    .map((k) => ({
      name: k.name,
      actual: k.current,
      target: k.target,
      progress: k.progress,
      status: k.status,
    }));

  return {
    department,
    headline: `${department} — live KPI dashboard`,
    stats: [
      { label: "Total KPIs", value: String(rows.length), tone: "neutral" },
      { label: "On track", value: String(green), sub: `≥${OFF_TARGET_THRESHOLD}% progress`, tone: "green" },
      { label: "Off target", value: String(red), sub: `<${OFF_TARGET_THRESHOLD}%`, tone: "red" },
      { label: "Avg progress", value: `${avg}%`, tone: avg >= OFF_TARGET_THRESHOLD ? "green" : "red" },
    ],
    statusSegments: [
      { label: "On track", value: green, color: "#10b981" },
      { label: "Off target", value: red, color: "#ef4444" },
    ].filter((s) => s.value > 0),
    categoryBars,
    kpiBars,
    highlights,
    concerns,
  };
}

export function tryDepartmentReportBlocks(
  message: string,
  ctx: OrgContext
): ChatBlock[] | null {
  const dept = resolveDepartmentFromQuery(message, ctx.kpis);
  if (!dept) return null;

  const dashboard = buildDepartmentDashboard(dept, ctx.kpis);
  if (!dashboard) {
    return [
      {
        type: "text",
        content: `No KPIs found in the database for **${dept}**. Assign KPIs from KPI Library first.`,
      },
    ];
  }

  const onTrackPct = dashboard.stats[1]?.value ?? "0";
  const total = dashboard.stats[0]?.value ?? "0";

  return [
    {
      type: "text",
      content: `**${dept} department report** — ${total} KPIs tracked. **${onTrackPct}** on track. Charts and highlights are below.`,
    },
    { type: "department_dashboard", data: dashboard },
  ];
}
