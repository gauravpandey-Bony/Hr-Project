"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { downloadFromApi } from "@/lib/download-from-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmployeeUploadConfirm } from "@/components/masters/employee-upload-confirm";
import {
  KraDepartmentPick,
  type KraDepartmentPickRow,
} from "@/components/kra/kra-department-pick";
import type { EmployeeUploadConflict } from "@/lib/masters/preview-employee-upload";

const DEPARTMENT_TEMPLATE = {
  filename: "department-master-template.csv",
  csv: `department,head,location,sort_order,active
IT,,Bony Polymers,7,true
Production,,Bony Polymers,2,true`,
  hint: "Columns: department (required), head, location, sort_order, active",
};

const EMPLOYEE_TEMPLATE = {
  filename: "employee-master-template.csv",
  csv: `name,designation,department,location,doj,ecn,manager,sort_order,active
John Doe,Manager,IT,Bony Polymers,2024-01-15,12345,Jane Smith,1,true`,
  hint: "CSV columns: name, designation, department (required), location, doj, ecn, manager, sort_order, active. For KRA workbooks (.xlsx / .xls), departments auto-match when possible.",
};

type EmployeeStep = "file" | "department" | "confirm";

export function UploadMasterModal({
  open,
  onClose,
  type = "departments",
  unitId,
}: {
  open: boolean;
  onClose: () => void;
  type?: "departments" | "employees";
  unitId?: string | null;
}) {
  const isEmployees = type === "employees";
  const template = isEmployees ? EMPLOYEE_TEMPLATE : DEPARTMENT_TEMPLATE;
  const uploadUrl = isEmployees ? "/api/employees/upload" : "/api/departments/upload";
  const exportUrl = isEmployees ? "/api/employees/export" : "/api/departments/export";
  const exportFilename = isEmployees ? "employee-master.xlsx" : "department-master.xlsx";

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeStep, setEmployeeStep] = useState<EmployeeStep>("file");
  const [conflicts, setConflicts] = useState<EmployeeUploadConflict[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [employeeRows, setEmployeeRows] = useState<KraDepartmentPickRow[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentPicks, setDepartmentPicks] = useState<Record<string, string>>({});

  function resetEmployeeFlow() {
    setEmployeeStep("file");
    setConflicts([]);
    setNewCount(0);
    setUpdateCount(0);
    setEmployeeRows([]);
    setDepartments([]);
    setDepartmentPicks({});
  }

  function handleClose() {
    resetEmployeeFlow();
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  }

  function buildFormData(confirmOverwrite: boolean, includeDepartmentOverrides: boolean) {
    const formData = new FormData();
    formData.append("file", file!);
    if (confirmOverwrite) {
      formData.append("confirmOverwrite", "true");
    }
    if (includeDepartmentOverrides && Object.keys(departmentPicks).length) {
      formData.append("departmentOverrides", JSON.stringify(departmentPicks));
      formData.append("skipDepartmentCheck", "true");
    }
    return formData;
  }

  async function runImport(confirmOverwrite: boolean, includeDepartmentOverrides = false) {
    if (!file) return;
    setLoading(true);
    setError(null);
    if (!confirmOverwrite && employeeStep === "file") setResult(null);

    const res = await fetch(uploadUrl, {
      method: "POST",
      body: buildFormData(confirmOverwrite, includeDepartmentOverrides),
    });
    const data = await res.json();
    setLoading(false);

    if (isEmployees && res.status === 422 && data.needsDepartmentPick) {
      setEmployeeRows((data.employees as KraDepartmentPickRow[]) ?? []);
      setDepartments((data.departments as { id: string; name: string }[]) ?? []);
      const initial: Record<string, string> = {};
      for (const row of (data.employees as KraDepartmentPickRow[]) ?? []) {
        if (!row.needsDepartmentPick && row.matchedDepartmentName) {
          initial[row.sheetName] = row.matchedDepartmentName;
        }
      }
      setDepartmentPicks(initial);
      setEmployeeStep("department");
      return;
    }

    if (isEmployees && res.status === 409 && data.requiresConfirmation) {
      setConflicts(data.conflicts ?? []);
      setNewCount(data.newCount ?? 0);
      setUpdateCount(data.updateCount ?? 0);
      setEmployeeStep("confirm");
      return;
    }

    if (res.ok) {
      const msg = isEmployees
        ? (data.message ??
          `Imported ${data.created ?? 0} new, ${data.updated ?? 0} updated (${data.rowsProcessed ?? 0} rows).`)
        : `Imported ${data.created} new, ${data.updated} updated (${data.rowsProcessed} rows).`;
      setResult(msg);
      resetEmployeeFlow();
      toast.success(msg);
      router.refresh();
    } else {
      const errMsg = data.error ?? "Upload failed";
      setError(
        data.parseErrors?.length ? `${errMsg}. ${data.parseErrors.join("; ")}` : errMsg
      );
      toast.error(errMsg);
    }
  }

  async function downloadCurrentData() {
    setExporting(true);
    setError(null);
    try {
      const qs = unitId ? `?unit=${encodeURIComponent(unitId)}` : "";
      await downloadFromApi(`${exportUrl}${qs}`, exportFilename);
      toast.success("Current data downloaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([template.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = template.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const confirming = isEmployees && employeeStep === "confirm";
  const pickingDepartment = isEmployees && employeeStep === "department";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {isEmployees ? "Upload Employee Master" : "Upload Department Master"}
          </DialogTitle>
          <DialogDescription>
            {isEmployees ? (
              <>
                Upload <strong>CSV</strong> or an employee KRA workbook (<strong>.xlsx</strong> /{" "}
                <strong>.xls</strong>). When a department matches Department Master, employees are
                assigned automatically; otherwise choose a department from the dropdown.{" "}
                {template.hint}
              </>
            ) : (
              <>
                Upload <strong>CSV</strong> or <strong>Excel (.xlsx)</strong>. {template.hint}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <EmployeeUploadConfirm
            conflicts={conflicts}
            newCount={newCount}
            updateCount={updateCount}
            loading={loading}
            onCancel={() =>
              setEmployeeStep(
                employeeRows.some((e) => e.needsDepartmentPick) ? "department" : "file"
              )
            }
            onConfirm={() => runImport(true, Object.keys(departmentPicks).length > 0)}
          />
        ) : pickingDepartment ? (
          <KraDepartmentPick
            employees={employeeRows}
            departments={departments}
            picks={departmentPicks}
            onPick={(sheetName, departmentName) =>
              setDepartmentPicks((prev) => ({ ...prev, [sheetName]: departmentName }))
            }
            loading={loading}
            onBack={() => {
              setEmployeeStep("file");
              setError(null);
            }}
            onContinue={() => runImport(false, true)}
          />
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={downloadTemplate}
                >
                  <Download className="h-4 w-4" />
                  Download CSV template
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={downloadCurrentData}
                  disabled={exporting}
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "Downloading…" : "Download current data"}
                </Button>
              </div>

              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-input bg-muted/30 p-8 text-center transition hover:border-primary/50"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  {file ? file.name : "Choose CSV or Excel file (.xlsx / .xls)"}
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    resetEmployeeFlow();
                    setError(null);
                    setResult(null);
                  }}
                />
              </div>

              {result && (
                <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {result}
                </p>
              )}
              {error && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" onClick={() => runImport(false)} disabled={!file || loading}>
                {loading ? (isEmployees ? "Checking…" : "Importing…") : "Import"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
