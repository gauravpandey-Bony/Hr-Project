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

export function UploadSpreadsheetModal({
  open,
  onClose,
  unitId,
  category,
  query,
}: {
  open: boolean;
  onClose: () => void;
  unitId?: string;
  category?: string;
  query?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const isExcel = /\.xlsx?$/i.test(file.name);
    const endpoint = isExcel ? "/api/masters/import-plant-kra" : "/api/kpis/upload";

    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      const msg = isExcel
        ? (data.message ??
          `Imported ${data.kpisCreated ?? 0} KPIs with ${data.entriesCreated ?? 0} entries.`)
        : `Imported ${data.kpisCreated} new KPI(s) and ${data.entriesCreated} data entries from ${data.rowsProcessed} rows.`;
      setResult(msg);
      toast.success(msg);
      router.refresh();
    } else {
      const errMsg = data.error ?? "Upload failed";
      setError(errMsg);
      toast.error(errMsg);
      if (data.parseErrors?.length) {
        setError(`${data.error}. ${data.parseErrors.join("; ")}`);
      }
    }
  }

  async function downloadCurrentData() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (unitId) params.set("unit", unitId);
      if (category && category !== "all") params.set("category", category);
      if (query) params.set("q", query);
      const qs = params.toString();
      await downloadFromApi(`/api/kpis/export${qs ? `?${qs}` : ""}`, "kpi-data.csv");
      toast.success("Current KPI data downloaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  function downloadTemplate() {
    const csv = `name,description,category,unit,target,direction,frequency,department,value,date
On-Time Delivery,Orders delivered on time,Sales,%,98,Higher,Monthly,Logistics,94,2026-06-01
Defect Rate,Quality defect percentage,Quality,%,1.2,Lower,Weekly,QA,1.4,2026-06-01
Production Output,MT produced,Production,MT,3000,Higher,Monthly,Production,2840,2026-06-01`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bony-polymers-kpi-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload a Spreadsheet
          </DialogTitle>
          <DialogDescription>
            Upload <strong>Excel (.xlsx)</strong> KRA workbook or a <strong>CSV</strong> file for
            simple KPI rows. Excel imports all department sheets; CSV creates KPIs row by row.
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
              Download sample template
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
            <Upload className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              {file ? file.name : "Choose Excel (.xlsx) or CSV file"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {result && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{result}</p>
          )}
          {error && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={upload} disabled={!file || loading}>
            {loading ? "Uploading…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
