import { db } from "@/lib/db";
import type { User, UserRole } from "@prisma/client";
import { formatKpiValue, OFF_TARGET_THRESHOLD } from "@/lib/kpi";
import {
  evaluateKpiCurrent,
  formatAnnualTargetLabel,
  isPlaceholderAchieved,
  parseAnnualTargetText,
  parseQuarterTargets,
} from "@/lib/kpi-quarters";
import { normalizeQuarterTargets } from "@/lib/kra/target-format";
import {
  normalizePersonName,
  personNameVariants,
  personNamesMatch,
} from "@/lib/person-name";
import { employeeMasterWhereForPlant } from "@/lib/unit-workspace";
import { locationToPlantUnitKey } from "@/lib/org-units.server";
import type { ChatBlock } from "./chat";

export type EmployeeKpiRow = {
  name: string;
  category: string;
  kraName: string | null;
  current: string;
  target: string;
  progress: string;
  progressNum: number;
  status: string;
  weightage: number | null;
};

export type EmployeeQuarterlyKpiRow = {
  id: string;
  name: string;
  category: string;
  kraName: string | null;
  unit: string;
  weightage: string;
  weightageNum: number | null;
  annualTarget: string;
  currentFormatted: string;
  targetValue: number;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  quarters: {
    q1: { target: string; achieved: string };
    q2: { target: string; achieved: string };
    q3: { target: string; achieved: string };
    q4: { target: string; achieved: string };
  };
  status: string;
  progress: string;
};

export type EmployeeDashboardData = {
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string | null;
    department: string | null;
    ecn: string | null;
    designation: string | null;
    managerName: string | null;
  };
  headline: string;
  stats: {
    label: string;
    value: string;
    sub?: string;
    tone: "green" | "amber" | "red" | "neutral";
  }[];
  statusSegments: { label: string; value: number; color: string }[];
  categoryBars: { label: string; progress: number }[];
  kpiBars: { name: string; progress: number; status: string }[];
  highlights: EmployeeKpiRow[];
  concerns: EmployeeKpiRow[];
  quarterlyReport: EmployeeQuarterlyKpiRow[];
  goals: { title: string; status: string; progress: string }[];
  reviews: { cycle: string; type: string; status: string; role: "reviewee" | "reviewer" }[];
  totalWeight: string;
};

type EmployeeUser = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "role"
  | "title"
  | "department"
  | "hrisExternalId"
  | "managerId"
>;

type MasterRow = {
  name: string;
  ecn: string | null;
  designation: string | null;
  department: string | null;
  managerName: string | null;
};

export type ResolvedEmployee =
  | { kind: "user"; user: EmployeeUser; master?: MasterRow | null }
  | { kind: "master"; master: MasterRow };

function normalize(s: string): string {
  return normalizePersonName(s);
}

/** User is asking for a person-specific report */
export function looksLikeEmployeeReportQuery(message: string): boolean {
  const q = normalize(message);
  if (
    /report|dashboard|summary|performance|status|details|profile|show|view/i.test(
      q
    )
  ) {
    return true;
  }
  if (/\b(demo-[a-z0-9-]+)\b/i.test(message)) return true;
  if (/\b\d{4,}\b/.test(message)) return true;
  if (/^(mr|ms|mrs)\s+/i.test(message.trim())) return true;
  return false;
}

function extractNumericIds(message: string): string[] {
  return [...new Set((message.match(/\b\d{4,}\b/g) ?? []).map((n) => n.trim()))];
}

function linkMasterToUser(
  master: MasterRow,
  users: EmployeeUser[]
): ResolvedEmployee | null {
  const key = normalizePersonName(master.name);
  const user = users.find((u) => normalizePersonName(u.name) === key);
  if (user) return { kind: "user", user, master };
  return { kind: "master", master };
}

