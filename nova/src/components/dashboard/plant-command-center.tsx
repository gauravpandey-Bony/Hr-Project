"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarRange,
  FileSpreadsheet,
  IndianRupee,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/ui/card-3d";
import { quarterStatusClass } from "@/lib/kra/quarter-status";
import type { PlantPerformanceReport } from "@/lib/kra/plant-performance-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import {
  EMPLOYEE_QUARTER_FILTER_OPTIONS,
  quarterFilterLabel,
} from "@/lib/ai/employee-quarter-filter";

const QUARTER_MAP: Record<string, FiscalQuarter> = {
  annual: "q1",
  q1: "q1",
  q2: "q2",
  q3: "q3",
  q4: "q4",
};

const CATEGORY_GRADIENT: Record<string, string> = {
  Sales: "from-violet-500 to-fuchsia-600",
  Quality: "from-blue-500 to-indigo-600",
  Finance: "from-amber-500 to-orange-600",
  Process: "from-emerald-500 to-teal-600",
  Production: "from-cyan-500 to-emerald-600",
  Maintenance: "from-orange-500 to-rose-500",
};

function scoreTone(score: number | null) {
  if (score == null) return "text-slate-400";
  if (score >= 90) return "text-emerald-500";
  if (score >= 70) return "text-amber-500";
  return "text-rose-500";
}

function HealthRing({ score }: { score: number | null }) {
  const pct = score ?? 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    score == null ? "#94a3b8" : pct >= 90 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="relative mx-auto h-36 w-36" style={{ transform: "translateZ(40px)" }}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 12px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-black tracking-tight", scoreTone(score))}>
          {score ?? "—"}
        </span>
        {score != null && <span className="text-xs font-medium text-white/50">%</span>}
      </div>
    </div>
  );
}

function PlantMetricCard({
  kraName,
  kpiName,
  achieved,
  target,
  status,
  statusLabel,
  category,
  index,
}: {
  kraName: string;
  kpiName: string;
  achieved: string;
  target: string;
  status: string;
  statusLabel: string;
  category: string;
  index: number;
}) {
  const gradient = CATEGORY_GRADIENT[category] ?? "from-slate-500 to-slate-700";
  const onTrack = status === "met";

  return (
    <Card3D floatIndex={index} className="border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 p-5 text-white">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
            gradient
          )}
          style={{ transform: "translateZ(28px)" }}
        >
          {category === "Sales" || category === "Finance" ? (
            <IndianRupee className="h-5 w-5 text-white" />
          ) : (
            <Target className="h-5 w-5 text-white" />
          )}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", quarterStatusClass(status as "met"))}>
          {statusLabel}
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">{kraName}</p>
      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{kpiName}</p>
      <div className="mt-4 grid grid-cols-2 gap-2" style={{ transform: "translateZ(16px)" }}>
        <div className="rounded-lg bg-white/5 px-2.5 py-2 ring-1 ring-white/10">
          <p className="text-[10px] text-white/40">Achieved</p>
          <p className="font-mono text-sm font-bold">{achieved}</p>
        </div>
        <div className="rounded-lg bg-white/5 px-2.5 py-2 ring-1 ring-white/10">
          <p className="text-[10px] text-white/40">Target</p>
          <p className="font-mono text-sm font-bold">{target}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-700", onTrack ? "bg-emerald-400" : "bg-rose-400")}
          style={{ width: onTrack ? "100%" : "35%" }}
        />
      </div>
    </Card3D>
  );
}

function DepartmentCard({
  name,
  score,
  employeeCount,
  index,
}: {
  name: string;
  score: number | null;
  employeeCount: number;
  index: number;
}) {
  const pct = score ?? 0;
  return (
    <Card3D floatIndex={index} className="bg-card p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25"
          style={{ transform: "translateZ(24px)" }}
        >
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{employeeCount} employees</p>
        </div>
        <p className={cn("text-2xl font-black", scoreTone(score))}>{score ?? "—"}%</p>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted shadow-inner" style={{ transform: "translateZ(12px)" }}>
        <motion.div
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            pct >= 90 ? "from-emerald-400 to-teal-500" : pct >= 70 ? "from-amber-400 to-orange-500" : "from-rose-400 to-pink-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.9, delay: index * 0.08 }}
        />
      </div>
    </Card3D>
  );
}

