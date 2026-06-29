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

export function UploadKraWorkbookModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/masters/import-plant-kra", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      const msg =
        data.message ??
        `Imported ${data.kpisCreated ?? 0} KPIs with ${data.entriesCreated ?? 0} entries.`;
      setResult(msg);
      toast.success(msg);
      router.refresh();
    } else {
      const errMsg = data.error ?? "Upload failed";
      setError(errMsg);
      toast.error(errMsg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload KRA / KPI Excel
          </DialogTitle>
          <DialogDescription>
            Upload the plant KRA workbook (<strong>.xlsx</strong> or{" "}
            <strong>.xls</strong>). Department sheets (Production, QA, Store, Billing,
            IT, etc.) are imported automatically.
          </DialogDescription>
        </DialogHeader>

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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={upload} disabled={!file || loading}>
            {loading ? "Importing…" : "Import Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
