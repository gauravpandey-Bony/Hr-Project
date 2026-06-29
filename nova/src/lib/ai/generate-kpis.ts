import { COMPANY } from "@/lib/company";
import { db } from "@/lib/db";
import type { KpiDirection, KpiFrequency } from "@prisma/client";

export interface GeneratedKpiSuggestion {
  name: string;
  description: string;
  category: string;
  unit: string;
  targetValue: number;
  direction: KpiDirection;
  frequency: KpiFrequency;
  department?: string;
}

async function loadDbKpiPool(
  organizationId: string
): Promise<GeneratedKpiSuggestion[]> {
  const kpis = await db.kpi.findMany({
    where: { organizationId, isActive: true },
    take: 150,
    orderBy: { name: "asc" },
  });
  return kpis.map((k) => ({
    name: k.name,
    description: k.description ?? k.kraName ?? k.name,
    category: k.category,
    unit: k.unit,
    targetValue: k.targetValue,
    direction: k.direction,
    frequency: k.frequency,
    department: k.department ?? undefined,
  }));
}

const IT_KPIS: GeneratedKpiSuggestion[] = [
  {
    name: "IT System Uptime",
    description: "Percentage of time critical business systems are available.",
    category: "Finance",
    unit: "%",
    targetValue: 99.5,
    direction: "HIGHER_IS_BETTER",
    frequency: "MONTHLY",
    department: "IT",
  },
  {
    name: "Help Desk Ticket Resolution Time",
    description: "Average hours to resolve IT support tickets.",
    category: "Finance",
    unit: "hours",
    targetValue: 8,
    direction: "LOWER_IS_BETTER",
    frequency: "WEEKLY",
    department: "IT",
  },
  {
    name: "IT Project On-Time Delivery",
    description: "Share of IT projects delivered by committed date.",
    category: "Finance",
    unit: "%",
    targetValue: 90,
    direction: "HIGHER_IS_BETTER",
    frequency: "MONTHLY",
    department: "IT",
  },
  {
    name: "Cybersecurity Incidents",
    description: "Number of confirmed security incidents per month.",
    category: "Safety",
    unit: "count",
    targetValue: 0,
    direction: "LOWER_IS_BETTER",
    frequency: "MONTHLY",
    department: "IT",
  },
  {
    name: "Backup Success Rate",
    description: "Percentage of scheduled backups completed successfully.",
    category: "Finance",
    unit: "%",
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    frequency: "WEEKLY",
    department: "IT",
  },
  {
    name: "ERP Data Entry Accuracy",
    description: "Error rate in master data maintained by IT/business teams.",
    category: "Quality",
    unit: "%",
    targetValue: 1,
    direction: "LOWER_IS_BETTER",
    frequency: "MONTHLY",
    department: "IT",
  },
];

const HR_KPIS: GeneratedKpiSuggestion[] = [
  {
    name: "Employee Turnover Rate",
    description: "Percentage of employees leaving the organization.",
    category: "Finance",
    unit: "%",
    targetValue: 8,
    direction: "LOWER_IS_BETTER",
    frequency: "MONTHLY",
    department: "HR",
  },
  {
    name: "Time to Hire",
    description: "Average days from job posting to offer acceptance.",
    category: "Finance",
    unit: "days",
    targetValue: 30,
    direction: "LOWER_IS_BETTER",
    frequency: "MONTHLY",
    department: "HR",
  },
  {
    name: "Training Hours per Employee",
    description: "Average training hours completed per employee.",
    category: "Finance",
    unit: "hours",
    targetValue: 24,
    direction: "HIGHER_IS_BETTER",
    frequency: "MONTHLY",
    department: "HR",
  },
  {
    name: "Absenteeism Rate",
    description: "Unplanned absence as percentage of scheduled workdays.",
    category: "Finance",
    unit: "%",
    targetValue: 3,
    direction: "LOWER_IS_BETTER",
    frequency: "MONTHLY",
    department: "HR",
  },
];

