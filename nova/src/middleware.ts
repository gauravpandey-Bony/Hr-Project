import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import {
  canAccessDashboardPath,
  canAccessUnitPicker,
  employeeDashboardRedirect,
  managerDashboardRedirect,
  roleHomeRedirect,
} from "@/lib/access-control";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/constants";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const userId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirect",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(loginUrl);
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value as
    | UserRole
    | undefined;

  const pathname = request.nextUrl.pathname;

  if (
    role &&
    pathname === "/dashboard" &&
    !canAccessUnitPicker(role)
  ) {
    return NextResponse.redirect(
      new URL(roleHomeRedirect(role), request.url)
    );
  }

  if (
    role === "EMPLOYEE" &&
    !canAccessDashboardPath(role, pathname)
  ) {
    return NextResponse.redirect(
      new URL(employeeDashboardRedirect(userId), request.url)
    );
  }

  if (
    role === "MANAGER" &&
    !canAccessDashboardPath(role, pathname)
  ) {
    return NextResponse.redirect(
      new URL(managerDashboardRedirect(pathname), request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
