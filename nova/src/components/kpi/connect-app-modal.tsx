"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Link2,
  CheckCircle2,
  MessageSquare,
  Users,
  FileSpreadsheet,
  Sheet,
  Calculator,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type AppItem = {
  id: string;
  name: string;
  description: string;
  connected: boolean;
};

const APP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  teams: MessageSquare,
  hris: Users,
  excel: FileSpreadsheet,
  sheets: Sheet,
  tally: Calculator,
  sap: Factory,
};

export function ConnectAppModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/integrations/connect")
      .then((r) => r.json())
      .then((d) =>
        setApps(
          (d.apps ?? []).map((a: AppItem & { id: string }) => ({
            ...a,
            name:
              a.id === "teams"
                ? "Microsoft Teams"
                : a.id === "hris"
                  ? "HRIS / Payroll"
                  : a.id === "excel"
                    ? "Microsoft Excel"
                    : a.id === "sheets"
                      ? "Google Sheets"
                      : a.id === "tally"
                        ? "Tally ERP"
                        : a.id === "sap"
                          ? "SAP"
                          : a.name,
          }))
        )
      );
  }, [open]);

  async function toggle(app: AppItem) {
    setLoading(app.id);

    if (app.connected) {
      await fetch(`/api/integrations/connect?appId=${app.id}`, { method: "DELETE" });
      toast.success(`${app.name} disconnected`);
    } else {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: app.id }),
      });
      const data = await res.json();
      if (res.ok) toast.success(data.message ?? `${app.name} connected`);
      else toast.error("Could not connect app");
    }

    setLoading(null);
    const refreshed = await fetch("/api/integrations/connect").then((r) => r.json());
    setApps(refreshed.apps ?? []);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Connect to an App
          </DialogTitle>
          <DialogDescription>
            Link data sources for automatic KPI updates.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          <ul className="divide-y p-2">
            {apps.map((app) => {
              const Icon = APP_ICONS[app.id] ?? Link2;
              return (
                <li
                  key={app.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{app.name}</p>
                    <p className="text-xs text-muted-foreground">{app.description}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={app.connected ? "outline" : "default"}
                    disabled={loading === app.id}
                    onClick={() => toggle(app)}
                    className={cn(
                      app.connected && "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    )}
                  >
                    {loading === app.id ? (
                      "…"
                    ) : app.connected ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                      </span>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <p className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
          Teams uses .env credentials · HRIS sync in Settings · Excel via CSV upload
        </p>
      </DialogContent>
    </Dialog>
  );
}
