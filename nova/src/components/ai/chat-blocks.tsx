"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBlock } from "@/lib/ai/chat";
import type { GeneratedKpiSuggestion } from "@/lib/ai/generate-kpis";
import { DepartmentDashboardBlock } from "./department-dashboard-block";
import { EmployeeDashboardBlock } from "./employee-dashboard-block";

export function ChatBlocks({
  blocks,
  isAdmin,
  unitId,
}: {
  blocks: ChatBlock[];
  isAdmin?: boolean;
  unitId?: string;
}) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} isAdmin={isAdmin} unitId={unitId} />
      ))}
    </div>
  );
}

function BlockRenderer({
  block,
  isAdmin,
  unitId,
}: {
  block: ChatBlock;
  isAdmin?: boolean;
  unitId?: string;
}) {
  if (block.type === "text") {
    return (
      <div
        className="prose prose-sm max-w-none text-foreground dark:prose-invert"
        dangerouslySetInnerHTML={{
          __html: block.content
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br/>"),
        }}
      />
    );
  }

  if (block.type === "table") {
    const statusCol = block.headers.findIndex((h) => /status/i.test(h));
    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {block.title && (
          <p className="border-b border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
            {block.title}
          </p>
        )}
        <table className="w-full min-w-[480px] text-xs">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              {block.headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {block.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-foreground">
                    {ci === statusCol ? (
                      <StatusBadge status={cell} />
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "department_dashboard") {
    return <DepartmentDashboardBlock data={block.data} />;
  }

  if (block.type === "employee_dashboard") {
    return <EmployeeDashboardBlock data={block.data} />;
  }

  if (block.type === "kpi_suggestions") {
    return <KpiSuggestionsBlock items={block.items} isAdmin={isAdmin} unitId={unitId} />;
  }

  return null;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "green"
      ? "bg-emerald-100 text-emerald-800"
      : s === "amber"
        ? "bg-amber-100 text-amber-800"
        : s === "red"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-700";
  const label = s === "green" ? "On track" : s === "red" || s === "amber" ? "Off target" : status;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {label}
    </span>
  );
}

function KpiSuggestionsBlock({
  items,
  isAdmin,
  unitId,
}: {
  items: GeneratedKpiSuggestion[];
  isAdmin?: boolean;
  unitId?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(items.map((_, i) => i))
  );
  const [applying, setApplying] = useState(false);

  async function apply() {
    const picked = items.filter((_, i) => selected.has(i));
    setApplying(true);
    await fetch("/api/ai/generate-kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply: true, selected: picked, unit: unitId }),
    });
    setApplying(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() =>
            setSelected((prev) => {
              const n = new Set(prev);
              if (n.has(i)) n.delete(i);
              else n.add(i);
              return n;
            })
          }
          className={cn(
            "flex w-full gap-2 rounded-lg border bg-white p-2.5 text-left text-xs",
            selected.has(i) ? "border-violet-400" : "border-slate-200"
          )}
        >
          <div
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              selected.has(i) ? "border-violet-600 bg-violet-600 text-white" : ""
            )}
          >
            {selected.has(i) && <Check className="h-2.5 w-2.5" />}
          </div>
          <div>
            <p className="font-medium text-slate-900">{item.name}</p>
            <p className="text-slate-500">
              {item.category} · Target {item.targetValue} {item.unit}
            </p>
          </div>
        </button>
      ))}
      {isAdmin && (
        <button
          type="button"
          onClick={apply}
          disabled={applying || selected.size === 0}
          className="w-full rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {applying ? "Adding…" : `Add ${selected.size} KPIs to library`}
        </button>
      )}
    </div>
  );
}
