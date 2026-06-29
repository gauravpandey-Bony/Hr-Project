"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LogIn, Shield, Users, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LoginAccount = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  title: string | null;
  department: string | null;
};

function roleBadgeVariant(role: string) {
  if (role === "ADMIN") return "default";
  if (role === "MANAGER") return "secondary";
  return "outline";
}

function AccountCard({
  account,
  active,
  onSelect,
}: {
  account: LoginAccount;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon =
    account.role === "ADMIN" ? Shield : account.role === "MANAGER" ? Users : User;

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
          <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
          <Badge variant={roleBadgeVariant(account.role)} className="shrink-0 text-[10px]">
            {account.role}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {account.title ?? "—"}
          {account.department ? ` · ${account.department}` : ""}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{account.id}</p>
      </div>
    </button>
  );
}

export function DemoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/accounts");
        const data = await res.json();
        const list = (data.accounts ?? []) as LoginAccount[];
        setAccounts(list);
        const first = list[0];
        if (first) {
          setSelectedId(first.id);
          setUserId(first.id);
        }
      } catch {
        toast.error("Could not load accounts");
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, []);

  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0];

  function selectAccount(account: LoginAccount) {
    setSelectedId(account.id);
    setUserId(account.id);
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

  const admins = accounts.filter((a) => a.role === "ADMIN");
  const managers = accounts.filter((a) => a.role === "MANAGER");
  const employees = accounts.filter((a) => a.role === "EMPLOYEE");

  if (loadingAccounts) {
    return <p className="text-sm text-muted-foreground">Loading accounts…</p>;
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No users in database. Run <code className="font-mono">npm run db:seed</code> on the server.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an account — enter password from your administrator
        </p>
      </div>

      {admins.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700">
            <Shield className="h-3.5 w-3.5" />
            Administrator
          </p>
          {admins.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              active={selectedId === a.id}
              onSelect={() => selectAccount(a)}
            />
          ))}
        </div>
      )}

      {managers.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Managers
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {managers.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                active={selectedId === a.id}
                onSelect={() => selectAccount(a)}
              />
            ))}
          </div>
        </div>
      )}

      {employees.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            Employees
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {employees.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                active={selectedId === a.id}
                onSelect={() => selectAccount(a)}
              />
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
      >
        {selected && (
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
            <Building2 className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {selected.title ?? "—"} · {selected.department ?? "—"}
              </p>
            </div>
            <Badge variant={roleBadgeVariant(selected.role)}>{selected.role}</Badge>
          </div>
        )}

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
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          <LogIn className="h-4 w-4" />
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
