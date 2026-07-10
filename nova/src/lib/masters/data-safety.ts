/**
 * Production data safety — nothing deletes / deactivates plant data
 * (bulk OR single) unless an operator explicitly sets ALLOW_DATA_PURGE=1
 * (or SEED_RESET_DATA=1 for full rebuild).
 *
 * Deploy, seed, KRA import, and the Cursor agent must NEVER wipe data
 * unless the user gives an explicit delete/wipe/purge command.
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
    `Refused to ${action}. Plant data is protected (bulk and single). ` +
      `Re-run only with ALLOW_DATA_PURGE=1 after an explicit operator command.`
  );
}
