import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    return NextResponse.json({ accounts: [], organization: null });
  }

  const users = await db.user.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      title: true,
      department: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    organization: { id: org.id, name: org.name },
    accounts: users,
  });
}
