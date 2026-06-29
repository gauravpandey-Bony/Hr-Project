import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseUploadFile, type EmployeeImportRow } from "@/lib/masters/import";
import { normalizeRosterDepartment, ROSTER_DEPARTMENTS } from "@/lib/masters/37p-roster";
import {
  dedupeDepartmentMasters,
  findExistingDepartmentMaster,
  normalizeDepartmentMasterName,
  upsertDepartmentMaster,
} from "@/lib/masters/department-master-sync";
import { isKraEmployeeWorkbook } from "@/lib/masters/kra-workbook";
import {
  previewEmployeeRowsUpload,
  previewKraWorkbookUpload,
} from "@/lib/masters/preview-employee-upload";
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
  const confirmOverwrite = formData.get("confirmOverwrite") === "true";

  if (isKraEmployeeWorkbook(buffer)) {
    if (!confirmOverwrite) {
      const preview = await previewKraWorkbookUpload(
        db,
        user.organizationId,
        buffer,
        file.name
      );
      if (preview.requiresConfirmation) {
        return NextResponse.json(
          {
            ...preview,
            error: "Existing Employee ID (ECN) found. Confirm before updating.",
            requiresConfirmation: true,
          },
          { status: 409 }
        );
      }
    }

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
  const { rows: parsedRows, errors } = await parseUploadFile(clone, "employees");
  const rows = parsedRows as EmployeeImportRow[];
  if (!confirmOverwrite) {
    const preview = await previewEmployeeRowsUpload(db, user.organizationId, rows);
    if (preview.requiresConfirmation) {
      return NextResponse.json(
        {
          ...preview,
          parseErrors: errors,
          error: "Existing Employee ID (ECN) found. Confirm before updating.",
          requiresConfirmation: true,
        },
        { status: 409 }
      );
    }
  }

  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors: errors },
      { status: 400 }
    );
  }

  const depts = await db.departmentMaster.findMany({
    where: { organizationId: user.organizationId, isActive: true },
  });
  const deptByName = new Map(
    depts.map((d) => [normalizeDepartmentMasterName(d.name).toLowerCase(), d.id])
  );

  for (const d of ROSTER_DEPARTMENTS) {
    const key = normalizeDepartmentMasterName(d.name).toLowerCase();
    if (!deptByName.has(key)) {
      const { department } = await upsertDepartmentMaster(db, user.organizationId, {
        name: d.name,
        location: d.location ?? "Bony Polymers 37-P",
        plantUnitKey: "Bony 37P",
        kraSheetId: d.kraSheetId ?? null,
        sortOrder: d.sortOrder ?? 0,
        isActive: true,
      });
      deptByName.set(key, department.id);
    }
  }

  await dedupeDepartmentMasters(db, user.organizationId, "Bony 37P");

  let created = 0;
  let updated = 0;
  let kpisAssigned = 0;

  for (const row of rows) {
    const deptName = normalizeDepartment(row.department);
    const departmentId =
      deptByName.get(deptName.toLowerCase()) ??
      deptByName.get(normalizeDepartmentMasterName(row.department).toLowerCase()) ??
      (
        await findExistingDepartmentMaster(
          db,
          user.organizationId,
          deptName,
          row.location
        )
      )?.id ??
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
