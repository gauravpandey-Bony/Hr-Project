"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2, Building2, Upload, Download } from "lucide-react";
import { UploadMasterModal } from "./upload-master-modal";
import { COMPANY } from "@/lib/company";
import { downloadFromApi } from "@/lib/download-from-api";
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
  MASTER_HERO,
  MASTER_HERO_BADGE,
  MASTER_HERO_SUBTITLE,
  MASTER_HERO_BTN_SECONDARY,
  MASTER_HERO_BTN_PRIMARY,
} from "./masters-table-styles";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
  pageSlice,
} from "@/components/ui/list-pagination";

type DeptRow = DepartmentMaster;

type Draft = {
  name: string;
  headName: string;
  location: string;
  sortOrder: string;
  isActive: boolean;
};

function toDraft(d: DeptRow): Draft {
  return {
    name: d.name,
    headName: d.headName ?? "",
    location: d.location ?? "Bony Polymers",
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const d = drafts[row.id];
      const hay = [
        row.name,
        row.headName,
        row.location,
        d?.name,
        d?.headName,
        d?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, drafts, search]);

  const pageRows = useMemo(
    () => pageSlice(filteredRows, page, DEFAULT_PAGE_SIZE),
    [filteredRows, page]
  );

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
      <div className={MASTER_HERO}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={MASTER_HERO_BADGE}>
              <Building2 className="h-3.5 w-3.5 text-emerald-100" />
              {COMPANY.shortName}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Department Master</h1>
            <p className={MASTER_HERO_SUBTITLE}>
              Plant departments — {rows.length} records
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadSheet}
              disabled={downloading || rows.length === 0}
              className={MASTER_HERO_BTN_SECONDARY}
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
                className={MASTER_HERO_BTN_SECONDARY}
              >
                <Upload className="h-4 w-4" />
                Upload Excel
              </button>
              <button
                type="button"
                onClick={addRow}
                disabled={adding}
                className={MASTER_HERO_BTN_PRIMARY}
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search department, head, location…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
        />
      </div>

      <ListPagination
        page={page}
        total={filteredRows.length}
        onPageChange={setPage}
        label="departments"
      />

      <StickyTableShell maxHeight="min(75vh, 900px)">
        <table className={MASTER_TABLE_CLASS}>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 shrink-0">#</TableHead>
              {isAdmin && <TableHead className="w-[72px] shrink-0">Actions</TableHead>}
              <TableHead className="min-w-[200px]">Department</TableHead>
              <TableHead className="min-w-[160px]">Head</TableHead>
              <TableHead className="min-w-[180px]">Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No departments match your search.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((row, idx) => {
              const d = drafts[row.id] ?? toDraft(row);
              const rowNumber = page * DEFAULT_PAGE_SIZE + idx + 1;
              return (
                <TableRow key={row.id}>
                  <TableCell className={`${MASTER_CELL} text-muted-foreground`}>{rowNumber}</TableCell>
                  {isAdmin && (
                    <TableCell className={MASTER_CELL}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => save(row.id)}
                          disabled={savingId === row.id}
                          className="rounded-md p-1.5 text-primary hover:bg-primary/10"
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
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </StickyTableShell>

      <ListPagination
        page={page}
        total={filteredRows.length}
        onPageChange={setPage}
        label="departments"
      />

      <UploadMasterModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        unitId={unitId}
      />
    </div>
  );
}
