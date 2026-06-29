import type { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { ROLE_COOKIE, SESSION_COOKIE } from "./constants";

/** Secure cookies only on HTTPS — HTTP deploys (e.g. bare IP) must not set Secure or login loops. */
function sessionCookieSecure(): boolean {
  const explicit = process.env.SESSION_COOKIE_SECURE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.startsWith("https://");
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  get secure() {
    return sessionCookieSecure();
  },
};

export function attachSessionCookie(
  response: NextResponse,
  userId: string,
  role?: UserRole
) {
  response.cookies.set(SESSION_COOKIE, userId, sessionCookieOptions);
  if (role) {
    response.cookies.set(ROLE_COOKIE, role, sessionCookieOptions);
  }
  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(ROLE_COOKIE);
}
