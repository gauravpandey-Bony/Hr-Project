"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2, Building2, Upload, Download } from "lucide-react";
import { UploadMasterModal } from "./upload-master-modal";
import { COMPANY } from "@/lib/company";
import { downloadFromApi } from "@/lib/download-from-api";
import { KRA_SHEETS } from "@/lib/plant-37p";
import { StickyTableShell } from "@/components/ui/sticky-table-shell";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DepartmentMaster } from "@prisma/client";
import {
  masterCellInput,
  MASTER_TABLE_CLASS,
  MASTER_CELL,
} from "./masters-table-styles";

type DeptRow = DepartmentMaster & { _count?: { employees: number } };

type Draft = {
  name: string;
  headName: string;
  location: string;
  kraSheetId: string;
  sortOrder: string;
  isActive: boolean;
};

function toDraft(d: DeptRow): Draft {
  return {
    name: d.name,
    headName: d.headName ?? "",
    location: d.location ?? "Bony Polymers",
    kraSheetId: d.kraSheetId ?? "",
    sortOrder: String(d.sortOrder),
    isActive: d.isActive,
  };
}

export function DepartmentMasterClient({
  initialRows,
  isAdmin,
  unitId,
}: {
  initialRows: DeptRow[];
  isAdmin: boolean;
  unitId?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.id, toDraft(r)]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadSheet() {
    setDownloading(true);
    setError(null);
    try {
      const qs = unitId ? `?unit=${encodeURIComponent(unitId)}` : "";
      await downloadFromApi(`/api/departments/export${qs}`, "department-master.xlsx");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    setRows(initialRows);
    setDrafts(Object.fromEntries(initialRows.map((r) => [r.id, toDraft(r)])));
  }, [initialRows]);

  function patch(id: string, p: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  async function save(id: string) {
    const d = drafts[id];
    if (!d?.name.trim()) {
      setError("Department name is required");
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name.trim(),
          headName: d.headName || null,
          location: d.location || "Bony Polymers",
          kraSheetId: d.kraSheetId || null,
          sortOrder: parseInt(d.sortOrder, 10) || 0,
          isActive: d.isActive,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove department "${name}"?`)) return;
    const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  async function addRow() {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Department",
          sortOrder: rows.length + 1,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Add failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-8 text-white shadow-xl sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium">
              <Building2 className="h-3.5 w-3.5 text-emerald-300" />
              {COMPANY.shortName}
            </div>
            <h1 className="text-3xl font-bold">Department Master</h1>
            <p className="mt-1 text-sm text-slate-300">
              Plant departments linked to KRA sheets — {rows.length} records
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadSheet}
              disabled={downloading || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500/30 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Sheet
            </button>
            {isAdmin && (
              <>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                <Upload className="h-4 w-4" />
                Upload Excel
              </button>
              <button
                type="button"
                onClick={addRow}
                disabled={adding}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add department
              </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <StickyTableShell maxHeight="min(75vh, 900px)">
        <table className={MASTER_TABLE_CLASS}>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 shrink-0">#</TableHead>
              {isAdmin && <TableHead className="w-[72px] shrink-0">Actions</TableHead>}
              <TableHead className="min-w-[200px]">Department</TableHead>
              <TableHead className="min-w-[160px]">Head</TableHead>
              <TableHead className="min-w-[180px]">Location</TableHead>
              <TableHead className="min-w-[200px]">KRA sheet</TableHead>
              <TableHead className="min-w-[64px]">Order</TableHead>
              <TableHead className="min-w-[72px]">Staff</TableHead>
              <TableHead className="min-w-[56px]">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const d = drafts[row.id] ?? toDraft(row);
              return (
                <TableRow key={row.id}>
                  <TableCell className={`${MASTER_CELL} text-muted-foreground`}>{idx + 1}</TableCell>
                  {isAdmin && (
                    <TableCell className={MASTER_CELL}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => save(row.id)}
                          disabled={savingId === row.id}
                          className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                          title="Save"
                        >
                          {savingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row.id, d.name)}
                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className={MASTER_CELL}>
                    {isAdmin ? (
                      <input
                        className={masterCellInput("min-w-[180px]")}
                        value={d.name}
                        onChange={(e) => patch(row.id, { name: e.target.value })}
                      />
                    ) : (
                      <span className="block font-medium leading-snug">{row.name}</span>
                    )}
                  </TableCell>
                  <TableCell className={MASTER_CELL}>
                    {isAdmin ? (
                      <input
                        className={masterCellInput("min-w-[140px]")}
                        value={d.headName}
                        onChange={(e) => patch(row.id, { headName: e.target.value })}
                      />
                    ) : (
                      <span className="block leading-snug">{row.headName ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className={MASTER_CELL}>
                    {isAdmin ? (
                      <input
                        className={masterCellInput("min-w-[160px]")}
                        value={d.location}
                        onChange={(e) => patch(row.id, { location: e.target.value })}
                      />
                    ) : (
                      <span className="block leading-snug">{row.location ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className={MASTER_CELL}>
                    {isAdmin ? (
                      <select
                        className={masterCellInput("min-w-[200px]")}
                        value={d.kraSheetId}
                        onChange={(e) => patch(row.id, { kraSheetId: e.target.value })}
                      >
                        <option value="">—</option>
                        {KRA_SHEETS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="block leading-snug">{row.kraSheetId ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className={MASTER_CELL}>
                    {isAdmin ? (
                      <input
                        className={masterCellInput("min-w-[56px]")}
                        value={d.sortOrder}
                        onChange={(e) => patch(row.id, { sortOrder: e.target.value })}
                      />
                    ) : (
                      row.sortOrder
                    )}
                  </TableCell>
                  <TableCell className={`${MASTER_CELL} text-muted-foreground`}>
                    {row._count?.employees ?? 0}
                  </TableCell>
                  <TableCell className={MASTER_CELL}>
                    {isAdmin ? (
                      <input
                        type="checkbox"
                        checked={d.isActive}
                        onChange={(e) => patch(row.id, { isActive: e.target.checked })}
                        className="h-4 w-4 rounded border-input"
                      />
                    ) : row.isActive ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </StickyTableShell>

      <UploadMasterModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        type="departments"
        unitId={unitId}
      />
    </div>
  );
}
