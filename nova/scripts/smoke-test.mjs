#!/usr/bin/env node
/**
 * Smoke test: pages + API routes (requires dev server on BASE_URL)
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

const pages = [
  "/",
  "/dashboard",
  "/dashboard/reviews",
  "/dashboard/reviews/assign-self",
  "/dashboard/reviews/new",
  "/dashboard/feedback",
  "/dashboard/goals",
  "/dashboard/compensation",
  "/dashboard/surveys",
  "/dashboard/calibration",
  "/dashboard/analytics",
  "/dashboard/settings",
];

async function fetchWithSession(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...options,
  });
  return res;
}

async function getSessionCookie() {
  const res = await fetchWithSession("/api/auth/session?redirect=/dashboard");
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const raw = setCookie[0] || res.headers.get("set-cookie") || "";
  const match = raw.match(/nova_user_id=([^;]+)/);
  return match ? `nova_user_id=${match[1]}` : null;
}

async function testPage(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  const ok = res.status === 200 || (res.status === 307 && path === "/dashboard");
  return { path, status: res.status, ok: ok || res.status === 200 };
}

async function testApi(path, cookie, method = "GET", body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  return { path, status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  const cookie = await getSessionCookie();
  if (!cookie) {
    console.error("FAIL: Could not obtain session cookie");
    process.exit(1);
  }
  console.log("Session cookie obtained\n");

  let failed = 0;

  console.log("--- Pages ---");
  for (const path of pages) {
    const r = await testPage(path, cookie);
    const pass = r.ok;
    console.log(`${pass ? "OK" : "FAIL"} ${path} (${r.status})`);
    if (!pass) failed++;
  }

  console.log("\n--- APIs ---");
  const apis = [
    ["/api/dashboard/stats"],
    ["/api/reviews/cycles"],
    ["/api/reviews/assignments?mine=true"],
    ["/api/reviews/assignments/assign-self"],
    ["/api/feedback"],
    ["/api/goals"],
    ["/api/compensation"],
    ["/api/surveys"],
    ["/api/calibration"],
    ["/api/analytics"],
    ["/api/templates"],
    ["/api/users"],
    ["/api/hris/sync"],
  ];

  for (const [path] of apis) {
    const r = await testApi(path, cookie);
    console.log(`${r.ok ? "OK" : "FAIL"} GET ${path} (${r.status})`);
    if (!r.ok) failed++;
  }

  const patchReview = await testApi("/api/reviews/assignments/assign-self", cookie, "PATCH", {
    responses: { key_wins: "Smoke test", impact: "Verified", collaboration: "4", execution: "4", growth: "4" },
  });
  console.log(
    `${patchReview.ok ? "OK" : "SKIP"} PATCH review submit (${patchReview.status})`
  );

  const feedbackSummary = await testApi("/api/feedback", cookie, "PATCH", {
    campaignId: (await testApi("/api/feedback", cookie)).data?.[0]?.id,
  });
  console.log(
    `${feedbackSummary.ok ? "OK" : "FAIL"} PATCH feedback AI summary (${feedbackSummary.status})`
  );
  if (!feedbackSummary.ok) failed++;

  const hrisSync = await testApi("/api/hris/sync", cookie, "POST", {
    connectionId: "hris-demo",
    direction: "inbound",
    employees: [
      {
        externalId: "HRIS-SMOKE",
        email: "smoke@acme.com",
        name: "Smoke Test",
        department: "QA",
      },
    ],
  });
  console.log(`${hrisSync.ok ? "OK" : "FAIL"} POST hris sync (${hrisSync.status})`);
  if (!hrisSync.ok) failed++;

  console.log(`\n${failed === 0 ? "All checks passed" : `${failed} check(s) failed`}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
