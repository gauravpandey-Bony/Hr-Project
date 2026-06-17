"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  LogIn,
  Shield,
  Users,
  User,
  Copy,
  Check,
  Building2,
} from "lucide-react";
import {
  DEMO_ACCOUNTS,
  DEMO_CREDENTIALS,
  type DemoRoleKey,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AccountOption = {
  key: DemoRoleKey;
  label: string;
  subtitle: string;
};

const ADMIN_ACCOUNT: AccountOption = {
  key: "admin",
  label: "Administrator",
  subtitle: "Full access · Employee & department masters",
};

const MANAGER_ACCOUNTS: AccountOption[] = [
  { key: "itManager", label: "Bhupesh Sharma", subtitle: "IT Sr. Manager" },
  { key: "manager", label: "Praveen Kumar", subtitle: "Store Manager" },
];

const EMPLOYEE_ACCOUNTS: AccountOption[] = [
  { key: "sikandarKhan", label: "Sikandar Khan", subtitle: "Sr. Engr-IT" },
  { key: "sudhaJetli", label: "Sudha Jetli", subtitle: "Sr. Officer · Billing" },
  { key: "employee", label: "Ms. Mahima", subtitle: "DEO · Billing" },
  { key: "rajKumar", label: "Raj Kumar", subtitle: "Plant Head" },
];

function roleBadgeVariant(role: string) {
  if (role === "ADMIN") return "default";
  if (role === "MANAGER") return "secondary";
  return "outline";
}

function AccountCard({
  option,
  active,
  onSelect,
}: {
  option: AccountOption;
  active: boolean;
  onSelect: () => void;
}) {
  const creds = DEMO_CREDENTIALS[option.key];
  const Icon =
    creds.role === "ADMIN" ? Shield : creds.role === "MANAGER" ? Users : User;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
        active
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{option.label}</p>
          <Badge variant={roleBadgeVariant(creds.role)} className="shrink-0 text-[10px]">
            {creds.role}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{option.subtitle}</p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {creds.userId} · {creds.password}
        </p>
      </div>
    </button>
  );
}

export function DemoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [role, setRole] = useState<DemoRoleKey>("sikandarKhan");
  const [userId, setUserId] = useState(DEMO_CREDENTIALS.sikandarKhan.userId);
  const [password, setPassword] = useState(DEMO_CREDENTIALS.sikandarKhan.password);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function selectRole(next: DemoRoleKey) {
    setRole(next);
    setUserId(DEMO_CREDENTIALS[next].userId);
    setPassword(DEMO_CREDENTIALS[next].password);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password, redirect }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Login failed");
        return;
      }
      toast.success(`Signed in as ${data.user.name}`);
      router.push(data.redirect ?? "/dashboard");
      router.refresh();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  function copyCredentials() {
    const c = DEMO_CREDENTIALS[role];
    const text = `${c.name} (${c.role})\nID: ${c.userId}\nPassword: ${c.password}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied");
    setTimeout(() => setCopied(false), 2000);
  }

  const creds = DEMO_CREDENTIALS[role];
  const account = DEMO_ACCOUNTS[role];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an account — credentials auto-fill below
        </p>
      </div>

      {/* Admin — separate */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700">
          <Shield className="h-3.5 w-3.5" />
          Administrator
        </p>
        <AccountCard
          option={ADMIN_ACCOUNT}
          active={role === "admin"}
          onSelect={() => selectRole("admin")}
        />
      </div>

      {/* Managers */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Managers
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MANAGER_ACCOUNTS.map((opt) => (
            <AccountCard
              key={opt.key}
              option={opt}
              active={role === opt.key}
              onSelect={() => selectRole(opt.key)}
            />
          ))}
        </div>
      </div>

      {/* Employees */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          Employees
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {EMPLOYEE_ACCOUNTS.map((opt) => (
            <AccountCard
              key={opt.key}
              option={opt}
              active={role === opt.key}
              onSelect={() => selectRole(opt.key)}
            />
          ))}
        </div>
      </div>

      {/* Sign-in form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
      >
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
          <Building2 className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{creds.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {account.title} · {account.department}
            </p>
          </div>
          <Badge variant={roleBadgeVariant(creds.role)}>{creds.role}</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="font-mono text-sm"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono text-sm"
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" size="lg" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={copyCredentials}
            className="shrink-0"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Demo environment · Admin: <span className="font-mono">demo-admin</span> /{" "}
        <span className="font-mono">admin123</span>
      </p>
    </div>
  );
}
