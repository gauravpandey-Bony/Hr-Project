import type { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { ROLE_COOKIE, SESSION_COOKIE } from "./constants";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  secure: process.env.NODE_ENV === "production",
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
