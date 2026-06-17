import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycleId");
  const mine = searchParams.get("mine") === "true";

  const assignments = await db.reviewAssignment.findMany({
    where: {
      ...(cycleId ? { cycleId } : {}),
      ...(mine ? { reviewerId: user.id } : {}),
      cycle: { organizationId: user.organizationId },
    },
    include: {
      cycle: { select: { name: true, status: true } },
      reviewee: { select: { id: true, name: true, title: true, department: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(assignments);
}
