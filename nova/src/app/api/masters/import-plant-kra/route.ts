import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseKraWorkbook, isValidKraEcn } from "@/lib/masters/kra-workbook";
import { previewKraUpload, parseDepartmentOverrides } from "@/lib/masters/preview-kra-upload";
import { findEmployeeEcnConflicts } from "@/lib/masters/preview-employee-upload";
import { syncKraWorkbook } from "@/lib/masters/sync-kra-workbook";
import { syncPlantKraWorkbook } from "@/lib/masters/sync-plant-kra-workbook";

export const runtime = "nodejs";
export const maxDuration = 120;

function importError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return importError("Forbidden", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return importError("No file uploaded", 400);
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return importError("Upload an Excel file (.xlsx or .xls)", 400);
    }

    const buffer = await file.arrayBuffer();
    const confirmOverwrite = formData.get("confirmOverwrite") === "true";
    const skipDepartmentCheck = formData.get("skipDepartmentCheck") === "true";
    const departmentOverrides = parseDepartmentOverrides(formData.get("departmentOverrides"));
    const plantUnitKey = String(formData.get("plantUnitKey") ?? "").trim() || null;

    const parsed = parseKraWorkbook(buffer, file.name);
    const employeeKra = parsed.employees.length > 0;
    const syncOptions = employeeKra
      ? {
          ...(plantUnitKey
            ? { plantUnitKey, location: plantUnitKey, sourceFileName: file.name }
            : { sourceFileName: file.name }),
          departmentOverrides,
          preParsed: parsed,
        }
      : undefined;

    if (employeeKra && !skipDepartmentCheck && !Object.keys(departmentOverrides).length) {
      const deptPreview = await previewKraUpload(
        db,
        user.organizationId,
        buffer,
        { plantUnitKey, sourceFileName: file.name },
        parsed
      );
      if (deptPreview.needsDepartmentPick) {
        return NextResponse.json(
          {
            needsDepartmentPick: true,
            employees: deptPreview.employees,
            departments: deptPreview.departments,
            error:
              "Choose department for employees without a matching Department Master row.",
          },
          { status: 422 }
        );
      }
    }

    if (employeeKra && !confirmOverwrite) {
      const conflicts = await findEmployeeEcnConflicts(
        db,
        user.organizationId,
        parsed.employees
      );
      if (conflicts.length) {
        const withEcn = parsed.employees.filter((e) => isValidKraEcn(e.ecn));
        const updateCount = conflicts.length;
        const newCount =
          withEcn.length -
          updateCount +
          parsed.employees.filter((e) => !isValidKraEcn(e.ecn)).length;

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

    const result = employeeKra
      ? await syncKraWorkbook(db, user.organizationId, buffer, user.id, syncOptions)
      : await syncPlantKraWorkbook(db, user.organizationId, buffer, user.id);

    const failed = employeeKra
      ? !result.employeeCount && !("kpiCount" in result && result.kpiCount)
      : !("kpiCount" in result && result.kpiCount);

    if (
      failed &&
      result.errors.length &&
      !(employeeKra && "kpisCreated" in result && result.kpisCreated > 0)
    ) {
      return NextResponse.json(
        { error: result.errors.join("; "), ...result },
        { status: 400 }
      );
    }

    const message = employeeKra
      ? `Imported ${result.employeesCreated ?? 0} employees and ${result.kpisCreated ?? 0} KPIs (${result.entriesCreated ?? 0} entries).`
      : `Imported ${result.kpisCreated} new and ${result.kpisUpdated} updated KPIs (${result.entriesCreated} monthly entries).`;

    return NextResponse.json({
      ok: true,
      message,
      ...result,
    });
  } catch (err) {
    console.error("import-plant-kra failed:", err);
    const msg = err instanceof Error ? err.message : "Import failed unexpectedly";
    const isUnique =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002";
    return importError(
      isUnique
        ? "Department or employee already exists with conflicting data. Try again after a minute."
        : msg,
      isUnique ? 409 : 500
    );
  }
}
