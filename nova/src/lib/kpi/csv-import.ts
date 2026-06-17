export type CsvKpiRow = {
  name: string;
  description?: string;
  category: string;
  unit: string;
  targetValue: number;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  department?: string;
  value?: number;
  recordedAt?: string;
};

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || c === "\t") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

const HEADER_MAP: Record<string, keyof CsvKpiRow | "skip"> = {
  name: "name",
  kpi: "name",
  kpiname: "name",
  description: "description",
  desc: "description",
  category: "category",
  unit: "unit",
  format: "unit",
  target: "targetValue",
  targetvalue: "targetValue",
  direction: "direction",
  frequency: "frequency",
  department: "department",
  dept: "department",
  value: "value",
  actual: "value",
  current: "value",
  date: "recordedAt",
  recordedat: "recordedAt",
  recordeddate: "recordedAt",
  note: "description",
};

export function parseKpiCsv(text: string): { rows: CsvKpiRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ["File must have a header row and at least one data row."] };
  }

  const headers = parseLine(lines[0]).map(normalizeHeader);
  const rows: CsvKpiRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => !c)) continue;

    const row: Partial<CsvKpiRow> & { name?: string } = {};
    headers.forEach((h, idx) => {
      const key = HEADER_MAP[h];
      if (!key || key === "skip") return;
      const val = cells[idx]?.replace(/^"|"$/g, "") ?? "";
      if (!val) return;
      if (key === "targetValue" || key === "value") {
        (row as Record<string, number>)[key] = parseFloat(val);
      } else {
        (row as Record<string, string>)[key] = val;
      }
    });

    if (!row.name) {
      errors.push(`Row ${i + 1}: missing KPI name`);
      continue;
    }

    const direction =
      row.direction?.toUpperCase().includes("LOW") ||
      row.direction?.toLowerCase() === "down"
        ? "LOWER_IS_BETTER"
        : "HIGHER_IS_BETTER";

    const freq = (row.frequency?.toUpperCase() ?? "MONTHLY") as CsvKpiRow["frequency"];
    const frequency = ["DAILY", "WEEKLY", "MONTHLY"].includes(freq) ? freq : "MONTHLY";

    rows.push({
      name: row.name,
      description: row.description,
      category: row.category || "Production",
      unit: row.unit || "%",
      targetValue: row.targetValue ?? 100,
      direction,
      frequency,
      department: row.department,
      value: row.value,
      recordedAt: row.recordedAt,
    });
  }

  return { rows, errors };
}
