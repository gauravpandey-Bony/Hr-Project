import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createOrgGroup, fetchOrgStructure } from "@/lib/org-units.server";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  subtitle: z.string().max(120).optional(),
  emoji: z.string().max(8).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groups } = await fetchOrgStructure(user.organizationId);
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.parse(await request.json());
  const group = await createOrgGroup(user.organizationId, body);
  return NextResponse.json(group, { status: 201 });
}
