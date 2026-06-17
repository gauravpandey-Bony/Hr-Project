import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrgUnitBySlug } from "@/lib/org-units.server";
import { getLocationVariantsForPlant } from "@/lib/org-units";

const createSchema = z.object({
  name: z.string().min(1),
  headName: z.string().optional(),
  location: z.string().optional(),
  kraSheetId: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

function employeeCountWhere(
  unitSlug: string | null,
  organizationId: string
) {
  if (!unitSlug || unitSlug === "all") return undefined;
  return getOrgUnitBySlug(organizationId, unitSlug).then((unit) => {
    if (!unit) return undefined;
    const locations = getLocationVariantsForPlant(
      unit.plantUnitKey,
      unit.locationAliases
    );
    return { OR: locations.map((location) => ({ location })) };
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitSlug = searchParams.get("unit");
  const locationWhere = await employeeCountWhere(unitSlug, user.organizationId);

  const departments = await db.departmentMaster.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          employees: {
            where: {
              isActive: true,
              ...(locationWhere ?? {}),
            },
          },
        },
      },
    },
  });

  return NextResponse.json(departments);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.parse(await request.json());
  const department = await db.departmentMaster.create({
    data: {
      organizationId: user.organizationId,
      name: body.name,
      headName: body.headName ?? null,
      location: body.location ?? "Bony Polymers",
      kraSheetId: body.kraSheetId ?? null,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json(department, { status: 201 });
}
