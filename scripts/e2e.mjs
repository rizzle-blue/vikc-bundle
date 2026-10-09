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
const TEST_NAME = process.env.E2E_NAME ?? "SKJ-198"; // the AntD option label contains the member id

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
  const enter = page.getByRole("button", { name: "Vào" });
  await enter.waitFor({ state: "visible" });
  for (let i = 0; i < 40 && (await enter.isDisabled()); i++) await page.waitForTimeout(100);
  await enter.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/** Remove everything this test wrote (service key, so DELETE is allowed). */
async function cleanup() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "skipped (no service key)";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  await fetch(`${url}/rest/v1/event_signups?member_id=eq.${TEST_MEMBER}`, { method: "DELETE", headers });
  await fetch(`${url}/rest/v1/exam_entries?member_id=eq.${TEST_MEMBER}`, { method: "DELETE", headers });
  await fetch(`${url}/rest/v1/member_profiles?member_id=eq.${TEST_MEMBER}`, { method: "DELETE", headers });
  await fetch(`${url}/rest/v1/registrations?member_id=eq.${TEST_MEMBER}`, { method: "DELETE", headers });
  return "done";
}

try {
  // 1. the gate
  await page.goto(`${BASE}/enroll`, { waitUntil: "networkidle" });
  check("gate: /enroll without a code → /login", path(), "/login");
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("gate: /admin without a code → /login", path(), "/login");
  await page.goto(`${BASE}/track`, { waitUntil: "networkidle" });
  check("gate: /track (names, times, rooms) → /login", path(), "/login");
  await page.goto(`${BASE}/members`, { waitUntil: "networkidle" });
  check("gate: /members (roster) → /login", path(), "/login");

  // 2. member signs in and checks in to events
  await login(MEMBER);
  check("member login sets the cookie", (await ctx.cookies()).map((c) => c.name).includes("vikc_member"), true);
  await page.goto(`${BASE}/enroll`, { waitUntil: "networkidle" });
  await page.locator("#member_id").click();
  await page.locator("#member_id").type(TEST_NAME, { delay: 40 });
  await page.waitForTimeout(1200);
  const option = page.locator(".ant-select-item-option", { hasText: TEST_MEMBER }).first();
  check("the member option is offered", await option.isVisible({ timeout: 4000 }).catch(() => false), true);
  await option.click();
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
  await page.waitForTimeout(600);

  // the exam expands into typed fields (the VKF submission data)
  await page.locator("#exam_current_rank_issued_on").click();
  await page.keyboard.type("01/01/2023", { delay: 40 });
  await page.keyboard.press("Enter");
  await page.locator("#exam_current_rank_issued_by").fill("VKF");
  await page.locator("#exam_dojo_approved").check();
  await page.waitForTimeout(400);

  // the VKF paperwork
  // room type is part of signing up (VKF charges the package by room × entries)
  await page.locator("#room_type").click();
  await page.waitForTimeout(400);
  await page.locator(".ant-select-item-option", { hasText: "Đôi" }).first().click();
  await page.waitForTimeout(300);

  // scope 1: the basic info arrives pre-filled from the roster — change the phone to prove precedence
  await page.locator("#phone").fill("0900000000");
  await page.locator("#full_name_latin").fill("TRUONG HUA DAN");
  await page.locator("#national_id").fill("012345678901");
  await page.locator("#address").fill("123 Đường ABC, Quận 1, TP.HCM");
  await page.locator("#occupation").fill("Kỹ sư");
  await page.locator("#emergency_contact").fill("Nguyễn Thị B — 0901234567");
  await page.locator("#certificate_mailing_address").fill("CLB Shakaijin");
  await page.locator("#current_rank_photo_url").fill("https://drive.google.com/file/d/test/view");
  await page.waitForTimeout(300);

  const entryTag = (await page.locator("text=/\\d+ nội dung thi đấu/").first().textContent())?.trim();
  check("entry counter counts only the shiai event", entryTag, "1 nội dung thi đấu");

  await page.getByRole("button", { name: "Lưu" }).click();
  await page.waitForTimeout(2500);
  const saved = (await page.locator(".ant-message-notice-content").first().textContent().catch(() => ""))?.trim();
  check("save confirms", saved, "Đã lưu. Cảm ơn bạn!");

  // 2b. what VKF's workbook will read back
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const submission = await fetch(
      `${url}/rest/v1/v_exam_submission?member_id=eq.${TEST_MEMBER}&select=grade_applied,full_name_latin,current_rank_issued_on,dojo_approved,vkf_fee_bracket,nights`,
      { headers },
    ).then((r) => r.json());
    check("the exam submission row exists", submission.length, 1);
    check("grade applied recorded", submission[0]?.grade_applied, "3 dan");
    check("latin name for the certificate recorded", submission[0]?.full_name_latin, "TRUONG HUA DAN");
    check("certificate issue date recorded", submission[0]?.current_rank_issued_on, "2023-01-01");
    check("dojo approval recorded", submission[0]?.dojo_approved, true);
    const profile = await fetch(
      `${url}/rest/v1/v_member_profile?member_id=eq.${TEST_MEMBER}&select=missing_fields`,
      { headers },
    ).then((r) => r.json());
    check("all VKF paperwork complete (0 missing)", profile[0]?.missing_fields, 0);

    // scope 2: the VIKC Registration sheet is pre-filled from the member's own entry
    const registration = await fetch(
      `${url}/rest/v1/v_vikc_registration?member_id=eq.${TEST_MEMBER}&select=full_name,full_name_latin,phone,vkf_member,current_rank,grade_applied,room_type,nights,entries,missing_fields`,
      { headers },
    ).then((r) => r.json());
    check("the member appears on the VIKC registration sheet", registration.length, 1);
    check("basic info: the member's own phone wins over the roster", registration[0]?.phone, "0900000000");
    check("basic info: the roster fills what was not declared (VKF member)", registration[0]?.vkf_member, true);
    check("the exam grade is pre-filled", registration[0]?.grade_applied, "3 dan");
    check("the trip is pre-filled", { room: registration[0]?.room_type, nights: registration[0]?.nights }, { room: "Đôi", nights: 4 });
  }

  // 3. a member cannot open the operator areas
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("member → /admin is bounced", path(), "/login");
  await page.goto(`${BASE}/track`, { waitUntil: "networkidle" });
  check("member → /track is bounced", path(), "/login");
  await page.goto(`${BASE}/trips`, { waitUntil: "networkidle" });
  check("member → /trips is bounced", path(), "/login");

  // 4. operator signs in, sees the programme, exports the CSV
  await login(ADMIN);
  check("admin login sets the cookie", (await ctx.cookies()).map((c) => c.name).includes("vikc_admin"), true);
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/track`, { waitUntil: "networkidle" });
  check("admin can open the board", path(), "/track");
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const dashboard = await page.evaluate("document.body.innerText");
  check("dashboard lists the four team events", ["Đồng đội Nữ 3 người", "Đồng đội Nam 5 người"].every((t) => dashboard.includes(t)), true);

  const csv = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/admin/export?event=team3-nam`);
    return { status: res.status, text: await res.text() };
  }, BASE);
  check("CSV export is allowed for the operator", csv.status, 200);
  if (!csv.text.includes(TEST_MEMBER)) console.log("  csv was:", csv.text.replace(/\n/g, " ⏎ ").slice(0, 300));
  check("CSV contains the sign-up", csv.text.includes(TEST_MEMBER), true);

  // the operator route is reachable with the admin cookie and validates without writing anything
  const validation = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/admin/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "missing-name" }), // no name_vi → rejected, nothing inserted
    });
    return { status: res.status, body: (await res.text()).slice(0, 120) };
  }, BASE);
  check("operator route validates with the admin cookie", validation.status, 400);
} catch (e) {
  failures++;
  console.log("FAIL unexpected error:", String(e).slice(0, 300));
} finally {
  console.log(`cleanup: ${await cleanup()}`);
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
