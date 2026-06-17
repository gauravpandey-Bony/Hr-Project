"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiOption = { id: string; name: string; unit: string; category: string };

export function UpdateKpiForm({
  kpis,
  defaultKpiId,
}: {
  kpis: KpiOption[];
  defaultKpiId?: string;
}) {
  const router = useRouter();
  const [kpiId, setKpiId] = useState(defaultKpiId ?? kpis[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kpiId || value === "") return;
    setLoading(true);

    const res = await fetch(`/api/kpis/${kpiId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: parseFloat(value),
        recordedAt: date,
        note: note || undefined,
      }),
    });

    setLoading(false);
    if (res.ok) {
      setValue("");
      setNote("");
      toast.success("KPI updated successfully");
      router.refresh();
    } else {
      toast.error("Could not save — try again");
    }
  }

  const selected = kpis.find((k) => k.id === kpiId);

  return (
    <Card className="mx-auto max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="kpi-select">Select KPI</Label>
          <select
            id="kpi-select"
            value={kpiId}
            onChange={(e) => setKpiId(e.target.value)}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {kpis.map((k) => (
              <option key={k.id} value={k.id}>
                [{k.category}] {k.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kpi-value">
              Value {selected ? `(${selected.unit})` : ""}
            </Label>
            <Input
              id="kpi-value"
              type="number"
              step="any"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter latest figure"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kpi-date">Date</Label>
            <Input
              id="kpi-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-note">Note (optional)</Label>
          <Input
            id="kpi-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Month-end actual from ERP"
          />
        </div>

        <Button type="submit" disabled={loading || !kpiId} className="w-full">
          {loading ? "Saving…" : "Save KPI data"}
        </Button>
      </form>
    </Card>
  );
}
