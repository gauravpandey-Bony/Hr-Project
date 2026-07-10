"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Card3D } from "@/components/ui/card-3d";
import { BonyLogo } from "@/components/brand/bony-logo";
import { cn } from "@/lib/utils";
import {
  PLATFORM_NOTE,
  type OrgGroup,
  type OrgUnit,
  unitDashboardPath,
} from "@/lib/org-units";
import { persistAdminUnitId } from "@/lib/admin-unit";
import { COMPANY } from "@/lib/company";
import { useOrgUnits } from "@/components/providers/org-units-provider";
import { DepartmentBrowser } from "@/components/dashboard/department-browser";
import {
  DASHBOARD_HERO,
  DASHBOARD_HERO_BADGE,
  DASHBOARD_HERO_SUBTITLE,
} from "@/components/masters/masters-table-styles";

function UnitTile({
  unit,
  floatIndex,
  onSelect,
  compact,
}: {
  unit: OrgUnit;
  floatIndex: number;
  onSelect: (unit: OrgUnit) => void;
  compact?: boolean;
}) {
  return (
    <Card3D
      as="button"
      floatIndex={floatIndex}
      onClick={() => onSelect(unit)}
      className="w-full overflow-hidden border-0 bg-transparent p-0 text-left shadow-none ring-1 ring-black/5"
    >
      <div
        className="relative min-h-[132px] p-4 text-white sm:p-5"
        style={{ background: unit.gradientCss }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,transparent_50%)]" />
        <div className="relative flex items-start justify-between gap-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-lg ring-1 ring-white/30 backdrop-blur-sm sm:h-11 sm:w-11 sm:text-xl"
            style={{ transform: "translateZ(28px)" }}
          >
            {unit.emoji}
          </span>
          <span
            className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm"
            style={{ transform: "translateZ(24px)" }}
          >
            Live
          </span>
        </div>
        <h3
          className={cn(
            "relative mt-3 font-bold tracking-tight",
            compact ? "text-sm" : "text-base"
          )}
          style={{ transform: "translateZ(20px)" }}
        >
          {unit.name}
        </h3>
        {unit.subtitle && (
          <p
            className="relative mt-1 text-[11px] leading-snug text-white/85 sm:text-xs"
            style={{ transform: "translateZ(16px)" }}
          >
            {unit.subtitle}
          </p>
        )}
      </div>
    </Card3D>
  );
}

function GroupTile({
  group,
  floatIndex,
  onOpen,
}: {
  group: OrgGroup;
  floatIndex: number;
  onOpen: (group: OrgGroup) => void;
}) {
  return (
    <Card3D
      as="button"
      floatIndex={floatIndex}
      onClick={() => onOpen(group)}
      className="w-full overflow-visible border-0 bg-transparent p-0 text-left text-white shadow-none ring-1 ring-white/20"
    >
      <div className="relative overflow-hidden rounded-[inherit] p-6" style={{ background: group.gradientCss }}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,transparent_55%)]" />
        <div className="relative flex items-start justify-between gap-3">
          {group.id === "bony" ? (
            <span className="relative z-10 shrink-0" style={{ transform: "translateZ(32px)" }}>
              <BonyLogo
                size="lg"
                variant="mark"
                className="h-14 w-14 rounded-2xl ring-1 ring-white/30 shadow-sm"
              />
            </span>
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl ring-1 ring-white/30 backdrop-blur-sm"
              style={{ transform: "translateZ(32px)" }}
            >
              {group.emoji}
            </span>
          )}
          <ChevronRight
            className="h-5 w-5 text-white/80"
            style={{ transform: "translateZ(24px)" }}
          />
        </div>
        <h3
          className="relative mt-4 text-xl font-bold tracking-tight"
          style={{ transform: "translateZ(24px)" }}
        >
          {group.name}
        </h3>
        <p
          className="relative mt-1 text-sm text-white/80"
          style={{ transform: "translateZ(20px)" }}
        >
          {group.subtitle ?? `${group.units.length} locations`}
        </p>
        <p
          className="relative mt-3 text-xs font-medium text-white/70"
          style={{ transform: "translateZ(16px)" }}
        >
          {group.units.length} locations · open any unit to add KPI data
        </p>
      </div>
    </Card3D>
  );
}

export function UnitTilePicker({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { groups, standaloneUnits, allUnits } = useOrgUnits();
  const [activeGroup, setActiveGroup] = useState<OrgGroup | null>(null);

  function handleUnitSelect(unit: OrgUnit) {
    persistAdminUnitId(unit.id, allUnits);
    router.push(unitDashboardPath(unit.id));
  }

  return (
    <div className="reports-grid-bg space-y-8 pb-10">
      <div className={DASHBOARD_HERO}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className={DASHBOARD_HERO_BADGE}>
            <BonyLogo size="xs" className="ring-white/20" />
            {COMPANY.productName}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Select your unit
          </h1>
          <p className={DASHBOARD_HERO_SUBTITLE}>{PLATFORM_NOTE}</p>
        </div>
      </div>

      {activeGroup ? (
        <div className="space-y-5 animate-fade-up">
          <button
            type="button"
            onClick={() => setActiveGroup(null)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition hover:border-emerald-400/50 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all units
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {activeGroup.id === "bony" ? (
              <BonyLogo
                size="lg"
                variant="mark"
                className="h-12 w-12 rounded-2xl ring-1 ring-black/10 shadow-lg"
              />
            ) : (
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white shadow-lg ring-1 ring-black/10"
                style={{ background: activeGroup.gradientCss }}
              >
                {activeGroup.emoji}
              </span>
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">{activeGroup.name}</h2>
              <p className="text-sm text-muted-foreground">
                {activeGroup.units.length} locations
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeGroup.units.map((unit, i) => (
              <UnitTile
                key={unit.id}
                unit={unit}
                floatIndex={i}
                onSelect={handleUnitSelect}
                compact
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-800/70">
              Company groups
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {groups.map((group, i) => (
                <GroupTile
                  key={group.id}
                  group={group}
                  floatIndex={i}
                  onOpen={setActiveGroup}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-800/70">
              Other units
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {standaloneUnits.map((unit, i) => (
                <UnitTile
                  key={unit.id}
                  unit={unit}
                  floatIndex={i}
                  onSelect={handleUnitSelect}
                  compact
                />
              ))}
            </div>
          </div>

          {isAdmin && <DepartmentBrowser />}
        </>
      )}
    </div>
  );
}
