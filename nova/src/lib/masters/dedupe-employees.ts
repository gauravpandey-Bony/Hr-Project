import type { PrismaClient } from "@prisma/client";

/**
 * Deactivate duplicate EmployeeMaster rows that share the same ECN.
 * Keeps the richest / newest active row per organizationId + ecn.
 */
export async function dedupeEmployeeMastersByEcn(
  db: PrismaClient,
  organizationId: string
): Promise<{ kept: number; deactivated: number; duplicateEcns: string[] }> {
  const rows = await db.employeeMaster.findMany({
    where: { organizationId, ecn: { not: null } },
    orderBy: [{ updatedAt: "desc" }],
  });

  const byEcn = new Map<string, typeof rows>();
  for (const row of rows) {
    const ecn = row.ecn?.trim();
    if (!ecn) continue;
    const list = byEcn.get(ecn) ?? [];
    list.push(row);
    byEcn.set(ecn, list);
  }

  let kept = 0;
  let deactivated = 0;
  const duplicateEcns: string[] = [];

  for (const [ecn, list] of byEcn) {
    if (list.length < 2) {
      kept += list.length;
      continue;
    }
    duplicateEcns.push(ecn);

    const ranked = [...list].sort((a, b) => {
      const score = (e: (typeof list)[number]) =>
        (e.isActive ? 8 : 0) +
        (e.managerName?.trim() ? 2 : 0) +
        (e.designation?.trim() ? 1 : 0) +
        (e.doj?.trim() ? 1 : 0) +
        (e.departmentId ? 1 : 0);
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const [winner, ...dupes] = ranked;
    kept++;
    for (const dupe of dupes) {
      if (!dupe.isActive) continue;
      await db.employeeMaster.update({
        where: { id: dupe.id },
        data: { isActive: false },
      });
      deactivated++;
    }
    // Ensure winner stays active when it was the best row
    if (winner && !winner.isActive) {
      await db.employeeMaster.update({
        where: { id: winner.id },
        data: { isActive: true },
      });
    }
  }

  return { kept, deactivated, duplicateEcns };
}
