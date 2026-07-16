/** Match employee master names ↔ KPI ownerName (Mr./Ms. prefixes differ) */

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    // "Mr. Name" and glued "Mr.Name" / "MrName"
    .replace(/^(mr|ms|mrs)\.?\s*/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Job-title tokens often appended to managerName in HR exports. */
const DESIGNATION_TOKENS = new Set([
  "sr",
  "jr",
  "senior",
  "junior",
  "manager",
  "mngr",
  "mgr",
  "asst",
  "assistant",
  "deputy",
  "plant",
  "head",
  "dept",
  "department",
  "am",
  "agm",
  "dgm",
  "gm",
  "director",
  "md",
  "ceo",
  "cfo",
  "coo",
  "ops",
  "operations",
  "maint",
  "maintenance",
  "production",
  "quality",
  "lead",
  "leader",
  "team",
  "incharge",
  "in",
  "charge",
]);

/**
 * Person core name with titles/designations removed.
 * "Mr. Bhupesh Kumar, Sr. Manager" → "bhupesh kumar"
 */
export function corePersonName(name: string): string {
  return normalizePersonName(name)
    .split(" ")
    .filter(Boolean)
    .filter((t) => !DESIGNATION_TOKENS.has(t) && !/^\d+$/.test(t))
    .join(" ");
}

/**
 * Reporting-manager match: exact core name after stripping designations.
 * Avoids "Sandeep Kumar" matching "Sandeep Kumar Gupta" (subset false positive).
 */
export function managerNamesMatch(
  managerRef: string | null | undefined,
  userName: string | null | undefined
): boolean {
  const a = corePersonName(managerRef ?? "");
  const b = corePersonName(userName ?? "");
  if (!a || !b) return false;
  if (a === b) return true;

  // Same token count + ordered equality after core strip only (already handled by ===).
  // Allow middle-initial omission only when both sides share first+last and length differs by 1.
  const at = a.split(" ").filter(Boolean);
  const bt = b.split(" ").filter(Boolean);
  if (at.length < 2 || bt.length < 2) return false;
  if (Math.abs(at.length - bt.length) !== 1) return false;
  const [shorter, longer] = at.length < bt.length ? [at, bt] : [bt, at];
  // First and last must match; longer may have one extra middle token.
  return (
    shorter[0] === longer[0] &&
    shorter[shorter.length - 1] === longer[longer.length - 1]
  );
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
