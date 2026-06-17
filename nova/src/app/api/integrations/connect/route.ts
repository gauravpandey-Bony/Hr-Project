import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJson } from "@/lib/utils";

const APP_CATALOG: Record<string, { name: string; description: string }> = {
  teams: { name: "Microsoft Teams", description: "Review & KPI notifications in Teams" },
  hris: { name: "HRIS / Payroll", description: "Employee sync from payroll system" },
  excel: { name: "Microsoft Excel", description: "Import KPI data from CSV exports" },
  sheets: { name: "Google Sheets", description: "Sync KPIs from shared spreadsheets" },
  tally: { name: "Tally ERP", description: "Finance & inventory from Tally" },
  sap: { name: "SAP", description: "Manufacturing & ERP data from SAP" },
};

type AppsMeta = Record<string, { connectedAt: string; connectedBy: string }>;

function getAppsMeta(metadata: string | null): AppsMeta {
  const parsed = parseJson<{ apps?: AppsMeta }>(metadata, {});
  return parsed.apps ?? {};
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [customConn, teamsConn] = await Promise.all([
    db.integrationConnection.findFirst({
      where: { organizationId: user.organizationId, provider: "CUSTOM" },
    }),
    db.integrationConnection.findFirst({
      where: { organizationId: user.organizationId, provider: "TEAMS" },
    }),
  ]);

  const appsMeta = getAppsMeta(customConn?.metadata ?? null);
  const teamsActive = teamsConn?.isActive ?? false;

  const apps = Object.entries(APP_CATALOG).map(([id, meta]) => ({
    id,
    ...meta,
    connected: id === "teams" ? teamsActive : Boolean(appsMeta[id]),
  }));

  return NextResponse.json({ apps });
}

const connectSchema = z.object({
  appId: z.string(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { appId } = connectSchema.parse(await request.json());
  if (!APP_CATALOG[appId]) {
    return NextResponse.json({ error: "Unknown app" }, { status: 400 });
  }

  const appName = APP_CATALOG[appId].name;

  if (appId === "teams") {
    await db.integrationConnection.upsert({
      where: {
        organizationId_provider: {
          organizationId: user.organizationId,
          provider: "TEAMS",
        },
      },
      create: {
        organizationId: user.organizationId,
        provider: "TEAMS",
        workspaceName: "Bony Polymers — Microsoft Teams",
        isActive: true,
      },
      update: { isActive: true },
    });
    return NextResponse.json({ message: `${appName} connected successfully` });
  }

  let customConn = await db.integrationConnection.findFirst({
    where: { organizationId: user.organizationId, provider: "CUSTOM" },
  });

  const apps = getAppsMeta(customConn?.metadata ?? null);
  apps[appId] = { connectedAt: new Date().toISOString(), connectedBy: user.id };

  if (!customConn) {
    customConn = await db.integrationConnection.create({
      data: {
        organizationId: user.organizationId,
        provider: "CUSTOM",
        workspaceName: "Connected apps",
        isActive: true,
        metadata: JSON.stringify({ apps }),
      },
    });
  } else {
    await db.integrationConnection.update({
      where: { id: customConn.id },
      data: { metadata: JSON.stringify({ apps }), isActive: true },
    });
  }

  return NextResponse.json({ message: `${appName} connected successfully` });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("appId");
  if (!appId) return NextResponse.json({ error: "appId required" }, { status: 400 });

  if (appId === "teams") {
    await db.integrationConnection.updateMany({
      where: { organizationId: user.organizationId, provider: "TEAMS" },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  }

  const customConn = await db.integrationConnection.findFirst({
    where: { organizationId: user.organizationId, provider: "CUSTOM" },
  });
  if (customConn?.metadata) {
    const apps = getAppsMeta(customConn.metadata);
    delete apps[appId];
    await db.integrationConnection.update({
      where: { id: customConn.id },
      data: { metadata: JSON.stringify({ apps }) },
    });
  }

  return NextResponse.json({ ok: true });
}
