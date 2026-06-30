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
import { answerFromDatabase } from "./maya-smart-answer";
import type { UserRole } from "@prisma/client";

export type ChatBlock =
  | { type: "text"; content: string }
  | { type: "table"; title?: string; headers: string[]; rows: string[][] }
  | { type: "kpi_suggestions"; items: GeneratedKpiSuggestion[]; focus?: string }
  | { type: "department_dashboard"; data: import("./department-report").DepartmentDashboardData }
  | { type: "employee_dashboard"; data: import("./employee-report").EmployeeDashboardData };


export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  blocks?: ChatBlock[];
};

function wantsKpiGeneration(msg: string): boolean {
  return /generate|create|suggest|add/i.test(msg) && /kpi/i.test(msg);
}

function wantsVisualReport(message: string): boolean {
  return /report|dashboard|scorecard|performance|chart|graph|visual|summary card/i.test(
    message
  );
}

function serializeContextForLlm(ctx: OrgContext): string {
  return JSON.stringify(ctx).slice(0, 32000);
}

async function llmAnswer(
  message: string,
  ctx: OrgContext,
  history: ChatMessage[]
): Promise<ChatBlock[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return answerFromDatabase(message, ctx);

  const contextStr = serializeContextForLlm(ctx);

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

  if (!res.ok) return answerFromDatabase(message, ctx);

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
    return blocks.length ? blocks : answerFromDatabase(message, ctx);
  } catch {
    return answerFromDatabase(message, ctx);
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
      blocks: [{ type: "text", content: `Kuch bhi puchho — employee, department, plant, KPI, headcount…` }],
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
    const { suggestions, source } = await generateKpiSuggestions(
      organizationId,
      existingKpiNames,
      focus
    );

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

  const deptInMessage = wantsVisualReport(query)
    ? resolveDepartmentFromQuery(query, ctx.kpis)
    : null;
  const employeeReport =
    wantsVisualReport(query) && deptInMessage === null
      ? await tryEmployeeReportBlocks(
          query,
          organizationId,
          requesterRole,
          reportUnitKey,
          reportUnitName
        )
      : null;
  const deptReport =
    wantsVisualReport(query) && !employeeReport
      ? tryDepartmentReportBlocks(query, ctx)
      : null;
  const blocks = employeeReport
    ? employeeReport
    : deptReport
      ? deptReport
      : await llmAnswer(query, ctx, history);

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
