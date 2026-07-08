import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { MUST_CHANGE_COOKIE } from "@/lib/constants";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  const mustChange = (await cookies()).get(MUST_CHANGE_COOKIE)?.value === "1";

  if (!user) {
    redirect("/login");
  }

  if (!user.mustChangePassword && !mustChange) {
    redirect("/dashboard");
  }

  return (
    <div className="login-mesh flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Change password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome, {user.name}. Set a secure password before continuing.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