export async function fetchKpisForEmployee(
  organizationId: string,
  ownerName: string,
  userId: string | null,
  plantUnit?: string | null
) {
  const variants = personNameVariants(ownerName);
  const candidates = await db.kpi.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(plantUnit ? { plantUnit } : {}),
      OR: [
        ...(userId ? [{ ownerId: userId }] : []),
        ...variants.map((v) => ({ ownerName: v })),
      ],
    },
    include: {
      entries: { orderBy: { recordedAt: "desc" }, take: 12 },
    },
    orderBy: [{ weightage: "desc" }, { name: "asc" }],
  });

  const seen = new Set<string>();
  return candidates.filter((k) => {
    if (seen.has(k.id)) return false;
    if (userId && k.ownerId === userId) {
      seen.add(k.id);
      return true;
    }
    if (k.ownerName && personNamesMatch(k.ownerName, ownerName)) {
      seen.add(k.id);
      return true;
    }
    return false;
  });
}

export async function resolveEmployeeFromQuery(
  message: string,
  organizationId: string
): Promise<ResolvedEmployee | null> {
  const q = normalize(message);
  if (q.length < 2) return null;

  const [users, masters] = await Promise.all([
    db.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        title: true,
        department: true,
        hrisExternalId: true,
        managerId: true,
      },
    }),
    db.employeeMaster.findMany({
      where: { organizationId, isActive: true },
      select: {
        name: true,
        ecn: true,
        designation: true,
        department: true,
        managerName: true,
      },
    }),
  ]);

  const pickBestUser = (candidates: EmployeeUser[]): EmployeeUser | null => {
    let best: EmployeeUser | null = null;
    let bestLen = 0;
    for (const u of candidates) {
      const n = normalize(u.name);
      if (n.length >= 3 && q.includes(n) && n.length > bestLen) {
        best = u;
        bestLen = n.length;
      }
    }
    return best;
  };

  const pickBestMaster = (candidates: MasterRow[]): MasterRow | null => {
    let best: MasterRow | null = null;
    let bestLen = 0;
    for (const m of candidates) {
      const n = normalize(m.name);
      if (n.length >= 3 && q.includes(n) && n.length > bestLen) {
        best = m;
        bestLen = n.length;
      }
    }
    return best;
  };

  for (const u of users) {
    if (q.includes(normalize(u.id))) {
      const master = masters.find((m) => normalize(m.name) === normalize(u.name));
      return { kind: "user", user: u, master: master ?? null };
    }
  }

  for (const num of extractNumericIds(message)) {
    const masterExact = masters.find((m) => m.ecn?.trim() === num);
    if (masterExact) return linkMasterToUser(masterExact, users);

    const masterByEcn = masters.find(
      (m) => m.ecn && (m.ecn.includes(num) || normalize(m.ecn).includes(num))
    );
    if (masterByEcn) return linkMasterToUser(masterByEcn, users);

    const userByEcn = users.find(
      (u) => u.hrisExternalId && u.hrisExternalId.includes(num)
    );
    if (userByEcn) {
      const master = masters.find((m) => normalize(m.name) === normalize(userByEcn.name));
      return { kind: "user", user: userByEcn, master: master ?? null };
    }
  }

  for (const u of users) {
    if (u.hrisExternalId && q.includes(normalize(u.hrisExternalId))) {
      const master = masters.find((m) => normalize(m.name) === normalize(u.name));
      return { kind: "user", user: u, master: master ?? null };
    }
  }

  for (const m of masters) {
    if (m.ecn && q.includes(normalize(m.ecn))) {
      return linkMasterToUser(m, users);
    }
  }

  for (const u of users) {
    const local = normalize(u.email.split("@")[0] ?? "");
    if (local.length >= 3 && q.includes(local)) {
      const master = masters.find((m) => normalize(m.name) === normalize(u.name));
      return { kind: "user", user: u, master: master ?? null };
    }
  }

  const byUserName = pickBestUser(users);
  if (byUserName) {
    const master = masters.find((m) => normalize(m.name) === normalize(byUserName.name));
    return { kind: "user", user: byUserName, master: master ?? null };
  }

  const byMasterName = pickBestMaster(masters);
  if (byMasterName) return linkMasterToUser(byMasterName, users);

  const skip = new Set([
    "report",
    "employee",
    "dashboard",
    "summary",
    "performance",
    "show",
    "kpi",
    "data",
    "the",
    "for",
    "of",
  ]);
  const tokens = q.split(" ").filter((t) => t.length >= 3 && !skip.has(t));

  for (const token of tokens) {
    const masterHits = masters.filter((m) => normalize(m.name).includes(token));
    if (masterHits.length === 1) return linkMasterToUser(masterHits[0], users);
    if (masterHits.length > 1) {
      const best = pickBestMaster(masterHits);
      if (best) return linkMasterToUser(best, users);
    }

    const userHits = users.filter((u) => normalize(u.name).includes(token));
    if (userHits.length === 1) {
      const master = masters.find((m) => normalize(m.name) === normalize(userHits[0].name));
      return { kind: "user", user: userHits[0], master: master ?? null };
    }
    if (userHits.length > 1) {
      const best = pickBestUser(userHits);
      if (best) {
        const master = masters.find((m) => normalize(m.name) === normalize(best.name));
        return { kind: "user", user: best, master: master ?? null };
      }
    }
  }

  // KPI sheet owners (e.g. Vijay Kumar Mishra) may exist before Employee Master row
  const kpiOwners = await db.kpi.findMany({
    where: { organizationId, isActive: true, ownerName: { not: null } },
    select: { ownerName: true, department: true },
    distinct: ["ownerName"],
  });
  const ownerHits = kpiOwners.filter(
    (k) => k.ownerName && personNamesMatch(k.ownerName, message)
  );
  if (ownerHits.length === 1 && ownerHits[0].ownerName) {
    const name = ownerHits[0].ownerName;
    const master = masters.find((m) => personNamesMatch(m.name, name));
    if (master) return linkMasterToUser(master, users);
    return {
      kind: "master",
      master: {
        name,
        ecn: null,
        designation: null,
        department: ownerHits[0].department,
        managerName: null,
      },
    };
  }

  return null;
}

