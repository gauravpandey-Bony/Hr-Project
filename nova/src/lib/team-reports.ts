import type { EmployeeMaster, Kpi, KpiEntry } from "@prisma/client";
import {
  buildEmployeeDashboard,
  fetchKpisForEmployee,
  type EmployeeDashboardData,
} from "@/lib/ai/employee-report";
import { type SheetMeta, sheetMetaForDepartment } from "@/lib/kra-sheets";
import { IT_TEAM_META } from "@/lib/team-scope";

export type TeamMemberKpi = Kpi & { entries: KpiEntry[] };

export type TeamMemberReportRow = {
  employeeId: string;
  name: string;
  ecn: string | null;
  designation: string | null;
  department: string | null;
  kpiCount: number;
  onTrack: number;
  offTarget: number;
  avgProgress: number;
  dashboard: EmployeeDashboardData;
  kpis: TeamMemberKpi[];
  sheetMeta: SheetMeta;
};

function memberSheetMeta(department: string | null): SheetMeta {
  if (department === "IT") return IT_TEAM_META;
  return sheetMetaForDepartment(department);
}

export type TeamReportBundle = {
  members: TeamMemberReportRow[];
  totals: {
    headcount: number;
    kpiCount: number;
    onTrack: number;
    offTarget: number;
    avgProgress: number;
  };
};

export async function buildTeamReports(
  organizationId: string,
  team: EmployeeMaster[]
): Promise<TeamReportBundle> {
  const members: TeamMemberReportRow[] = [];

  for (const emp of team) {
    const dashboard = await buildEmployeeDashboard(organizationId, {
      kind: "master",
      master: {
        name: emp.name,
        ecn: emp.ecn,
        designation: emp.designation,
        department: emp.department,
        managerName: emp.managerName,
      },
    });

    const kpiCount = Number(dashboard.stats[0]?.value ?? 0);
    const onTrack = Number(dashboard.stats[1]?.value ?? 0);
    const offTarget = Number(dashboard.stats[2]?.value ?? 0);
    const avgStr = dashboard.stats[3]?.value ?? "0";
    const avgProgress = parseInt(avgStr.replace("%", ""), 10) || 0;

    const kpis = await fetchKpisForEmployee(organizationId, emp.name, null);

    members.push({
      employeeId: emp.id,
      name: emp.name,
      ecn: emp.ecn,
      designation: emp.designation,
      department: emp.department,
      kpiCount,
      onTrack,
      offTarget,
      avgProgress,
      dashboard,
      kpis,
      sheetMeta: memberSheetMeta(emp.department),
    });
  }

  members.sort((a, b) => b.avgProgress - a.avgProgress);

  const totals = members.reduce(
    (acc, m) => ({
      headcount: acc.headcount + 1,
      kpiCount: acc.kpiCount + m.kpiCount,
      onTrack: acc.onTrack + m.onTrack,
      offTarget: acc.offTarget + m.offTarget,
      avgProgress: acc.avgProgress + m.avgProgress,
    }),
    { headcount: 0, kpiCount: 0, onTrack: 0, offTarget: 0, avgProgress: 0 }
  );

  return {
    members,
    totals: {
      ...totals,
      avgProgress:
        totals.headcount > 0 ? Math.round(totals.avgProgress / totals.headcount) : 0,
    },
  };
}
