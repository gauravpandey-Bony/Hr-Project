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
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card3D } from "@/components/ui/card-3d";
import { cn } from "@/lib/utils";
import { formatDepartmentDisplayName } from "@/lib/masters/department-master-sync";

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
  floatIndex,
}: {
  account: ShowcaseAccount;
  variant: "admin" | "manager";
  loading: boolean;
  onLogin: () => void;
  floatIndex: number;
}) {
  const isAdmin = variant === "admin";
  const Icon = isAdmin ? Shield : Users;

  return (
    <Card3D
      floatIndex={floatIndex}
      className={cn(
        "login-card-3d border-0 p-4 sm:p-5",
        isAdmin
          ? "bg-gradient-to-br from-amber-50 via-white to-orange-50/70"
          : "bg-gradient-to-br from-slate-50 via-white to-sky-50/70"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-3xl",
          isAdmin ? "bg-amber-400/30" : "bg-sky-400/25"
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full blur-3xl",
          isAdmin ? "bg-orange-300/20" : "bg-indigo-300/15"
        )}
        aria-hidden
      />

      <div className="relative flex items-start gap-4" style={{ transform: "translateZ(28px)" }}>
        <div
          className={cn(
            "login-icon-3d flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
            isAdmin
              ? "bg-gradient-to-br from-amber-400 via-orange-500 to-orange-700"
              : "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700"
          )}
        >
          <Icon className="h-5 w-5 drop-shadow-sm" />
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
            {account.department ? (
              <>
                {" · "}
                <span className="dept-name">
                  {formatDepartmentDisplayName(account.department)}
                </span>
              </>
            ) : null}
          </p>
          {!isAdmin && account.teamSize ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-sky-800 shadow-sm ring-1 ring-sky-100">
              <BadgeCheck className="h-3.5 w-3.5" />
              {account.teamSize} direct reports with live KRA data
            </p>
          ) : null}
          {isAdmin ? (
            <p className="mt-2 font-mono text-xs text-amber-800/80">
              {account.loginId} · ready to sign in
            </p>
          ) : (
            <p className="mt-2 font-mono text-xs text-sky-800/80">ECN {account.loginId}</p>
          )}
        </div>
      </div>

      <Button
        type="button"
        className={cn(
          "login-btn-3d relative mt-5 w-full gap-2 text-white",
          isAdmin
            ? "bg-gradient-to-b from-amber-400 via-orange-500 to-orange-700 hover:from-amber-400 hover:via-orange-500 hover:to-orange-700"
            : "bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-700 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-700"
        )}
        size="lg"
        disabled={loading}
        onClick={onLogin}
        style={{ transform: "translateZ(36px)" }}
      >
        {loading ? "Signing in…" : isAdmin ? "Sign in as Admin" : "Sign in as Manager"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card3D>
  );
}

export function DemoLoginForm() {
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
        <div className="h-36 animate-pulse rounded-[1.35rem] bg-muted/60 shadow-inner" />
        <div className="h-52 animate-pulse rounded-[1.35rem] bg-muted/60 shadow-inner" />
        <div className="h-36 animate-pulse rounded-[1.35rem] bg-muted/60 shadow-inner" />
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
  let floatCursor = 0;

  return (
    <div className="space-y-4">
      {showcase.admin ? (
        <QuickLoginCard
          account={showcase.admin}
          variant="admin"
          floatIndex={floatCursor++}
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
        <Card3D
          floatIndex={floatCursor++}
          className="login-card-3d border-0 bg-gradient-to-br from-sky-50/90 via-white to-blue-50/60 p-4 sm:p-5"
        >
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-sky-400/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-14 -left-8 h-28 w-28 rounded-full bg-blue-500/15 blur-3xl"
            aria-hidden
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin(employeeId.trim(), employeePassword, "employee");
            }}
            className="relative"
          >
            <div
              className="mb-5 flex items-center gap-3"
              style={{ transform: "translateZ(28px)" }}
            >
              <div className="login-icon-3d flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-blue-700 text-white">
                <UserRound className="h-5 w-5 drop-shadow-sm" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Employee
                </p>
                <h3 className="text-lg font-bold tracking-tight text-foreground">ECN login</h3>
              </div>
            </div>

            <div
              className="grid gap-4 sm:grid-cols-2"
              style={{ transform: "translateZ(24px)" }}
            >
              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-xs font-semibold tracking-wide">
                  Employee code (ECN)
                </Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="login-input-3d h-11 font-mono"
                  placeholder="e.g. 101911"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeePassword" className="text-xs font-semibold tracking-wide">
                  Password
                </Label>
                <Input
                  id="employeePassword"
                  type="password"
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  className="login-input-3d h-11 font-mono"
                  placeholder="First login: same as ECN"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <p
              className="mt-3.5 flex items-start gap-2 rounded-xl bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-900/75 ring-1 ring-sky-100/80"
              style={{ transform: "translateZ(20px)" }}
            >
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
              First-time login uses ECN as password. You will be asked to change it.
            </p>

            <Button
              type="submit"
              className="login-btn-3d mt-4 w-full gap-2 bg-gradient-to-b from-sky-400 via-blue-500 to-blue-700 text-white hover:from-sky-400 hover:via-blue-500 hover:to-blue-700"
              size="lg"
              disabled={loading === "employee"}
              style={{ transform: "translateZ(36px)" }}
            >
              <LogIn className="h-4 w-4" />
              {loading === "employee" ? "Signing in…" : "Sign in as Employee"}
            </Button>
          </form>
        </Card3D>
      ) : null}

      {showcase.manager ? (
        <QuickLoginCard
          account={showcase.manager}
          variant="manager"
          floatIndex={floatCursor++}
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
