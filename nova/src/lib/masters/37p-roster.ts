import * as XLSX from "xlsx";
import type { DepartmentImportRow, EmployeeImportRow } from "./import";
import { dedupeDepartmentMasters } from "./department-master-sync";

/** Excel Department column → master name, KRA sheet, KPI library department */
export const ROSTER_DEPT_MAP: Record<
  string,
  { masterName: string; kraSheetId: string; kpiDepartment: string; sortOrder: number }
> = {
  PRODUCTION: {
    masterName: "Production",
    kraSheetId: "production",
    kpiDepartment: "Production",
    sortOrder: 2,
  },
  QUALITY: {
    masterName: "Quality Assurance",
    kraSheetId: "qa",
    kpiDepartment: "Quality Assurance",
    sortOrder: 3,
  },
  MAINTENANCE: {
    masterName: "Maintenance",
    kraSheetId: "maintenance",
    kpiDepartment: "Maintenance",
    sortOrder: 4,
  },
  STORE: {
    masterName: "Store",
    kraSheetId: "store",
    kpiDepartment: "Store",
    sortOrder: 5,
  },
  "DISPATCH & BILLING": {
    masterName: "Dispatch & Billing",
    kraSheetId: "billing",
    kpiDepartment: "Billing",
    sortOrder: 6,
  },
  DISPATCH: {
    masterName: "Dispatch",
    kraSheetId: "billing",
    kpiDepartment: "Billing",
    sortOrder: 7,
  },
  HR: {
    masterName: "Human Resources",
    kraSheetId: "plant",
    kpiDepartment: "All Departments",
    sortOrder: 8,
  },
  MIS: {
    masterName: "MIS",
    kraSheetId: "mis",
    kpiDepartment: "MIS",
    sortOrder: 9,
  },
  OPERATIONS: {
    masterName: "Production",
    kraSheetId: "plant",
    kpiDepartment: "Plant Head",
    sortOrder: 2,
  },
  "PLANT HEAD": {
    masterName: "Production",
    kraSheetId: "plant",
    kpiDepartment: "Plant Head",
    sortOrder: 2,
  },
  PPC: {
    masterName: "PPC",
    kraSheetId: "production",
    kpiDepartment: "Production",
    sortOrder: 11,
  },
  DEVELOPMENT: {
    masterName: "Development",
    kraSheetId: "production",
    kpiDepartment: "Production",
    sortOrder: 12,
  },
};

function buildRosterDepartments(): DepartmentImportRow[] {
  const byName = new Map<string, DepartmentImportRow>();

  for (const mapped of Object.values(ROSTER_DEPT_MAP)) {
    if (!byName.has(mapped.masterName)) {
      byName.set(mapped.masterName, {
        name: mapped.masterName,
        kraSheetId: mapped.kraSheetId,
        location: "Bony Polymers 37-P",
        sortOrder: mapped.sortOrder,
      });
    }
  }

  // KPI library still uses "Billing" / "IT" labels — keep for filters & legacy rows
  if (!byName.has("Billing")) {
    byName.set("Billing", {
      name: "Billing",
      kraSheetId: "billing",
      location: "Bony Polymers 37-P",
      sortOrder: 13,
    });
  }
  if (!byName.has("IT")) {
    byName.set("IT", {
      name: "IT",
      kraSheetId: "it",
      location: "Bony Polymers 37-P",
      sortOrder: 14,
    });
  }

  return Array.from(byName.values()).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
}

export const ROSTER_DEPARTMENTS: DepartmentImportRow[] = buildRosterDepartments();

/** Plant Head is a KRA sheet role — employees belong under Production in master data */
export const PLANT_HEAD_EMPLOYEE_DEPARTMENT = "Production";
export const PLANT_HEAD_KPI_DEPARTMENT = "Plant Head";
export const PLANT_HEAD_KRA_SHEET_ID = "plant";

/** KRA sheet roles nested under Production — not top-level departments */
export function isPlantHeadRoleDepartment(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const key = trimmed.toLowerCase();
  if (key === "plant head" || key === "operations") return true;
  if (/^plant head\b/i.test(trimmed) && /archived/i.test(trimmed)) return true;
  if (/^operations\b/i.test(trimmed) && /archived/i.test(trimmed)) return true;
  return false;
}

