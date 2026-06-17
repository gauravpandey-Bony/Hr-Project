import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db.reviewTemplate.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { isDefault: "desc" },
  });

  return NextResponse.json(templates);
}
