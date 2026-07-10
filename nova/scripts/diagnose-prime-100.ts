import { PrismaClient } from "@prisma/client";
import { parseQuarterTargets } from "../src/lib/kpi-quarters";
import { quarterAchievementStatus } from "../src/lib/kra/quarter-status";

const db = new PrismaClient();

async function main() {
  const all = await db.kpi.findMany({
    where: { isActive: true },
    select: {
      name: true,
      ownerName: true,
      department: true,
      kpiLevel: true,
      weightage: true,
      quarterTargets: true,
      plantUnit: true,
    },
  });

  const kpis = all.filter((k) =>
    (k.plantUnit ?? "").toLowerCase().includes("prime")
  );

  const counts = {
    total: kpis.length,
    pending: 0,
    met: 0,
    not_met: 0,
    entered: 0,
    byLevel: {} as Record<string, number>,
    plantUnits: {} as Record<string, number>,
  };
  const metSamples: Array<Record<string, unknown>> = [];
  const pendingSamples: Array<Record<string, unknown>> = [];
  const sameTargetAchieved = { count: 0, samples: [] as Array<Record<string, unknown>> };

  for (const k of kpis) {
    counts.byLevel[k.kpiLevel] = (counts.byLevel[k.kpiLevel] ?? 0) + 1;
    const pu = k.plantUnit ?? "(null)";
    counts.plantUnits[pu] = (counts.plantUnits[pu] ?? 0) + 1;

    const q = parseQuarterTargets(k.quarterTargets as never);
    const cell = q?.q1 ?? { target: "", achieved: "" };
    const status = quarterAchievementStatus(cell.target, cell.achieved);
    counts[status] += 1;

    const t = (cell.target ?? "").trim();
    const a = (cell.achieved ?? "").trim();
    if (t && a && t.toLowerCase() === a.toLowerCase()) {
      sameTargetAchieved.count += 1;
      if (sameTargetAchieved.samples.length < 10) {
        sameTargetAchieved.samples.push({
          name: k.name.slice(0, 50),
          owner: k.ownerName,
          level: k.kpiLevel,
          target: t,
          achieved: a,
        });
      }
    }

    if (status === "met" && metSamples.length < 15) {
      metSamples.push({
        name: k.name.slice(0, 50),
        owner: k.ownerName,
        level: k.kpiLevel,
        dept: k.department,
        target: cell.target,
        achieved: cell.achieved,
        w: k.weightage,
      });
    }
    if (status === "pending" && pendingSamples.length < 5) {
      pendingSamples.push({
        name: k.name.slice(0, 50),
        target: cell.target,
        achieved: JSON.stringify(cell.achieved),
      });
    }
  }

  console.log(
    JSON.stringify({ counts, sameTargetAchieved, metSamples, pendingSamples }, null, 2)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
