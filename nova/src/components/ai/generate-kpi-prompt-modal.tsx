"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSelectedUnit } from "@/hooks/use-admin-unit";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const EXAMPLES = [
  "Store",
  "Billing",
  "Production",
  "Quality",
  "Maintenance",
  "IT",
  "HR",
  "Plant Head",
];

export function GenerateKpiPromptModal({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminUnitId = useAdminSelectedUnit("ADMIN");
  const unitId = searchParams.get("unit") ?? adminUnitId ?? undefined;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<"ai" | "template" | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuggestions([]);
      setSelected(new Set());
      setSource(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function generate(focusText?: string) {
    const text = (focusText ?? prompt).trim();
    if (!text) return;

    setPrompt(text);
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch("/api/ai/generate-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: text, unit: unitId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate KPIs");
        return;
      }
      const list: Suggestion[] = data.suggestions ?? [];
      setSuggestions(list);
      setSource(data.source);
      setSelected(new Set(list.map((_, i) => i)));
      if (list.length === 0) {
        setError(`No new KPIs found for "${text}". Try another topic like IT, Sales, or Quality.`);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function applySelected() {
    const picked = suggestions.filter((_, i) => selected.has(i));
    if (!picked.length || !isAdmin) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, selected: picked, unit: unitId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not add KPIs");
        return;
      }
      toast.success(`Added ${picked.length} KPI${picked.length !== 1 ? "s" : ""}`);
      handleClose();
    } catch {
      setError("Could not add KPIs — please try again.");
    } finally {
      setApplying(false);
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

  function handleClose() {
    setPrompt("");
    setSuggestions([]);
    setSelected(new Set());
    setError(null);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl text-white">
            Generate your KPIs using AI
          </DialogTitle>
          <p className="text-sm text-violet-100">
            Type a topic — IT, Sales, Quality… then pick from the list
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          <label htmlFor="kpi-prompt-input" className="sr-only">
            What KPIs are you looking for?
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              id="kpi-prompt-input"
              ref={inputRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  generate();
                }
              }}
              placeholder="Type here… e.g. IT, HR, warehouse, marketing"
              className="min-h-[52px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="off"
            />
            <Button
              type="button"
              onClick={() => generate()}
              disabled={loading || !prompt.trim()}
              className="bg-violet-600 hover:bg-violet-700 sm:self-stretch"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Generating…" : "Generate"}
            </Button>
          </div>

          <p className="mt-4 text-xs font-medium text-muted-foreground">
            Popular examples — click to fill & generate
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <Button
                key={ex}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generate(ex)}
                disabled={loading}
                className="rounded-full"
              >
                {ex}
              </Button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Choose KPIs to add
                  {source && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({source === "ai" ? "AI powered" : "smart templates"})
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    setSelected(
                      selected.size === suggestions.length
                        ? new Set()
                        : new Set(suggestions.map((_, i) => i))
                    )
                  }
                >
                  {selected.size === suggestions.length ? "Deselect all" : "Select all"}
                </Button>
              </div>
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border bg-muted/30 p-2">
                {suggestions.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      className={cn(
                        "flex w-full gap-3 rounded-lg border bg-card p-3 text-left transition",
                        selected.has(i)
                          ? "border-violet-400 ring-1 ring-violet-200"
                          : "border-border hover:border-input"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          selected.has(i)
                            ? "border-violet-600 bg-violet-600 text-white"
                            : "border-input bg-background"
                        )}
                      >
                        {selected.has(i) && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {s.description}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {s.category} · Target {s.targetValue} {s.unit} · {s.frequency}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="shrink-0 flex-row items-center justify-between border-t bg-muted/30 px-6 py-4 sm:justify-between">
          <a href="/dashboard/ai" className="text-xs text-primary hover:underline">
            Open full AI chat
          </a>
          {isAdmin && suggestions.length > 0 ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={applySelected}
                disabled={applying || selected.size === 0}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {applying ? "Adding…" : `Add ${selected.size} KPI${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GenerateKpiPromptButton({ isAdmin }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
      >
        <Sparkles className="h-4 w-4" />
        Generate KPIs
      </Button>
      <GenerateKpiPromptModal open={open} onClose={() => setOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
