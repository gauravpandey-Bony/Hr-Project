"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarRange,
  FileSpreadsheet,
  Info,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/ui/card-3d";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type ScoreFocus = "health" | "plant" | "departments" | "employees";

function scoreTone(score: number | null) {
  if (score == null) return "text-slate-400";
  if (score >= 90) return "text-emerald-500";
  if (score >= 70) return "text-amber-500";
  return "text-rose-500";
}

function formatScore(score: number | null | undefined) {
  return score == null ? "—" : `${score}%`;
}

function HealthRing({
  score,
  onClick,
}: {
  score: number | null;
  onClick?: () => void;
}) {
  const pct = score ?? 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    score == null ? "#94a3b8" : pct >= 90 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#f43f5e";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mx-auto block h-36 w-36 rounded-full outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      style={{ transform: "translateZ(40px)" }}
      title="Click to see how this score is calculated"
      aria-label="Overall plant health score — click for calculation basis"
    >
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
        <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-white/35 opacity-0 transition group-hover:opacity-100">
          <Info className="h-2.5 w-2.5" /> How
        </span>
      </div>
    </button>
  );
}

function DepartmentCard({
  name,
  score,
  employeeCount,
  calculation,
  index,
  onExplain,
}: {
  name: string;
  score: number | null;
  employeeCount: number;
  calculation: string;
  index: number;
  onExplain: () => void;
}) {
  const pct = score ?? 0;
  return (
    <Card3D floatIndex={index} className="bg-card p-5">
      <button type="button" onClick={onExplain} className="w-full text-left outline-none">
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
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted shadow-inner"
          style={{ transform: "translateZ(12px)" }}
        >
          <motion.div
            className={cn(
              "h-full rounded-full bg-gradient-to-r",
              pct >= 90
                ? "from-emerald-400 to-teal-500"
                : pct >= 70
                  ? "from-amber-400 to-orange-500"
                  : "from-rose-400 to-pink-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ duration: 0.9, delay: index * 0.08 }}
          />
        </div>
        <p className="mt-2 truncate text-[10px] text-muted-foreground" title={calculation}>
          Click for calculation basis
        </p>
      </button>
    </Card3D>
  );
}

function ScoreBreakdownDialog({
  open,
  onOpenChange,
  focus,
  unitName,
  periodLabel,
  healthScore,
  report,
  departmentName,
  departmentCalculation,
  departmentScore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus: ScoreFocus | "department";
  unitName: string;
  periodLabel: string;
  healthScore: number | null;
  report: PlantPerformanceReport | null | undefined;
  departmentName?: string;
  departmentCalculation?: string;
  departmentScore?: number | null;
}) {
  const plant = report?.plantKpis.overallScore ?? null;
  const departments = report?.departments.overallScore ?? null;
  const employees = report?.employees.overallScore ?? null;

  const available = [
    plant != null ? `Plant ${plant}%` : null,
    departments != null ? `Departments ${departments}%` : null,
    employees != null ? `Employees ${employees}%` : null,
  ].filter(Boolean) as string[];

  const healthBasis =
    healthScore == null
      ? "No scored layers yet. Upload plant, department, or employee KRA data to calculate plant health."
      : available.length === 1
        ? `Only one layer has data, so overall health equals that score: ${available[0]}.`
        : `Simple average of available layers (null / “—” values are skipped):\n(${available.join(" + ")}) ÷ ${available.length} = ${healthScore}%`;

  const title =
    focus === "department"
      ? `${departmentName ?? "Department"} score`
      : focus === "health"
        ? "Overall plant health"
        : focus === "plant"
          ? "Plant score"
          : focus === "departments"
            ? "Departments score"
            : "Employees score";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {unitName} · {periodLabel} — calculation basis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {focus === "department" ? (
            <BreakdownBlock
              label="This department"
              score={departmentScore ?? null}
              body={
                departmentCalculation?.trim() ||
                "No calculation detail available for this department yet."
              }
            />
          ) : null}

          {focus === "health" ||
          focus === "plant" ||
          focus === "departments" ||
          focus === "employees" ? (
            <>
              {(focus === "health" || focus === "plant") && (
                <BreakdownBlock
                  label="Plant"
                  score={plant}
                  body={
                    report?.plantKpis.overallCalculation?.trim() ||
                    "Weighted average of plant-level KPIs (weight × points). No plant KPIs are loaded for this period, so this shows —%."
                  }
                  highlight={focus === "plant"}
                />
              )}
              {(focus === "health" || focus === "departments") && (
                <BreakdownBlock
                  label="Departments"
                  score={departments}
                  body={
                    report?.departments.overallCalculation?.trim() ||
                    "Average of each department’s score. If a department has its own KPIs, those are used; otherwise the average of employee scores in that department is used."
                  }
                  highlight={focus === "departments"}
                />
              )}
              {(focus === "health" || focus === "employees") && (
                <BreakdownBlock
                  label="Employees"
                  score={employees}
                  body={
                    report?.employees.overallCalculation?.trim() ||
                    "Weighted average across all individual employee KPIs at this plant (weight × points for the selected quarter)."
                  }
                  highlight={focus === "employees"}
                />
              )}
              {focus === "health" ? (
                <BreakdownBlock
                  label="Overall ring (plant health)"
                  score={healthScore}
                  body={healthBasis}
                  highlight
                />
              ) : null}
            </>
          ) : null}

          <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Scores use the selected report period only. Pending KPIs without achieved values are
            excluded from weighted averages until data is entered.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BreakdownBlock({
  label,
  score,
  body,
  highlight,
}: {
  label: string;
  score: number | null;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        highlight ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-base font-black tabular-nums", scoreTone(score))}>
          {formatScore(score)}
        </p>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

export function PlantCommandCenter({
  unitName,
  unitId,
  plantUnitKey,
  employeeIdByName,
  reportsByQuarter,
  hasKpiData = true,
  employeeCount = 0,
}: {
  unitName: string;
  unitId: string;
  plantUnitKey: string;
  employeeIdByName: Record<string, string>;
  reportsByQuarter: Record<FiscalQuarter, PlantPerformanceReport>;
  hasKpiData?: boolean;
  employeeCount?: number;
}) {
  const [filter, setFilter] = useState<string>("q1");
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreFocus, setScoreFocus] = useState<ScoreFocus | "department">("health");
  const [deptExplain, setDeptExplain] = useState<{
    name: string;
    score: number | null;
    calculation: string;
  } | null>(null);

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
  const periodLabel = quarterFilterLabel(filter as "q1");

  function openScore(focus: ScoreFocus) {
    setDeptExplain(null);
    setScoreFocus(focus);
    setScoreOpen(true);
  }

  function openDepartment(name: string, score: number | null, calculation: string) {
    setDeptExplain({ name, score, calculation });
    setScoreFocus("department");
    setScoreOpen(true);
  }

  return (
    <div className="space-y-8">
      <Card3D tilt={false} className="border-border/70 bg-card/90 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Report period</p>
            <p className="text-xs text-muted-foreground">
              {periodLabel} · {unitName}
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
          <HealthRing score={healthScore} onClick={() => openScore("health")} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">
              Plant command center
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{unitName}</h2>
            <p className="mt-2 max-w-lg text-sm text-slate-400">{profile.tagline}</p>
            <p className="mt-1 text-[11px] text-white/35">
              Tap the ring or any score below to see the calculation basis.
            </p>
            {!hasKpiData && employeeCount > 0 && (
              <p className="mt-2 max-w-lg text-sm text-amber-200/90">
                {employeeCount} employees in master — upload KRA Excel to unlock KPI scores and
                spotlight metrics.
              </p>
            )}
            <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
              <ScorePill
                label="Plant"
                value={report?.plantKpis.overallScore}
                onClick={() => openScore("plant")}
              />
              <ScorePill
                label="Departments"
                value={report?.departments.overallScore}
                onClick={() => openScore("departments")}
              />
              <ScorePill
                label="Employees"
                value={report?.employees.overallScore}
                onClick={() => openScore("employees")}
              />
            </div>
          </div>
        </div>
      </div>

      <ScoreBreakdownDialog
        open={scoreOpen}
        onOpenChange={setScoreOpen}
        focus={scoreFocus}
        unitName={unitName}
        periodLabel={periodLabel}
        healthScore={healthScore}
        report={report}
        departmentName={deptExplain?.name}
        departmentCalculation={deptExplain?.calculation}
        departmentScore={deptExplain?.score}
      />

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
                calculation={d.calculation}
                index={i}
                onExplain={() => openDepartment(d.department, d.weightedScore, d.calculation)}
              />
            ))}
          </div>
        ) : (
          <EmptyPanel
            message={
              employeeCount > 0
                ? `${employeeCount} employees in master — upload KRA sheets to score departments.`
                : "Upload employee KRA sheets to see department scores."
            }
          />
        )}
      </section>

      <Card3D className="bg-card p-5">
        <h3 className="font-bold">Quick actions</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <QuickLink href={`/dashboard/reports/plant${qQs}`} icon={BarChart3} label="Full plant scorecard" />
          <QuickLink
            href={`/dashboard/reports/quarterly${unitQs}`}
            icon={BarChart3}
            label="Quarterly KRA report"
          />
          <QuickLink href={`/dashboard/kra${unitQs}`} icon={FileSpreadsheet} label="KRA master sheet" />
          <QuickLink
            href={`/dashboard/masters/employees${unitQs}`}
            icon={Users}
            label="Employee master"
          />
          <QuickLink href={`/dashboard/ai${unitQs}`} icon={Sparkles} label="Maya AI insights" />
          <QuickLink
            href={`/dashboard/reports/plant${qQs}`}
            icon={TrendingUp}
            label="Calculation breakdown"
          />
        </div>
      </Card3D>
    </div>
  );
}

function ScorePill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number | null | undefined;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/10 hover:ring-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      title={`Click to see how ${label} score is calculated`}
    >
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className={cn("text-xl font-bold", scoreTone(value ?? null))}>{value ?? "—"}%</p>
    </button>
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
