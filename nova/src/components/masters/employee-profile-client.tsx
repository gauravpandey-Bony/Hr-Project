"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DepartmentMaster, EmployeeMaster, Kpi, User } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  Briefcase,
  IndianRupee,
  Loader2,
  Mail,
  Phone,
  Save,
  TrendingUp,
  User as UserIcon,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { appendUnitQuery } from "@/lib/unit-workspace";
import { confirmReportingManagerChange } from "@/lib/employee-master-grouping";
import { resolveReportingManagerName } from "@/lib/reporting-manager";

type KpiBrief = Pick<Kpi, "id" | "name" | "department" | "kraName" | "plantUnit">;

type ProfilePayload = EmployeeMaster & {
  dept: Pick<DepartmentMaster, "id" | "name" | "location"> | null;
};

type Draft = {
  name: string;
  designation: string;
  departmentId: string;
  location: string;
  doj: string;
  dob: string;
  ecn: string;
  email: string;
  phone: string;
  grade: string;
  lastIncrementPercent: string;
  lastCtc: string;
  lastPromotionDate: string;
  managerName: string;
  isActive: boolean;
};

function toDraft(e: ProfilePayload): Draft {
  const inc = e.lastIncrementPercent;
  let incStr = "";
  if (inc != null) {
    incStr = String(inc <= 1 ? inc * 100 : inc);
  }
  return {
    name: e.name,
    designation: e.designation ?? "",
    departmentId: e.departmentId ?? "",
    location: e.location ?? "",
    doj: e.doj ?? "",
    dob: e.dob ?? "",
    ecn: e.ecn ?? "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    grade: e.grade ?? "",
    lastIncrementPercent: incStr,
    lastCtc: e.lastCtc ?? "",
    lastPromotionDate: e.lastPromotionDate ?? "",
    managerName: e.managerName ?? "",
    isActive: e.isActive,
  };
}

