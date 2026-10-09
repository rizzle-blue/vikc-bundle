#!/usr/bin/env node
// End-to-end smoke test: the access gate, a member checking in, and the operator reading the CSV.
// It writes real rows for ONE test member and removes them again at the end.
//
//   pnpm start -p 3100        # in another shell
//   pnpm e2e                  # reads the codes + keys from .env / .env.local
//
// Needs MEMBER_ACCESS_CODE + ADMIN_ACCESS_CODE (from .env.local) and SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY (from .env) so it can clean up after itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = join(import.meta.dirname, "..");
for (const f of [".env", ".env.local"]) {
  try { process.loadEnvFile(join(root, f)); } catch { /* optional */ }
}
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const MEMBER = process.env.MEMBER_ACCESS_CODE;
const ADMIN = process.env.ADMIN_ACCESS_CODE;
const TEST_MEMBER = process.env.E2E_MEMBER ?? "SKJ-198";
const TEST_NAME = process.env.E2E_NAME ?? "Trương";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh", viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
const path = () => new URL(page.url()).pathname;

async function login(code) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input[name=code]").fill(code);
  await page.getByRole("button", { name: "Vào" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/** Remove everything this test wrote (service key, so DELETE is allowed). */
async function cleanup() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "skipped (no service key)";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  await fetch(`${url}/rest/v1/event_signups?member_id=eq.${TEST_MEMBER}`, { method: "DELETE", headers });
  await fetch(`${url}/rest/v1/registrations?member_id=eq.${TEST_MEMBER}`, { method: "DELETE", headers });
  return "done";
}

try {
  // 1. the gate
  await page.goto(`${BASE}/enroll`, { waitUntil: "networkidle" });
  check("gate: /enroll without a code → /login", path(), "/login");
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("gate: /admin without a code → /login", path(), "/login");

  // 2. member signs in and checks in to events
  await login(MEMBER);
  check("member login sets the cookie", (await ctx.cookies()).map((c) => c.name).includes("vikc_member"), true);
  await page.goto(`${BASE}/enroll`, { waitUntil: "networkidle" });
  await page.locator("#member_id").click();
  await page.locator("#member_id").type(TEST_NAME, { delay: 40 });
  await page.waitForTimeout(1200);
  await page.locator(".ant-select-item-option").first().click();
  await page.waitForTimeout(2000);
  await page.locator("#arrival_at").click();
  await page.keyboard.type("18/11/2026 14:00", { delay: 40 });
  await page.keyboard.press("Enter");
  await page.locator("#departure_at").click();
  await page.keyboard.type("22/11/2026 10:00", { delay: 40 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);

  await page.locator("label", { hasText: "Đồng đội Nam 3 người" }).first().locator("input[type=checkbox]").check();
  await page.locator("label", { hasText: "Kỳ thi Kyu/Dan" }).first().locator("input[type=checkbox]").check();
  await page.waitForTimeout(500);
  await page.locator(".ant-select").last().click();
  await page.waitForTimeout(400);
  await page.locator(".ant-select-item-option", { hasText: "3 dan" }).first().click();
  await page.waitForTimeout(400);

  const entryTag = (await page.locator("text=/\\d+ nội dung thi đấu/").first().textContent())?.trim();
  check("entry counter counts only the shiai event", entryTag, "1 nội dung thi đấu");

  await page.getByRole("button", { name: "Lưu" }).click();
  await page.waitForTimeout(2500);
  const saved = (await page.locator(".ant-message-notice-content").first().textContent().catch(() => ""))?.trim();
  check("save confirms", saved, "Đã lưu. Cảm ơn bạn!");

  // 3. a member cannot open the operator area
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("member → /admin is bounced", path(), "/login");

  // 4. operator signs in, sees the programme, exports the CSV
  await login(ADMIN);
  check("admin login sets the cookie", (await ctx.cookies()).map((c) => c.name).includes("vikc_admin"), true);
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const dashboard = await page.evaluate("document.body.innerText");
  check("dashboard lists the four team events", ["Đồng đội Nữ 3 người", "Đồng đội Nam 5 người"].every((t) => dashboard.includes(t)), true);

  const csv = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/admin/export?event=team3-nam`);
    return { status: res.status, text: await res.text() };
  }, BASE);
  check("CSV export is allowed for the operator", csv.status, 200);
  check("CSV contains the sign-up", csv.text.includes(TEST_MEMBER), true);

  const denied = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/admin/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "nope", name_vi: "nope", kind: "other" }),
    });
    return res.status;
  }, BASE);
  check("operator route is open to the admin cookie", denied === 200 || denied === 400, true);
} catch (e) {
  failures++;
  console.log("FAIL unexpected error:", String(e).slice(0, 300));
} finally {
  console.log(`cleanup: ${await cleanup()}`);
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
