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
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-[#0f172a] to-blue-950 px-8 py-10 text-white shadow-elevated ring-1 ring-black/5 animate-fade-up">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.15),transparent_55%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            {canAccessUnitPicker(user.role) && (
              <Link
                href={UNIT_PICKER_PATH}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100 backdrop-blur-md transition hover:bg-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All units
              </Link>
            )}
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
              <LayoutDashboard className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-blue-100">{unit.name}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {isEmployeeRole(user.role) ? "My KPI Dashboard" : "Plant Command Center"}
            </h1>
            <p className="mt-3 text-lg text-slate-300/90 text-balance">
              {isEmployeeRole(user.role)
                ? `Your assigned KPIs at ${unit.name}.`
                : `${unit.name} — plant health, departments & business KPIs at a glance.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={trackHref}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-md transition hover:bg-white/20"
            >
              <PenLine className="h-4 w-4" />
              Update data
            </Link>
            {!isEmployeeRole(user.role) && (
              <>
                <Link
                  href={reportsHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-md transition hover:bg-white/20"
                >
                  <BarChart3 className="h-4 w-4" />
                  Reports
                </Link>
                <Link
                  href={aiHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
                >
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
                <Link
                  href={createHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90"
                >
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
