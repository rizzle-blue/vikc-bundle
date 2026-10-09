#!/usr/bin/env node
// Apply SQL to the Supabase project through the Management API (no DB password needed on this
// machine). Migrations are applied once each and recorded in `public.schema_migrations`; seeds are
// idempotent and always re-run.
//
//   node scripts/db-apply.mjs                        # pending migrations + seeds
//   node scripts/db-apply.mjs supabase/seed_events.sql
//   node scripts/db-apply.mjs --status
//
// Needs SUPABASE_URL + SUPABASE_ACCESS_TOKEN (a `sbp_…` personal access token) in .env.
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

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

/** Run one SQL batch; the endpoint answers 200 with an error object when the SQL fails. */
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  try {
    const parsed = JSON.parse(body);
    if (parsed && !Array.isArray(parsed) && (parsed.message || parsed.error)) {
      throw new Error(String(parsed.message ?? parsed.error).slice(0, 300));
    }
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) return null; // non-JSON success
    throw e;
  }
}

const MIGRATIONS_DIR = join(root, "supabase/migrations");
const all = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const SEEDS = ["supabase/seed.sql", "supabase/seed_members.sql", "supabase/seed_events.sql"];
const args = process.argv.slice(2);

await sql(`create table if not exists public.schema_migrations (
            version text primary key,
            applied_at timestamptz not null default now())`);
const appliedRows = await sql("select version from public.schema_migrations");
const applied = new Set((appliedRows ?? []).map((r) => r.version));

if (args.includes("--status")) {
  for (const f of all) {
    const v = basename(f, ".sql");
    console.log(`${applied.has(v) ? "applied" : "PENDING"}  ${f}`);
  }
  process.exit(0);
}

const explicit = args.filter((a) => !a.startsWith("--"));
const jobs = explicit.length
  ? explicit.map((f) => ({ file: f.replace(`${root}/`, ""), migration: false }))
  : [
      ...all.map((f) => ({ file: `supabase/migrations/${f}`, migration: true })),
      ...SEEDS.map((f) => ({ file: f, migration: false })),
    ];

let failed = false;
for (const { file, migration } of jobs) {
  const version = basename(file, ".sql");
  if (migration && applied.has(version)) {
    console.log(`skip    ${file} (already applied)`);
    continue;
  }
  try {
    await sql(readFileSync(join(root, file), "utf8"));
    if (migration) {
      await sql(`insert into public.schema_migrations (version) values ('${version}')
                on conflict (version) do nothing`);
    }
    console.log(`ok      ${file}${migration ? "  → recorded" : ""}`);
  } catch (e) {
    console.log(`FAIL    ${file} — ${e.message}`);
    failed = true;
  }
}

// make new tables/views reachable through the REST API immediately
await sql("notify pgrst, 'reload schema'");
process.exit(failed ? 1 : 0);
