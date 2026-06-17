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

type MasterType = "departments" | "employees";

const TEMPLATES: Record<
  MasterType,
  { filename: string; csv: string; hint: string }
> = {
  departments: {
    filename: "department-master-template.csv",
    csv: `department,head,location,kra_sheet_id,sort_order,active
IT,,Bony Polymers,it,7,true
Production,,Bony Polymers,production,2,true`,
    hint: "Columns: department (required), head, location, kra_sheet_id, sort_order, active",
  },
  employees: {
    filename: "employee-master-template.csv",
    csv: `designation,department,location,doj,ecn,manager,sort_order,active
Sr. Manager,IT,Bony Polymers,01.01.2020,,,1,true
Sr. Engr-IT,IT,Plant SF1,15.06.2019,ECN-1001,,2,true`,
    hint: "Upload 37P roster .xlsx OR New KRA KPI workbook (one sheet per employee + KPIs).",
  },
};

export function UploadMasterModal({
  open,
  onClose,
  type,
  unitId,
}: {
  open: boolean;
  onClose: () => void;
  type: MasterType;
  unitId?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = type === "departments" ? "Upload Department Master" : "Upload Employee Master";
  const api = type === "departments" ? "/api/departments/upload" : "/api/employees/upload";
  const tpl = TEMPLATES[type];

  async function upload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(api, { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      const msg = `Imported ${data.created} new, ${data.updated} updated (${data.rowsProcessed} rows).`;
      setResult(msg);
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

  const exportBase =
    type === "departments" ? "/api/departments/export" : "/api/employees/export";
  const exportFallback =
    type === "departments" ? "department-master.xlsx" : "employee-master.xlsx";

  async function downloadCurrentData() {
    setExporting(true);
    setError(null);
    try {
      const qs = unitId ? `?unit=${encodeURIComponent(unitId)}` : "";
      await downloadFromApi(`${exportBase}${qs}`, exportFallback);
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
    const blob = new Blob([tpl.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tpl.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Upload <strong>CSV</strong> or <strong>Excel (.xlsx)</strong>. {tpl.hint}
          </DialogDescription>
        </DialogHeader>

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
              {file ? file.name : "Choose CSV or Excel file"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={upload} disabled={!file || loading}>
            {loading ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
