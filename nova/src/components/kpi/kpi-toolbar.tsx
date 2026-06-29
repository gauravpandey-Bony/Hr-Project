"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { downloadFromApi } from "@/lib/download-from-api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GenerateKpiPromptButton } from "@/components/ai/generate-kpi-prompt-modal";
import { UploadSpreadsheetModal } from "./upload-spreadsheet-modal";
import { UploadKraWorkbookModal } from "@/components/kra/upload-kra-workbook-modal";
import { ConnectAppModal } from "./connect-app-modal";
import { KpiSearchBar } from "./kpi-search-bar";
import { KPI_CATEGORIES } from "@/lib/company";

export function KpiToolbar({
  isAdmin,
  currentCategory,
  query,
  resultCount,
  unitId,
}: {
  isAdmin: boolean;
  currentCategory?: string;
  query?: string;
  resultCount?: number;
  unitId?: string;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [kraUploadOpen, setKraUploadOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportSpreadsheet() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (unitId) params.set("unit", unitId);
      if (currentCategory && currentCategory !== "all") params.set("category", currentCategory);
      if (query) params.set("q", query);
      const qs = params.toString();
      await downloadFromApi(`/api/kpis/export${qs ? `?${qs}` : ""}`, "kpi-data.csv");
      toast.success("KPI data downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const createHref = unitId
    ? `/dashboard/kpis/create?unit=${encodeURIComponent(unitId)}`
    : "/dashboard/kpis/create";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-soft backdrop-blur-sm">
        {isAdmin && (
          <>
            <Button variant="outline" asChild>
              <Link href={createHref}>
                <Plus className="h-4 w-4" />
                Add a KPI
              </Link>
            </Button>
            <GenerateKpiPromptButton isAdmin={isAdmin} />
            <Button variant="default" onClick={() => setKraUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  More
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                  Upload a Spreadsheet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportSpreadsheet} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export Spreadsheet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConnectOpen(true)}>
                  Connect to an App
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <div className="ml-auto flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {resultCount !== undefined && (
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              <span className="text-foreground">{resultCount}</span> KPI
              {resultCount === 1 ? "" : "s"}
            </p>
          )}
          <KpiSearchBar
            categories={KPI_CATEGORIES}
            currentCategory={currentCategory}
            query={query}
            unitId={unitId}
          />
        </div>
      </div>

      <UploadSpreadsheetModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        unitId={unitId}
        category={currentCategory}
        query={query}
      />
      <UploadKraWorkbookModal open={kraUploadOpen} onClose={() => setKraUploadOpen(false)} />
      <ConnectAppModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}
