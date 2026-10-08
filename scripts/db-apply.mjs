#!/usr/bin/env node
// Apply SQL files to the Supabase project via the Management API.
// Used because this machine has no database password / `supabase link` (see docs/status-web.md).
//
//   node scripts/db-apply.mjs                       # apply every migration + seed, in order
//   node scripts/db-apply.mjs path/to/file.sql …    # apply specific files
//
// Needs SUPABASE_URL + SUPABASE_ACCESS_TOKEN (a `sbp_…` personal access token) in .env.
// Files must be idempotent: they are re-run whenever the schema changes.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
for (const f of [".env", "../../.env"]) {
  try { process.loadEnvFile(join(root, f)); } catch { /* optional */ }
}

const url = process.env.SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error("need SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env");
  process.exit(1);
}
const ref = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];
if (!ref) {
  console.error("SUPABASE_URL does not look like https://<ref>.supabase.co");
  process.exit(1);
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      ...readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
        .map((f) => join("supabase/migrations", f)),
      "supabase/seed.sql",
      "supabase/seed_members.sql",
    ];

/** One statement batch per file; the Management API runs it like the SQL editor does. */
async function apply(file) {
  const sql = readFileSync(join(root, file), "utf8");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  // The query endpoint answers 200 with an error object when the SQL fails — treat that as a failure.
  let sqlError = null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && !Array.isArray(parsed) && (parsed.message || parsed.error)) sqlError = parsed.message ?? parsed.error;
  } catch { /* not JSON: fine */ }
  const ok = res.ok && !sqlError;
  console.log(`${ok ? "ok  " : "FAIL"} ${file}${ok ? ` (${body.length} B)` : ` — HTTP ${res.status}: ${sqlError ?? body.slice(0, 400)}`}`);
  return ok;
}

let failed = false;
for (const file of files) failed = !(await apply(file)) || failed;

// make the new tables/views visible to the REST API immediately
await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: "notify pgrst, 'reload schema';" }),
});

process.exit(failed ? 1 : 0);
