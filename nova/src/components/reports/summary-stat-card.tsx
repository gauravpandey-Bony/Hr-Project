"use client";

import { cn } from "@/lib/utils";
import { Card3D } from "@/components/ui/card-3d";
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  target: Target,
  check: CheckCircle2,
  alert: AlertTriangle,
  trend: TrendingUp,
  x: XCircle,
};

export type StatIconName = keyof typeof ICONS;

export function SummaryStatCard({
  label,
  value,
  hint,
  iconName = "target",
  variant = "default",
  progress,
  delay = 0,
  onClick,
  className,
  floatIndex = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  iconName?: StatIconName;
  variant?: "default" | "success" | "warning" | "accent" | "danger";
  progress?: number;
  delay?: number;
  onClick?: () => void;
  className?: string;
  floatIndex?: number;
}) {
  const Icon = ICONS[iconName] ?? Target;

  const styles = {
    default: {
      card: "border-slate-200/80 bg-white hover:border-slate-300",
      label: "text-slate-500",
      value: "text-slate-900",
      icon: "text-slate-400",
      iconBg: "bg-white/90 shadow-raised",
      hint: "text-slate-400",
    },
    success: {
      card: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-white hover:border-emerald-300",
      label: "text-emerald-700",
      value: "text-emerald-800",
      icon: "text-emerald-500",
      iconBg: "bg-white/90 shadow-raised",
      hint: "text-emerald-600",
    },
    warning: {
      card: "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white hover:border-amber-300",
      label: "text-amber-700",
      value: "text-amber-800",
      icon: "text-amber-500",
      iconBg: "bg-white/90 shadow-raised",
      hint: "text-amber-600",
    },
    accent: {
      card: "border-primary/20 bg-gradient-to-br from-primary/5 via-white to-white hover:border-primary/30",
      label: "text-primary",
      value: "text-foreground",
      icon: "text-primary",
      iconBg: "bg-white/90 shadow-raised",
      hint: "text-primary/80",
    },
    danger: {
      card: "border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-white hover:border-rose-300",
      label: "text-rose-700",
      value: "text-rose-800",
      icon: "text-rose-500",
      iconBg: "bg-white/90 shadow-raised",
      hint: "text-rose-600",
    },
  }[variant];

  return (
    <Card3D
      as={onClick ? "button" : "div"}
      onClick={onClick}
      floatIndex={floatIndex}
      className={cn(
        "w-full p-5 text-left animate-fade-up",
        onClick && "cursor-pointer",
        styles.card,
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <p className={cn("text-sm font-medium", styles.label)}>{label}</p>
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/[0.04]",
            styles.iconBg,
            styles.icon
          )}
          style={{ transform: "translateZ(32px)" }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p
        className={cn("mt-3 text-3xl font-bold tracking-tight", styles.value)}
        style={{ transform: "translateZ(24px)" }}
      >
        {value}
      </p>
      {hint && (
        <p className={cn("mt-1 text-xs", styles.hint)} style={{ transform: "translateZ(16px)" }}>
          {hint}
        </p>
      )}
      {progress !== undefined && (
        <div
          className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100/90 shadow-inner"
          style={{ transform: "translateZ(12px)" }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-blue-600 transition-all duration-1000"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </Card3D>
  );
}
