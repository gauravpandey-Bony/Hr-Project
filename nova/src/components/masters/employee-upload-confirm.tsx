"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  EmployeeUploadConflict,
  EmployeeUploadDuplicateInFile,
} from "@/lib/masters/preview-employee-upload";

export function EmployeeUploadConfirm({
  conflicts,
  duplicatesInFile = [],
  plantSummary = {},
  newCount,
  updateCount,
  loading,
  onCancel,
  onConfirm,
}: {
  conflicts: EmployeeUploadConflict[];
  duplicatesInFile?: EmployeeUploadDuplicateInFile[];
  plantSummary?: Record<string, number>;
  newCount: number;
  updateCount: number;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasFileDupes = duplicatesInFile.length > 0;
  const hasDbConflicts = conflicts.length > 0;
  const plantLines = Object.entries(plantSummary).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {plantLines.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          <p className="mb-2 font-semibold text-emerald-900 dark:text-emerald-100">
            Plant assignment (from Working Location)
          </p>
          <div className="flex flex-wrap gap-2">
            {plantLines.map(([plant, count]) => (
              <span
                key={plant}
                className="rounded-full border border-emerald-600/30 bg-background px-3 py-1 text-xs font-medium"
              >
                {plant}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasFileDupes && (
        <div className="flex gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-rose-900 dark:text-rose-100">
              Duplicate Employee ID in file
            </p>
            <p className="text-rose-800/90 dark:text-rose-200/90">
              Same CODE appears more than once — fix the Excel file or confirm to continue.
            </p>
          </div>
        </div>
      )}

      {hasDbConflicts && (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              Same Employee ID (ECN) already exists in system
            </p>
            <p className="text-amber-800/90 dark:text-amber-200/90">
              {updateCount} employee{updateCount === 1 ? "" : "s"} will be{" "}
              <strong>updated</strong>
              {newCount > 0 ? (
                <>
                  {" "}
                  and {newCount} new will be <strong>created</strong>
                </>
              ) : null}
              . Highlighted rows below.
            </p>
          </div>
        </div>
      )}

      {hasFileDupes && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-rose-300">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-rose-100/90 text-xs uppercase text-rose-900 dark:bg-rose-950/90 dark:text-rose-200">
              <tr>
                <th className="px-3 py-2">ECN (duplicate)</th>
                <th className="px-3 py-2">Names in file</th>
              </tr>
            </thead>
            <tbody>
              {duplicatesInFile.map((d) => (
                <tr key={d.ecn} className="border-t border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
                  <td className="px-3 py-2 font-mono text-xs text-rose-700">{d.ecn}</td>
                  <td className="px-3 py-2 text-rose-800">{d.names.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasDbConflicts && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-input">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ECN</th>
                <th className="px-3 py-2">In file</th>
                <th className="px-3 py-2">Plant</th>
                <th className="px-3 py-2">In system</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c) => (
                <tr
                  key={c.ecn}
                  className="border-t border-input/60 bg-amber-50/60 dark:bg-amber-950/20"
                >
                  <td className="px-3 py-2 font-mono text-xs">{c.ecn}</td>
                  <td className="px-3 py-2">{c.nameInFile}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.plantUnitKey ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.existingName}
                    {c.existingDepartment ? ` · ${c.existingDepartment}` : ""}
                    {c.existingLocation ? ` · ${c.existingLocation}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel upload
        </Button>
        <Button type="button" onClick={onConfirm} disabled={loading}>
          {loading ? "Importing…" : "Yes, update & import"}
        </Button>
      </div>
    </div>
  );
}
