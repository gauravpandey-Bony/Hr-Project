"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { DEMO_USERS } from "@/lib/constants";
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

const demos = [
  { id: DEMO_USERS.admin, label: "Admin" },
  { id: DEMO_USERS.manager, label: "Manager" },
  { id: DEMO_USERS.employee, label: "Employee" },
];

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
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-600 text-[11px] font-bold text-white shadow-sm">
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
        {currentRole !== "EMPLOYEE" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch demo user
            </DropdownMenuLabel>
            {demos.map((d) => (
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
