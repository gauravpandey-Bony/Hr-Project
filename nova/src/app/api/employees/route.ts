import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assignDepartmentKpisToEmployee } from "@/lib/kpi/assign-department-kpis";
import { employeeMasterWhereForUserAsync } from "@/lib/access-control";
import { getOrgUnitBySlug } from "@/lib/org-units.server";
import { getLocationVariantsForPlant } from "@/lib/org-units";
import { filterRealKraEmployees } from "@/lib/masters/logistics-kra-junk";
import { departmentsAreEquivalent } from "@/lib/masters/department-master-sync";
import { resolvePlantFromWorkingLocation } from "@/lib/masters/employee-plant-location";

function plantLabelFromLocation(location: string | null | undefined): string {
  if (!location?.trim()) return "—";
  return resolvePlantFromWorkingLocation(location).plantUnitKey;
}

const createSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  doj: z.string().optional(),
  dob: z.string().optional(),
  ecn: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  grade: z.string().optional(),
  lastIncrementPercent: z.number().min(0).max(1).optional(),
  lastCtc: z.string().optional(),
  lastPromotionDate: z.string().optional(),
  managerName: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get("departmentId");
  const departmentName = searchParams.get("department")?.trim();
  const unitSlug = searchParams.get("unit");

  const baseWhere = await employeeMasterWhereForUserAsync(user);

  let locationWhere: Record<string, unknown> | undefined;
  if (unitSlug && unitSlug !== "all") {
    const unit = await getOrgUnitBySlug(user.organizationId, unitSlug);
    if (unit) {
      const locations = getLocationVariantsForPlant(
        unit.plantUnitKey,
        unit.locationAliases
      );
      locationWhere = { OR: locations.map((location) => ({ location })) };
    }
  }

  const employees = await db.employeeMaster.findMany({
    where: {
      ...baseWhere,
      isActive: true,
      ...(departmentId ? { departmentId } : {}),
      ...(locationWhere ?? {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { dept: { select: { name: true } } },
  });

  let rows = filterRealKraEmployees(employees);

  if (departmentName) {
    rows = rows.filter((e) =>
      departmentsAreEquivalent(e.department ?? "", departmentName)
    );
  }

  return NextResponse.json(
    rows.map((e) => ({
      ...e,
      plantLabel: plantLabelFromLocation(e.location),
    }))
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.parse(await request.json());
  let departmentName = body.department ?? null;
  const departmentId = body.departmentId ?? null;

  if (departmentId) {
    const dept = await db.departmentMaster.findFirst({
      where: { id: departmentId, organizationId: user.organizationId },
    });
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
    departmentName = dept.name;
  }

  const employee = await db.employeeMaster.create({
    data: {
      organizationId: user.organizationId,
      name: body.name,
      designation: body.designation ?? null,
      departmentId,
      department: departmentName,
      location: body.location ?? "Bony Polymers",
      doj: body.doj ?? null,
      dob: body.dob ?? null,
      ecn: body.ecn ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      grade: body.grade ?? null,
      lastIncrementPercent: body.lastIncrementPercent ?? null,
      lastCtc: body.lastCtc ?? null,
      lastPromotionDate: body.lastPromotionDate ?? null,
      managerName: body.managerName ?? null,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    },
  });

  const kpiAssign = departmentName
    ? await assignDepartmentKpisToEmployee(user.organizationId, {
        name: employee.name,
        department: departmentName,
        ecn: employee.ecn,
      })
    : { assigned: 0, skipped: 0, kpiNames: [] as string[] };

  return NextResponse.json(
    { ...employee, kpisAssigned: kpiAssign.assigned, kpiNames: kpiAssign.kpiNames },
    { status: 201 }
  );
}
