"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Template = { id: string; name: string };
type UserOption = { id: string; name: string; department: string | null };

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreateCycleForm({
  templates,
  users,
}: {
  templates: Template[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(users.map((u) => u.id));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/reviews/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        templateId: form.get("templateId"),
        cycleType: form.get("cycleType"),
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
        workflow: {
          self: form.get("self") === "on",
          manager: form.get("manager") === "on",
          peer: form.get("peer") === "on",
          peerCount: Number(form.get("peerCount") || 2),
        },
        participantIds: selectedUsers,
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Review cycle created");
      router.push("/dashboard/reviews");
    } else {
      toast.error("Could not create cycle");
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="cycle-name">Cycle name</Label>
          <Input
            id="cycle-name"
            name="name"
            required
            placeholder="Q3 2026 Performance Review"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cycle-desc">Description</Label>
          <textarea
            id="cycle-desc"
            name="description"
            rows={2}
            className={cn(
              "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <select id="template" name="templateId" required className={selectClass}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycle-type">Cycle type</Label>
            <select id="cycle-type" name="cycleType" className={selectClass}>
              {["ANNUAL", "QUARTERLY", "MONTHLY", "AD_HOC"].map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start">Start date</Label>
            <Input id="start" name="startDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End date</Label>
            <Input id="end" name="endDate" type="date" required />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Workflow</legend>
          <label className="flex items-center gap-2 text-sm">
            <input name="self" type="checkbox" defaultChecked className="rounded border-input" />
            Self review
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="manager" type="checkbox" defaultChecked className="rounded border-input" />
            Manager review
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="peer" type="checkbox" className="rounded border-input" />
            Peer review
          </label>
          <div className="flex items-center gap-2">
            <Input name="peerCount" type="number" min={1} max={5} defaultValue={2} className="w-20" />
            <span className="text-sm text-muted-foreground">peers per person</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Participants</legend>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border p-2 scrollbar-thin">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  onChange={(e) =>
                    setSelectedUsers((prev) =>
                      e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                    )
                  }
                  className="rounded border-input"
                />
                {u.name}
                {u.department && (
                  <span className="text-muted-foreground">({u.department})</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create cycle"}
        </Button>
      </form>
    </Card>
  );
}
