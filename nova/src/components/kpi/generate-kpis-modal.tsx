"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Wand2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Suggestion = {
  name: string;
  description: string;
  category: string;
  unit: string;
  targetValue: number;
  direction: string;
  frequency: string;
  department?: string;
};

export function GenerateKpisButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/ai/generate-kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus: focus || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuggestions(data.suggestions ?? []);
      setSource(data.source);
      setAiEnabled(data.aiEnabled);
      setSelected(new Set(data.suggestions?.map((_: Suggestion, i: number) => i) ?? []));
      setOpen(true);
    } else {
      toast.error(data.error ?? "Could not generate KPIs");
    }
  }

  async function applySelected() {
    const picked = suggestions.filter((_, i) => selected.has(i));
    if (!picked.length) return;
    setApplying(true);
    const res = await fetch("/api/ai/generate-kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply: true, selected: picked }),
    });
    setApplying(false);
    if (res.ok) {
      toast.success(`Added ${picked.length} KPI${picked.length !== 1 ? "s" : ""}`);
      setOpen(false);
      setSuggestions([]);
      router.refresh();
    } else {
      toast.error("Could not add KPIs");
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={generate}
        disabled={loading}
        className="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
      >
        {loading ? (
          <Sparkles className="h-4 w-4 animate-pulse" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        {loading ? "Generating…" : "Generate KPIs"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5" />
              AI Generate KPIs
            </DialogTitle>
            <p className="text-xs text-violet-100">
              {source === "ai"
                ? "Powered by OpenAI"
                : "Smart templates (add OPENAI_API_KEY for full AI)"}
            </p>
          </DialogHeader>

          <div className="border-b px-5 py-3">
            <Input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional: e.g. quality, safety, extrusion line…"
              onKeyDown={(e) => e.key === "Enter" && generate()}
            />
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto p-0 text-primary"
              onClick={generate}
              disabled={loading}
            >
              Regenerate suggestions
            </Button>
          </div>

          <ScrollArea className="max-h-96 flex-1">
            <ul className="divide-y px-2 py-2">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={cn(
                      "flex w-full gap-3 rounded-lg px-3 py-3 text-left transition",
                      selected.has(i) ? "bg-violet-50 dark:bg-violet-950/30" : "hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        selected.has(i)
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-input"
                      )}
                    >
                      {selected.has(i) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{s.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {s.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.category} · Target {s.targetValue} {s.unit} · {s.frequency} ·{" "}
                        {s.direction === "LOWER_IS_BETTER" ? "↓ lower better" : "↑ higher better"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          <DialogFooter className="flex-row items-center justify-between border-t bg-muted/30 px-5 py-4 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {selected.size} of {suggestions.length} selected
              {!aiEnabled && " · Set OPENAI_API_KEY in .env for GPT suggestions"}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={applySelected}
                disabled={applying || selected.size === 0}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {applying ? "Adding…" : `Add ${selected.size} KPIs`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
