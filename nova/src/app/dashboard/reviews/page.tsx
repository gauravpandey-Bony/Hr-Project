import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { reviewAssignmentWhereForUser } from "@/lib/access-control";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { LaunchCycleButton } from "@/components/reviews/launch-cycle-button";
import { format } from "date-fns";

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const showCycles = user.role === "ADMIN" || user.role === "MANAGER";

  const [cycles, myAssignments] = await Promise.all([
    showCycles
      ? db.reviewCycle.findMany({
          where: { organizationId: user.organizationId },
          include: {
            template: { select: { name: true } },
            _count: { select: { assignments: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.reviewAssignment.findMany({
      where: reviewAssignmentWhereForUser(user),
      include: {
        cycle: { select: { name: true } },
        reviewee: { select: { name: true, title: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const statusVariant = (s: string) => {
    if (s === "SUBMITTED") return "success" as const;
    if (s === "OVERDUE") return "danger" as const;
    if (s === "IN_PROGRESS") return "info" as const;
    return "warning" as const;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance Reviews"
        description="Flexible cycles with self, manager, and peer reviews — completed in Teams or on the web."
        actions={
          user.role === "ADMIN" ? (
            <Button asChild>
              <Link href="/dashboard/reviews/new">Create cycle</Link>
            </Button>
          ) : undefined
        }
      />

      {showCycles && (
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Review cycles</h2>
        <div className="space-y-4">
          {cycles.map((cycle) => (
            <Card key={cycle.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{cycle.name}</h3>
                    <Badge
                      variant={
                        cycle.status === "ACTIVE"
                          ? "success"
                          : cycle.status === "CLOSED"
                            ? "default"
                            : "warning"
                      }
                    >
                      {cycle.status}
                    </Badge>
                    <Badge variant="info">{cycle.cycleType}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Template: {cycle.template.name} · {cycle._count.assignments} assignments ·{" "}
                    {format(cycle.startDate, "MMM d")} – {format(cycle.endDate, "MMM d, yyyy")}
                  </p>
                </div>
                {user.role === "ADMIN" && cycle.status !== "CLOSED" && (
                  <LaunchCycleButton cycleId={cycle.id} />
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          {user.role === "EMPLOYEE" ? "My reviews" : "My assignments"}
        </h2>
        <StickyTableShell>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead>Reviewee</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {myAssignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.reviewee.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.cycle.name}</TableCell>
                  <TableCell>{a.reviewType}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.dueDate ? format(a.dueDate, "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status !== "SUBMITTED" ? (
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link href={`/dashboard/reviews/${a.id}`}>Complete</Link>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Done</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StickyTableShell>
      </section>
    </div>
  );
}
