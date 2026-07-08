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
import { MUST_CHANGE_COOKIE, ROLE_COOKIE, SESSION_COOKIE } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userId = request.cookies.get(SESSION_COOKIE)?.value;
  const mustChange = request.cookies.get(MUST_CHANGE_COOKIE)?.value === "1";

  if (pathname === "/change-password") {
    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!mustChange) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirect",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(loginUrl);
  }

  if (mustChange) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value as
    | UserRole
    | undefined;

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
  matcher: ["/dashboard", "/dashboard/:path*", "/change-password"],
};
