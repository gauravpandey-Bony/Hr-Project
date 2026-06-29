"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/ui/card-3d";
import type { PlantAlert, PlantAlertSeverity } from "@/lib/plant/plant-alerts";

const SEVERITY_STYLES: Record<
  PlantAlertSeverity,
  { border: string; bg: string; icon: typeof AlertTriangle; iconClass: string; badge: string }
> = {
  critical: {
    border: "border-rose-300/80",
    bg: "from-rose-50/90 via-card to-card",
    icon: XCircle,
    iconClass: "text-rose-600 bg-rose-100",
    badge: "bg-rose-100 text-rose-800",
  },
  warning: {
    border: "border-amber-300/80",
    bg: "from-amber-50/90 via-card to-card",
    icon: AlertTriangle,
    iconClass: "text-amber-600 bg-amber-100",
    badge: "bg-amber-100 text-amber-800",
  },
  info: {
    border: "border-sky-300/80",
    bg: "from-sky-50/90 via-card to-card",
    icon: Info,
    iconClass: "text-sky-600 bg-sky-100",
    badge: "bg-sky-100 text-sky-800",
  },
  success: {
    border: "border-emerald-300/80",
    bg: "from-emerald-50/90 via-card to-card",
    icon: CheckCircle2,
    iconClass: "text-emerald-600 bg-emerald-100",
    badge: "bg-emerald-100 text-emerald-800",
  },
};

function AlertCard({ alert, defaultOpen }: { alert: PlantAlert; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? alert.severity === "critical");
  const style = SEVERITY_STYLES[alert.severity];
  const Icon = style.icon;

  return (
    <Card3D
      tilt={false}
      className={cn("border bg-gradient-to-br p-0", style.border, style.bg)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.iconClass)}
          style={{ transform: "translateZ(16px)" }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-foreground">{alert.title}</h4>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", style.badge)}>
              {alert.count}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{alert.description}</p>
        </div>
        {alert.items.length > 0 && (
          open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {open && alert.items.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/50"
          >
            <ul className="divide-y divide-border/40 px-4 py-1">
              {alert.items.map((item, i) => (
                <li key={i}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition hover:text-primary"
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.meta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="font-medium">{item.label}</span>
                      {item.meta && (
                        <span className="text-xs text-muted-foreground">{item.meta}</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {alert.actionHref && alert.actionLabel && (
        <div className="border-t border-border/40 px-4 py-2.5">
          <Link
            href={alert.actionHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {alert.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </Card3D>
  );
}

export function PlantAlertsPanel({ alerts }: { alerts: PlantAlert[] }) {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.filter((a) => a.severity === "warning").length;

  if (alerts.length === 0) {
    return (
      <Card3D className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-2 font-semibold text-emerald-800">All clear</p>
        <p className="text-sm text-muted-foreground">No alerts for this quarter.</p>
      </Card3D>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/30">
              <Bell className="h-5 w-5" />
            </div>
            {(critical > 0 || warning > 0) && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-card">
                {critical + warning}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold">Live alerts</h3>
            <p className="text-sm text-muted-foreground">
              {critical > 0 && <span className="text-rose-600">{critical} critical</span>}
              {critical > 0 && warning > 0 && " · "}
              {warning > 0 && <span className="text-amber-600">{warning} warning</span>}
              {critical === 0 && warning === 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Monitoring active
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {alerts.map((alert, i) => (
          <AlertCard key={alert.id} alert={alert} defaultOpen={i < 2} />
        ))}
      </div>
    </section>
  );
}
