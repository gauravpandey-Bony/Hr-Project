import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isTeamsConfigured } from "@/lib/teams/client";
import { HrisSyncDemo } from "@/components/settings/hris-sync-demo";
import { COMPANY } from "@/lib/company";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [integrations, hrisConnections, templates] = await Promise.all([
    db.integrationConnection.findMany({
      where: { organizationId: user.organizationId },
    }),
    db.hrisConnection.findMany({
      where: { organizationId: user.organizationId },
      include: { syncLogs: { orderBy: { createdAt: "desc" }, take: 3 } },
    }),
    db.reviewTemplate.findMany({
      where: { organizationId: user.organizationId },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description={`${COMPANY.name} — integrations, HRIS sync, and review templates.`}
      />

      <section>
        <Card>
          <h2 className="font-semibold">Microsoft Teams</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review notifications via adaptive cards in Teams
          </p>
          <Badge className="mt-3" variant={isTeamsConfigured() ? "success" : "warning"}>
            {isTeamsConfigured()
              ? "Configured"
              : "Add TEAMS_APP_ID & TEAMS_APP_PASSWORD in .env"}
          </Badge>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">HRIS connections</h2>
        <div className="space-y-4">
          {hrisConnections.map((conn) => (
            <Card key={conn.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{conn.provider}</h3>
                  <p className="text-sm text-slate-500">
                    {conn.syncDirection} · Last sync:{" "}
                    {conn.lastSyncAt?.toLocaleString() ?? "Never"}
                  </p>
                </div>
                <Badge variant={conn.isActive ? "success" : "default"}>
                  {conn.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {conn.syncLogs.length > 0 && (
                <ul className="mt-3 text-xs text-slate-500">
                  {conn.syncLogs.map((log) => (
                    <li key={log.id}>
                      {log.status} — {log.recordsProcessed} records —{" "}
                      {log.createdAt.toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
        {user.role === "ADMIN" && <HrisSyncDemo connectionId="hris-bony" />}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Review templates</h2>
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{t.name}</h3>
                {t.isDefault && <Badge variant="info">Default</Badge>}
              </div>
              <p className="text-sm text-slate-500">{t.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <h2 className="font-semibold">Connected services</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {integrations.map((i) => (
            <li key={i.id}>
              {i.provider}: {i.workspaceName ?? "Connected"}
            </li>
          ))}
          {integrations.length === 0 && (
            <li className="text-slate-400">No integrations connected yet</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
