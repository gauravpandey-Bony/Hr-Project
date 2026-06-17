import { db } from "@/lib/db";
import type { HrisEmployee, HrisSyncPayload, FieldMapping } from "./types";

const DEFAULT_MAPPING: FieldMapping = {
  externalId: "externalId",
  email: "email",
  name: "name",
  title: "title",
  department: "department",
  managerId: "managerExternalId",
};

export async function syncEmployeesFromHris(
  organizationId: string,
  connectionId: string,
  payload: HrisSyncPayload
) {
  const connection = await db.hrisConnection.findFirst({
    where: { id: connectionId, organizationId, isActive: true },
  });
  if (!connection) throw new Error("HRIS connection not found");

  const log = await db.hrisSyncLog.create({
    data: {
      connectionId,
      direction: "INBOUND",
      status: "RUNNING",
      payload: JSON.stringify({ count: payload.employees.length }),
    },
  });

  let processed = 0;

  try {
    const managerMap = new Map<string, string>();

    for (const emp of payload.employees) {
      if (emp.status === "terminated") continue;

      const user = await db.user.upsert({
        where: {
          organizationId_email: {
            organizationId,
            email: emp.email.toLowerCase(),
          },
        },
        create: {
          organizationId,
          email: emp.email.toLowerCase(),
          name: emp.name,
          title: emp.title,
          department: emp.department,
          hrisExternalId: emp.externalId,
        },
        update: {
          name: emp.name,
          title: emp.title,
          department: emp.department,
          hrisExternalId: emp.externalId,
        },
      });

      managerMap.set(emp.externalId, user.id);
      processed++;
    }

    for (const emp of payload.employees) {
      if (!emp.managerExternalId) continue;
      const userId = managerMap.get(emp.externalId);
      const managerId = managerMap.get(emp.managerExternalId);
      if (userId && managerId) {
        await db.user.update({
          where: { id: userId },
          data: { managerId },
        });
      }
    }

    await db.hrisConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    await db.hrisSyncLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", recordsProcessed: processed },
    });

    return { processed, logId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db.hrisSyncLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message },
    });
    throw err;
  }
}

export async function exportUsersToHris(organizationId: string, connectionId: string) {
  const users = await db.user.findMany({
    where: { organizationId },
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      department: true,
      hrisExternalId: true,
      managerId: true,
    },
  });

  const log = await db.hrisSyncLog.create({
    data: {
      connectionId,
      direction: "OUTBOUND",
      status: "SUCCESS",
      recordsProcessed: users.length,
      payload: JSON.stringify(users),
    },
  });

  await db.hrisConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  });

  return { employees: users, logId: log.id };
}

export function mapHrisPayload(
  raw: Record<string, unknown>[],
  mapping: FieldMapping = DEFAULT_MAPPING
): HrisEmployee[] {
  return raw.map((row) => ({
    externalId: String(row[mapping.externalId] ?? ""),
    email: String(row[mapping.email] ?? ""),
    name: String(row[mapping.name] ?? ""),
    title: row[mapping.title ?? "title"] ? String(row[mapping.title ?? "title"]) : undefined,
    department: row[mapping.department ?? "department"]
      ? String(row[mapping.department ?? "department"])
      : undefined,
    managerExternalId: row[mapping.managerId ?? "managerId"]
      ? String(row[mapping.managerId ?? "managerId"])
      : undefined,
  }));
}
