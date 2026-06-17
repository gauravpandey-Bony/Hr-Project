export type KpiExportRow = {
  name: string;
  description: string | null;
  category: string;
  unit: string;
  targetValue: number;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  frequency: string;
  department: string | null;
  value?: number;
  recordedAt?: Date | null;
};

function escapeCsv(val: string | number): string {
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDirection(direction: KpiExportRow["direction"]): string {
  return direction === "LOWER_IS_BETTER" ? "Lower" : "Higher";
}

function formatFrequency(frequency: string): string {
  return frequency.charAt(0) + frequency.slice(1).toLowerCase();
}

export function kpiExportCsv(rows: KpiExportRow[]): string {
  const header =
    "name,description,category,unit,target,direction,frequency,department,value,date";
  const lines = rows.map((r) =>
    [
      r.name,
      r.description ?? "",
      r.category,
      r.unit,
      r.targetValue,
      formatDirection(r.direction),
      formatFrequency(r.frequency),
      r.department ?? "",
      r.value ?? "",
      r.recordedAt ? r.recordedAt.toISOString().slice(0, 10) : "",
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function kpiExportFilename(unitSlug?: string | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = unitSlug && unitSlug !== "all" ? `-${unitSlug}` : "";
  return `kpi-data${suffix}-${date}.csv`;
}
