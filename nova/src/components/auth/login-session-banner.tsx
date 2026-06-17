"use client";

import { useRouter } from "next/navigation";
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
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {role}
        </Badge>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 text-xs text-muted-foreground"
        onClick={signOut}
      >
        Logout
      </Button>
    </div>
  );
}
