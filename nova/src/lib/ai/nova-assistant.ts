/** Wake-word assistant — invoke with "Maya, …" (voice or chat) */

export const NOVA = {
  name: "Maya",
  displayName: "Maya",
  productLabel: "Maya — Bony KPI AI",
} as const;

const NOVA_WORD =
  "(?:maya|माया|maaya|maia|mya|mai\\s*a|knower|know\\s*a)";

const WAKE_PREFIX =
  new RegExp(
    `^(?:(?:hey|hi|ok|please|yar|yaar|hello)\\s+)?${NOVA_WORD}(?:[,:\\s!.-]+|\\s+)`,
    "i"
  );

const WAKE_ONLY = new RegExp(
  `^(?:(?:hey|hi|ok|hello)\\s+)?${NOVA_WORD}[!.\\s]*$`,
  "i"
);

const WAKE_IN_PHRASE = new RegExp(
  `\\b(?:(?:hey|hi|ok|hello)\\s+)?${NOVA_WORD}\\b`,
  "i"
);

const WAKE_STRIP_VOICE = new RegExp(
  `^[\\s\\S]*?\\b(?:(?:hey|hi|ok|hello)\\s+)?${NOVA_WORD}\\b[,:\\s]*`,
  "i"
);

export type NovaParseResult = {
  invoked: boolean;
  command: string;
  activationOnly: boolean;
};

export function transcriptHasWakeWord(transcript: string): boolean {
  const t = transcript.trim();
  if (!t) return false;
  return WAKE_IN_PHRASE.test(t) || WAKE_ONLY.test(t);
}

export function extractNovaVoiceCommand(transcript: string): NovaParseResult | null {
  const raw = transcript.trim();
  if (!raw || !transcriptHasWakeWord(raw)) return null;

  const afterWake = raw.replace(WAKE_STRIP_VOICE, "").trim();
  if (!afterWake || WAKE_ONLY.test(raw)) {
    return { invoked: true, command: "", activationOnly: true };
  }
  return {
    invoked: true,
    command: afterWake,
    activationOnly: false,
  };
}

export function parseNovaMessage(message: string): NovaParseResult {
  const raw = message.trim();
  if (!raw) {
    return { invoked: false, command: "", activationOnly: false };
  }

  if (WAKE_ONLY.test(raw)) {
    return { invoked: true, command: "", activationOnly: true };
  }

  if (WAKE_PREFIX.test(raw)) {
    const command = raw.replace(WAKE_PREFIX, "").trim();
    return {
      invoked: true,
      command,
      activationOnly: !command,
    };
  }

  if (WAKE_IN_PHRASE.test(raw)) {
    const command = raw.replace(WAKE_STRIP_VOICE, "").trim();
    return {
      invoked: true,
      command,
      activationOnly: !command,
    };
  }

  return { invoked: false, command: raw, activationOnly: false };
}

/** Normalize messy voice text before chat API */
export function normalizeNovaVoiceMessage(transcript: string): string {
  const parsed = extractNovaVoiceCommand(transcript) ?? parseNovaMessage(transcript);
  if (parsed.activationOnly) return NOVA.name;
  if (parsed.invoked && parsed.command) return `${NOVA.name}, ${parsed.command}`;
  const t = transcript.trim();
  if (t) return t;
  return NOVA.name;
}

/** Hey Maya ON — report/ECN/name requests without saying "Maya" */
export function isDirectNovaIntent(transcript: string): boolean {
  const t = transcript.trim();
  if (!t || transcriptHasWakeWord(t)) return false;
  if (/\b\d{4,}\b/.test(t)) return true;
  return /report|dashboard|employee|kpi|department|production|billing|it\b|show|view|batao|dikhao|bataye|ki report|ka report|sharma|khan|gupta|mishra/i.test(
    t
  );
}

export function novaActivationBlocks(
  unitName?: string | null,
  orgWide?: boolean
): { type: "text"; content: string }[] {
  const scope = orgWide
    ? "I can answer about **any employee, department, or unit** in your organization."
    : unitName
      ? `Focused on **${unitName}** — ask me anything about this unit.`
      : "Ask me about KPIs, employees, departments, or reports.";
  return [
    {
      type: "text",
      content: `**${NOVA.name} is active.** ${scope}\n\nKuch bhi puchho — seedha sawal pucho, koi fixed command zaroori nahi.`,
    },
  ];
}

export function novaSystemPrompt(
  companyName: string,
  unitName?: string | null,
  orgWide?: boolean
): string {
  const unitRule = orgWide
    ? `You have access to the **entire organization** — all plants and units. Answer any question about any employee, department, or KPI. Include department, unit/plant, and KPI details when relevant.`
    : unitName
      ? `Focus on **${unitName}** when the question is about unit KPIs, but still help with org-wide employee lookups when asked by name.`
      : "Answer using only the database context for the current workspace.";
  return `You are ${NOVA.name}, the friendly KPI assistant for ${companyName} (Bony Polymers).
Users may ask in natural language — Hindi, English, or mixed. No fixed commands are required.
${unitRule}
Use ONLY the database context below. Search employees, departments, plants, KPIs, reviews, and goals from that data.
For counts, lists, comparisons, manager names, headcount, red/green KPIs — answer directly with numbers and tables.
If data is missing, say clearly what is not in the database.
Respond in JSON: { "text": "markdown answer", "tables": [{ "title": "", "headers": [], "rows": [[]] }] }`;
}
