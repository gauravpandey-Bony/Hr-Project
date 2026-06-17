import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recs = await db.compensationRecommendation.findMany({
    where: {
      employee: { organizationId: user.organizationId },
      ...(user.role === "MANAGER" ? { managerId: user.id } : {}),
    },
    include: {
      employee: { select: { name: true, title: true, department: true } },
      manager: { select: { name: true } },
    },
  });

  return NextResponse.json(recs);
}
