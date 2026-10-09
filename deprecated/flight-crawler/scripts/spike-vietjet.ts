// VietJet crawler probe (hybrid): real clicks for the autocomplete fields, DOM clicks for the
// overlay-covered date picker, then read the rendered results HTML. No API calls, no signing,
// no stealth plugins.
// Usage: npx tsx scripts/spike-vietjet.ts [--from SGN] [--to HAN] [--date 2026-11-18] [--headed]
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const from = arg("from", "SGN"), to = arg("to", "HAN"), date = arg("date", "2026-11-18");
const headed = process.argv.includes("--headed");
const dir = join("out", "spike-vietjet", `${from}-${to}-${date}`);
await mkdir(dir, { recursive: true });
const [yyyy, mm, dd] = date.split("-");
const say = (...a: unknown[]) => console.log(...a);

const browser = await chromium.launch({ headless: !headed, channel: "chrome" });
const page = await (await browser.newContext({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh", viewport: { width: 1440, height: 1000 } })).newPage();
const js = (s: string) => page.evaluate(s);

try {
  await page.goto("https://www.vietjetair.com/vi", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  for (const t of ["Để sau", "Đồng ý"]) {
    const b = page.getByRole("button", { name: t }).first();
    if (await b.isVisible({ timeout: 1500 }).catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(900); }
  }
  await page.locator("input[type=radio][value=oneway]").first().check({ timeout: 8000 }).catch(() => say("[warn] oneway"));

  // route: real clicks (autocomplete needs real focus/typing)
  const fields = page.locator("input.MuiInputBase-input[type=text]:visible");
  const dep = fields.nth(0), arr = fields.nth(1);
  await dep.click({ timeout: 10_000 }); await dep.pressSequentially(from, { delay: 110 });
  await page.waitForTimeout(1600);
  await page.locator('li:has-text("Tân Sơn Nhất"), [role=option]:has-text("Tân Sơn Nhất"), li:has-text("Tân Sơn Nhất")').first().click({ timeout: 6000 }).catch(() => say("[warn] origin pick"));
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape").catch(() => {});
  await arr.click({ timeout: 10_000 }); await arr.pressSequentially(to, { delay: 110 });
  await page.waitForTimeout(1600);
  await page.locator('li:has-text("Nội Bài"), [role=option]:has-text("Nội Bài")').first().click({ timeout: 6000 }).catch(() => say("[warn] dest pick"));
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape").catch(() => {});
  say("[route]", await dep.inputValue().catch(() => "?"), "->", await arr.inputValue().catch(() => "?"));

  // date: DOM clicks (the picker overlay covers the control)
  await js("(function(){ var c = Array.from(document.querySelectorAll('div[role=button]')).find(function(e){ return (e.innerText||'').indexOf('Ngày đi') >= 0; }); if (c) c.click(); })()");
  await page.waitForTimeout(2500);
  say("[pick day]", await js(`(function(){
    var months = Array.from(document.querySelectorAll('.rdrMonth'));
    var target = months.find(function(m){
      var n = m.querySelector('.rdrMonthName');
      return n && new RegExp('tháng\\\\s*' + ${Number(mm)} + '\\\\b', 'i').test(n.textContent || '');
    }) || months[0];
    if (!target) return 'no grid';
    var hit = Array.from(target.querySelectorAll('.rdrDay')).filter(function(d){
      return !/rdrDayDisabled|rdrDayPassive|rdrDayHidden/.test(d.className);
    }).find(function(d){
      var n = d.querySelector('.rdrDayNumber');
      return n && n.textContent.trim() === String(${Number(dd)});
    });
    if (!hit) return 'day unavailable in ' + ((target.querySelector('.rdrMonthName')||{}).textContent||'?');
    var el = hit.querySelector('.rdrDayNumber') || hit;
    var b = el.getBoundingClientRect();
    var o = { bubbles: true, cancelable: true, view: window, clientX: Math.round(b.x + b.width/2), clientY: Math.round(b.y + b.height/2) };
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    return 'ok ' + ((target.querySelector('.rdrMonthName')||{}).textContent||'?');
  })()`));
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(600);
  say("[route objects]", await js("(function(){ var t = Array.from(document.querySelectorAll('input.MuiInputBase-input[type=text]')).slice(0,2).map(function(i){return i.value}).join(' -> '); return t; })()"));
  say("[form state]", await js("Array.from(document.querySelectorAll('input.MuiInputBase-input[type=text]')).slice(0,2).map(function(i){return i.value}).join(' -> ') + ' | date=' + (function(){ var p=Array.from(document.querySelectorAll('p')).find(function(e){return /1?\\d\\/1?\\d\\/20\\d\\d/.test(e.textContent||'')}); return p?p.textContent.trim():'?'; })()"));
  await page.screenshot({ path: join(dir, "screen-form.png") });

  await page.locator("button:visible", { hasText: /Tìm chuyến bay/ }).last().click({ timeout: 10_000 }).catch(() => say("[warn] submit"));
  say("[submitted]");
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(5000); await page.mouse.wheel(0, 900).catch(() => {}); }
  say("[final url]", page.url());
  const html: string = await page.content();
  await writeFile(join(dir, "results.html"), html);
  const text = (await page.evaluate("document.body.innerText")) as string;
  await writeFile(join(dir, "results.txt"), text);
  await page.screenshot({ path: join(dir, "screen-results.png") });
  say("[results text]", text.replace(/\n+/g, " | ").slice(0, 1400));
} catch (e) {
  say("[error]", String(e).slice(0, 300));
  await page.screenshot({ path: join(dir, "screen-error.png") }).catch(() => {});
} finally {
  await browser.close();
}
