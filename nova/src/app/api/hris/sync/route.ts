import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { syncEmployeesFromHris, exportUsersToHris } from "@/lib/hris/sync";
import type { HrisSyncPayload } from "@/lib/hris/types";

const syncSchema = z.object({
  connectionId: z.string(),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  employees: z
    .array(
      z.object({
        externalId: z.string(),
        email: z.string().email(),
        name: z.string(),
        title: z.string().optional(),
        department: z.string().optional(),
        managerExternalId: z.string().optional(),
        status: z.enum(["active", "terminated"]).optional(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  const secret = request.headers.get("x-hris-webhook-secret");
  const isWebhook = secret === process.env.HRIS_WEBHOOK_SECRET;

  let organizationId: string;
  if (isWebhook) {
    const org = await db.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });
    organizationId = org.id;
  } else {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    organizationId = user.organizationId;
  }

  const body = syncSchema.parse(await request.json());
  const connection = await db.hrisConnection.findFirst({
    where: { id: body.connectionId, organizationId },
  });
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  if (body.direction === "outbound") {
    const result = await exportUsersToHris(organizationId, connection.id);
    return NextResponse.json(result);
  }

  if (!body.employees?.length) {
    return NextResponse.json({ error: "employees required for inbound sync" }, { status: 400 });
  }

  const payload: HrisSyncPayload = {
    employees: body.employees,
    syncedAt: new Date().toISOString(),
    source: connection.provider,
  };

  const result = await syncEmployeesFromHris(organizationId, connection.id, payload);
  return NextResponse.json(result);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await db.hrisConnection.findMany({
    where: { organizationId: user.organizationId },
    include: {
      syncLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return NextResponse.json(connections);
}