function Field({
  label,
  value,
  editing,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {editing ? (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      ) : (
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}

export function EmployeeProfileClient({
  employee: initial,
  departments,
  kpis,
  linkedUser,
  isAdmin,
  unitId,
  dojLabel,
  incrementLabel,
  ctcLabel,
  promotionLabel,
  allEmployees = [],
}: {
  employee: ProfilePayload;
  departments: DepartmentMaster[];
  kpis: KpiBrief[];
  linkedUser: Pick<User, "id" | "email" | "role"> | null;
  isAdmin: boolean;
  unitId?: string | null;
  dojLabel: string;
  incrementLabel: string;
  ctcLabel: string;
  promotionLabel: string;
  allEmployees?: Pick<EmployeeMaster, "id" | "name" | "designation" | "ecn">[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    const d = toDraft(initial);
    d.managerName =
      resolveReportingManagerName(d.managerName, allEmployees) || d.managerName;
    return d;
  });

  const kraHref = unitId
    ? appendUnitQuery("/dashboard/kra", unitId)
    : "/dashboard/kra";
  const quarterlyHref = unitId
    ? appendUnitQuery("/dashboard/reports/quarterly", unitId)
    : "/dashboard/reports/quarterly";
  const backHref = unitId
    ? appendUnitQuery("/dashboard/masters/employees", unitId)
    : "/dashboard/masters/employees";

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (
      !confirmReportingManagerChange(initial.managerName, draft.managerName || null)
    ) {
      return;
    }
    setSaving(true);
    try {
      const incRaw = draft.lastIncrementPercent.trim();
      let lastIncrementPercent: number | null = null;
      if (incRaw) {
        const n = parseFloat(incRaw.replace(/%/g, ""));
        if (Number.isFinite(n)) lastIncrementPercent = n > 1 ? n / 100 : n;
      }

      const res = await fetch(`/api/employees/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          designation: draft.designation || null,
          departmentId: draft.departmentId || null,
          location: draft.location || null,
          doj: draft.doj || null,
          dob: draft.dob || null,
          ecn: draft.ecn || null,
          email: draft.email || null,
          phone: draft.phone || null,
          grade: draft.grade || null,
          lastIncrementPercent,
          lastCtc: draft.lastCtc || null,
          lastPromotionDate: draft.lastPromotionDate || null,
          managerName: draft.managerName || null,
          isActive: draft.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Profile saved");
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 library-grid-bg pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Employee Master
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 text-white shadow-xl sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">
              {draft.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-indigo-300">Employee Profile</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{initial.name}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {initial.designation ?? "—"} · {initial.department ?? "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {initial.location ?? "—"} {initial.ecn ? `· ECN ${initial.ecn}` : ""}
              </p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(toDraft(initial));
                      setEditing(false);
                    }}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
                >
                  Edit profile
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              Personal & employment
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={draft.name} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <Field label="ECN" value={draft.ecn} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, ecn: v }))} />
              <Field label="Date of birth" value={draft.dob} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, dob: v }))} placeholder="DD.MM.YYYY" />
              <Field label="Date of joining" value={draft.doj} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, doj: v }))} placeholder="DD.MM.YYYY" />
              {!editing && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">DOJ (formatted)</p>
                    <p className="text-sm font-medium">{dojLabel}</p>
                  </div>
                </>
              )}
              <Field label="Grade / level" value={draft.grade} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, grade: v }))} />
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                {editing ? (
                  <select
                    value={draft.departmentId}
                    onChange={(e) => setDraft((d) => ({ ...d, departmentId: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {departments.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium">{initial.department ?? "—"}</p>
                )}
              </div>
              <Field label="Designation" value={draft.designation} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, designation: v }))} />
              <Field label="Plant / location" value={draft.location} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} />
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reporting manager
                </p>
                {editing ? (
                  <select
                    value={
                      resolveReportingManagerName(draft.managerName, allEmployees) ||
                      draft.managerName
                    }
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, managerName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Select from Employee Master —</option>
                    {allEmployees
                      .filter((e) => e.id !== initial.id)
                      .map((e) => (
                        <option key={e.id} value={e.name}>
                          {e.name}
                          {e.ecn ? ` (${e.ecn})` : ""}
                          {e.designation ? ` · ${e.designation}` : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-foreground">
                    {resolveReportingManagerName(draft.managerName, allEmployees) ||
                      draft.managerName ||
                      "—"}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              Compensation
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Last increment (%)"
                value={draft.lastIncrementPercent}
                editing={editing}
                onChange={(v) => setDraft((d) => ({ ...d, lastIncrementPercent: v }))}
                placeholder="e.g. 12"
              />
              {!editing && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last increment</p>
                  <p className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                    <TrendingUp className="h-4 w-4" />
                    {incrementLabel}
                  </p>
                </div>
              )}
              <Field
                label="Last CTC"
                value={draft.lastCtc}
                editing={editing}
                onChange={(v) => setDraft((d) => ({ ...d, lastCtc: v }))}
                placeholder="e.g. 8.5 Lakh or 850000"
              />
              {!editing && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CTC (display)</p>
                  <p className="text-sm font-semibold text-foreground">{ctcLabel}</p>
                </div>
              )}
              <Field
                label="Last promotion date"
                value={draft.lastPromotionDate}
                editing={editing}
                onChange={(v) => setDraft((d) => ({ ...d, lastPromotionDate: v }))}
                placeholder="DD.MM.YYYY"
              />
              {!editing && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last promotion</p>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {promotionLabel}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Mail className="h-4 w-4" />
              Contact
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" value={draft.email} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} type="email" />
              <Field label="Phone" value={draft.phone} editing={editing} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />
              {linkedUser && !editing && (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">App login</p>
                  <p className="text-sm">{linkedUser.email} · {linkedUser.role}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Quick links
            </h2>
            <div className="flex flex-col gap-2">
              <Link
                href={kraHref}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted/50"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                KRA / KPI sheet
              </Link>
              <Link
                href={quarterlyHref}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted/50"
              >
                <BarChart3 className="h-4 w-4 text-violet-600" />
                Quarterly report
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              KPIs ({kpis.length})
            </h2>
            {kpis.length === 0 ? (
              <p className="text-sm text-muted-foreground">No individual KPIs linked yet.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {kpis.slice(0, 12).map((k) => (
                  <li key={k.id} className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="font-medium leading-snug">{k.name}</p>
                    <p className="text-xs text-muted-foreground">{k.kraName ?? k.department}</p>
                  </li>
                ))}
                {kpis.length > 12 && (
                  <li className="text-xs text-muted-foreground">+{kpis.length - 12} more</li>
                )}
              </ul>
            )}
          </section>

          <section className={cn("rounded-2xl border p-4 text-sm", initial.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
            <p className="font-semibold">{initial.isActive ? "Active employee" : "Inactive"}</p>
            {editing && (
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                />
                Active
              </label>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
