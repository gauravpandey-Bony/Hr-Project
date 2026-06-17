"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Factory, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrgUnits } from "@/components/providers/org-units-provider";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OrgUnitsManager({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { groups } = useOrgUnits();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  async function submitGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/org-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          subtitle: form.get("subtitle") || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create company group");
      }
      setAddGroupOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const groupSlug = (form.get("groupSlug") as string) || null;
    try {
      const res = await fetch("/api/org-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          subtitle: form.get("subtitle") || undefined,
          groupSlug: groupSlug === "" ? null : groupSlug,
          plantUnitKey: form.get("plantUnitKey") || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create unit");
      }
      setAddUnitOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => {
            setError(null);
            setAddGroupOpen(true);
          }}
        >
          <Building2 className="h-4 w-4" />
          Add company group
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => {
            setError(null);
            setAddUnitOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add other unit
        </Button>
      </div>

      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New company group</DialogTitle>
            <DialogDescription>
              Create a group card on the dashboard. You can add plants inside it after saving.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name</Label>
              <Input id="group-name" name="name" required placeholder="e.g. Bony North" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-subtitle">Subtitle (optional)</Label>
              <Input id="group-subtitle" name="subtitle" placeholder="e.g. 3 plant locations" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              Create group
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addUnitOpen} onOpenChange={setAddUnitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New unit</DialogTitle>
            <DialogDescription>
              Add a standalone unit or place it inside an existing company group.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUnit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Unit name</Label>
              <Input id="unit-name" name="name" required placeholder="e.g. New Division" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-group">Add inside group (optional)</Label>
              <select id="unit-group" name="groupSlug" className={selectClass} defaultValue="">
                <option value="">Other units (standalone)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plant-key">KPI plant key (optional)</Label>
              <Input
                id="plant-key"
                name="plantUnitKey"
                placeholder="Defaults to unit name"
              />
              <p className="text-xs text-muted-foreground">
                Used to match KPI data for this unit&apos;s dashboard.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />}
              Create unit
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
