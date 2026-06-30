import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseUploadFile, type EmployeeImportRow } from "@/lib/masters/import";
import { ROSTER_DEPARTMENTS } from "@/lib/masters/37p-roster";
import {
  dedupeDepartmentMasters,
  findExistingDepartmentMaster,
  normalizeDepartmentMasterName,
  reconcileDepartmentAssignmentsForAllPlants,
  upsertDepartmentMaster,
} from "@/lib/masters/department-master-sync";
import { isKraEmployeeWorkbook, parseKraWorkbook } from "@/lib/masters/kra-workbook";
import {
  previewEmployeeRowsUpload,
  findEmployeeEcnConflicts,
} from "@/lib/masters/preview-employee-upload";
import {
  previewKraUpload,
  parseDepartmentOverrides,
} from "@/lib/masters/preview-kra-upload";
import { syncKraWorkbook } from "@/lib/masters/sync-kra-workbook";
import { resolvePlantFromWorkingLocation, summarizePlantAssignments } from "@/lib/masters/employee-plant-location";
import { assignDepartmentKpisToEmployee } from "@/lib/kpi/assign-department-kpis";
import { prepareStaffDetailsRows } from "@/lib/masters/staff-details-import";
import { isStaffDetailsBuffer } from "@/lib/masters/staff-details-roster";
import { listPlantUnitScopes } from "@/lib/masters/plant-unit-scopes";

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
  const skipDepartmentCheck = formData.get("skipDepartmentCheck") === "true";
  const departmentOverrides = parseDepartmentOverrides(formData.get("departmentOverrides"));

  if (isKraEmployeeWorkbook(buffer)) {
    const parsed = parseKraWorkbook(buffer, file.name);
    const syncOptions = {
      sourceFileName: file.name,
      departmentOverrides,
      preParsed: parsed,
    };

    if (!skipDepartmentCheck && !Object.keys(departmentOverrides).length) {
      const deptPreview = await previewKraUpload(
        db,
        user.organizationId,
        buffer,
        { sourceFileName: file.name },
        parsed
      );
      if (deptPreview.needsDepartmentPick) {
        return NextResponse.json(
          {
            ...deptPreview,
            error: "Choose department for employees without a matching Department Master row.",
            needsDepartmentPick: true,
          },
          { status: 422 }
        );
      }
    }

    if (!confirmOverwrite) {
      const employeesForConflict = parsed.employees
        .filter((e) => e.name?.trim())
        .map((e) => ({ ecn: e.ecn, name: e.name!.trim() }));
      const conflicts = await findEmployeeEcnConflicts(
        db,
        user.organizationId,
        employeesForConflict
      );
      if (conflicts.length) {
        const withEcn = parsed.employees.filter((e) => e.ecn);
        const updateCount = conflicts.length;
        const newCount =
          withEcn.length -
          updateCount +
          parsed.employees.filter((e) => !e.ecn).length;

        return NextResponse.json(
          {
            conflicts,
            newCount,
            updateCount,
            requiresConfirmation: true,
            error: "Existing Employee ID (ECN) found. Confirm before updating.",
          },
          { status: 409 }
        );
      }
    }

    const result = await syncKraWorkbook(
      db,
      user.organizationId,
      buffer,
      user.id,
      syncOptions
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
  let rows = parsedRows as EmployeeImportRow[];
  rows = await prepareStaffDetailsRows(db, user.organizationId, buffer, rows);
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

  /** Plant-scoped cache: `${deptName}::${location}` → department id */
  const deptByPlantKey = new Map<string, string>();

  for (const d of ROSTER_DEPARTMENTS) {
    const location = d.location ?? "Bony Polymers 37-P";
    const rosterKey = `${normalizeDepartmentMasterName(d.name)}::${location}`;
    if (deptByPlantKey.has(rosterKey)) continue;
    const { department } = await upsertDepartmentMaster(db, user.organizationId, {
      name: d.name,
      location,
      plantUnitKey: "Bony Polymers",
      kraSheetId: d.kraSheetId ?? null,
      sortOrder: d.sortOrder ?? 0,
      isActive: true,
    });
    deptByPlantKey.set(rosterKey, department.id);
  }

  for (const unit of listPlantUnitScopes()) {
    await dedupeDepartmentMasters(db, user.organizationId, unit.plantUnitKey);
  }

  let created = 0;
  let updated = 0;
  let kpisAssigned = 0;

  for (const row of rows) {
    const deptName = normalizeDepartmentMasterName(row.department);
    const plantAssignment = resolvePlantFromWorkingLocation(
      row.location ?? row.rawLocation
    );
    const plantUnitKey = row.plantUnitKey ?? plantAssignment.plantUnitKey;
    const location = row.location ?? plantAssignment.location;

    const deptKey = `${deptName}::${location}`;
    let departmentId = deptByPlantKey.get(deptKey);

    if (!departmentId) {
      const existing = await findExistingDepartmentMaster(
        db,
        user.organizationId,
        deptName,
        location,
        plantUnitKey
      );
      departmentId = existing?.id;
    }

    if (!departmentId) {
      const { department } = await upsertDepartmentMaster(db, user.organizationId, {
        name: deptName,
        location,
        plantUnitKey,
        isActive: true,
      });
      departmentId = department.id;
    }

    deptByPlantKey.set(deptKey, departmentId);

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
      location,
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

  if (isStaffDetailsBuffer(buffer)) {
    await reconcileDepartmentAssignmentsForAllPlants(
      db,
      user.organizationId,
      listPlantUnitScopes()
    );
  }

  return NextResponse.json({
    created,
    updated,
    kpisAssigned,
    rowsProcessed: rows.length,
    plantSummary: summarizePlantAssignments(rows),
    parseErrors: errors,
  });
}