const MARKETING_KPIS: GeneratedKpiSuggestion[] = [
  {
    name: "Lead Conversion Rate",
    description: "Percentage of marketing leads converted to customers.",
    category: "Sales",
    unit: "%",
    targetValue: 12,
    direction: "HIGHER_IS_BETTER",
    frequency: "MONTHLY",
    department: "Marketing",
  },
  {
    name: "Cost per Lead",
    description: "Average marketing spend required to generate one lead.",
    category: "Finance",
    unit: "₹",
    targetValue: 500,
    direction: "LOWER_IS_BETTER",
    frequency: "MONTHLY",
    department: "Marketing",
  },
  {
    name: "Website Traffic Growth",
    description: "Month-over-month growth in unique website visitors.",
    category: "Sales",
    unit: "%",
    targetValue: 10,
    direction: "HIGHER_IS_BETTER",
    frequency: "MONTHLY",
    department: "Marketing",
  },
  {
    name: "Brand Campaign ROI",
    description: "Return on investment from marketing campaigns.",
    category: "Finance",
    unit: "ratio",
    targetValue: 3,
    direction: "HIGHER_IS_BETTER",
    frequency: "MONTHLY",
    department: "Marketing",
  },
];

const STATIC_FOCUS_KEYWORDS: { keys: string[]; pool: GeneratedKpiSuggestion[] }[] = [
  { keys: ["it", "tech", "software", "erp", "system", "cyber", "helpdesk", "information technology"], pool: IT_KPIS },
  { keys: ["hr", "human resource", "hiring", "recruit", "employee", "training", "attendance"], pool: HR_KPIS },
  { keys: ["marketing", "market", "brand", "campaign", "lead", "digital"], pool: MARKETING_KPIS },
];

const DB_FOCUS_RULES: {
  keys: string[];
  match: (k: GeneratedKpiSuggestion) => boolean;
}[] = [
  { keys: ["quality", "defect", "scrap", "yield", "qa"], match: (k) => k.category === "Quality" },
  { keys: ["production", "oee", "output", "throughput", "manufacturing", "plant"], match: (k) => k.category === "Production" },
  { keys: ["sales", "delivery", "dispatch", "customer"], match: (k) => k.category === "Sales" },
  { keys: ["maintenance", "downtime", "pm"], match: (k) => k.category === "Maintenance" },
  { keys: ["safety", "incident", "ltifr"], match: (k) => k.category === "Safety" },
  { keys: ["store", "inventory", "fifo", "grn", "procurement"], match: (k) => k.department === "Store" },
  { keys: ["billing", "sap", "invoicing", "portal"], match: (k) => k.department === "Billing" },
];

function poolForFocus(
  focus: string,
  dbPool: GeneratedKpiSuggestion[]
): GeneratedKpiSuggestion[] | null {
  const q = focus.toLowerCase().trim();
  for (const { keys, pool } of STATIC_FOCUS_KEYWORDS) {
    if (keys.some((k) => q.includes(k) || k.includes(q))) return pool;
  }
  for (const { keys, match } of DB_FOCUS_RULES) {
    if (keys.some((k) => q.includes(k) || k.includes(q))) {
      const matched = dbPool.filter(match);
      if (matched.length) return matched;
    }
  }
  return null;
}

function dedupeSuggestions(
  items: GeneratedKpiSuggestion[],
  existing: Set<string>
): GeneratedKpiSuggestion[] {
  const seen = new Set<string>();
  return items.filter((k) => {
    const key = k.name.toLowerCase();
    if (existing.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ruleBasedSuggestions(
  organizationId: string,
  existingNames: string[],
  focus?: string
): Promise<GeneratedKpiSuggestion[]> {
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));
  const dbPool = await loadDbKpiPool(organizationId);
  const allPools = [...dbPool, ...IT_KPIS, ...HR_KPIS, ...MARKETING_KPIS];

  if (focus?.trim()) {
    const q = focus.toLowerCase().trim();
    const topicPool = poolForFocus(q, dbPool);
    if (topicPool?.length) {
      const matched = dedupeSuggestions(topicPool, existing);
      if (matched.length) return matched.slice(0, 8);
    }

    const keywordMatched = dedupeSuggestions(
      allPools.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.category.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q) ||
          (k.department?.toLowerCase().includes(q) ?? false)
      ),
      existing
    );
    if (keywordMatched.length) return keywordMatched.slice(0, 8);

    const title = focus.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    const custom: GeneratedKpiSuggestion[] = [
      {
        name: `${title} Performance Score`,
        description: `Overall performance index for ${focus.trim()} initiatives.`,
        category: "Finance",
        unit: "%",
        targetValue: 85,
        direction: "HIGHER_IS_BETTER",
        frequency: "MONTHLY",
        department: focus.trim(),
      },
      {
        name: `${title} Goal Achievement`,
        description: `Percentage of ${focus.trim()} targets met on time.`,
        category: "Finance",
        unit: "%",
        targetValue: 90,
        direction: "HIGHER_IS_BETTER",
        frequency: "MONTHLY",
        department: focus.trim(),
      },
      {
        name: `${title} Cost Efficiency`,
        description: `Cost variance vs budget for ${focus.trim()}.`,
        category: "Finance",
        unit: "%",
        targetValue: 5,
        direction: "LOWER_IS_BETTER",
        frequency: "MONTHLY",
        department: focus.trim(),
      },
      {
        name: `${title} SLA Compliance`,
        description: `Service level agreement adherence for ${focus.trim()}.`,
        category: "Quality",
        unit: "%",
        targetValue: 95,
        direction: "HIGHER_IS_BETTER",
        frequency: "WEEKLY",
        department: focus.trim(),
      },
    ];
    return custom.filter((k) => !existing.has(k.name.toLowerCase()));
  }

  return dedupeSuggestions(allPools, existing).slice(0, 8);
}

