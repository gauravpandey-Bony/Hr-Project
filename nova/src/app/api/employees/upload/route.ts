import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseUploadFile } from "@/lib/masters/import";
import { normalizeRosterDepartment, ROSTER_DEPARTMENTS } from "@/lib/masters/37p-roster";
import { isKraEmployeeWorkbook } from "@/lib/masters/kra-workbook";
import { syncKraWorkbook } from "@/lib/masters/sync-kra-workbook";
import { assignDepartmentKpisToEmployee } from "@/lib/kpi/assign-department-kpis";

function normalizeDepartment(name: string) {
  return normalizeRosterDepartment(name).masterName;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  if (isKraEmployeeWorkbook(buffer)) {
    const result = await syncKraWorkbook(
      db,
      user.organizationId,
      buffer,
      user.id
    );
    if (
      result.errors.length &&
      result.employeesCreated === 0 &&
      result.employeesUpdated === 0
    ) {
      return NextResponse.json(
        { error: result.errors.join("; "), parseErrors: result.parseErrors },
        { status: 400 }
      );
    }
    return NextResponse.json({
      created: result.employeesCreated,
      updated: result.employeesUpdated,
      rowsProcessed: result.employeesCreated + result.employeesUpdated,
      kpisCreated: result.kpisCreated,
      kpisUpdated: result.kpisUpdated,
      parseErrors: result.parseErrors,
      message: "KRA workbook imported with employee details and individual KPIs.",
    });
  }

  const blob = new Blob([buffer]);
  const clone = new File([blob], file.name, { type: file.type });
  const { rows, errors } = await parseUploadFile(clone, "employees");
  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  const depts = await db.departmentMaster.findMany({
    where: { organizationId: user.organizationId },
  });
  const deptByName = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));

  for (const d of ROSTER_DEPARTMENTS) {
    if (!deptByName.has(d.name.toLowerCase())) {
      const created = await db.departmentMaster.create({
        data: {
          organizationId: user.organizationId,
          name: d.name,
          location: d.location ?? "Bony Polymers 37-P",
          kraSheetId: d.kraSheetId ?? null,
          sortOrder: d.sortOrder ?? 0,
          isActive: true,
        },
      });
      deptByName.set(d.name.toLowerCase(), created.id);
    }
  }

  let created = 0;
  let updated = 0;
  let kpisAssigned = 0;

  for (const row of rows) {
    const deptName = normalizeDepartment(row.department);
    const departmentId =
      deptByName.get(deptName.toLowerCase()) ??
      deptByName.get(row.department.toLowerCase()) ??
      null;

    const existing = row.ecn
      ? await db.employeeMaster.findFirst({
          where: { organizationId: user.organizationId, ecn: row.ecn },
        })
      : await db.employeeMaster.findFirst({
          where: {
            organizationId: user.organizationId,
            name: row.name!,
          },
        });

    const data = {
      name: row.name!,
      designation: row.designation ?? null,
      departmentId,
      department: deptName,
      location: row.location?.trim() || null,
      doj: row.doj ?? null,
      ecn: row.ecn ?? null,
      managerName: row.managerName ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: row.isActive ?? true,
    };

    let record;
    if (existing) {
      const deptChanged = data.department && data.department !== existing.department;
      record = await db.employeeMaster.update({ where: { id: existing.id }, data });
      updated++;
      if (deptChanged && data.department) {
        const r = await assignDepartmentKpisToEmployee(user.organizationId, {
          name: record.name,
          department: data.department,
          ecn: record.ecn,
        });
        kpisAssigned += r.assigned;
      }
    } else {
      record = await db.employeeMaster.create({
        data: { organizationId: user.organizationId, ...data },
      });
      created++;
      if (data.department) {
        const r = await assignDepartmentKpisToEmployee(user.organizationId, {
          name: record.name,
          department: data.department,
          ecn: record.ecn,
        });
        kpisAssigned += r.assigned;
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    kpisAssigned,
    rowsProcessed: rows.length,
    parseErrors: errors,
  });
}
