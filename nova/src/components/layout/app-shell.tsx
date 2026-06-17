"use client";

import type { UserRole } from "@prisma/client";
import { useSidebar } from "@/hooks/use-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { CommandMenu } from "@/components/layout/command-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({
  children,
  currentName,
  currentRole,
}: {
  children: React.ReactNode;
  currentName: string;
  currentRole: string;
}) {
  const { collapsed, mobileOpen, setMobileOpen, toggleCollapsed } = useSidebar();

  const openCommand = () => {
    document.dispatchEvent(new CustomEvent("nova:command-open"));
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapse={toggleCollapsed}
          onNavigate={() => setMobileOpen(false)}
          userRole={currentRole as UserRole}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden mesh-bg">
          <DashboardHeader
            currentName={currentName}
            currentRole={currentRole}
            onMenuClick={() => setMobileOpen(true)}
            onSearchFocus={openCommand}
          />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <CommandMenu userRole={currentRole as UserRole} />
    </TooltipProvider>
  );
}
