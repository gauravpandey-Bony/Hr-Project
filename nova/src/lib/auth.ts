import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE } from "./constants";
import type { User, UserRole } from "@prisma/client";

/** Deduped per request — layout + page share one DB lookup. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
});

export async function requireUser(role?: UserRole[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (role && !role.includes(user.role)) throw new Error("Forbidden");
  return user;
}
