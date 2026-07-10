/**
 * ECNs that are always system ADMIN.
 * Login password is permanently the ECN itself (never force-changed).
 */
export const PERMANENT_SUPER_ADMIN_ECNS = ["101068", "101008"] as const;

export type PermanentSuperAdminEcn = (typeof PERMANENT_SUPER_ADMIN_ECNS)[number];

export function normalizeEcn(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function isPermanentSuperAdminEcn(
  ecn: string | null | undefined
): ecn is PermanentSuperAdminEcn {
  const normalized = normalizeEcn(ecn);
  return (PERMANENT_SUPER_ADMIN_ECNS as readonly string[]).includes(normalized);
}

/** Fixed password for permanent super admins = their ECN. */
export function permanentSuperAdminPassword(ecn: string): string {
  return normalizeEcn(ecn);
}
