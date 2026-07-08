"use client";

import { useEffect, useMemo, useState } from "react";
import type { Kpi, KpiEntry } from "@prisma/client";
import { KpiSummaryRow } from "@/components/kpi/kpi-card";
import { StickyTableShell } from "@/components/ui/sticky-table-shell";
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
  pageSlice,
} from "@/components/ui/list-pagination";

type KpiRow = Kpi & { entries: KpiEntry[] };

const KPI_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export function KpiLibraryTable({
  kpis,
  query,
  category,
}: {
  kpis: KpiRow[];
  query?: string;
  category?: string;
}) {
  const [page, setPage] = useState(0);

  // Reset page when filters change.
  useEffect(() => {
    setPage(0);
  }, [query, category, kpis.length]);

  const pageRows = useMemo(
    () => pageSlice(kpis, page, KPI_PAGE_SIZE),
    [kpis, page]
  );

  return (
    <div className="space-y-3">
      <ListPagination
        page={page}
        pageSize={KPI_PAGE_SIZE}
        total={kpis.length}
        onPageChange={setPage}
        label="KPIs"
      />

      <StickyTableShell className="overflow-hidden">
        <table className="w-full min-w-[920px] table-fixed caption-bottom text-sm">
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "112px" }} />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md shadow-[0_1px_0_0_hsl(var(--border)/0.8)]">
            <TableRow className="border-b border-border/80 bg-muted/35 hover:bg-muted/35">
              <TableHead className="h-9 px-4 py-2 pl-5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                KPI
              </TableHead>
              <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                Category
              </TableHead>
              <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                Frequency
              </TableHead>
              <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                Actual
              </TableHead>
              <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                Target
              </TableHead>
              <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                Progress
              </TableHead>
              <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
                Status
              </TableHead>
              <TableHead className="h-9 px-3 py-2 pr-5 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((kpi) => (
              <KpiSummaryRow key={kpi.id} kpi={kpi} />
            ))}
          </TableBody>
        </table>
      </StickyTableShell>

      <ListPagination
        page={page}
        pageSize={KPI_PAGE_SIZE}
        total={kpis.length}
        onPageChange={setPage}
        label="KPIs"
      />
    </div>
  );
}
