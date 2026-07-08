import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { attachSessionCookie } from "@/lib/session";
import { roleHomeRedirect } from "@/lib/access-control";

export async function POST(request: Request) {
  const body = await request.json();
  const loginId = String(body.userId ?? body.email ?? body.ecn ?? "").trim();
  const password = String(body.password ?? "");

  if (!loginId || !password) {
    return NextResponse.json(
      { error: "Employee code and password required" },
      { status: 400 }
    );
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { id: loginId },
        { email: loginId.toLowerCase() },
        { hrisExternalId: loginId },
      ],
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid employee code or password" },
      { status: 401 }
    );
  }

  if (user.mustChangePassword) {
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role },
      redirect: "/change-password",
      mustChangePassword: true,
    });
    return attachSessionCookie(response, user.id, user.role, true);
  }

  const defaultRedirect = roleHomeRedirect(user.role);
  const redirectTo =
    typeof body.redirect === "string" &&
    body.redirect.startsWith("/dashboard") &&
    (user.role === "ADMIN" || body.redirect !== "/dashboard")
      ? body.redirect
      : defaultRedirect;

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    redirect: redirectTo,
    mustChangePassword: false,
  });
  return attachSessionCookie(response, user.id, user.role, false);
}
