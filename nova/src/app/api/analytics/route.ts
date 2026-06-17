import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateReviewInsights } from "@/lib/ai/insights";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await db.reviewAssignment.findMany({
    where: {
      cycle: { organizationId: user.organizationId },
      status: "SUBMITTED",
      overallRating: { not: null },
    },
    include: { reviewee: { select: { department: true } } },
  });

  const avgRating =
    assignments.length > 0
      ? assignments.reduce((s, a) => s + (a.overallRating ?? 0), 0) / assignments.length
      : 0;

  const allAssignments = await db.reviewAssignment.count({
    where: { cycle: { organizationId: user.organizationId } },
  });
  const submitted = assignments.length;
  const completionRate =
    allAssignments > 0 ? Math.round((submitted / allAssignments) * 100) : 0;

  const departmentBreakdown: Record<string, number[]> = {};
  for (const a of assignments) {
    const dept = a.reviewee.department ?? "Unknown";
    if (!departmentBreakdown[dept]) departmentBreakdown[dept] = [];
    departmentBreakdown[dept].push(a.overallRating ?? 0);
  }

  const deptAvgs = Object.fromEntries(
    Object.entries(departmentBreakdown).map(([d, vals]) => [
      d,
      vals.reduce((x, y) => x + y, 0) / vals.length,
    ])
  );

  const placements = await db.nineBoxPlacement.findMany({
    where: { session: { organizationId: user.organizationId } },
    include: { user: { select: { name: true } } },
  });

  const frameworks = await db.competencyFramework.findMany({
    where: { organizationId: user.organizationId },
  });

  const insights = generateReviewInsights(avgRating, completionRate, deptAvgs);

  return NextResponse.json({
    avgRating: Math.round(avgRating * 10) / 10,
    completionRate,
    departmentBreakdown: deptAvgs,
    nineBox: placements,
    competencyFrameworks: frameworks,
    insights,
  });
}
