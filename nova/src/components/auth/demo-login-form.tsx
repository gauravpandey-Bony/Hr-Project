"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  KeyRound,
  LogIn,
  Shield,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ShowcaseAccount = {
  id: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  title: string | null;
  department: string | null;
  loginId: string;
  loginPassword: string;
  teamSize?: number;
};

type ShowcaseResponse = {
  showcase: {
    admin: ShowcaseAccount | null;
    manager: ShowcaseAccount | null;
  } | null;
  hasEmployeeLogin?: boolean;
};

async function loginRequest(userId: string, password: string, redirect: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ userId, password, redirect }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as { user: { name: string }; redirect?: string };
}

function QuickLoginCard({
  account,
  variant,
  loading,
  onLogin,
}: {
  account: ShowcaseAccount;
  variant: "admin" | "manager";
  loading: boolean;
  onLogin: () => void;
}) {
  const isAdmin = variant === "admin";
  const Icon = isAdmin ? Shield : Users;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
        isAdmin
          ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 shadow-sm hover:shadow-md"
          : "border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-indigo-50/40 shadow-sm hover:shadow-md"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-opacity group-hover:opacity-100",
          isAdmin ? "bg-amber-300/20 opacity-70" : "bg-violet-300/20 opacity-70"
        )}
      />

      <div className="relative flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
            isAdmin
              ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white"
              : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {isAdmin ? "Administrator" : "Reporting manager"}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold tracking-tight text-foreground">
            {account.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {account.title ?? "Manager"}
            {account.department ? ` · ${account.department}` : ""}
          </p>
          {!isAdmin && account.teamSize ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
              <BadgeCheck className="h-3.5 w-3.5" />
              {account.teamSize} direct reports with live KRA data
            </p>
          ) : null}
          {isAdmin ? (
            <p className="mt-2 font-mono text-xs text-amber-800/80">
              {account.loginId} · ready to sign in
            </p>
          ) : (
            <p className="mt-2 font-mono text-xs text-violet-800/80">
              ECN {account.loginId}
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        className={cn(
          "relative mt-5 w-full gap-2 shadow-sm",
          isAdmin
            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        )}
        size="lg"
        disabled={loading}
        onClick={onLogin}
      >
        {loading ? "Signing in…" : isAdmin ? "Sign in as Admin" : "Sign in as Manager"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function DemoLoginForm({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [showcase, setShowcase] = useState<ShowcaseResponse["showcase"]>(null);
  const [hasEmployeeLogin, setHasEmployeeLogin] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [loading, setLoading] = useState<"admin" | "manager" | "employee" | null>(null);
  const [loadingShowcase, setLoadingShowcase] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/accounts");
        const data = (await res.json()) as ShowcaseResponse;
        setShowcase(data.showcase);
        setHasEmployeeLogin(data.hasEmployeeLogin ?? false);
      } catch {
        toast.error("Could not load sign-in options");
      } finally {
        setLoadingShowcase(false);
      }
    })();
  }, []);

  async function handleLogin(
    userId: string,
    password: string,
    kind: "admin" | "manager" | "employee"
  ) {
    setLoading(kind);
    try {
      const data = await loginRequest(userId, password, redirect);
      toast.success(`Signed in as ${data.user.name}`);
      window.location.assign(data.redirect ?? "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(null);
    }
  }

  if (loadingShowcase) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-36 animate-pulse rounded-2xl bg-muted/60" />
      </div>
    );
  }

  if (!showcase?.admin && !showcase?.manager && !hasEmployeeLogin) {
    return (
      <p className="text-sm text-muted-foreground">
        No sign-in accounts available. Run <code className="font-mono">npm run db:seed</code> on
        the server.
      </p>
    );
  }

  const showEmployeeLogin = hasEmployeeLogin;

  return (
    <div className={cn("space-y-5", compact ? "max-w-md" : "max-w-lg")}>
      {!compact && (
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Secure workspace access
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Admin and manager quick access below. Employees sign in with ECN and password.
          </p>
        </div>
      )}

      {showcase.admin ? (
        <QuickLoginCard
          account={showcase.admin}
          variant="admin"
          loading={loading === "admin"}
          onLogin={() =>
            void handleLogin(
              showcase.admin!.loginId,
              showcase.admin!.loginPassword,
              "admin"
            )
          }
        />
      ) : null}

      {showEmployeeLogin ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin(employeeId.trim(), employeePassword, "employee");
          }}
          className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Employee
              </p>
              <h3 className="text-base font-bold text-foreground">ECN login</h3>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee code (ECN)</Label>
              <Input
                id="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="font-mono"
                placeholder="e.g. 101911"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeePassword">Password</Label>
              <Input
                id="employeePassword"
                type="password"
                value={employeePassword}
                onChange={(e) => setEmployeePassword(e.target.value)}
                className="font-mono"
                placeholder="First login: same as ECN"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            First-time login uses ECN as password. You will be asked to change it.
          </p>

          <Button
            type="submit"
            className="mt-4 w-full gap-2"
            size="lg"
            disabled={loading === "employee"}
          >
            <LogIn className="h-4 w-4" />
            {loading === "employee" ? "Signing in…" : "Sign in as Employee"}
          </Button>
        </form>
      ) : null}

      {showcase.manager ? (
        <QuickLoginCard
          account={showcase.manager}
          variant="manager"
          loading={loading === "manager"}
          onLogin={() =>
            void handleLogin(
              showcase.manager!.loginId,
              showcase.manager!.loginPassword,
              "manager"
            )
          }
        />
      ) : null}
    </div>
  );
}
