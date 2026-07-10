/**
 * Production data safety — nothing bulk-deletes / deactivates plant data
 * unless an operator explicitly sets ALLOW_DATA_PURGE=1 (or SEED_RESET_DATA=1).
 *
 * Deploy, seed, and KRA import must NEVER wipe employees/KPIs on their own.
 */
export function isDataPurgeAllowed(): boolean {
  return (
    process.env.ALLOW_DATA_PURGE === "1" ||
    process.env.SEED_RESET_DATA === "1"
  );
}

export function requireDataPurgeAllowed(action: string): void {
  if (isDataPurgeAllowed()) return;
  throw new Error(
    `Refused to ${action}. Plant data is protected. ` +
      `Re-run only with ALLOW_DATA_PURGE=1 (explicit operator command).`
  );
}
