import { COMPANY } from "@/lib/company";
import {
  parseNovaMessage,
  novaActivationBlocks,
  novaSystemPrompt,
  NOVA,
} from "./nova-assistant";
import { generateKpiSuggestions, type GeneratedKpiSuggestion } from "./generate-kpis";
import type { OrgContext } from "./db-context";
import {
  resolveDepartmentFromQuery,
  tryDepartmentReportBlocks,
} from "./department-report";
import { tryEmployeeReportBlocks } from "./employee-report";
import type { UserRole } from "@prisma/client";

export type ChatBlock =
  | { type: "text"; content: string }
  | { type: "table"; title?: string; headers: string[]; rows: string[][] }
  | { type: "kpi_suggestions"; items: GeneratedKpiSuggestion[]; focus?: string }
  | { type: "department_dashboard"; data: import("./department-report").DepartmentDashboardData }
  | { type: "employee_dashboard"; data: import("./employee-report").EmployeeDashboardData };

const KPI_TABLE_MAX = 12;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  blocks?: ChatBlock[];
};

function wantsKpiGeneration(msg: string): boolean {
  return /generate|create|suggest|add/i.test(msg) && /kpi/i.test(msg);
}

function ruleBasedAnswer(message: string, ctx: OrgContext): ChatBlock[] {
  const q = message.toLowerCase();
  const blocks: ChatBlock[] = [];

  const deptReport = tryDepartmentReportBlocks(message, ctx);
  if (deptReport) return deptReport;

  if (/summary|overview|dashboard|all data|full data/i.test(q)) {
    blocks.push({
      type: "text",
      content: `Here is a full snapshot of **${ctx.workspace}** from the database:`,
    });
    blocks.push({
      type: "table",
      title: "Company stats",
      headers: ["Metric", "Count"],
      rows: [
        ["Employees", String(ctx.stats.employees)],
        ["KPIs tracked", String(ctx.stats.kpis)],
        ["Goals", String(ctx.stats.goals)],
        ["Active review cycles", String(ctx.stats.activeCycles)],
        ["Pending reviews", String(ctx.stats.pendingReviews)],
        ["360° campaigns", String(ctx.stats.feedbackCampaigns)],
        ["Surveys", String(ctx.stats.surveys)],
      ],
    });
    if (ctx.kpis.length) {
      blocks.push({
        type: "table",
        title: "All KPIs (latest values)",
        headers: ["KPI", "Category", "Actual", "Target", "Progress", "Status"],
        rows: ctx.kpis.map((k) => [
          k.name,
          k.category,
          k.current,
          k.target,
          k.progress,
          k.status,
        ]),
      });
    }
    return blocks;
  }

  if (/employee|staff|user|team|kaun/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${ctx.stats.employees} employees** in the database:`,
    });
    blocks.push({
      type: "table",
      headers: ["Name", "Role", "Department", "Title", "Email"],
      rows: ctx.users.map((u) => [u.name, u.role, u.department ?? "—", u.title ?? "—", u.email]),
    });
    return blocks;
  }

  if (/kpi|metric|performance|defect|production|dispatch/i.test(q)) {
    if (!ctx.kpis.length) {
      blocks.push({
        type: "text",
        content: "No KPIs in the database yet. Say **“Generate KPIs for production”** to create some.",
      });
      return blocks;
    }
    const filtered = q.includes("production")
      ? ctx.kpis.filter((k) => k.category === "Production")
      : q.includes("quality")
        ? ctx.kpis.filter((k) => k.category === "Quality")
        : q.includes("red") || q.includes("off target")
          ? ctx.kpis.filter((k) => k.status === "red")
          : q.includes("green") || q.includes("on target")
            ? ctx.kpis.filter((k) => k.status === "green")
            : ctx.kpis;

    const show = filtered.slice(0, KPI_TABLE_MAX);
    blocks.push({
      type: "text",
      content:
        filtered.length > KPI_TABLE_MAX
          ? `Found **${filtered.length} KPI(s)** — showing first ${KPI_TABLE_MAX} in the table. For charts, ask: **"Production department report"**.`
          : `Found **${filtered.length} KPI(s)** matching your question:`,
    });
    blocks.push({
      type: "table",
      headers: ["KPI", "Category", "Actual", "Target", "Progress", "Status"],
      rows: show.map((k) => [
        k.name,
        k.category,
        k.current,
        k.target,
        k.progress,
        k.status,
      ]),
    });
    return blocks;
  }

  if (/review|pending|assignment/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${ctx.stats.pendingReviews} pending review(s)** and ${ctx.reviewCycles.length} cycle(s):`,
    });
    if (ctx.reviewCycles.length) {
      blocks.push({
        type: "table",
        title: "Review cycles",
        headers: ["Cycle", "Status", "Assignments"],
        rows: ctx.reviewCycles.map((c) => [c.name, c.status, String(c.assignments)]),
      });
    }
    if (ctx.pendingReviews.length) {
      blocks.push({
        type: "table",
        title: "Pending reviews",
        headers: ["Type", "Reviewee", "Cycle", "Status"],
        rows: ctx.pendingReviews.map((r) => [r.type, r.reviewee, r.cycle, r.status]),
      });
    }
    return blocks;
  }

  if (/goal|okr/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${ctx.goals.length} goals** in the database:`,
    });
    blocks.push({
      type: "table",
      headers: ["Goal", "Level", "Owner", "Progress", "Status"],
      rows: ctx.goals.map((g) => [g.title, g.level, g.owner, g.progress, g.status]),
    });
    return blocks;
  }

  if (/feedback|360/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${ctx.feedback.length} feedback campaign(s):**`,
    });
    blocks.push({
      type: "table",
      headers: ["Campaign", "Status", "Responses", "AI summary"],
      rows: ctx.feedback.map((f) => [
        f.name,
        f.status,
        String(f.responses),
        f.aiSummary ?? "—",
      ]),
    });
    return blocks;
  }

  if (/compensation|salary|merit|bonus/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${ctx.compensation.length} compensation recommendation(s):**`,
    });
    blocks.push({
      type: "table",
      headers: ["Employee", "Rating", "Merit %", "Bonus %"],
      rows: ctx.compensation.map((c) => [
        c.employee,
        c.rating?.toFixed(1) ?? "—",
        c.merit?.toString() ?? "—",
        c.bonus?.toString() ?? "—",
      ]),
    });
    return blocks;
  }

  if (/survey|engagement|pulse/i.test(q)) {
    blocks.push({
      type: "table",
      title: "Surveys",
      headers: ["Title", "Status", "Responses"],
      rows: ctx.surveys.map((s) => [s.title, s.status, String(s.responses)]),
    });
    return blocks;
  }

  blocks.push({
    type: "text",
    content: `I can answer questions about **KPIs**, **employees**, **reviews**, **goals**, **feedback**, **compensation**, and **surveys** for **${ctx.workspace}**. Try:\n\n• **Ms. Mahima employee report** (name or user ID)\n• **demo-employee report**\n• "Production department report"\n• "Show all KPIs"\n• "Full database summary"`,
  });
  return blocks;
}

async function llmAnswer(
  message: string,
  ctx: OrgContext,
  history: ChatMessage[]
): Promise<ChatBlock[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ruleBasedAnswer(message, ctx);

  const contextStr = JSON.stringify(ctx).slice(0, 12000);

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
          content: `${novaSystemPrompt(COMPANY.name, ctx.unitName, ctx.orgWide)}
Be specific with numbers from data.
DATABASE CONTEXT:\n${contextStr}`,
        },
        ...history.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) return ruleBasedAnswer(message, ctx);

  try {
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    const blocks: ChatBlock[] = [];
    if (parsed.text) blocks.push({ type: "text", content: parsed.text });
    for (const t of parsed.tables ?? []) {
      blocks.push({
        type: "table",
        title: t.title,
        headers: t.headers,
        rows: t.rows,
      });
    }
    return blocks.length ? blocks : ruleBasedAnswer(message, ctx);
  } catch {
    return ruleBasedAnswer(message, ctx);
  }
}

export async function processChatMessage(
  message: string,
  organizationId: string,
  ctx: OrgContext,
  history: ChatMessage[],
  existingKpiNames: string[],
  requesterRole: UserRole = "ADMIN",
  plantUnitKey?: string | null,
  unitName?: string | null
): Promise<ChatMessage> {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      role: "assistant",
      content: `${NOVA.name} — ask me anything.`,
      blocks: [{ type: "text", content: `Type **${NOVA.name}, production report** or an employee name.` }],
    };
  }

  const nova = parseNovaMessage(trimmed);
  if (nova.activationOnly) {
    return {
      role: "assistant",
      content: `${NOVA.name} active — ready for your command.`,
      blocks: novaActivationBlocks(ctx.unitName, ctx.orgWide),
    };
  }

  const query = nova.command;

  if (wantsKpiGeneration(query)) {
    const focus = query
      .replace(/generate|create|suggest|kpi|kpis|for|me|please/gi, "")
      .trim();
    const { suggestions, source } = await generateKpiSuggestions(existingKpiNames, focus);

    return {
      role: "assistant",
      content: `Here are ${suggestions.length} KPI suggestions (${source === "ai" ? "AI" : "smart templates"}). Select and add from the list below.`,
      blocks: [
        {
          type: "text",
          content: focus
            ? `Based on: **${focus}**`
            : `Popular manufacturing & operations KPIs for ${ctx.workspace}:`,
        },
        { type: "kpi_suggestions", items: suggestions, focus },
      ],
    };
  }

  const reportUnitKey = requesterRole === "ADMIN" ? null : plantUnitKey;
  const reportUnitName = requesterRole === "ADMIN" ? null : unitName ?? ctx.unitName;

  const deptInMessage = resolveDepartmentFromQuery(query, ctx.kpis);
  const employeeReport =
    deptInMessage === null
      ? await tryEmployeeReportBlocks(
          query,
          organizationId,
          requesterRole,
          reportUnitKey,
          reportUnitName
        )
      : null;
  const deptReport = employeeReport ? null : tryDepartmentReportBlocks(query, ctx);
  const blocks = employeeReport
    ? employeeReport
    : deptReport
      ? deptReport
      : process.env.OPENAI_API_KEY
        ? await llmAnswer(query, ctx, history)
        : ruleBasedAnswer(query, ctx);

  if (nova.invoked && blocks.length) {
    const first = blocks.find((b) => b.type === "text");
    if (first && first.type === "text" && !first.content.startsWith("**")) {
      first.content = `**${NOVA.name}:** ${first.content}`;
    }
  }

  const summary = blocks.find((b) => b.type === "text")?.content ?? "Here is what I found in your database.";

  return {
    role: "assistant",
    content: summary,
    blocks,
  };
}
