"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Shield, Users } from "lucide-react";
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

export function DemoLoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [showcase, setShowcase] = useState<ShowcaseResponse["showcase"]>(null);
  const [hasEmployeeLogin, setHasEmployeeLogin] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [loading, setLoading] = useState<"admin" | "manager" | "employee" | null>(
    null
  );
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
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
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

  return (
    <div className="space-y-5">
      {hasEmployeeLogin ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin(employeeId.trim(), employeePassword, "employee");
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="employeeId" className="text-sm font-semibold text-slate-800">
              Employee code (ECN)
              <span className="ml-0.5 text-rose-500" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-11 rounded-lg border-slate-200 bg-white font-mono text-[15px] shadow-none placeholder:text-slate-400 focus-visible:ring-[#1e3a5f]/30"
              placeholder="Type here"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="employeePassword"
              className="text-sm font-semibold text-slate-800"
            >
              Password
              <span className="ml-0.5 text-rose-500" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="employeePassword"
              type="password"
              value={employeePassword}
              onChange={(e) => setEmployeePassword(e.target.value)}
              className="h-11 rounded-lg border-slate-200 bg-white font-mono text-[15px] shadow-none placeholder:text-slate-400 focus-visible:ring-[#1e3a5f]/30"
              placeholder="Type here"
              autoComplete="current-password"
              required
            />
          </div>

          <Button
            type="submit"
            className="mt-1 h-12 w-full gap-2 rounded-lg bg-[#1e3a5f] text-[15px] font-semibold text-white hover:bg-[#172e4c]"
            disabled={loading === "employee"}
          >
            {loading === "employee" ? "Signing in…" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      ) : null}

      {(showcase?.admin || showcase?.manager) && (
        <div className="space-y-2.5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-400">Quick access</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {showcase.admin ? (
              <button
                type="button"
                disabled={loading === "admin"}
                onClick={() =>
                  void handleLogin(
                    showcase.admin!.loginId,
                    showcase.admin!.loginPassword,
                    "admin"
                  )
                }
                className={cn(
                  "flex flex-1 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white",
                  loading === "admin" && "opacity-60"
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1e3a5f] text-white">
                  <Shield className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {loading === "admin" ? "Signing in…" : "Admin"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {showcase.admin.name}
                  </span>
                </span>
              </button>
            ) : null}

            {showcase.manager ? (
              <button
                type="button"
                disabled={loading === "manager"}
                onClick={() =>
                  void handleLogin(
                    showcase.manager!.loginId,
                    showcase.manager!.loginPassword,
                    "manager"
                  )
                }
                className={cn(
                  "flex flex-1 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white",
                  loading === "manager" && "opacity-60"
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-600 text-white">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {loading === "manager" ? "Signing in…" : "Manager"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {showcase.manager.name}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-400">
        By continuing, you agree to Bony Polymers&apos;{" "}
        <span className="font-medium text-[#1e3a5f]">Terms of service</span> and{" "}
        <span className="font-medium text-[#1e3a5f]">Privacy Policy</span>.
      </p>
    </div>
  );
}
