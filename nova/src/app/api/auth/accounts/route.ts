import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { personNamesMatch } from "@/lib/person-name";
import { SEED_USERS, seedPasswordForUser } from "../../../../../prisma/seed-users";

export type ShowcaseAccount = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  title: string | null;
  department: string | null;
  loginId: string;
  loginPassword: string;
  teamSize?: number;
};

function showcaseCredentials(user: {
  id: string;
  role: string;
  hrisExternalId: string | null;
}): { loginId: string; loginPassword: string } | null {
  const seed = SEED_USERS.find((u) => u.id === user.id);
  if (seed) {
    return {
      loginId: seed.ecn?.trim() || user.id,
      loginPassword: seedPasswordForUser(user.id, seed.defaultPassword),
    };
  }

  const ecn = user.hrisExternalId?.trim();
  if (ecn) {
    return { loginId: ecn, loginPassword: ecn };
  }

  if (user.role === "ADMIN") {
    return {
      loginId: user.id,
      loginPassword: process.env.SHOWCASE_ADMIN_PASSWORD?.trim() || "admin123",
    };
  }

  return null;
}

async function pickShowcaseManager(
  organizationId: string,
  managers: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    title: string | null;
    department: string | null;
    hrisExternalId: string | null;
  }[]
): Promise<(typeof managers)[0] & { teamSize: number } | null> {
  if (!managers.length) return null;

  const [employees, kpis] = await Promise.all([
    db.employeeMaster.findMany({
      where: { organizationId, isActive: true },
      select: { name: true, managerName: true },
    }),
    db.kpi.findMany({
      where: { organizationId, isActive: true, ownerName: { not: null } },
      select: { ownerName: true },
    }),
  ]);

  const ownersWithKpis = new Set(
    kpis.map((k) => (k.ownerName ?? "").toLowerCase()).filter(Boolean)
  );

  let best: { user: (typeof managers)[0]; score: number; teamSize: number } | null = null;

  for (const mgr of managers) {
    const reports = employees.filter(
      (e) => e.managerName?.trim() && personNamesMatch(e.managerName, mgr.name)
    );
    if (!reports.length) continue;

    const reportsWithKpis = reports.filter((r) =>
      ownersWithKpis.has(r.name.toLowerCase())
    ).length;
    const score = reportsWithKpis * 10 + reports.length;

    if (!best || score > best.score) {
      best = { user: mgr, score, teamSize: reports.length };
    }
  }

  if (best) return { ...best.user, teamSize: best.teamSize };

  const fallback = managers.find((m) => showcaseCredentials(m));
  return fallback ? { ...fallback, teamSize: 0 } : null;
}

export async function GET() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    return NextResponse.json({ showcase: null, organization: null });
  }

  const users = await db.user.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      title: true,
      department: true,
      hrisExternalId: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const admins = users.filter((u) => u.role === "ADMIN");
  const managers = users.filter((u) => u.role === "MANAGER");

  const adminUser = admins.find((u) => u.id === "demo-admin") ?? admins[0] ?? null;
  const managerPick = await pickShowcaseManager(org.id, managers);

  const showcase: {
    admin: ShowcaseAccount | null;
    manager: ShowcaseAccount | null;
  } = {
    admin: null,
    manager: null,
  };

  if (adminUser) {
    const creds = showcaseCredentials(adminUser);
    if (creds) {
      showcase.admin = {
        ...adminUser,
        role: "ADMIN",
        loginId: creds.loginId,
        loginPassword: creds.loginPassword,
      };
    }
  }

  if (managerPick) {
    const creds = showcaseCredentials(managerPick);
    if (creds) {
      showcase.manager = {
        id: managerPick.id,
        email: managerPick.email,
        name: managerPick.name,
        role: "MANAGER",
        title: managerPick.title,
        department: managerPick.department,
        loginId: creds.loginId,
        loginPassword: creds.loginPassword,
        teamSize: managerPick.teamSize,
      };
    }
  }

  const hasEmployeeLogin =
    (await db.user.count({
      where: { organizationId: org.id, hrisExternalId: { not: null } },
    })) > 0;

  const switchableAccounts = [showcase.admin, showcase.manager]
    .filter((u): u is ShowcaseAccount => u != null)
    .map(({ id, name, role }) => ({ id, name, role }));

  return NextResponse.json({
    organization: { id: org.id, name: org.name },
    showcase,
    hasEmployeeLogin,
    switchableAccounts,
  });
}
