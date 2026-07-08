import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mergeKpiWhereForWorkspace } from "@/lib/access-control";
import { resolveWorkspace, requireAdminWorkspace } from "@/lib/unit-workspace.server";
import { getCompanyContext } from "@/lib/company.server";
import { buildQuarterlyReportRows } from "@/lib/kra/quarterly-report";
import type { FiscalQuarter } from "@/lib/kpi-quarters";
import { QuarterlyReportClient } from "@/components/reports/quarterly-report-client";
import { CalendarRange } from "lucide-react";

const QUARTERS: FiscalQuarter[] = ["q1", "q2", "q3", "q4"];

export default async function QuarterlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; employee?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { unit: unitId, employee: employeeParam } = await searchParams;
  const workspace = await resolveWorkspace(user, unitId);
  if (user.role === "ADMIN") {
    requireAdminWorkspace(user, workspace);
  }

  const isEmployeeView = user.role === "EMPLOYEE";
  const employeeName = isEmployeeView ? user.name?.trim() ?? null : null;

  const [kpis, company] = await Promise.all([
    db.kpi.findMany({
      where: await mergeKpiWhereForWorkspace(user, workspace.dataScope, {
        kpiLevel: "INDIVIDUAL",
        isActive: true,
      }),
      select: {
        id: true,
        name: true,
        kraName: true,
        ownerName: true,
        department: true,
        weightage: true,
        quarterTargets: true,
        kpiLevel: true,
      },
      orderBy: [{ ownerName: "asc" }, { kraName: "asc" }, { name: "asc" }],
    }),
    getCompanyContext(user.organizationId),
  ]);

  const rowsByQuarter = Object.fromEntries(
    QUARTERS.map((q) => [
      q,
      buildQuarterlyReportRows(kpis, q, employeeName),
    ])
  ) as Record<FiscalQuarter, ReturnType<typeof buildQuarterlyReportRows>>;

  const employees = [
    ...new Set(
      kpis.map((k) => k.ownerName?.trim()).filter((n): n is string => Boolean(n))
    ),
  ].sort();

  return (
    <div className="reports-grid-bg space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-8 py-10 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            <CalendarRange className="h-3.5 w-3.5 text-blue-300" />
            <span>{company.shortName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Quarterly KRA Report
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            {isEmployeeView
              ? "Your Q1–Q4 achievement vs target — what was achieved and what is still pending."
              : "Per-quarter detail for every employee — target, achieved, and status for each KPI."}
          </p>
        </div>
      </div>

      <QuarterlyReportClient
        rowsByQuarter={rowsByQuarter}
        employees={employees}
        isEmployeeView={isEmployeeView}
        initialEmployeeFilter={
          isEmployeeView ? null : employeeParam?.trim() || null
        }
      />
    </div>
  );
}
