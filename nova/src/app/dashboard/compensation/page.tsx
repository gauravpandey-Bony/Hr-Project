import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StickyTableShell } from "@/components/ui/sticky-table-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CompensationPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const recs = await db.compensationRecommendation.findMany({
    where: {
      employee: { organizationId: user.organizationId },
      ...(user.role === "MANAGER" ? { managerId: user.id } : {}),
    },
    include: {
      employee: { select: { name: true, title: true, department: true } },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compensation"
        description="Connect performance ratings to merit and bonus recommendations."
      />

      <StickyTableShell>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead>Employee</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Suggested merit</TableHead>
              <TableHead>Suggested bonus</TableHead>
              <TableHead>Manager note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-medium">{r.employee.name}</p>
                  <p className="text-sm text-muted-foreground">{r.employee.title}</p>
                </TableCell>
                <TableCell>{r.performanceRating?.toFixed(1) ?? "—"}</TableCell>
                <TableCell>{r.suggestedMeritPct}%</TableCell>
                <TableCell>{r.suggestedBonusPct}%</TableCell>
                <TableCell className="max-w-xs text-muted-foreground">
                  {r.managerRecommendation ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </StickyTableShell>

      <Card className="bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Managers use review data alongside suggested ranges to submit recommendations.
          Final bands sync outbound via HRIS when configured.
        </p>
      </Card>
    </div>
  );
}
