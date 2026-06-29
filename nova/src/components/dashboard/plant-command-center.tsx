"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarRange,
  FileSpreadsheet,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/ui/card-3d";
import type { PlantPerformanceReport } from "@/lib/kra/plant-performance-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import {
  EMPLOYEE_QUARTER_FILTER_OPTIONS,
  quarterFilterLabel,
} from "@/lib/ai/employee-quarter-filter";
import {
  getPlantDashboardProfile,
  resolveSpotlightMetrics,
  type PlantDashboardProfile,
} from "@/lib/plant/plant-dashboard-config";
import { buildPlantAlerts } from "@/lib/plant/plant-alerts";
import { PlantSpotlightMetrics } from "@/components/dashboard/plant-spotlight-metrics";
import { PlantAlertsPanel } from "@/components/dashboard/plant-alerts-panel";
import { motion } from "framer-motion";

const QUARTER_MAP: Record<string, FiscalQuarter> = {
  annual: "q1",
  q1: "q1",
  q2: "q2",
  q3: "q3",
  q4: "q4",
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
  plantUnitKey,
  employeeIdByName,
  reportsByQuarter,
}: {
  unitName: string;
  unitId: string;
  plantUnitKey: string;
  employeeIdByName: Record<string, string>;
  reportsByQuarter: Record<FiscalQuarter, PlantPerformanceReport>;
}) {
  const [filter, setFilter] = useState<string>("q1");
  const quarter = QUARTER_MAP[filter] ?? "q1";
  const report = reportsByQuarter[quarter];
  const profile: PlantDashboardProfile = getPlantDashboardProfile(unitId, plantUnitKey);

  const spotlight = useMemo(
    () => (report ? resolveSpotlightMetrics(profile, report) : []),
    [profile, report]
  );

  const alerts = useMemo(
    () =>
      report
        ? buildPlantAlerts(report, spotlight, employeeIdByName, unitId, quarter)
        : [],
    [report, spotlight, employeeIdByName, unitId, quarter]
  );

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

  const departments = report?.departments.cards ?? [];
  const unitQs = `?unit=${encodeURIComponent(unitId)}`;
  const qQs = `${unitQs}&quarter=${quarter}`;

  return (
    <div className="space-y-8">
      <Card3D tilt={false} className="border-border/70 bg-card/90 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Report period</p>
            <p className="text-xs text-muted-foreground">
              {quarterFilterLabel(filter as "q1")} · {unitName}
            </p>
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

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-[#0c1222] to-indigo-950 px-6 py-8 text-white shadow-2xl sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2),transparent_55%)]" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <HealthRing score={healthScore} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Plant command center</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{unitName}</h2>
            <p className="mt-2 max-w-lg text-sm text-slate-400">{profile.tagline}</p>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
              <ScorePill label="Plant" value={report?.plantKpis.overallScore} />
              <ScorePill label="Departments" value={report?.departments.overallScore} />
              <ScorePill label="Employees" value={report?.employees.overallScore} />
            </div>
          </div>
        </div>
      </div>

      {report && (
        <PlantSpotlightMetrics
          title={profile.metricsSectionTitle}
          subtitle={profile.metricsSectionSubtitle}
          metrics={spotlight}
        />
      )}

      <PlantAlertsPanel alerts={alerts} />

      <section className="space-y-4">
        <SectionHeader
          icon={Building2}
          title="Department performance"
          subtitle="Weighted KRA scores by department"
          href={`/dashboard/reports/plant${qQs}`}
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

      <Card3D className="bg-card p-5">
        <h3 className="font-bold">Quick actions</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <QuickLink href={`/dashboard/reports/plant${qQs}`} icon={BarChart3} label="Full plant scorecard" />
          <QuickLink href={`/dashboard/reports/quarterly${unitQs}`} icon={BarChart3} label="Quarterly KRA report" />
          <QuickLink href={`/dashboard/kra${unitQs}`} icon={FileSpreadsheet} label="KRA master sheet" />
          <QuickLink href={`/dashboard/masters/employees${unitQs}`} icon={Users} label="Employee master" />
          <QuickLink href={`/dashboard/ai${unitQs}`} icon={Sparkles} label="Maya AI insights" />
          <QuickLink href={`/dashboard/reports/plant${qQs}`} icon={TrendingUp} label="Calculation breakdown" />
        </div>
      </Card3D>
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
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        View all <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
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
