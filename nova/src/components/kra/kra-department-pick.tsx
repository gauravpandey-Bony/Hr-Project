"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type KraDepartmentPickRow = {
  sheetName: string;
  name: string;
  detectedDepartment: string | null;
  detectedDepartmentRaw: string | null;
  matchedDepartmentId: string | null;
  matchedDepartmentName: string | null;
  needsDepartmentPick: boolean;
};

export function KraDepartmentPick({
  employees,
  departments,
  picks,
  onPick,
  loading,
  onBack,
  onContinue,
}: {
  employees: KraDepartmentPickRow[];
  departments: { id: string; name: string }[];
  picks: Record<string, string>;
  onPick: (sheetName: string, departmentName: string) => void;
  loading?: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const missing = employees.filter(
    (e) => e.needsDepartmentPick && !picks[e.sheetName]?.trim()
  );
  const autoMatched = employees.filter((e) => !e.needsDepartmentPick);

  return (
    <div className="space-y-4">
      {autoMatched.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="font-medium">
            {autoMatched.length} employee{autoMatched.length === 1 ? "" : "s"} — department
            auto-matched
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {autoMatched.slice(0, 5).map((e) => (
              <li key={e.sheetName}>
                {e.name} → <strong>{e.matchedDepartmentName ?? e.detectedDepartment}</strong>
              </li>
            ))}
            {autoMatched.length > 5 && (
              <li className="text-muted-foreground">+{autoMatched.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {employees.some((e) => e.needsDepartmentPick) && (
        <>
          <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Choose department for unmatched employees
              </p>
              <p className="text-amber-800/90 dark:text-amber-200/90">
                No matching department found in Department Master — select the correct department
                below.
              </p>
            </div>
          </div>

          <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
            {employees
              .filter((e) => e.needsDepartmentPick)
              .map((emp) => (
                <div
                  key={emp.sheetName}
                  className="rounded-lg border border-input bg-muted/20 p-3"
                >
                  <div className="mb-2">
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Excel: {emp.detectedDepartmentRaw ?? emp.detectedDepartment ?? "—"}
                    </p>
                  </div>
                  <Label className="sr-only">Department for {emp.name}</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={picks[emp.sheetName] ?? ""}
                    onChange={(e) => onPick(emp.sheetName, e.target.value)}
                  >
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={loading || missing.length > 0}
        >
          {loading ? "Importing…" : "Continue import"}
        </Button>
      </div>
    </div>
  );
}
