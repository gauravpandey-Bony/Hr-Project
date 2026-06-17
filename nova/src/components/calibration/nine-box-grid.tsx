"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Placement = {
  id: string;
  userId: string;
  performance: number;
  potential: number;
  user: { id: string; name: string; department: string | null };
};

const labels = [
  ["Enigma", "Growth Employee", "Star"],
  ["Assess", "Core Player", "High Performer"],
  ["Underperformer", "Effective", "Trusted Pro"],
];

export function NineBoxGrid({
  sessionId,
  placements,
  readOnly,
}: {
  sessionId: string;
  placements: Placement[];
  readOnly?: boolean;
}) {
  const [local, setLocal] = useState(placements);
  const [dragging, setDragging] = useState<string | null>(null);

  function cellPeople(perf: number, pot: number) {
    return local.filter((p) => p.performance === perf && p.potential === pot);
  }

  async function movePerson(userId: string, performance: number, potential: number) {
    setLocal((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, performance, potential } : p))
    );
    await fetch("/api/calibration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userId, performance, potential }),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex">
        <div className="w-8" />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center text-xs font-medium text-slate-500">
          <span>Low potential</span>
          <span>Medium</span>
          <span>High potential</span>
        </div>
      </div>
      {[3, 2, 1].map((perf, rowIdx) => (
        <div key={perf} className="flex gap-2">
          <div className="flex w-8 items-center justify-center">
            <span
              className="text-xs font-medium text-slate-500"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {perf === 3 ? "High perf" : perf === 2 ? "Med perf" : "Low perf"}
            </span>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {[1, 2, 3].map((pot) => (
              <div
                key={`${perf}-${pot}`}
                className={cn(
                  "min-h-[100px] rounded-lg border-2 border-dashed p-2 transition-colors",
                  dragging ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50"
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging && !readOnly) {
                    movePerson(dragging, perf, pot);
                    setDragging(null);
                  }
                }}
              >
                <p className="mb-1 text-[10px] font-medium text-slate-400">
                  {labels[rowIdx][pot - 1]}
                </p>
                <div className="flex flex-wrap gap-1">
                  {cellPeople(perf, pot).map((p) => (
                    <span
                      key={p.userId}
                      draggable={!readOnly}
                      onDragStart={() => setDragging(p.userId)}
                      onDragEnd={() => setDragging(null)}
                      className="cursor-grab rounded-md bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 active:cursor-grabbing"
                    >
                      {p.user.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
