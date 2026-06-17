"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LaunchCycleButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function launch() {
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/reviews/cycles/${cycleId}/launch`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      const n = data.notifications;
      setResult(
        `Teams: ${n?.teams ?? 0} notified · ${n?.emailReady ?? 0} ready in web app`
      );
      router.refresh();
    } else {
      setResult("Launch failed");
    }
  }

  return (
    <div>
      <button
        onClick={launch}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Launching…" : "Launch cycle & notify"}
      </button>
      {result && <p className="mt-2 text-xs text-slate-500">{result}</p>}
    </div>
  );
}
