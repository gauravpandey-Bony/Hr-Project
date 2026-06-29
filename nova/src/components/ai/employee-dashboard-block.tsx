"use client";

import type { EmployeeDashboardData } from "@/lib/ai/employee-report";

export function EmployeeDashboardBlock({ data }: { data: EmployeeDashboardData }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Individual employee reports are no longer available. Department and plant KPI
      reports are still available from Reports and Maya AI.
      {data.employee?.name ? (
        <p className="mt-2 font-medium text-foreground">{data.employee.name}</p>
      ) : null}
    </div>
  );
}
