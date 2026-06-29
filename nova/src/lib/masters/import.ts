import * as XLSX from "xlsx";
import { is37pRosterMatrix, parse37pRoster } from "./37p-roster";

export type DepartmentImportRow = {
  name: string;
  headName?: string;
  location?: string;
  kraSheetId?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type EmployeeImportRow = {
  /** Optional — use designation+department if omitted */
  name?: string;
  designation?: string;
  department: string;
  location?: string;
  doj?: string;
  ecn?: string;
  managerName?: string;
  sortOrder?: number;
  isActive?: boolean;
};

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if ((c === "," && !inQuotes) || c === "\t") {
      result.push(current.trim());
      current = "";
    } else current += c;
  }
  result.push(current.trim());
  return result;
}

function norm(h: string) {
  return h.toLowerCase().replace(/[\s_%-]+/g, "");
}

function sheetToMatrix(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as string[][];
}

function parseCsvTable(
  text: string,
  mapRow: (headers: string[], cells: string[], lineNo: number) => void
): string[] {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    errors.push("File must have a header row and at least one data row.");
    return errors;
  }
  const headers = parseLine(lines[0]).map(norm);
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    mapRow(headers, cells, i + 1);
  }
  return errors;
}

const DEPT_HEADERS: Record<string, keyof DepartmentImportRow> = {
  department: "name",
  departmentname: "name",
  name: "name",
  head: "headName",
  headname: "headName",
  location: "location",
  krasheet: "kraSheetId",
  krasheetid: "kraSheetId",
  sortorder: "sortOrder",
  order: "sortOrder",
  active: "isActive",
};

const EMP_HEADERS: Record<string, keyof EmployeeImportRow> = {
  name: "name",
  employeename: "name",
  designation: "designation",
  title: "designation",
  department: "department",
  dept: "department",
  location: "location",
  doj: "doj",
  dateofjoining: "doj",
  ecn: "ecn",
  employeecode: "ecn",
  code: "ecn",
  manager: "managerName",
  managername: "managerName",
  sortorder: "sortOrder",
  order: "sortOrder",
  active: "isActive",
};

export function parseDepartmentCsv(text: string): {
  rows: DepartmentImportRow[];
  errors: string[];
} {
  const rows: DepartmentImportRow[] = [];
  const errors = parseCsvTable(text, (headers, cells, lineNo) => {
    const row: Partial<DepartmentImportRow> = {};
    headers.forEach((h, idx) => {
      const key = DEPT_HEADERS[h];
      if (!key) return;
      const val = cells[idx]?.replace(/^"|"$/g, "") ?? "";
      if (!val) return;
      if (key === "sortOrder") row.sortOrder = parseInt(val, 10);
      else if (key === "isActive") row.isActive = val === "1" || val.toLowerCase() === "true" || val.toLowerCase() === "yes";
      else (row as Record<string, string>)[key] = val;
    });
    if (!row.name) {
      errors.push(`Row ${lineNo}: department name required`);
      return;
    }
    rows.push({
      name: row.name,
      headName: row.headName,
      location: row.location ?? "Bony Polymers",
      kraSheetId: row.kraSheetId,
      sortOrder: row.sortOrder ?? rows.length + 1,
      isActive: row.isActive ?? true,
    });
  });
  return { rows, errors };
}

export function parseEmployeeCsv(text: string): {
  rows: EmployeeImportRow[];
  errors: string[];
} {
  const rows: EmployeeImportRow[] = [];
  const errors = parseCsvTable(text, (headers, cells, lineNo) => {
    const row: Partial<EmployeeImportRow> = {};
    headers.forEach((h, idx) => {
      const key = EMP_HEADERS[h];
      if (!key) return;
      const val = cells[idx]?.replace(/^"|"$/g, "") ?? "";
      if (!val) return;
      if (key === "sortOrder") row.sortOrder = parseInt(val, 10);
      else if (key === "isActive") row.isActive = val === "1" || val.toLowerCase() === "true" || val.toLowerCase() === "yes";
      else (row as Record<string, string>)[key] = val;
    });
    if (!row.department) {
      errors.push(`Row ${lineNo}: department required`);
      return;
    }
    const displayName =
      row.name?.trim() ||
      [row.designation, row.department].filter(Boolean).join(" — ") ||
      `Staff ${rows.length + 1}`;
    rows.push({
      name: displayName,
      designation: row.designation,
      department: row.department,
      location: row.location ?? "Bony Polymers",
      doj: row.doj,
      ecn: row.ecn,
      managerName: row.managerName,
      sortOrder: row.sortOrder ?? rows.length + 1,
      isActive: row.isActive ?? true,
    });
  });
  return { rows, errors };
}

/** Multi-sheet employee roster workbooks are no longer imported. */
export function parseEmployeeKraWorkbook(_buffer: ArrayBuffer): {
  rows: EmployeeImportRow[];
  errors: string[];
} {
  return {
    rows: [],
    errors: ["Employee KRA/KPI workbook import is disabled."],
  };
}

export function parseDepartmentXlsx(buffer: ArrayBuffer): {
  rows: DepartmentImportRow[];
  errors: string[];
} {
  const matrix = sheetToMatrix(buffer);
  if (matrix.length < 2) {
    return { rows: [], errors: ["Empty spreadsheet"] };
  }
  const text = matrix.map((r) => r.join(",")).join("\n");
  return parseDepartmentCsv(text);
}

export function parseEmployeeXlsx(buffer: ArrayBuffer): {
  rows: EmployeeImportRow[];
  errors: string[];
} {
  const wb = XLSX.read(buffer, { type: "array" });
  const first = wb.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[first], {
    header: 1,
    defval: "",
  }) as string[][];

  if (is37pRosterMatrix(matrix)) {
    const parsed = parse37pRoster(buffer);
    return {
      rows: parsed.rows,
      errors: parsed.errors,
    };
  }

  const headerRow = (matrix[0] ?? []).join(" ").toLowerCase();

  if (headerRow.includes("department") && headerRow.includes("designation")) {
    const text = matrix.map((r) => r.join(",")).join("\n");
    return parseEmployeeCsv(text);
  }

  return {
    rows: [],
    errors: ["Employee master import is disabled. Use department master instead."],
  };
}

export function readUploadBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function parseUploadFile(
  file: File,
  type: "departments" | "employees"
): Promise<{ rows: DepartmentImportRow[] | EmployeeImportRow[]; errors: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    return type === "departments"
      ? parseDepartmentCsv(text)
      : parseEmployeeCsv(text);
  }
  const buffer = await readUploadBuffer(file);
  return type === "departments"
    ? parseDepartmentXlsx(buffer)
    : parseEmployeeXlsx(buffer);
}
