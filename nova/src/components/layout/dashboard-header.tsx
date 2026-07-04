"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserSwitcher } from "@/components/layout/user-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  currentName,
  currentRole,
  onMenuClick,
  onSearchFocus,
  className,
}: {
  currentName: string;
  currentRole: string;
  onMenuClick?: () => void;
  onSearchFocus?: () => void;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-[3.75rem] shrink-0 items-center gap-3 border-b border-border/60 bg-background/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="rounded-xl lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={onSearchFocus}
        className="group relative hidden w-full max-w-md sm:block"
        aria-label="Open command palette"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition group-hover:text-foreground" />
        <div className="flex h-10 w-full items-center rounded-xl border border-border/80 bg-muted/40 pl-10 pr-14 text-sm text-muted-foreground shadow-inner-soft transition-all group-hover:border-primary/20 group-hover:bg-muted/60">
          Search name, emp code, dept, designation, location…
        </div>
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-border/80 bg-background/80 px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground shadow-sm sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <div className="flex-1" aria-hidden />

      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-xl sm:hidden"
        onClick={onSearchFocus}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        Search
      </Button>

      <div className="hidden items-center gap-2 sm:flex">
        <ThemeToggle />
        <UserSwitcher currentName={currentName} currentRole={currentRole} />
      </div>
      <div className="flex items-center gap-2 sm:hidden">
        <ThemeToggle />
        <UserSwitcher currentName={currentName} currentRole={currentRole} compact />
      </div>
    </header>
  );
}