export function PlantCommandCenter({
  unitName,
  unitId,
  reportsByQuarter,
}: {
  unitName: string;
  unitId: string;
  reportsByQuarter: Record<FiscalQuarter, PlantPerformanceReport>;
}) {
  const [filter, setFilter] = useState<string>("q1");
  const quarter = QUARTER_MAP[filter] ?? "q1";
  const report = reportsByQuarter[quarter];

  const healthScore = useMemo(() => {
    if (!report) return null;
    const parts = [
      report.plantKpis.overallScore,
      report.departments.overallScore,
      report.employees.overallScore,
    ].filter((s): s is number => s != null);
    if (parts.length === 0) return null;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
  }, [report]);

  const offTrackEmployees = useMemo(
    () =>
      report?.employees.rows.filter((e) => e.weightedScore != null && e.weightedScore < 70) ?? [],
    [report]
  );

  const plantKpis = report?.plantKpis.rows ?? [];
  const departments = report?.departments.cards ?? [];
  const unitQs = `?unit=${encodeURIComponent(unitId)}&quarter=${quarter}`;

  return (
    <div className="space-y-8">
      {/* Quarter filter */}
      <Card3D tilt={false} className="border-border/70 bg-card/90 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Report period</p>
            <p className="text-xs text-muted-foreground">{quarterFilterLabel(filter as "q1")} · {unitName}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {EMPLOYEE_QUARTER_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
                filter === opt.value
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.value === "annual" ? "Annual" : opt.label}
            </button>
          ))}
        </div>
      </Card3D>

      {/* Hero health score */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-[#0c1222] to-indigo-950 px-6 py-8 text-white shadow-2xl sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2),transparent_55%)]" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <HealthRing score={healthScore} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Plant command center</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{unitName}</h2>
            <p className="mt-2 max-w-lg text-sm text-slate-400">
              Composite health from plant KPIs, departments & employees. Business metrics on top — people performance below.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
              <ScorePill label="Plant" value={report?.plantKpis.overallScore} />
              <ScorePill label="Departments" value={report?.departments.overallScore} />
              <ScorePill label="Employees" value={report?.employees.overallScore} />
            </div>
          </div>
        </div>
      </div>

      {/* Plant KPIs */}
      <section className="space-y-4">
        <SectionHeader
          icon={TrendingUp}
          title="Plant business KPIs"
          subtitle="Sales, delivery, quality & profitability"
          href={`/dashboard/reports/plant${unitQs}`}
        />
        {plantKpis.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plantKpis.slice(0, 6).map((kpi, i) => (
              <PlantMetricCard
                key={kpi.kpiId}
                kraName={kpi.kraName}
                kpiName={kpi.kpiName}
                achieved={kpi.achieved}
                target={kpi.target}
                status={kpi.status}
                statusLabel={kpi.statusLabel}
                category={kpi.category}
                index={i}
              />
            ))}
          </div>
        ) : (
          <EmptyPanel message="Import Plant Head KRA sheet for sales, OTD & plant metrics." />
        )}
      </section>

      {/* Departments */}
      <section className="space-y-4">
        <SectionHeader
          icon={Building2}
          title="Department performance"
          subtitle="Weighted KRA scores by department"
          href={`/dashboard/reports/plant${unitQs}`}
        />
        {departments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d, i) => (
              <DepartmentCard
                key={d.department}
                name={d.department}
                score={d.weightedScore}
                employeeCount={d.employeeCount}
                index={i}
              />
            ))}
          </div>
        ) : (
          <EmptyPanel message="Upload employee KRA sheets to see department scores." />
        )}
      </section>

      {/* Alerts + quick links */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card3D className="border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-card to-card p-5">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-bold">Needs attention</h3>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <AlertRow
              icon={TrendingDown}
              label="Employees below 70%"
              value={offTrackEmployees.length}
              tone="rose"
            />
            <AlertRow
              icon={Target}
              label="KRAs pending entry"
              value={report?.employees.summary.pending ?? 0}
              tone="amber"
            />
            <AlertRow
              icon={TrendingUp}
              label="KRAs achieved"
              value={report?.employees.summary.met ?? 0}
              tone="emerald"
            />
          </ul>
          {offTrackEmployees.length > 0 && (
            <div className="mt-4 border-t border-amber-200/50 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Low performers</p>
              <div className="flex flex-wrap gap-1.5">
                {offTrackEmployees.slice(0, 5).map((e) => (
                  <span
                    key={e.employeeName}
                    className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-800"
                  >
                    {e.employeeName} ({e.weightedScore}%)
                  </span>
                ))}
                {offTrackEmployees.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{offTrackEmployees.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </Card3D>

        <Card3D className="bg-card p-5">
          <h3 className="font-bold">Quick actions</h3>
          <div className="mt-4 grid gap-2">
            <QuickLink href={`/dashboard/reports/plant${unitQs}`} icon={BarChart3} label="Full plant scorecard" />
            <QuickLink href={`/dashboard/reports/quarterly${unitQs.replace(`&quarter=${quarter}`, "")}`} icon={BarChart3} label="Quarterly KRA report" />
            <QuickLink href={`/dashboard/kra${unitQs.replace(`&quarter=${quarter}`, "")}`} icon={FileSpreadsheet} label="KRA master sheet" />
            <QuickLink href={`/dashboard/masters/employees${unitQs.replace(`&quarter=${quarter}`, "")}`} icon={Users} label="Employee master" />
            <QuickLink href={`/dashboard/ai${unitQs.replace(`&quarter=${quarter}`, "")}`} icon={Sparkles} label="Maya AI insights" />
          </div>
        </Card3D>
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className={cn("text-xl font-bold", scoreTone(value ?? null))}>{value ?? "—"}%</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  href,
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        View all <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AlertRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "rose" | "amber" | "emerald";
}) {
  const cls =
    tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-emerald-700";
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", cls)} />
        {label}
      </span>
      <span className={cn("text-lg font-bold", cls)}>{value}</span>
    </li>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof BarChart3;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-medium transition hover:border-primary/30 hover:bg-primary/5"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
