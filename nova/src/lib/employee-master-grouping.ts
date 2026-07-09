import type { DepartmentMaster, EmployeeMaster } from "@prisma/client";
import { personNamesMatch } from "@/lib/person-name";
import { formatDepartmentDisplayName } from "@/lib/masters/department-master-sync";
import {
  buildEcnToNameMap,
  isEmployeeCode,
  resolveReportingManagerName,
} from "@/lib/reporting-manager";

export type ManagerTeamSection = {
  type: "manager-team";
  managerName: string;
  managerRow: EmployeeMaster | null;
  reports: EmployeeMaster[];
};

export type StandaloneSection = {
  type: "standalone";
  employees: EmployeeMaster[];
};

export type DepartmentEmployeeGroup = {
  departmentId: string;
  departmentName: string;
  sections: Array<ManagerTeamSection | StandaloneSection>;
  totalCount: number;
};

function deptNameFor(
  employee: EmployeeMaster,
  deptById: Map<string, DepartmentMaster>
): string {
  const raw = employee.departmentId
    ? deptById.get(employee.departmentId)?.name ?? employee.department ?? "General"
    : employee.department?.trim() || "General";
  return formatDepartmentDisplayName(raw);
}

/** One visible row per ECN (and per id). Prefer the row with richer data. */
export function dedupeEmployeeMasterRows(
  employees: EmployeeMaster[]
): EmployeeMaster[] {
  const byId = new Map<string, EmployeeMaster>();
  for (const emp of employees) {
    if (!byId.has(emp.id)) byId.set(emp.id, emp);
  }

  const byEcn = new Map<string, EmployeeMaster>();
  const withoutEcn: EmployeeMaster[] = [];

  for (const emp of byId.values()) {
    const ecn = emp.ecn?.trim();
    if (!ecn) {
      withoutEcn.push(emp);
      continue;
    }
    const prev = byEcn.get(ecn);
    if (!prev) {
      byEcn.set(ecn, emp);
      continue;
    }
    byEcn.set(ecn, preferEmployeeRow(prev, emp));
  }

  return [...byEcn.values(), ...withoutEcn];
}

function preferEmployeeRow(a: EmployeeMaster, b: EmployeeMaster): EmployeeMaster {
  const score = (e: EmployeeMaster) =>
    (e.isActive ? 8 : 0) +
    (e.managerName?.trim() ? 2 : 0) +
    (e.designation?.trim() ? 1 : 0) +
    (e.doj?.trim() ? 1 : 0) +
    (e.departmentId ? 1 : 0);

  const scoreA = score(a);
  const scoreB = score(b);
  if (scoreB !== scoreA) return scoreB > scoreA ? b : a;
  return b.updatedAt >= a.updatedAt ? b : a;
}

function findManagerRow(
  deptEmployees: EmployeeMaster[],
  managerName: string,
  ecnToName: Map<string, string>,
  reportIds: Set<string>
): EmployeeMaster | null {
  const candidates = deptEmployees.filter((e) => !reportIds.has(e.id));
  return (
    candidates.find((e) => personNamesMatch(e.name, managerName)) ??
    candidates.find(
      (e) => isEmployeeCode(managerName) && e.ecn?.trim() === managerName.trim()
    ) ??
    (isEmployeeCode(managerName)
      ? candidates.find((e) => ecnToName.get(managerName) === e.name) ?? null
      : null)
  );
}

export function groupEmployeesByDepartment(
  employees: EmployeeMaster[],
  departments: DepartmentMaster[]
): DepartmentEmployeeGroup[] {
  const uniqueEmployees = dedupeEmployeeMasterRows(employees);
  const deptById = new Map(departments.map((d) => [d.id, d]));
  const deptOrder = new Map(departments.map((d, i) => [d.id, d.sortOrder ?? i]));

  const byDept = new Map<string, EmployeeMaster[]>();

  for (const emp of uniqueEmployees) {
    const deptId = emp.departmentId ?? "__general__";
    const list = byDept.get(deptId) ?? [];
    list.push(emp);
    byDept.set(deptId, list);
  }

  const groups: DepartmentEmployeeGroup[] = [];

  const sortedDeptIds = [...byDept.keys()].sort((a, b) => {
    const orderA = a === "__general__" ? 9999 : (deptOrder.get(a) ?? 9998);
    const orderB = b === "__general__" ? 9999 : (deptOrder.get(b) ?? 9998);
    if (orderA !== orderB) return orderA - orderB;
    const nameA = a === "__general__" ? "General" : (deptById.get(a)?.name ?? "");
    const nameB = b === "__general__" ? "General" : (deptById.get(b)?.name ?? "");
    return nameA.localeCompare(nameB);
  });

  for (const deptId of sortedDeptIds) {
    const deptEmployees = byDept.get(deptId) ?? [];
    const departmentName =
      deptId === "__general__"
        ? "General"
        : (deptById.get(deptId)?.name ?? deptNameFor(deptEmployees[0]!, deptById));

    const ecnToName = buildEcnToNameMap(deptEmployees);
    const resolveManagerKey = (manager: string) =>
      resolveReportingManagerName(manager, deptEmployees) || manager;

    const reportsByManager = new Map<string, EmployeeMaster[]>();
    for (const emp of deptEmployees) {
      const manager = emp.managerName?.trim();
      if (!emp.isActive || !manager || personNamesMatch(emp.name, manager)) continue;
      const key = resolveManagerKey(manager);
      // Never treat an employee as reporting to themselves via ECN→name resolution
      if (personNamesMatch(emp.name, key)) continue;
      const list = reportsByManager.get(key) ?? [];
      list.push(emp);
      reportsByManager.set(key, list);
    }

    const sections: Array<ManagerTeamSection | StandaloneSection> = [];
    const placed = new Set<string>();

    const managerNames = [...reportsByManager.keys()].sort((a, b) => a.localeCompare(b));
    for (const managerName of managerNames) {
      const reports = [...(reportsByManager.get(managerName) ?? [])]
        .filter((r) => !placed.has(r.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      const reportIds = new Set(reports.map((r) => r.id));

      // Manager row must not be someone who already appears as a report in this team
      let managerRow = findManagerRow(
        deptEmployees,
        managerName,
        ecnToName,
        reportIds
      );
      // Show each person only once across the department (report under their manager wins)
      if (managerRow && placed.has(managerRow.id)) {
        managerRow = null;
      }

      for (const r of reports) placed.add(r.id);
      if (managerRow) placed.add(managerRow.id);

      sections.push({
        type: "manager-team",
        managerName,
        managerRow,
        reports,
      });
    }

    const standalone = deptEmployees
      .filter((e) => !placed.has(e.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

    if (standalone.length) {
      sections.push({ type: "standalone", employees: standalone });
    }

    groups.push({
      departmentId: deptId,
      departmentName,
      sections,
      totalCount: deptEmployees.length,
    });
  }

  return groups;
}

export function confirmReportingManagerChange(
  previous: string | null | undefined,
  next: string | null | undefined
): boolean {
  const prev = (previous ?? "").trim();
  const nxt = (next ?? "").trim();
  if (prev === nxt) return true;

  if (!nxt) {
    if (!confirm("Remove reporting manager for this employee?")) return false;
    return confirm("Are you sure you want to remove the reporting manager?");
  }

  if (!confirm(`Change reporting manager to "${nxt}"?`)) return false;
  return confirm("Are you sure you want to change reporting manager?");
}
