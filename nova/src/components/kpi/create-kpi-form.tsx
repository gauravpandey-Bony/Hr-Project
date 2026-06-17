"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KPI_CATEGORIES } from "@/lib/company";
import { useOrgUnit } from "@/components/providers/org-units-provider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreateKpiForm({
  unitId,
  plantUnitKey,
}: {
  unitId?: string;
  plantUnitKey?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const unit = useOrgUnit(unitId);
  const plantUnit = plantUnitKey ?? unit?.plantUnitKey ?? "Bony Polymers";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        category: form.get("category"),
        unit: form.get("unit"),
        targetValue: Number(form.get("targetValue")),
        direction: form.get("direction"),
        frequency: form.get("frequency"),
        department: form.get("department") || undefined,
        plantUnit,
      }),
    });

    setLoading(false);
    if (res.ok) {
      toast.success(unit ? `KPI added to ${unit.name}` : "KPI created");
      router.push(unit ? `/dashboard/units/${unit.id}` : "/dashboard/kpis");
      router.refresh();
    } else {
      toast.error("Could not create KPI");
    }
  }

  return (
    <Card>
      {unit && (
        <p className="mb-4 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground">
          Adding KPI to <strong>{unit.name}</strong> workspace
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">KPI name</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="On-time dispatch %"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select id="category" name="category" className={selectClass}>
              {KPI_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" name="unit" required defaultValue="%" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="targetValue">Target</Label>
            <Input
              id="targetValue"
              name="targetValue"
              type="number"
              step="any"
              required
              defaultValue={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="direction">Direction</Label>
            <select id="direction" name="direction" className={selectClass} defaultValue="HIGHER_IS_BETTER">
              <option value="HIGHER_IS_BETTER">Higher is better</option>
              <option value="LOWER_IS_BETTER">Lower is better</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <select id="frequency" name="frequency" className={selectClass} defaultValue="MONTHLY">
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="DAILY">Daily</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department (optional)</Label>
          <Input id="department" name="department" placeholder="Production" />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saving…" : unit ? `Create KPI for ${unit.name}` : "Create KPI"}
        </Button>
      </form>
    </Card>
  );
}
