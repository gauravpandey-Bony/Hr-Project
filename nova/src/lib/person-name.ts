/** Match employee master names ↔ KPI ownerName (Mr./Ms. prefixes differ) */

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(mr|ms|mrs)\.?\s+/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function personNameVariants(name: string): string[] {
  const raw = name.trim();
  if (!raw) return [];
  const stripped = raw.replace(/^(mr|ms|mrs)\.?\s+/i, "").trim();
  const set = new Set([
    raw,
    stripped,
    `Mr. ${stripped}`,
    `Ms. ${stripped}`,
    `Mrs. ${stripped}`,
  ]);
  return [...set].filter(Boolean);
}

export function personNamesMatch(a: string, b: string): boolean {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // Require at least two name tokens before treating one name as a subset of another.
  // Avoids "Ram" matching "Raman" / shared surnames matching the wrong employee.
  const aTokens = na.split(" ").filter(Boolean);
  const bTokens = nb.split(" ").filter(Boolean);
  const [shorter, longer] =
    aTokens.length <= bTokens.length ? [aTokens, bTokens] : [bTokens, aTokens];
  if (shorter.length < 2) return false;
  return shorter.every((token) => longer.includes(token));
}