async function llmSuggestions(
  organizationId: string,
  existingNames: string[],
  focus?: string
): Promise<GeneratedKpiSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ruleBasedSuggestions(organizationId, existingNames, focus);

  const prompt = `You are a KPI consultant for ${COMPANY.name}, a polymer manufacturing company in India.
Suggest 6-8 operational KPIs as JSON: { "kpis": [{ "name", "description", "category", "unit", "targetValue", "direction": "HIGHER_IS_BETTER"|"LOWER_IS_BETTER", "frequency": "DAILY"|"WEEKLY"|"MONTHLY", "department" }] }.
Categories: Production, Quality, Sales, Maintenance, Safety, Finance.
${focus ? `Focus: ${focus}` : "Focus: manufacturing plant performance like SimpleKPI."}
Do not duplicate: ${existingNames.join(", ") || "none"}.
Use realistic targets for a mid-size polymer plant.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: "Reply with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI error:", await res.text());
    return ruleBasedSuggestions(organizationId, existingNames, focus);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return ruleBasedSuggestions(organizationId, existingNames, focus);

  const parsed = JSON.parse(content) as { kpis: GeneratedKpiSuggestion[] };
  return (parsed.kpis ?? []).slice(0, 10).map((k) => ({
    ...k,
    direction: k.direction === "LOWER_IS_BETTER" ? "LOWER_IS_BETTER" : "HIGHER_IS_BETTER",
    frequency: ["DAILY", "WEEKLY", "MONTHLY"].includes(k.frequency)
      ? k.frequency
      : "MONTHLY",
  }));
}

export async function generateKpiSuggestions(
  organizationId: string,
  existingNames: string[],
  focus?: string
): Promise<{ suggestions: GeneratedKpiSuggestion[]; source: "ai" | "template" }> {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  const suggestions = hasKey
    ? await llmSuggestions(organizationId, existingNames, focus)
    : await ruleBasedSuggestions(organizationId, existingNames, focus);

  return {
    suggestions,
    source: hasKey ? "ai" : "template",
  };
}

export async function generateKpiInsights(
  kpis: {
    name: string;
    category: string;
    current: number;
    target: number;
    direction: KpiDirection;
    status: "green" | "amber" | "red";
  }[]
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || kpis.length === 0) {
    return ruleBasedKpiInsights(kpis);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You advise plant managers at a polymer company. Return JSON: { \"insights\": string[] } with 3-5 short actionable bullets.",
        },
        {
          role: "user",
          content: `Analyze these KPIs for ${COMPANY.shortName}:\n${JSON.stringify(kpis, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    }),
  });

  if (!res.ok) return ruleBasedKpiInsights(kpis);

  try {
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return (parsed.insights as string[])?.slice(0, 5) ?? ruleBasedKpiInsights(kpis);
  } catch {
    return ruleBasedKpiInsights(kpis);
  }
}

function ruleBasedKpiInsights(
  kpis: {
    name: string;
    status: "green" | "amber" | "red";
    category: string;
  }[]
): string[] {
  const insights: string[] = [];
  const red = kpis.filter((k) => k.status === "red");

  if (red.length) {
    insights.push(
      `Priority: ${red.map((k) => k.name).join(", ")} — schedule root-cause review this week.`
    );
  }
  const qualityIssues = red.filter((k) => k.category === "Quality");
  if (qualityIssues.length) {
    insights.push(
      "Quality metrics off target — align production and QA on defect containment actions."
    );
  }
  if (insights.length === 0) {
    insights.push("All tracked KPIs are on target. Consider adding OEE or scrap rate if not yet tracked.");
  }
  insights.push("Tip: Use Generate KPIs to add industry-standard manufacturing metrics in one click.");

  return insights.slice(0, 4);
}
