import { cn } from "@/lib/utils";
import { Trophy, Medal, Award } from "lucide-react";

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-white shadow-lg shadow-amber-300/50 ring-2 ring-amber-200/80">
        <Trophy className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow">
        <Award className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500"
      )}
    >
      {rank}
    </span>
  );
}
