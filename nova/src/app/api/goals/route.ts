import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await db.goal.findMany({
    where: { organizationId: user.organizationId },
    include: {
      owner: { select: { name: true, department: true } },
      children: true,
    },
    orderBy: [{ level: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(goals);
}
