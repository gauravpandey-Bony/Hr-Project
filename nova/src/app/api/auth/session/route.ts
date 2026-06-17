import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { DEMO_USERS, SESSION_COOKIE } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { roleHomeRedirect } from "@/lib/access-control";
import { attachSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? DEMO_USERS.admin;
  const requestedRedirect = searchParams.get("redirect");

  const cookieStore = await cookies();
  const currentId = cookieStore.get(SESSION_COOKIE)?.value;
  const current = currentId
    ? await db.user.findUnique({ where: { id: currentId } })
    : null;

  if (current?.role === "EMPLOYEE" && userId !== current.id) {
    return NextResponse.redirect(new URL(roleHomeRedirect("EMPLOYEE"), request.url));
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const fallbackRedirect = roleHomeRedirect(user.role);
  const redirectTo =
    requestedRedirect?.startsWith("/dashboard") &&
    (user.role === "ADMIN" || requestedRedirect !== "/dashboard")
      ? requestedRedirect
      : fallbackRedirect;

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  return attachSessionCookie(response, user.id, user.role);
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  const { userId } = await request.json();

  if (current?.role === "EMPLOYEE" && userId !== current.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
  });
  return attachSessionCookie(response, user.id, user.role);
}
