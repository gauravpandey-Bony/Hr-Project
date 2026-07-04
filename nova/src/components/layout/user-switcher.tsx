"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SwitchUser = { id: string; label: string; role: string };

export function UserSwitcher({
  currentName,
  currentRole,
  compact = false,
}: {
  currentName: string;
  currentRole: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<SwitchUser[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/accounts");
        const data = await res.json();
        setUsers(
          (data.accounts ?? []).map(
            (a: { id: string; name: string; role: string }) => ({
              id: a.id,
              label: a.name,
              role: a.role,
            })
          )
        );
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  async function switchUser(userId: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
      credentials: "same-origin",
    });
    if (res.ok) router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
    router.refresh();
  }

  const switchable = users.filter(
    (u) => u.id && (currentRole === "ADMIN" || u.role === currentRole)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn(
            "gap-2 rounded-xl border-border/80 bg-background/80 shadow-sm transition hover:border-primary/20 hover:shadow-md",
            !compact && "h-10 min-w-[160px] justify-between px-3"
          )}
          aria-label="User menu"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-700 text-[11px] font-bold text-white shadow-sm">
            {currentName
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          {!compact && (
            <>
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="truncate text-xs font-medium leading-tight">
                  {currentName}
                </span>
                <span className="truncate text-2xs text-muted-foreground">
                  {currentRole}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{currentName}</p>
          <p className="text-xs text-muted-foreground">{currentRole}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="gap-2 font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
        {currentRole !== "EMPLOYEE" && switchable.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch user
            </DropdownMenuLabel>
            {switchable.map((d) => (
              <DropdownMenuItem key={d.id} onClick={() => switchUser(d.id)}>
                {d.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