function resolvedDisplayId(resolved: ResolvedEmployee): string {
  if (resolved.kind === "user") return resolved.user.id;
  const ecn = resolved.master.ecn?.trim();
  if (ecn) return ecn;
  return resolved.master.name;
}

export function resolvedOwnerName(resolved: ResolvedEmployee): string {
  return resolved.kind === "user" ? resolved.user.name : resolved.master.name;
}

export function resolvedUserId(resolved: ResolvedEmployee): string | null {
  return resolved.kind === "user" ? resolved.user.id : null;
}

export async function buildEmployeeDashboard(
  organizationId: string,
  resolved: ResolvedEmployee,
  plantUnitKey?: string | null
): Promise<EmployeeDashboardData> {
  const ownerName = resolvedOwnerName(resolved);
  const nameVariants = personNameVariants(ownerName);
  const master =
    resolved.kind === "master"
      ? resolved.master
      : resolved.master ??
        (await db.employeeMaster.findFirst({
          where: {
            organizationId,
            OR: nameVariants.map((n) => ({ name: n })),
          },
          select: {
            name: true,
            ecn: true,
            designation: true,
            department: true,
            managerName: true,
          },
        })) ??
        (await db.employeeMaster.findMany({
          where: { organizationId, isActive: true },
          select: {
            name: true,
            ecn: true,
            designation: true,
            department: true,
            managerName: true,
          },
        })).find((m) => personNamesMatch(m.name, ownerName)) ??
        null;

  const userId = resolved.kind === "user" ? resolved.user.id : null;

  const [kpis, goals, assignments, manager] = await Promise.all([
    fetchKpisForEmployee(organizationId, ownerName, userId, plantUnitKey),
    userId
      ? db.goal.findMany({
          where: { organizationId, ownerId: userId },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    userId
      ? db.reviewAssignment.findMany({
          where: {
            OR: [{ revieweeId: userId }, { reviewerId: userId }],
            cycle: { organizationId },
          },
          include: { cycle: { select: { name: true } } },
          orderBy: { dueDate: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    resolved.kind === "user" && resolved.user.managerId
      ? db.user.findUnique({
          where: { id: resolved.user.managerId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const rows: EmployeeKpiRow[] = kpis.map((k) => {
    const { current, progressNum, status } = evaluateKpiCurrent(k);
    return {
      name: k.name,
      category: k.category,
      kraName: k.kraName,
      current: formatKpiValue(current, k.unit),
      target: formatKpiValue(k.targetValue, k.unit),
      progress: `${progressNum}%`,
      progressNum,
      status,
      weightage: k.weightage,
    };
  });

  const green = rows.filter((k) => k.status === "green").length;
  const red = rows.filter((k) => k.status === "red").length;
  const avg =
    rows.length > 0
      ? Math.round(rows.reduce((s, k) => s + k.progressNum, 0) / rows.length)
      : 0;

  const byCategory = new Map<string, number[]>();
  for (const k of rows) {
    const cat = k.category || "Other";
    const list = byCategory.get(cat) ?? [];
    list.push(k.progressNum);
    byCategory.set(cat, list);
  }

  const categoryBars = Array.from(byCategory.entries())
    .map(([label, vals]) => ({
      label,
      progress: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))
    .sort((a, b) => b.progress - a.progress);

  const kpiBars = [...rows]
    .sort((a, b) => b.progressNum - a.progressNum)
    .map((k) => ({
      name: k.name,
      progress: k.progressNum,
      status: k.status,
    }));

  const sorted = [...rows].sort((a, b) => a.progressNum - b.progressNum);
  const totalWeight = rows.reduce((s, k) => s + (k.weightage ?? 0), 0);

  const quarterlyReport: EmployeeQuarterlyKpiRow[] = kpis.map((k) => {
    const { current, progressNum, status } = evaluateKpiCurrent(k);
    const rawQuarters = parseQuarterTargets(k.quarterTargets) ?? {
      q1: { target: "", achieved: "" },
      q2: { target: "", achieved: "" },
      q3: { target: "", achieved: "" },
      q4: { target: "", achieved: "" },
    };
    const quarters = normalizeQuarterTargets(rawQuarters, k.unit);
    const withAchieved = (q: keyof typeof quarters) => ({
      target: quarters[q].target || "—",
      achieved:
        isPlaceholderAchieved(quarters[q].achieved) ? "—" : quarters[q].achieved!,
    });

    return {
      id: k.id,
      name: k.name,
      category: k.category || "Other",
      kraName: k.kraName,
      unit: k.unit,
      weightage:
        k.weightage != null ? `${Math.round(k.weightage * 100)}%` : "—",
      weightageNum: k.weightage,
      annualTarget: formatAnnualTargetLabel(
        rawQuarters,
        parseAnnualTargetText(k.quarterTargets),
        k.targetValue,
        k.unit
      ),
      currentFormatted: formatKpiValue(current, k.unit),
      targetValue: k.targetValue,
      direction: k.direction,
      quarters: {
        q1: withAchieved("q1"),
        q2: withAchieved("q2"),
        q3: withAchieved("q3"),
        q4: withAchieved("q4"),
      },
      status,
      progress: `${progressNum}%`,
    };
  });

  const profile =
    resolved.kind === "user"
      ? {
          id: resolved.user.id,
          name: resolved.user.name,
          email: resolved.user.email,
          role: resolved.user.role,
          title: resolved.user.title,
          department: resolved.user.department ?? master?.department ?? null,
          ecn: resolved.user.hrisExternalId ?? master?.ecn ?? null,
          designation: master?.designation ?? resolved.user.title,
          managerName: master?.managerName ?? manager?.name ?? null,
        }
      : {
          id: resolvedDisplayId(resolved),
          name: master!.name,
          email: "—",
          role: "EMPLOYEE",
          title: master?.designation ?? null,
          department: master?.department ?? null,
          ecn: master?.ecn ?? null,
          designation: master?.designation ?? null,
          managerName: master?.managerName ?? null,
        };

  return {
    employee: profile,
    headline:
      rows.length > 0
        ? "Individual KPI performance report"
        : "Employee profile — no KPIs assigned yet",
    stats: [
      { label: "KPIs owned", value: String(rows.length), tone: "neutral" },
      { label: "On track", value: String(green), sub: `≥${OFF_TARGET_THRESHOLD}%`, tone: "green" },
      { label: "Off target", value: String(red), sub: `<${OFF_TARGET_THRESHOLD}%`, tone: "red" },
      {
        label: "Avg progress",
        value: rows.length ? `${avg}%` : "—",
        tone: rows.length === 0 ? "neutral" : avg >= OFF_TARGET_THRESHOLD ? "green" : "red",
      },
    ],
    statusSegments: [
      { label: "On track", value: green, color: "#10b981" },
      { label: "Off target", value: red, color: "#ef4444" },
    ].filter((s) => s.value > 0),
    categoryBars,
    kpiBars,
    highlights: [...rows]
      .filter((k) => k.status === "green")
      .sort((a, b) => b.progressNum - a.progressNum)
      .slice(0, 5),
    concerns: sorted
      .filter((k) => k.status !== "green")
      .slice(0, 5),
    quarterlyReport,
    goals: goals.map((g) => ({
      title: g.title,
      status: g.status,
      progress: `${g.currentValue}/${g.targetValue ?? "—"} ${g.unit ?? ""}`.trim(),
    })),
    reviews: assignments.map((a) => ({
      cycle: a.cycle.name,
      type: a.reviewType,
      status: a.status,
      role:
        userId && a.revieweeId === userId
          ? ("reviewee" as const)
          : ("reviewer" as const),
    })),
    totalWeight: totalWeight > 0 ? `${Math.round(totalWeight * 100)}%` : "—",
  };
}

async function suggestSimilarEmployees(
  message: string,
  organizationId: string,
  plantUnitKey?: string | null
): Promise<ChatBlock[]> {
  const q = normalize(message);
  const tokens = q.split(" ").filter((t) => t.length >= 3 && !/report|employee|dashboard/.test(t));

  const masters = await db.employeeMaster.findMany({
    where: plantUnitKey
      ? { ...employeeMasterWhereForPlant(organizationId, plantUnitKey), isActive: true }
      : { organizationId, isActive: true },
    select: { name: true, ecn: true, department: true },
    take: 200,
  });

  const hits = masters.filter((m) =>
    tokens.some((t) => normalize(m.name).includes(t) || (m.ecn?.includes(t) ?? false))
  );

  const sample = (hits.length ? hits : masters).slice(0, 8);

  return [
    {
      type: "text",
      content:
        "No employee match found. Try a name from **Employee Master**, ECN (e.g. `101008`), or login ID (`demo-employee`).",
    },
    {
      type: "table",
      title: hits.length ? "Similar employees" : "Sample employees (try: name + report)",
      headers: ["Name", "ECN", "Department"],
      rows: sample.map((m) => [m.name, m.ecn ?? "—", m.department ?? "—"]),
    },
  ];
}

export async function getEmployeeReportByQuery(
  query: string,
  organizationId: string,
  requesterRole: UserRole,
  requester?: Pick<User, "id" | "name" | "role" | "department" | "organizationId">
): Promise<EmployeeDashboardData | null> {
  if (requesterRole === "EMPLOYEE") return null;
  const trimmed = query.trim();
  if (!trimmed) return null;
  const resolved = await resolveEmployeeFromQuery(trimmed, organizationId);
  if (!resolved) return null;

  if (requesterRole === "MANAGER" && requester) {
    const { canViewEmployeeReport } = await import("@/lib/team-scope");
    const name = resolved.kind === "user" ? resolved.user.name : resolved.master.name;
    if (!(await canViewEmployeeReport(requester, name))) return null;
  }

  return buildEmployeeDashboard(organizationId, resolved);
}

async function employeeMatchesUnit(
  organizationId: string,
  resolved: ResolvedEmployee,
  plantUnitKey: string
): Promise<boolean> {
  const name = resolvedOwnerName(resolved);
  const master = await db.employeeMaster.findFirst({
    where: {
      organizationId,
      isActive: true,
      OR: personNameVariants(name).map((n) => ({ name: n })),
    },
    select: { location: true },
  });
  if (
    master?.location &&
    (await locationToPlantUnitKey(organizationId, master.location)) === plantUnitKey
  ) {
    return true;
  }
  const kpis = await fetchKpisForEmployee(
    organizationId,
    name,
    resolvedUserId(resolved),
    plantUnitKey
  );
  return kpis.length > 0;
}

export async function tryEmployeeReportBlocks(
  _message: string,
  _organizationId: string,
  _requesterRole: UserRole,
  _plantUnitKey?: string | null,
  _unitName?: string | null
): Promise<ChatBlock[] | null> {
  return null;
}
