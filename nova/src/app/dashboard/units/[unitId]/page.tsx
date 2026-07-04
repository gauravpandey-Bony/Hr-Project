import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  isEmployeeRole,
  mergeKpiWhereForUnit,
  canAccessUnitPicker,
  UNIT_PICKER_PATH,
} from "@/lib/access-control";
import { resolveWorkspace } from "@/lib/unit-workspace.server";
import { KPI_CATEGORIES } from "@/lib/company";
import { getOrgUnitBySlug } from "@/lib/org-units.server";
import { OBSOLETE_UNIT_REDIRECTS } from "@/lib/org-units-defaults";
import { aliasesForUnit } from "@/lib/org-units";
import { plantDataScope, employeeMasterWhereForPlant } from "@/lib/unit-workspace";
import { MyDashboardClient } from "@/components/dashboard/my-dashboard-client";
import { PlantCommandCenter } from "@/components/dashboard/plant-command-center";
import {
  buildPlantPerformanceReport,
  enrichPlantReportWithEmployeeMaster,
} from "@/lib/kra/plant-performance-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { GenerateKpiPromptButton } from "@/components/ai/generate-kpi-prompt-modal";
import { UploadKraWorkbookButton } from "@/components/kra/upload-kra-workbook-button";
import {
  ArrowLeft,
  BarChart3,
  LayoutDashboard,
  PenLine,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import {
  DASHBOARD_HERO,
  DASHBOARD_HERO_BADGE,
  DASHBOARD_HERO_SUBTITLE,
  DASHBOARD_HERO_BTN_PRIMARY,
  DASHBOARD_HERO_BTN_SECONDARY,
} from "@/components/masters/masters-table-styles";

const QUARTERS: FiscalQuarter[] = ["q1", "q2", "q3", "q4"];

const KPI_SELECT = {
  id: true,
  name: true,
  kraName: true,
  ownerName: true,
  department: true,
  weightage: true,
  quarterTargets: true,
  kpiLevel: true,
  category: true,
  unit: true,
} as const;

export default async function UnitDashboardPage({
  params,
}: {
  params: { unitId: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const redirectSlug = OBSOLETE_UNIT_REDIRECTS[params.unitId];
  if (redirectSlug) {
    redirect(`/dashboard/units/${redirectSlug}`);
  }

  const unit = await getOrgUnitBySlug(user.organizationId, params.unitId);
  if (!unit) notFound();

  if (isEmployeeRole(user.role)) {
    const workspace = await resolveWorkspace(user);
    if (workspace.unitId && workspace.unitId !== params.unitId) {
      redirect(`/dashboard/units/${workspace.unitId}`);
    }
  }

  const { locationAliases, kpiPlantAliases } = aliasesForUnit(unit);
  const dataScope = plantDataScope(unit.plantUnitKey, locationAliases, kpiPlantAliases);

  const kpis = await db.kpi.findMany({
    where: mergeKpiWhereForUnit(user, dataScope),
    include: {
      entries: { orderBy: { recordedAt: "desc" }, take: 12 },
    },
    orderBy: { category: "asc" },
  });

  const scorecardKpis = isEmployeeRole(user.role)
    ? []
    : await db.kpi.findMany({
        where: mergeKpiWhereForUnit(user, dataScope, { isActive: true }),
        select: KPI_SELECT,
      });

  const plantEmployees =
    !isEmployeeRole(user.role)
      ? await db.employeeMaster.findMany({
          where: {
            ...employeeMasterWhereForPlant(user.organizationId, dataScope),
            isActive: true,
          },
          select: { id: true, name: true, department: true },
          orderBy: { name: "asc" },
        })
      : [];

  const reportsByQuarter = Object.fromEntries(
    QUARTERS.map((q) => {
      const base = buildPlantPerformanceReport(scorecardKpis, q, unit.name);
      return [
        q,
        enrichPlantReportWithEmployeeMaster(base, plantEmployees),
      ];
    })
  ) as Record<FiscalQuarter, ReturnType<typeof buildPlantPerformanceReport>>;

  const hasPlantDashboard =
    !isEmployeeRole(user.role) && (scorecardKpis.length > 0 || plantEmployees.length > 0);

  const kpiOwnerNames = [
    ...new Set(
      scorecardKpis
        .filter((k) => k.kpiLevel === "INDIVIDUAL" && k.ownerName?.trim())
        .map((k) => k.ownerName!.trim())
    ),
  ];
  const employeeIdByName = Object.fromEntries(
    plantEmployees
      .filter((e) => kpiOwnerNames.length === 0 || kpiOwnerNames.includes(e.name))
      .map((e) => [e.name, e.id])
  );

  const categories = KPI_CATEGORIES.filter((cat) => kpis.some((k) => k.category === cat));
  const createHref = `/dashboard/kpis/create?unit=${encodeURIComponent(params.unitId)}`;
  const trackHref = `/dashboard/track?unit=${encodeURIComponent(params.unitId)}`;
  const unitQs = `?unit=${encodeURIComponent(params.unitId)}`;
  const reportsHref = `/dashboard/reports${unitQs}`;
  const aiHref = `/dashboard/ai${unitQs}`;
  const kraHref = `/dashboard/kra${unitQs}`;

  return (
    <div className="reports-grid-bg space-y-8 pb-10">
      <div className={DASHBOARD_HERO}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            {canAccessUnitPicker(user.role) && (
              <Link
                href={UNIT_PICKER_PATH}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-medium text-emerald-50 backdrop-blur-md transition hover:bg-white/25"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All units
              </Link>
            )}
            <div className={`${DASHBOARD_HERO_BADGE} mb-3`}>
              <LayoutDashboard className="h-3.5 w-3.5 text-emerald-100" />
              <span className="text-emerald-50">{unit.name}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {isEmployeeRole(user.role) ? "My KPI Dashboard" : "Plant Command Center"}
            </h1>
            <p className={`${DASHBOARD_HERO_SUBTITLE} text-lg`}>
              {isEmployeeRole(user.role)
                ? `Your assigned KPIs at ${unit.name}.`
                : `${unit.name} — plant health, departments & business KPIs at a glance.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={trackHref} className={DASHBOARD_HERO_BTN_SECONDARY}>
              <PenLine className="h-4 w-4" />
              Update data
            </Link>
            {!isEmployeeRole(user.role) && (
              <>
                <Link href={reportsHref} className={DASHBOARD_HERO_BTN_SECONDARY}>
                  <BarChart3 className="h-4 w-4" />
                  Reports
                </Link>
                <Link href={aiHref} className={DASHBOARD_HERO_BTN_PRIMARY}>
                  <Sparkles className="h-4 w-4" />
                  Maya AI
                </Link>
              </>
            )}
            {user.role === "ADMIN" && (
              <>
                <UploadKraWorkbookButton
                  variant="hero-outline"
                  label="Upload Excel"
                  plantUnitKey={unit.plantUnitKey}
                />
                <GenerateKpiPromptButton isAdmin />
                <Link href={createHref} className={DASHBOARD_HERO_BTN_PRIMARY}>
                  <Plus className="h-4 w-4" />
                  Add KPI
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {kpis.length > 0 && isEmployeeRole(user.role) && (
        <MyDashboardClient
          kpis={kpis}
          categories={categories}
          isEmployee={true}
        />
      )}

      {hasPlantDashboard && (
        <PlantCommandCenter
          unitName={unit.name}
          unitId={params.unitId}
          plantUnitKey={unit.plantUnitKey}
          employeeIdByName={employeeIdByName}
          reportsByQuarter={reportsByQuarter}
          hasKpiData={scorecardKpis.length > 0}
          employeeCount={plantEmployees.length}
        />
      )}

      {kpis.length > 0 && !isEmployeeRole(user.role) && scorecardKpis.length === 0 && !hasPlantDashboard && (
        <MyDashboardClient
          kpis={kpis}
          categories={categories}
          isEmployee={false}
        />
      )}

      {kpis.length === 0 && !hasPlantDashboard && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white py-20 text-center shadow-inner animate-fade-up">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-5 text-lg font-medium text-slate-700">No KPIs for {unit.name} yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            HR can add KPIs or upload KRA data here. Once saved, charts and scores will appear on
            this dashboard automatically.
          </p>
          {user.role === "ADMIN" && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <UploadKraWorkbookButton
                variant="hero"
                label="Upload Excel Sheet"
                plantUnitKey={unit.plantUnitKey}
              />
              <GenerateKpiPromptButton isAdmin />
              <Link
                href={createHref}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add KPI for {unit.name}
              </Link>
              <Link
                href={kraHref}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-primary/30"
              >
                KRA Master Sheet
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
