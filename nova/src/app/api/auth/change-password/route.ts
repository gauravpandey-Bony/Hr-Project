import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { attachSessionCookie } from "@/lib/session";
import { roleHomeRedirect } from "@/lib/access-control";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = bodySchema.parse(await request.json());

  if (body.newPassword !== body.confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  if (body.newPassword === body.currentPassword) {
    return NextResponse.json(
      { error: "New password must be different from current password" },
      { status: 400 }
    );
  }

  const ecn = user.hrisExternalId?.trim();
  if (ecn && body.newPassword === ecn) {
    return NextResponse.json(
      { error: "New password cannot be the same as your employee code (ECN)" },
      { status: 400 }
    );
  }

  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const passwordHash = await hashPassword(body.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  const redirect = roleHomeRedirect(user.role);
  const response = NextResponse.json({ ok: true, redirect });
  return attachSessionCookie(response, user.id, user.role, false);
}
