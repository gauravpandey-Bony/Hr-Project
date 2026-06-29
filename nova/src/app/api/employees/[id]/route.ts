import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assignDepartmentKpisToEmployee } from "@/lib/kpi/assign-department-kpis";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  designation: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  doj: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  ecn: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  lastIncrementPercent: z.number().min(0).max(2).optional().nullable(),
  lastCtc: z.string().optional().nullable(),
  managerName: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await db.employeeMaster.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: { dept: { select: { id: true, name: true } } },
  });
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(employee);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.employeeMaster.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateSchema.parse(await request.json());
  let departmentName = body.department;
  const departmentId = body.departmentId;

  if (departmentId !== undefined && departmentId !== null) {
    const dept = await db.departmentMaster.findFirst({
      where: { id: departmentId, organizationId: user.organizationId },
    });
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
    departmentName = dept.name;
  } else if (departmentId === null) {
    departmentName = body.department ?? null;
  }

  const employee = await db.employeeMaster.update({
    where: { id: params.id },
    data: {
      ...body,
      ...(departmentId !== undefined ? { departmentId } : {}),
      ...(departmentName !== undefined ? { department: departmentName } : {}),
    },
  });

  const deptChanged =
    departmentName !== undefined &&
    departmentName !== existing.department &&
    Boolean(departmentName);

  const kpiAssign = deptChanged
    ? await assignDepartmentKpisToEmployee(user.organizationId, {
        name: employee.name,
        department: employee.department,
        ecn: employee.ecn,
      })
    : { assigned: 0, skipped: 0, kpiNames: [] as string[] };

  return NextResponse.json({
    ...employee,
    kpisAssigned: kpiAssign.assigned,
    kpiNames: kpiAssign.kpiNames,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.employeeMaster.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.employeeMaster.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
