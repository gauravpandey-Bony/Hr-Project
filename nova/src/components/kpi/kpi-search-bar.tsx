"use client";

import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function KpiSearchBar({
  categories,
  currentCategory,
  query,
  unitId,
}: {
  categories: readonly string[];
  currentCategory?: string;
  query?: string;
  unitId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const q = params.q ?? query;
    const cat = params.category ?? currentCategory;
    if (q) sp.set("q", q);
    if (cat && cat !== "all") sp.set("category", cat);
    if (unitId) sp.set("unit", unitId);
    const qs = sp.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <>
      <select
        value={currentCategory ?? "all"}
        onChange={(e) => update({ category: e.target.value })}
        className={cn(
          "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm font-medium text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Filter by category"
      >
        <option value="all">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          defaultValue={query}
          placeholder="Search KPIs…"
          className="h-10 w-full min-w-[200px] rounded-xl border-input bg-background/80 pl-9 sm:w-64"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update({ q: (e.target as HTMLInputElement).value || undefined });
            }
          }}
        />
      </div>
    </>
  );
}
