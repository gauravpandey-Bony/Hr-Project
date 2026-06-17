"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiInsightsPanel() {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/ai/kpi-insights");
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setInsights(data.insights ?? []);
      setAiEnabled(data.aiEnabled);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-indigo-50/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100/80 bg-gradient-to-r from-violet-100/50 to-indigo-100/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200/60">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">AI Insights</h2>
            <p className="text-xs text-slate-500">Smart takeaways from your live KPI data</p>
          </div>
          {aiEnabled && (
            <span className="rounded-full bg-violet-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
              GPT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/ai"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open chat
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-violet-200 bg-white p-2 text-violet-600 transition hover:bg-violet-50 disabled:opacity-50"
            title="Refresh insights"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded-md bg-violet-100/80" style={{ width: `${90 - i * 15}%` }} />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-slate-500">Add KPI data to unlock AI-powered insights.</p>
        ) : (
          <ul className="space-y-3">
            {insights.map((line, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-violet-100/80 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
