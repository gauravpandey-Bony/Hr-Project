import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { kpiWhereForUser } from "@/lib/access-control";
import { StatusPill } from "@/components/kpi/kpi-card";
import { KpiGauge } from "@/components/kpi/kpi-gauge";
import { TrendBars } from "@/components/kpi/trend-bars";
import { formatKpiValue, entryTimestamp } from "@/lib/kpi";
import { evaluateKpiCurrent } from "@/lib/kpi-quarters";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyTableShell } from "@/components/ui/sticky-table-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function KpiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;

  if (id === "new") redirect("/dashboard/kpis/create");
  if (id === "create") redirect("/dashboard/kpis/create");

  const kpi = await db.kpi.findFirst({
    where: { id, ...(await kpiWhereForUser(user)) },
    include: {
      entries: { orderBy: { recordedAt: "desc" } },
      owner: { select: { name: true } },
    },
  });

  if (!kpi) notFound();

  const { current, progressNum: progress, status } = evaluateKpiCurrent(kpi);

  const trendPoints = [...kpi.entries]
    .sort((a, b) => entryTimestamp(a.recordedAt) - entryTimestamp(b.recordedAt))
    .slice(-12)
    .map((e) => ({
      label: format(e.recordedAt, "MMM"),
      value: e.value,
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/reports" className="text-emerald-600 hover:underline">
            ← Reports
          </Link>
          <Link href="/dashboard/kpis" className="text-slate-500 hover:text-emerald-600">
            KPI Library
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{kpi.name}</h1>
        <p className="text-muted-foreground">
          {kpi.category} · {kpi.frequency.replace("_", " ")} ·{" "}
          {kpi.owner?.name ?? kpi.department ?? "Company"}
        </p>
      </div>

      <Card className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-center justify-center">
          <KpiGauge progress={progress} status={status} size={160} />
          <StatusPill status={status} className="mt-4" />
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Current</p>
            <p className="text-3xl font-bold tracking-tight">{formatKpiValue(current, kpi.unit)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Target</p>
            <p className="text-xl font-semibold">{formatKpiValue(kpi.targetValue, kpi.unit)}</p>
          </div>
          {kpi.description && <p className="text-sm text-muted-foreground">{kpi.description}</p>}
          <Button asChild>
            <Link href={`/dashboard/track?kpi=${kpi.id}`}>Update this KPI</Link>
          </Button>
        </div>
      </Card>

      {trendPoints.length > 0 && (
        <Card>
          <h2 className="mb-4 font-semibold">Trend</h2>
          <TrendBars points={trendPoints} status={status} />
        </Card>
      )}

      <div>
        <h2 className="mb-3 font-semibold tracking-tight">History</h2>
        <StickyTableShell>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpi.entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{format(e.recordedAt, "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatKpiValue(e.value, kpi.unit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StickyTableShell>
      </div>
    </div>
  );
}
