"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmployeeUploadConflict } from "@/lib/masters/preview-employee-upload";

export function EmployeeUploadConfirm({
  conflicts,
  newCount,
  updateCount,
  loading,
  onCancel,
  onConfirm,
}: {
  conflicts: EmployeeUploadConflict[];
  newCount: number;
  updateCount: number;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Same Employee ID (ECN) already exists
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
            . Please verify before continuing.
          </p>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-input">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">ECN</th>
              <th className="px-3 py-2">In file</th>
              <th className="px-3 py-2">In system</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c) => (
              <tr key={c.ecn} className="border-t border-input/60">
                <td className="px-3 py-2 font-mono text-xs">{c.ecn}</td>
                <td className="px-3 py-2">{c.nameInFile}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {c.existingName}
                  {c.existingDepartment ? ` · ${c.existingDepartment}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
