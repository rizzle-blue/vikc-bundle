// Probe a booking page: load URL, record every JSON response (url, status, size,
// top-level keys) and save bodies under out/spike/<name>/ for fixture building.
// Usage: pnpm spike <name> <url> [--headed] [--wait 25]
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [name, url, ...rest] = process.argv.slice(2);
if (!name || !url) {
  console.error("usage: spike <name> <url> [--headed] [--wait seconds]");
  process.exit(1);
}
const headed = rest.includes("--headed");
const waitIdx = rest.indexOf("--wait");
const waitSec = waitIdx >= 0 ? Number(rest[waitIdx + 1]) : 25;
const dir = join("out", "spike", name);
await mkdir(dir, { recursive: true });

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  viewport: { width: 1366, height: 900 },
});
const page = await ctx.newPage();
let n = 0;
page.on("response", async (res) => {
  const type = res.headers()["content-type"] ?? "";
  const rtype = res.request().resourceType();
  if (rtype !== "xhr" && rtype !== "fetch" && !type.includes("json")) return;
  try {
    const body = await res.text();
    const i = ++n;
    let keys = "";
    try {
      const j = JSON.parse(body);
      keys = Array.isArray(j) ? `[array ${j.length}]` : Object.keys(j).slice(0, 8).join(",");
    } catch { keys = "(non-json)"; }
    console.log(`#${i} ${res.status()} ${res.request().method()} ${body.length}B ${res.url().slice(0, 160)} :: ${keys}`);
    await writeFile(join(dir, `${String(i).padStart(3, "0")}.txt`), `${res.request().method()} ${res.url()}\n${res.status()}\n\n${body}`);
  } catch { /* body unavailable (redirect/aborted) */ }
});
const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => { console.log("goto error", String(e).slice(0, 200)); return null; });
console.log("main status", resp?.status(), "final url", page.url().slice(0, 200));
await page.waitForTimeout(waitSec * 1000);
await page.screenshot({ path: join(dir, "screen.png"), fullPage: false });
console.log("title:", await page.title());
await browser.close();
