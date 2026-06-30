import * as XLSX from "xlsx";
import type { EmployeeImportRow } from "./import";
import { normalizeDepartmentMasterName } from "./department-master-sync";
import { resolvePlantFromWorkingLocation } from "./employee-plant-location";

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatEcn(code: unknown): string {
  if (code === "" || code == null) return "";
  return String(code).trim();
}

function normalizeDesignation(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function formatStaffDetailsDoj(raw: unknown): string | undefined {
  if (raw === "" || raw == null) return undefined;

  const numericSerial =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim())
        ? Number(raw)
        : null;

  if (numericSerial != null && numericSerial >= 1000) {
    const parsed = XLSX.SSF.parse_date_code(numericSerial);
    if (parsed) {
      const d = String(parsed.d).padStart(2, "0");
      const m = String(parsed.m).padStart(2, "0");
      return `${d}.${m}.${parsed.y}`;
    }
  }

  const s = String(raw).trim();
  if (!s) return undefined;

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && /[a-z]/i.test(s)) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${d}.${m}.${parsed.getFullYear()}`;
  }

  return s;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]+/g, "");
}

export function isStaffDetailsMatrix(matrix: string[][]): boolean {
  for (let i = 0; i < Math.min(matrix.length, 6); i++) {
    const headers = (matrix[i] ?? []).map((c) => normHeader(String(c ?? "")));
    if (
      headers.includes("code") &&
      headers.includes("name") &&
      headers.includes("department") &&
      (headers.includes("workinglocation") || headers.includes("location"))
    ) {
      return true;
    }
  }
  return false;
}

export function isStaffDetailsBuffer(buffer: ArrayBuffer): boolean {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
  }) as string[][];
  return isStaffDetailsMatrix(matrix);
}

function findHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const headers = (matrix[i] ?? []).map((c) => normHeader(String(c ?? "")));
    if (headers.includes("code") && headers.includes("name") && headers.includes("department")) {
      return i;
    }
  }
  return -1;
}

export function buildStaffDetailsEcnMap(
  rows: EmployeeImportRow[]
): Map<string, string> {
  const ecnToName = new Map<string, string>();
  for (const row of rows) {
    if (row.ecn && row.name) ecnToName.set(row.ecn, row.name);
  }
  return ecnToName;
}

export function resolveStaffDetailsManagers(
  rows: EmployeeImportRow[],
  ecnToName: Map<string, string>
): void {
  for (const row of rows) {
    if (!row.managerEcn) continue;
    const mgr = ecnToName.get(row.managerEcn);
    if (mgr) {
      row.managerName = mgr;
      continue;
    }
    if (row.managerName && /^\d{4,}$/.test(row.managerName.trim())) {
      row.managerName = undefined;
    }
  }
}

export function parseStaffDetailsRoster(buffer: ArrayBuffer): {
  rows: EmployeeImportRow[];
  errors: string[];
} {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
  }) as string[][];

  if (!isStaffDetailsMatrix(matrix)) {
    return { rows: [], errors: ["Not a Staff Details roster (CODE, NAME, DEPARTMENT, WORKING LOCATION)"] };
  }

  const headerIdx = findHeaderRow(matrix);
  if (headerIdx < 0) {
    return { rows: [], errors: ["Could not find header row"] };
  }

  const headers = (matrix[headerIdx] ?? []).map((h) => normHeader(String(h ?? "")));
  const col = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const iCode = col(["code"]);
  const iName = col(["name"]);
  const iDesig = col(["designation"]);
  const iDept = col(["department"]);
  const iLoc = col(["workinglocation", "location"]);
  const iDoj = col(["doj"]);
  const iReporting = col(["reporting", "manager"]);

  if (iName < 0 || iDept < 0) {
    return { rows: [], errors: ["Missing NAME or DEPARTMENT column"] };
  }

  const rows: EmployeeImportRow[] = [];
  const errors: string[] = [];
  const ecnToName = new Map<string, string>();

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const rawName = String(line[iName] ?? "").trim();
    const rawDept = String(line[iDept] ?? "").trim();
    if (!rawName || !rawDept) continue;

    const rawLocation = iLoc >= 0 ? String(line[iLoc] ?? "").trim() : "";
    const { plantUnitKey, location } = resolvePlantFromWorkingLocation(rawLocation);
    const ecn = iCode >= 0 ? formatEcn(line[iCode]) : "";
    const name = titleCaseName(rawName);
    const department = normalizeDepartmentMasterName(rawDept);
    const reportingCode = iReporting >= 0 ? formatEcn(line[iReporting]) : "";
    const rawDesig = iDesig >= 0 ? String(line[iDesig] ?? "").trim() : "";

    if (ecn) ecnToName.set(ecn, name);

    rows.push({
      name,
      designation: rawDesig ? normalizeDesignation(rawDesig) : undefined,
      department,
      location,
      rawLocation: rawLocation || undefined,
      plantUnitKey,
      doj: iDoj >= 0 ? formatStaffDetailsDoj(line[iDoj]) : undefined,
      ecn: ecn || undefined,
      managerEcn: reportingCode || undefined,
      sortOrder: rows.length + 1,
      isActive: true,
    });
  }

  resolveStaffDetailsManagers(rows, ecnToName);

  if (!rows.length) errors.push("No employee rows found");
  return { rows, errors };
}

export function parseStaffDetailsFile(path: string): {
  rows: EmployeeImportRow[];
  errors: string[];
} {
  const wb = XLSX.readFile(path);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return parseStaffDetailsRoster(buf);
}
