import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  findExistingDepartmentMaster,
  normalizeDepartmentMasterName,
} from "@/lib/masters/department-master-sync";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  headName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  kraSheetId: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.departmentMaster.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateSchema.parse(await request.json());
  if (body.name) {
    const name = normalizeDepartmentMasterName(body.name);
    const duplicate = await findExistingDepartmentMaster(
      db,
      user.organizationId,
      name,
      body.location ?? existing.location
    );
    if (duplicate && duplicate.id !== existing.id) {
      return NextResponse.json(
        {
          error: `Department "${name}" already exists for this plant.`,
          existingId: duplicate.id,
        },
        { status: 409 }
      );
    }
    body.name = name;
  }

  const department = await db.departmentMaster.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json(department);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.departmentMaster.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never hard-delete department rows — soft-deactivate only.
  await db.departmentMaster.update({
    where: { id: params.id },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true, softDeleted: true });
}
