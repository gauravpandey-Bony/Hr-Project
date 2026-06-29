"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet } from "lucide-react";
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
import { parseApiJsonResponse } from "@/lib/parse-api-response";

type Step = "file" | "department" | "confirm";
type LoadingPhase = "idle" | "importing";

export function UploadKraWorkbookModal({
  open,
  onClose,
  plantUnitKey,
}: {
  open: boolean;
  onClose: () => void;
  plantUnitKey?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("file");
  const [conflicts, setConflicts] = useState<EmployeeUploadConflict[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [employeeRows, setEmployeeRows] = useState<KraDepartmentPickRow[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentPicks, setDepartmentPicks] = useState<Record<string, string>>({});

  const loading = loadingPhase !== "idle";

  function resetFlow() {
    setStep("file");
    setConflicts([]);
    setNewCount(0);
    setUpdateCount(0);
    setEmployeeRows([]);
    setDepartments([]);
    setDepartmentPicks({});
  }

  function handleClose() {
    resetFlow();
    setFile(null);
    setResult(null);
    setError(null);
    setLoadingPhase("idle");
    onClose();
  }

  function buildFormData(confirmOverwrite: boolean, includeDepartmentOverrides: boolean) {
    const formData = new FormData();
    formData.append("file", file!);
    if (plantUnitKey?.trim()) {
      formData.append("plantUnitKey", plantUnitKey.trim());
    }
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
    setLoadingPhase("importing");
    setError(null);
    if (!confirmOverwrite && step === "file") setResult(null);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);

      const res = await fetch("/api/masters/import-plant-kra", {
        method: "POST",
        body: buildFormData(confirmOverwrite, includeDepartmentOverrides),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = await parseApiJsonResponse(res);

      if (res.status === 422 && data.needsDepartmentPick) {
        setEmployeeRows((data.employees as KraDepartmentPickRow[]) ?? []);
        setDepartments((data.departments as { id: string; name: string }[]) ?? []);
        const initial: Record<string, string> = {};
        for (const row of (data.employees as KraDepartmentPickRow[]) ?? []) {
          if (!row.needsDepartmentPick && row.matchedDepartmentName) {
            initial[row.sheetName] = row.matchedDepartmentName;
          }
        }
        setDepartmentPicks(initial);
        setStep("department");
        return;
      }

      if (res.status === 409 && data.requiresConfirmation) {
        setConflicts((data.conflicts as EmployeeUploadConflict[]) ?? []);
        setNewCount((data.newCount as number) ?? 0);
        setUpdateCount((data.updateCount as number) ?? 0);
        setStep("confirm");
        return;
      }

      if (res.ok) {
        const msg =
          (data.message as string) ??
          `Imported ${(data.kpisCreated as number) ?? 0} KPIs with ${(data.entriesCreated as number) ?? 0} entries.`;
        setResult(msg);
        resetFlow();
        setStep("file");
        toast.success(msg);
        router.refresh();
      } else {
        const errMsg = (data.error as string) ?? "Upload failed";
        setError(errMsg);
        toast.error(errMsg);
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "Import timed out after 2 minutes — file may be too large."
          : e instanceof Error
            ? e.message
            : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingPhase("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload KRA / KPI Excel
          </DialogTitle>
          <DialogDescription>
            Upload an employee KRA workbook (<strong>.xlsx</strong> / <strong>.xls</strong>).
            When a department matches Department Master, employees are assigned automatically;
            otherwise choose a department from the dropdown.
          </DialogDescription>
        </DialogHeader>

        {step === "confirm" ? (
          <EmployeeUploadConfirm
            conflicts={conflicts}
            newCount={newCount}
            updateCount={updateCount}
            loading={loading}
            onCancel={() =>
              setStep(employeeRows.some((e) => e.needsDepartmentPick) ? "department" : "file")
            }
            onConfirm={() => runImport(true, Object.keys(departmentPicks).length > 0)}
          />
        ) : step === "department" ? (
          <KraDepartmentPick
            employees={employeeRows}
            departments={departments}
            picks={departmentPicks}
            onPick={(sheetName, departmentName) =>
              setDepartmentPicks((prev) => ({ ...prev, [sheetName]: departmentName }))
            }
            loading={loading}
            onBack={() => {
              setStep("file");
              setError(null);
            }}
            onContinue={() => runImport(false, true)}
          />
        ) : (
          <>
            <div className="space-y-4">
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-input bg-muted/30 p-8 text-center transition hover:border-primary/50"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  {file ? file.name : "Choose Excel file (.xlsx / .xls)"}
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    resetFlow();
                    setError(null);
                    setResult(null);
                  }}
                />
              </div>

              {loading && (
                <p className="text-center text-sm text-muted-foreground">
                  Importing employees & KPIs — please wait…
                </p>
              )}

              {result && (
                <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {result}
                </p>
              )}
              {error && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => runImport(false)}
                disabled={!file || loading}
              >
                {loading ? "Importing…" : "Import Excel"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
