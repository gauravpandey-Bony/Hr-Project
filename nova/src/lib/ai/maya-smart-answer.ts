import { normalizePersonName } from "@/lib/person-name";
import { departmentsAreEquivalent } from "@/lib/masters/department-master-sync";
import type { OrgContext } from "./db-context";
import type { ChatBlock } from "./chat";

const STOP_WORDS = new Set([
  "maya",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "me",
  "mujhe",
  "batao",
  "bataye",
  "dikhao",
  "dikha",
  "show",
  "tell",
  "about",
  "ke",
  "ka",
  "ki",
  "ko",
  "se",
  "mein",
  "main",
  "kya",
  "what",
  "which",
  "how",
  "many",
  "kitne",
  "kitna",
  "kaun",
  "who",
  "please",
  "report",
  "department",
  "employee",
  "plant",
  "unit",
  "kpi",
  "kpis",
  "hai",
  "hain",
  "ho",
  "tha",
  "the",
]);

function tokens(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function matchesText(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  return h.includes(n) || n.includes(h);
}

function wantsCount(q: string): boolean {
  return /kitne|kitna|how many|count|total|number of|headcount/i.test(q);
}

function wantsList(q: string): boolean {
  return /list|sab|all|dikhao|show|kaun kaun|names/i.test(q);
}

function statusFilter(q: string): "red" | "green" | "amber" | null {
  if (/red|off target|weak|kharab|below/i.test(q)) return "red";
  if (/green|on target|achha|good/i.test(q)) return "green";
  if (/amber|warning/i.test(q)) return "amber";
  return null;
}

function findDepartmentInQuery(message: string, ctx: OrgContext): string | null {
  const q = message.toLowerCase();
  for (const dept of ctx.departments) {
    const name = dept.name.toLowerCase();
    if (name.length > 2 && q.includes(name)) return dept.name;
    if (departmentsAreEquivalent(message, dept.name)) return dept.name;
  }
  for (const [dept, count] of Object.entries(ctx.departmentHeadcount)) {
    if (dept.length > 2 && q.includes(dept.toLowerCase())) return dept;
    if (count > 0 && departmentsAreEquivalent(message, dept)) return dept;
  }
  return null;
}

function findPlantInQuery(message: string, ctx: OrgContext): string | null {
  const q = message.toLowerCase();
  for (const plant of ctx.plants) {
    if (q.includes(plant.name.toLowerCase()) || q.includes(plant.slug.toLowerCase())) {
      return plant.name;
    }
    if (q.includes(plant.plantUnitKey.toLowerCase())) return plant.name;
  }
  for (const loc of ctx.employeeLocations) {
    if (loc.length > 3 && q.includes(loc.toLowerCase())) return loc;
  }
  return null;
}

function filterEmployees(ctx: OrgContext, message: string) {
  const dept = findDepartmentInQuery(message, ctx);
  const plant = findPlantInQuery(message, ctx);
  const toks = tokens(message);

  return ctx.employees.filter((emp) => {
    if (dept && emp.department && !departmentsAreEquivalent(emp.department, dept)) {
      return false;
    }
    if (plant) {
      const loc = (emp.location ?? "").toLowerCase();
      if (!loc.includes(plant.toLowerCase()) && !matchesText(loc, plant)) {
        return false;
      }
    }
    if (!toks.length) return true;
    const blob = `${emp.name} ${emp.ecn ?? ""} ${emp.department ?? ""} ${emp.designation ?? ""} ${emp.managerName ?? ""}`.toLowerCase();
    return toks.some((t) => blob.includes(t));
  });
}

function filterKpis(ctx: OrgContext, message: string) {
  const dept = findDepartmentFromKpis(message, ctx);
  const plant = findPlantInQuery(message, ctx);
  const status = statusFilter(message);
  const toks = tokens(message);

  return ctx.kpis.filter((k) => {
    if (dept && k.department && !departmentsAreEquivalent(k.department, dept)) return false;
    if (plant && k.department && !matchesText(k.department, plant)) {
      // plant filter via owner location not in kpi - skip strict plant on kpi
    }
    if (status && k.status !== status) return false;
    if (!toks.length) return true;
    const blob = `${k.name} ${k.category} ${k.department ?? ""} ${k.owner ?? ""}`.toLowerCase();
    return toks.some((t) => blob.includes(t));
  });
}

function findDepartmentFromKpis(message: string, ctx: OrgContext): string | null {
  return findDepartmentInQuery(message, ctx);
}

function findEmployeeByName(message: string, ctx: OrgContext) {
  const q = normalizePersonName(message);
  if (q.length < 3) return null;

  const ecnMatch = message.match(/\b\d{4,}\b/);
  if (ecnMatch) {
    const hit = ctx.employees.find((e) => e.ecn === ecnMatch[0]);
    if (hit) return hit;
  }

  const direct = ctx.employees.find((e) => normalizePersonName(e.name) === q);
  if (direct) return direct;

  const partial = ctx.employees.filter((e) => {
    const n = normalizePersonName(e.name);
    return n.includes(q) || q.includes(n);
  });
  return partial.length === 1 ? partial[0]! : null;
}

/** Answer any natural-language question from org context — no fixed commands. */
export function answerFromDatabase(message: string, ctx: OrgContext): ChatBlock[] {
  const q = message.trim();
  if (!q) {
    return [{ type: "text", content: "Kuch bhi puchho — employee, department, plant, KPI, headcount…" }];
  }

  const blocks: ChatBlock[] = [];
  const employee = findEmployeeByName(q, ctx);
  const dept = findDepartmentInQuery(q, ctx);
  const plant = findPlantInQuery(q, ctx);
  const status = statusFilter(q);

  if (employee && /manager|reporting|boss|head/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${employee.name}** ka reporting manager: **${employee.managerName ?? "database me nahi hai"}** (${employee.department ?? "—"}, ${employee.location ?? "—"}).`,
    });
    return blocks;
  }

  if (employee && !wantsList(q) && !wantsCount(q)) {
    const empKpis = ctx.kpis.filter(
      (k) => k.owner && normalizePersonName(k.owner) === normalizePersonName(employee.name)
    );
    blocks.push({
      type: "text",
      content: `**${employee.name}** — ${employee.designation ?? "—"}, ${employee.department ?? "—"}, ${employee.location ?? "—"}${employee.ecn ? ` (ECN ${employee.ecn})` : ""}.`,
    });
    if (empKpis.length) {
      blocks.push({
        type: "table",
        title: `${employee.name} — KPIs`,
        headers: ["KPI", "Actual", "Target", "Progress", "Status"],
        rows: empKpis.map((k) => [k.name, k.current, k.target, k.progress, k.status]),
      });
    }
    return blocks;
  }

  if (wantsCount(q)) {
    if (dept) {
      const count = ctx.departmentHeadcount[dept] ?? filterEmployees(ctx, q).length;
      blocks.push({
        type: "text",
        content: `**${dept}** me **${count}** active employee${count === 1 ? "" : "s"} hain (${ctx.workspace}).`,
      });
      return blocks;
    }
    if (plant) {
      const count = filterEmployees(ctx, plant).length;
      blocks.push({
        type: "text",
        content: `**${plant}** me **${count}** employee${count === 1 ? "" : "s"} hain.`,
      });
      return blocks;
    }
    if (/employee|staff|log|headcount/i.test(q)) {
      blocks.push({
        type: "text",
        content: `Total **${ctx.stats.employeeMaster}** employees, **${ctx.stats.kpis}** KPIs (${ctx.workspace}).`,
      });
      return blocks;
    }
    if (/kpi|metric/i.test(q)) {
      const filtered = filterKpis(ctx, q);
      blocks.push({
        type: "text",
        content: `**${filtered.length}** KPIs match your question. On track: **${ctx.kpiHealth.green}**, off target: **${ctx.kpiHealth.red}**.`,
      });
      return blocks;
    }
    if (/department|vibhag/i.test(q)) {
      blocks.push({
        type: "text",
        content: `**${ctx.departments.length}** departments in database.`,
      });
      return blocks;
    }
  }

  const matchedEmployees = filterEmployees(ctx, q);
  const matchedKpis = filterKpis(ctx, q);

  if (dept && (wantsList(q) || matchedEmployees.length > 0)) {
    const list = matchedEmployees.length ? matchedEmployees : ctx.employees.filter(
      (e) => e.department && departmentsAreEquivalent(e.department, dept)
    );
    blocks.push({
      type: "text",
      content: `**${dept}** — ${list.length} employee${list.length === 1 ? "" : "s"}:`,
    });
    blocks.push({
      type: "table",
      headers: ["Name", "Designation", "ECN", "Manager"],
      rows: list.slice(0, 25).map((e) => [
        e.name,
        e.designation ?? "—",
        e.ecn ?? "—",
        e.managerName ?? "—",
      ]),
    });
    const deptKpis = ctx.kpis.filter(
      (k) => k.department && departmentsAreEquivalent(k.department, dept)
    );
    if (deptKpis.length) {
      blocks.push({
        type: "table",
        title: `${dept} — KPIs`,
        headers: ["KPI", "Owner", "Actual", "Target", "Status"],
        rows: deptKpis.slice(0, 15).map((k) => [
          k.name,
          k.owner ?? "—",
          k.current,
          k.target,
          k.status,
        ]),
      });
    }
    return blocks;
  }

  if (status && matchedKpis.length) {
    blocks.push({
      type: "text",
      content: `**${matchedKpis.length}** ${status} KPI(s) found:`,
    });
    blocks.push({
      type: "table",
      headers: ["KPI", "Department", "Actual", "Target", "Progress"],
      rows: matchedKpis.slice(0, 20).map((k) => [
        k.name,
        k.department ?? "—",
        k.current,
        k.target,
        k.progress,
      ]),
    });
    return blocks;
  }

  if (matchedKpis.length > 0 && matchedKpis.length <= 25) {
    blocks.push({
      type: "text",
      content: `Database se **${matchedKpis.length}** KPI match mile:`,
    });
    blocks.push({
      type: "table",
      headers: ["KPI", "Category", "Department", "Actual", "Target", "Status"],
      rows: matchedKpis.map((k) => [
        k.name,
        k.category,
        k.department ?? "—",
        k.current,
        k.target,
        k.status,
      ]),
    });
    return blocks;
  }

  if (matchedEmployees.length > 0 && matchedEmployees.length <= 30) {
    blocks.push({
      type: "text",
      content: `**${matchedEmployees.length}** employee match:`,
    });
    blocks.push({
      type: "table",
      headers: ["Name", "Department", "Designation", "Location", "ECN"],
      rows: matchedEmployees.map((e) => [
        e.name,
        e.department ?? "—",
        e.designation ?? "—",
        e.location ?? "—",
        e.ecn ?? "—",
      ]),
    });
    return blocks;
  }

  if (/summary|overview|snapshot|sab kuch|poora data/i.test(q)) {
    blocks.push({
      type: "text",
      content: `**${ctx.workspace}** database snapshot:`,
    });
    blocks.push({
      type: "table",
      title: "Counts",
      headers: ["Metric", "Value"],
      rows: [
        ["Employees", String(ctx.stats.employeeMaster)],
        ["KPIs", String(ctx.stats.kpis)],
        ["Departments", String(ctx.departments.length)],
        ["Plants / units", String(ctx.plants.length)],
        ["KPIs on track", String(ctx.kpiHealth.green)],
        ["KPIs off target", String(ctx.kpiHealth.red)],
        ["Goals", String(ctx.stats.goals)],
        ["Pending reviews", String(ctx.stats.pendingReviews)],
      ],
    });
    return blocks;
  }

  blocks.push({
    type: "text",
    content: `Maine database me dhunda — **${ctx.workspace}** me ${ctx.stats.employeeMaster} employees aur ${ctx.stats.kpis} KPIs hain. Zyada specific puchho, jaise:\n\n• "IT me kitne log hain?"\n• "Bhupesh Kumar ka manager kaun hai?"\n• "Red KPIs kaun se hain?"\n• "Production department ke employees"`,
  });
  if (ctx.departmentHeadcount && Object.keys(ctx.departmentHeadcount).length) {
    const top = Object.entries(ctx.departmentHeadcount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    blocks.push({
      type: "table",
      title: "Department headcount (top)",
      headers: ["Department", "Employees"],
      rows: top.map(([d, c]) => [d, String(c)]),
    });
  }
  return blocks;
}