export async function reconcilePlantHeadEmployeesAsProduction(
  db: import("@prisma/client").PrismaClient,
  organizationId: string
): Promise<number> {
  const production = await db.departmentMaster.findFirst({
    where: { organizationId, name: PLANT_HEAD_EMPLOYEE_DEPARTMENT },
  });

  const updated = await db.employeeMaster.updateMany({
    where: {
      organizationId,
      department: { in: ["Plant Head", "Operations"] },
    },
    data: {
      department: PLANT_HEAD_EMPLOYEE_DEPARTMENT,
      departmentId: production?.id ?? null,
    },
  });

  const legacyDepts = await db.departmentMaster.findMany({
    where: { organizationId, name: { in: ["Plant Head", "Operations"] } },
  });
  for (const dept of legacyDepts) {
    await db.departmentMaster.update({
      where: { id: dept.id },
      data: {
        isActive: false,
        name: `${dept.name} (archived ${dept.id.slice(-6)})`,
        location: `${dept.location ?? "unknown"}#${dept.id.slice(-6)}`,
      },
    });
  }

  await dedupeDepartmentMasters(db, organizationId, "Bony 37P");

  return updated.count;
}

export function normalizeRosterDepartment(raw: string): {
  masterName: string;
  kraSheetId: string;
  kpiDepartment: string;
} {
  const key = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const mapped = ROSTER_DEPT_MAP[key];
  if (mapped) {
    return {
      masterName: mapped.masterName,
      kraSheetId: mapped.kraSheetId,
      kpiDepartment: mapped.kpiDepartment,
    };
  }
  const title = raw
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { masterName: title, kraSheetId: "", kpiDepartment: title };
}

function excelSerialToDoj(serial: unknown): string | undefined {
  if (serial === "" || serial == null) return undefined;
  if (typeof serial === "string") return serial.trim() || undefined;
  if (typeof serial !== "number" || serial < 1000) return undefined;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return undefined;
  const d = String(parsed.d).padStart(2, "0");
  const m = String(parsed.m).padStart(2, "0");
  return `${d}.${m}.${parsed.y}`;
}

function formatEcn(code: unknown): string {
  if (code === "" || code == null) return "";
  return String(code).trim();
}

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export type Roster37pRow = EmployeeImportRow & {
  kpiDepartment: string;
  kraSheetId: string;
  salaryLocation?: string;
};

export function is37pRosterMatrix(matrix: string[][]): boolean {
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const row = (matrix[i] ?? []).map((c) => String(c).toLowerCase());
    const joined = row.join("|");
    if (
      joined.includes("webtel") ||
      (joined.includes("name") && joined.includes("department") && joined.includes("designation"))
    ) {
      return true;
    }
  }
  return false;
}

export function parse37pRoster(buffer: ArrayBuffer): {
  rows: Roster37pRow[];
  errors: string[];
} {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
  }) as string[][];

  if (!is37pRosterMatrix(matrix)) {
    return { rows: [], errors: ["Not a 37P employee roster format"] };
  }

  let headerIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const cells = (matrix[i] ?? []).map((c) => String(c).toLowerCase());
    if (cells.includes("name") && cells.some((c) => c.includes("department"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return { rows: [], errors: ["Could not find header row (Name, Department)"] };
  }

  const headers = (matrix[headerIdx] ?? []).map((h) =>
    String(h)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
  );

  const col = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const iName = col(["name"]);
  const iDept = col(["department"]);
  const iDesig = col(["designation"]);
  const iEcn = col(["webtel", "empcode", "code"]);
  const iLoc = col(["workinglocation", "location"]);
  const iDoj = col(["joindate", "doj"]);
  const iSalary = col(["salarylocation"]);

  if (iName < 0 || iDept < 0) {
    return { rows: [], errors: ["Missing Name or Department columns"] };
  }

  const rows: Roster37pRow[] = [];
  const errors: string[] = [];

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const rawName = String(line[iName] ?? "").trim();
    const rawDept = String(line[iDept] ?? "").trim();
    if (!rawName || !rawDept) continue;

    const { masterName, kraSheetId, kpiDepartment } = normalizeRosterDepartment(rawDept);
    const ecn = formatEcn(iEcn >= 0 ? line[iEcn] : "");
    const designation =
      iDesig >= 0 ? String(line[iDesig] ?? "").trim() || undefined : undefined;
    const location =
      (iLoc >= 0 ? String(line[iLoc] ?? "").trim() : "") || "Bony Polymers 37-P";
    const doj = iDoj >= 0 ? excelSerialToDoj(line[iDoj]) : undefined;
    const salaryLocation =
      iSalary >= 0 ? String(line[iSalary] ?? "").trim() || undefined : undefined;

    rows.push({
      name: titleCaseName(rawName),
      designation,
      department: masterName,
      location,
      doj,
      ecn: ecn || undefined,
      sortOrder: rows.length + 1,
      isActive: true,
      kpiDepartment,
      kraSheetId,
      salaryLocation,
    });
  }

  if (!rows.length) errors.push("No employee rows found in roster");
  return { rows, errors };
}

export function parse37pRosterFile(path: string): {
  rows: Roster37pRow[];
  errors: string[];
} {
  const wb = XLSX.readFile(path);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return parse37pRoster(buf);
}
