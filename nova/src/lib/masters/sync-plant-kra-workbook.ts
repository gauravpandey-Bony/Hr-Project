import { readFileSync, existsSync } from "fs";
import type { PrismaClient } from "@prisma/client";
import {
  parsePlantKraWorkbook,
  resolvePlantKpiId,
  type PlantKraWorkbookKpi,
} from "./plant-kra-workbook";
import { PLANT_UNIT } from "@/lib/plant-37p";

export type SyncPlantKraResult = {
  kpisCreated: number;
  kpisUpdated: number;
  entriesCreated: number;
  rajKumarLinked: number;
  employeeEnsured: boolean;
  kpiCount: number;
  errors: string[];
};

async function ensureRajKumarEmployee(
  db: PrismaClient,
  organizationId: string
): Promise<boolean> {
  const dept = await db.departmentMaster.findFirst({
    where: { organizationId, name: "Plant Head" },
  });

  const existing = await db.employeeMaster.findFirst({
    where: {
      organizationId,
      isActive: true,
      name: { contains: "Raj Kumar" },
    },
  });

  if (existing) {
    await db.employeeMaster.update({
      where: { id: existing.id },
      data: {
        name: "Raj Kumar",
        designation: "Manager",
        department: "Plant Head",
        departmentId: dept?.id ?? existing.departmentId,
        location: "Bony Polymers",
        isActive: true,
      },
    });
    return true;
  }

  await db.employeeMaster.create({
    data: {
      organizationId,
      name: "Raj Kumar",
      designation: "Manager",
      department: "Plant Head",
      departmentId: dept?.id ?? null,
      location: "Bony Polymers",
      sortOrder: 0,
      isActive: true,
    },
  });
  return true;
}

async function upsertPlantKpis(
  db: PrismaClient,
  organizationId: string,
  kpis: PlantKraWorkbookKpi[],
  adminUserId: string | null,
  rajKumarUserId: string | null
): Promise<{ created: number; updated: number; entriesCreated: number; rajKumarLinked: number }> {
  let created = 0;
  let updated = 0;
  let entriesCreated = 0;
  let rajKumarLinked = 0;

  const months = [
    new Date(2026, 0, 28),
    new Date(2026, 1, 28),
    new Date(2026, 2, 28),
    new Date(2026, 3, 28),
  ];

  for (const k of kpis) {
    const id = resolvePlantKpiId(k.sheetId, k.srNo, k.kraName, k.name);
    const seedName =
      k.sheetId === "plant" && k.name === "5S" ? "5S Audit Score" : k.name;
    const ownerId = k.ownerName === "Raj Kumar" ? rajKumarUserId : null;

    const data = {
      organizationId,
      name: seedName,
      description: k.kraName,
      category: k.category,
      unit: k.unit,
      targetValue: k.targetValue,
      direction: k.direction,
      frequency: "MONTHLY" as const,
      department: k.department,
      kraName: k.kraName,
      weightage: k.weightage,
      plantUnit: PLANT_UNIT,
      kpiLevel: k.kpiLevel,
      ownerName: k.ownerName ?? null,
      ownerId,
      quarterTargets: JSON.stringify({
        annualTarget: k.targetAnnual,
        ...k.quarterTargets,
      }),
      isActive: true,
    };

    const existing = await db.kpi.findUnique({ where: { id } });
    if (existing) {
      await db.kpi.update({ where: { id }, data });
      updated++;
    } else {
      await db.kpi.create({ data: { id, ...data } });
      created++;
    }

    if (k.ownerName === "Raj Kumar" && ownerId) rajKumarLinked++;

    if (k.entryValues.length) {
      await db.kpiEntry.deleteMany({ where: { kpiId: id } });
      for (let i = 0; i < k.entryValues.length; i++) {
        await db.kpiEntry.create({
          data: {
            kpiId: id,
            value: k.entryValues[i],
            recordedAt: months[i] ?? months[months.length - 1],
            enteredById: adminUserId,
          },
        });
        entriesCreated++;
      }
    }
  }

  return { created, updated, entriesCreated, rajKumarLinked };
}

export async function syncPlantKraWorkbook(
  db: PrismaClient,
  organizationId: string,
  buffer: ArrayBuffer,
  adminUserId?: string | null,
  rajKumarUserId?: string | null
): Promise<SyncPlantKraResult> {
  const { kpis, errors } = parsePlantKraWorkbook(buffer);
  if (!kpis.length) {
    return {
      kpisCreated: 0,
      kpisUpdated: 0,
      entriesCreated: 0,
      rajKumarLinked: 0,
      employeeEnsured: false,
      kpiCount: 0,
      errors,
    };
  }

  const employeeEnsured = await ensureRajKumarEmployee(db, organizationId);

  const rajUser =
    rajKumarUserId ??
    (
      await db.user.findFirst({
        where: { organizationId, name: { contains: "Raj Kumar" } },
        select: { id: true },
      })
    )?.id ??
    null;

  const { created, updated, entriesCreated, rajKumarLinked } = await upsertPlantKpis(
    db,
    organizationId,
    kpis,
    adminUserId ?? null,
    rajUser
  );

  if (rajUser) {
    await db.kpi.updateMany({
      where: { organizationId, ownerName: "Raj Kumar" },
      data: { ownerId: rajUser },
    });
  }

  return {
    kpisCreated: created,
    kpisUpdated: updated,
    entriesCreated,
    rajKumarLinked,
    employeeEnsured,
    kpiCount: kpis.length,
    errors,
  };
}

export async function syncPlantKraFromDefaultFile(
  db: PrismaClient,
  organizationId: string,
  filePath?: string,
  adminUserId?: string | null,
  rajKumarUserId?: string | null
): Promise<SyncPlantKraResult> {
  const path = filePath ?? `${process.cwd()}/data/plant-kra-26-27-37p.xlsx`;
  if (!existsSync(path)) {
    return {
      kpisCreated: 0,
      kpisUpdated: 0,
      entriesCreated: 0,
      rajKumarLinked: 0,
      employeeEnsured: false,
      kpiCount: 0,
      errors: [`Plant KRA workbook not found: ${path}`],
    };
  }
  const buffer = readFileSync(path);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return syncPlantKraWorkbook(
    db,
    organizationId,
    arrayBuffer,
    adminUserId,
    rajKumarUserId
  );
}
