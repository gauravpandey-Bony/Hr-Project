"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewFormSchema, RatingScale } from "@/types";
import { parseJson } from "@/lib/utils";

export function ReviewForm({
  assignmentId,
  formSchemaStr,
  ratingScaleStr,
  revieweeName,
  initialResponses,
  readOnly,
}: {
  assignmentId: string;
  formSchemaStr: string;
  ratingScaleStr: string;
  revieweeName: string;
  initialResponses?: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const formSchema = parseJson<ReviewFormSchema>(formSchemaStr, { sections: [] });
  const ratingScale = parseJson<RatingScale>(ratingScaleStr, { type: "numeric", min: 1, max: 5 });
  const [responses, setResponses] = useState<Record<string, string>>(
    parseJson<Record<string, string>>(initialResponses ?? null, {})
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/reviews/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to submit review");
      toast.error("Failed to submit review");
      return;
    }
    toast.success("Review submitted");
    router.push("/dashboard/reviews");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="text-muted-foreground">
        Review for <span className="font-medium text-foreground">{revieweeName}</span>
      </p>

      {formSchema.sections.map((section) => (
        <fieldset key={section.id} className="space-y-4">
          <legend className="text-lg font-semibold text-foreground">{section.title}</legend>
          {section.questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label>
                {q.label}
                {q.required && <span className="text-destructive"> *</span>}
              </Label>
              {q.type === "rating" ? (
                <select
                  required={q.required}
                  disabled={readOnly}
                  value={responses[q.id] ?? ""}
                  onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                  className={cn(
                    "flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  )}
                >
                  <option value="">Select rating</option>
                  {(ratingScale.labels ??
                    Array.from(
                      { length: (ratingScale.max ?? 5) - (ratingScale.min ?? 1) + 1 },
                      (_, i) => String(i + (ratingScale.min ?? 1))
                    )).map((label, i) => (
                    <option key={i} value={String(i + (ratingScale.min ?? 1))}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  required={q.required}
                  disabled={readOnly}
                  rows={q.type === "textarea" ? 4 : 2}
                  value={responses[q.id] ?? ""}
                  onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              )}
            </div>
          ))}
        </fieldset>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!readOnly && (
        <Button type="submit" disabled={saving}>
          {saving ? "Submitting…" : "Submit review"}
        </Button>
      )}
    </form>
  );
}
