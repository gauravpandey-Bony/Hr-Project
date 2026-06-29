"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/components/providers/company-provider";
import { BonyLogo } from "@/components/brand/bony-logo";
import {
  getHrNavForRole,
  getMainNavForRole,
  getSettingsNavForRole,
} from "@/lib/access-control";
import {
  adminHasUnitWorkspace,
  ADMIN_UNIT_PICKER_PATH,
  getAdminMainNav,
} from "@/lib/admin-unit";
import { useOrgUnit, useOrgUnits } from "@/components/providers/org-units-provider";
import { useAdminSelectedUnit } from "@/hooks/use-admin-unit";
import type { UserRole } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onToggleCollapse,
  onNavigate,
  userRole = "ADMIN",
}: {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  userRole?: UserRole;
}) {
  const company = useCompany();
  const pathname = usePathname();
  const { allUnits } = useOrgUnits();
  const adminUnitId = useAdminSelectedUnit(userRole, allUnits);
  const mainNav =
    userRole === "ADMIN"
      ? getAdminMainNav(adminUnitId, allUnits)
      : getMainNavForRole(userRole);
  const hrNav =
    userRole === "ADMIN" && !adminHasUnitWorkspace(adminUnitId, allUnits)
      ? []
      : getHrNavForRole(userRole);
  const settingsNav = getSettingsNavForRole(userRole);
  const selectedUnit = useOrgUnit(adminUnitId);
  const [hrOpen, setHrOpen] = useState(
    pathname.includes("/reviews") ||
      pathname.includes("/feedback") ||
      pathname.includes("/goals") ||
      pathname.includes("/calibration") ||
      pathname.includes("/compensation")
  );

  const NavLink = ({
    href,
    label,
    icon: Icon,
    nested,
    tooltip,
  }: {
    href: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    nested?: boolean;
    tooltip?: string;
  }) => {
    const itemPath = href.split("?")[0];
    const isUnitDashboardNav = itemPath.startsWith("/dashboard/units/");
    const isUnitPicker = itemPath === ADMIN_UNIT_PICKER_PATH;
    const active = isUnitPicker
      ? pathname === ADMIN_UNIT_PICKER_PATH
      : pathname === itemPath ||
        (isUnitDashboardNav && pathname.startsWith("/dashboard/units/")) ||
        (!isUnitDashboardNav &&
          itemPath !== "/dashboard" &&
          pathname.startsWith(itemPath));

    const link = (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          nested && !collapsed && "ml-1",
          active
            ? "nav-pill-active pl-4"
            : "text-sidebar-foreground/55 hover:bg-white/[0.06] hover:text-sidebar-foreground",
          collapsed && "justify-center px-2 pl-2"
        )}
        aria-current={active ? "page" : undefined}
      >
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              active ? "text-primary" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
            )}
          />
        )}
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate">
            <span className="block truncate">{label}</span>
            {isUnitPicker && selectedUnit && (
              <span className="block truncate text-[10px] font-normal text-sidebar-foreground/40">
                Switch unit
              </span>
            )}
          </span>
        )}
      </Link>
    );

    if (collapsed && Icon) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {tooltip ?? label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 lg:static lg:z-auto",
        "bg-[linear-gradient(180deg,hsl(var(--sidebar))_0%,hsl(224_47%_5%)_100%)]",
        collapsed ? "w-[4.5rem]" : "w-[17rem]",
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b border-sidebar-border/80 px-4 py-4",
          collapsed && "justify-center px-2"
        )}
      >
        <BonyLogo size="md" className="shadow-glow shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight tracking-tight">
              {company.productName}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/45">
              {selectedUnit && userRole === "ADMIN"
                ? selectedUnit.name
                : `${company.brandName} · ${company.shortName}`}
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 px-2.5 py-4">
        <nav className="space-y-1" aria-label="Main navigation">
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/35">
              KPI tracking
            </p>
          )}
          {mainNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              tooltip={
                item.href.split("?")[0] === ADMIN_UNIT_PICKER_PATH && selectedUnit
                  ? `Switch unit · ${selectedUnit.name}`
                  : undefined
              }
            />
          ))}

          {hrNav.length > 0 && (
            <div className="pt-4">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setHrOpen(!hrOpen)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/35 transition hover:text-sidebar-foreground/60"
                  aria-expanded={hrOpen}
                >
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5" />
                    People & HR
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", hrOpen && "rotate-180")}
                  />
                </button>
              ) : (
                <div className="my-3 border-t border-sidebar-border/60" />
              )}
              {(hrOpen || collapsed) &&
                hrNav.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    nested
                  />
                ))}
            </div>
          )}

          {settingsNav && (
            <div className="pt-3">
              <NavLink
                href={settingsNav.href}
                label={settingsNav.label}
                icon={settingsNav.icon}
              />
            </div>
          )}
        </nav>
      </ScrollArea>

      <div
        className={cn(
          "border-t border-sidebar-border/80 p-2.5",
          collapsed ? "flex justify-center" : "space-y-2 px-2"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-[11px] leading-snug text-sidebar-foreground/50">
              {selectedUnit && userRole === "ADMIN"
                ? `Workspace · ${selectedUnit.name}`
                : `KPI workspace for ${company.shortName}`}
            </p>
          </div>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden h-9 w-9 text-sidebar-foreground/50 hover:bg-white/[0.06] hover:text-sidebar-foreground lg:inline-flex",
              !collapsed && "ml-auto"
            )}
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
