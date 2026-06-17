"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

export function HrisSyncDemo({ connectionId }: { connectionId: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runDemoSync() {
    setLoading(true);
    const res = await fetch("/api/hris/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId,
        direction: "inbound",
        employees: [
          {
            externalId: "HRIS-2001",
            email: "vikram.singh@bonypolymers.com",
            name: "Vikram Singh",
            title: "Maintenance Technician",
            department: "Maintenance",
            managerExternalId: "HRIS-1001",
          },
        ],
      }),
    });
    const data = await res.json();
    setLoading(false);
    setResult(res.ok ? `Synced ${data.processed} employees` : "Sync failed");
  }

  return (
    <Card className="mt-4 border-dashed border-2">
      <p className="text-sm font-medium">Demo inbound HRIS sync</p>
      <button
        onClick={runDemoSync}
        disabled={loading}
        className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Syncing…" : "Sync sample employee"}
      </button>
      {result && <p className="mt-2 text-xs text-slate-500">{result}</p>}
    </Card>
  );
}
