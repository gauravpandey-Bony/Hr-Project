"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LoginSessionBanner({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.refresh();
  }

  return (
    <div className="login-session-3d mb-5 flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-[11px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <Badge
            variant="secondary"
            className="mt-0.5 h-5 rounded-md px-1.5 text-[10px] font-bold uppercase tracking-wide"
          >
            {role}
          </Badge>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-white/80 hover:text-foreground"
        onClick={signOut}
      >
        <LogOut className="h-3.5 w-3.5" />
        Logout
      </Button>
    </div>
  );
}
