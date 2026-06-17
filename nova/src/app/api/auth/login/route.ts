import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  DEMO_CREDENTIALS,
  demoRoleForUserId,
  isValidDemoPassword,
  type DemoRoleKey,
} from "@/lib/constants";
import { attachSessionCookie } from "@/lib/session";
import { roleHomeRedirect } from "@/lib/access-control";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.userId ?? "").trim();
  const password = String(body.password ?? "");

  const role = demoRoleForUserId(userId);
  if (!role || !isValidDemoPassword(role, password)) {
    return NextResponse.json(
      { error: "Invalid user ID or password" },
      { status: 401 }
    );
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
  });
  return attachSessionCookie(response, user.id, user.role);
}

/** Reference for demo accounts (no secrets beyond demo passwords) */
export async function GET() {
  return NextResponse.json({
    accounts: (Object.keys(DEMO_CREDENTIALS) as DemoRoleKey[]).map((key) => ({
      role: DEMO_CREDENTIALS[key].role,
      userId: DEMO_CREDENTIALS[key].userId,
      email: DEMO_CREDENTIALS[key].email,
      password: DEMO_CREDENTIALS[key].password,
      name: DEMO_CREDENTIALS[key].name,
    })),
  });
}
