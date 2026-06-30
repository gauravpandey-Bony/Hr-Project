/** Resolve reporting manager stored as employee code (ECN) to display name. */

export type EmployeeEcnLookup = {
  name: string;
  ecn?: string | null;
};

export function isEmployeeCode(value: string): boolean {
  return /^\d{4,}$/.test(value.trim());
}

export function buildEcnToNameMap(
  employees: EmployeeEcnLookup[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of employees) {
    const code = e.ecn?.trim();
    if (code) map.set(code, e.name);
  }
  return map;
}

export function resolveReportingManagerName(
  managerRef: string | null | undefined,
  employees: EmployeeEcnLookup[]
): string {
  const raw = managerRef?.trim() ?? "";
  if (!raw) return "";
  if (!isEmployeeCode(raw)) return raw;

  const name = buildEcnToNameMap(employees).get(raw);
  return name ?? raw;
}
