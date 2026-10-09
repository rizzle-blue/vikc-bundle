# STATUS — VIKC 2026 web migration (Vercel + Supabase)

Handoff: [`handoff.md`](handoff.md) · Engine spec: [`spec-flight-crawler.md`](spec-flight-crawler.md) ·
Task board: [`tasks/README.md`](tasks/README.md)
Last updated: **2026-10-09** (T3 + T7 UI built and verified end-to-end against Supabase) · Next: **Vercel deploy**

Single source of truth for *where the web migration stands*. Update this file
whenever a card is finished or a check changes (rule 7 in the handoff).

## 1. Step progress

**Track A — fares data (plumbing)**

| Step | Scope | Status |
|---|---|---|
| A1 | Crawler engine: VNA adapter, FX, store selection, CLI, tests | ✅ built, **uncommitted** |
| A2 | SerpApi removed; first-party sources only (VNA + VietJet planned) | ✅ removed — tests 9 → 7 |
| A3 | Durable local store (embedded Postgres, same migration as Supabase) | ✅ working — `data/fares`, 95 offers stored |
| A4 | On-demand runner (`scripts/crawl.sh`, `pnpm crawl`, `pnpm fares`) | ✅ working, logged to `data/crawl.log` |
| A5 | Supabase write (project exists, needs the **secret** key + schema) | ⏳ T1 |
| A6 | VietJet browser adapter (one-way + itinerary coverage) | ⏳ T5 — probe script written, not run |
| A7 | Manual-run workflow + staleness visibility | ⏳ T6 |

**Track B — the app members use (the product)**

| Step | Scope | Status |
|---|---|---|
| B1 | Registration schema + roster seed (`members`, `member_trip`, 3 views, RLS) | ✅ built + verified on PGlite (18 tests) |
| B1b | Trip-domain rules as pure TS (`@vikc/registration`: stay/headcount/progress) | ✅ built + tested |
| B2 | Supabase: both migrations + seeds applied, grants, first live writes | ✅ done (T1) |
| B3 | `apps/web` built on **Refine + AntD** (admin CRUD + custom member pages) | ✅ done (T3) — deploy to Vercel left |
| B4 | `/enroll` — pick your name, arrival + departure datetime, live nights/days | ✅ done (T7) |
| B5 | `/track` — headcount per day 18–30/11, progress list, deadline countdown | ✅ done (T7) |

Decisions (T7): **1a roster pick, no login** · v1 fields = arrival/departure + room type + roommate,
exam grade, team-3, team-5, dojo, notes (no fees).

Priority note (owner, 2026-10-08): the point of the app is that members pick their **arrival and
departure datetimes** so the trip is tracked programmatically. Categories/fees/fares are secondary.

**Dropped:** SerpApi (2026-10-08) · spreadsheet/xlsx track (archived) · any scheduler
(GitHub Actions, launchd, Vercel cron) — runs are triggered by hand.

## 2. Task board status

| Card | Task | Status | Blocked by |
|---|---|---|---|
| [T0](tasks/T0-commit-and-pr.md) | Commit step 1 + open PR | ⏳ ready, needs owner OK to push | owner OK |
| [T1](tasks/T1-supabase-live.md) | Schema + seed on the project, first live write | ⏳ | T0, owner supplies the **secret** key |
| ~~T2~~ | ~~SerpApi real fixture~~ | ❌ **dropped** | — |
| [T3](tasks/T3-web-app.md) | Next.js app + fares page on Vercel | ⏳ | T1 |
| [T4](tasks/T4-verify-vna-taxes.md) | Verify VNA price = taxes-included | ⏳ | — |
| [T5](tasks/T5-vietjet-browser-adapter.md) | VietJet browser-capture adapter | 🅿️ **parked** (off the critical path) | owner restart |
| [T6](tasks/T6-manual-crawl-and-data-health.md) | Manual crawl workflow + data health | ⏳ | T1 |
| [T7](tasks/T7-enrollment-and-registration.md) | **Arrival/departure datetimes + progress tracking** | 🔒 **the product**, 2 decisions | T1, T3 |

## 3. Verification evidence

Checks must be reproducible with the commands in the handoff §0. Record the date
and the observed result — never a bare "looks fine".

| Date | Check | Command | Result |
|---|---|---|---|
| 2026-10-08 | Unit tests | `pnpm test` | ✅ 3 files / **10 tests** (parsers, runner, local sink) |
| 2026-10-08 | Types | `pnpm typecheck` | ✅ `tsc --noEmit` clean |
| 2026-10-08 | Live VNA crawl | `pnpm crawl --dry-run` | ✅ 46 + 49 grid rows in ~3 s |
| 2026-10-08 | Real crawl → local store | `./scripts/crawl.sh run` | ✅ `2/2 provider runs ok`, 95 offers in 1 hour-bucket |
| 2026-10-08 | Hourly overwrite semantics | two crawls inside one hour | ✅ offer count stayed 95 (same-hour upsert), second hour would add rows |
| 2026-10-08 | Query the store | `pnpm fares` | ✅ cheapest per registered search: khứ hồi 18–22/11 = 2.673.158 ₫, 18–29/11 = 2.335.769 ₫; 4 one-way legs show `—` (no provider yet) |
| 2026-10-08 | Migration on PGlite 17 (fares) | apply migration + seed twice + upsert probe | ✅ applies, seed idempotent, hour buckets behave |
| 2026-10-08 | Registration migration + roster seed | `pnpm --filter @vikc/registration test` | ✅ 18 tests: migration applies, seed idempotent (22 members, 22 trip rows), `member_trip_order` rejects a departure before arrival, RLS policies present (roster read-only, trip writable) |
| 2026-10-08 | **SQL views vs TypeScript rules** | same test run | ✅ `v_member_stay` / `v_member_nights` / `v_headcount_per_day` match `deriveStay` / `presenceDays` / `headcountByDay` day-by-day for the fixtures — the admin SQL and the form preview cannot diverge |
| 2026-10-08 | Stay derivation fixtures | `pnpm test` | ✅ 18/11→22/11 = 4 nights (Tam Chúc 4), 20/11→29/11 = 9 nights (NB 3 + HN 6), 15/11→20/11 flags `outside-window` + 3 nights outside the legs, migration-rejected reverse order |
| 2026-10-08 | Supabase project | `GET /rest/v1/…` | ✅ project `vikc-tracker` (ap-northeast-1, healthy) |
| 2026-10-08 | Migrations applied to production | `node scripts/db-apply.mjs` (Management API, PAT) | ✅ flights + registration + both seeds; `notify pgrst` reload; 6 searches, 22 members, 22 trip rows |
| 2026-10-08 | Grants | same | ✅ this project does **not** auto-expose new tables → explicit `GRANT`s added (`20261009000001_grants.sql`); before that every read answered `42501 permission denied` |
| 2026-10-08 | Secret key | project API keys (`?reveal=true`) | ✅ `sb_secret_…` written to `.env`; reads all tables/views. **The masked value without `reveal=true` returns 401** — that trap cost an hour |
| 2026-10-08 | Crawl → Supabase (real write) | `pnpm crawl` | ✅ `[store] supabase …` , 95 grid rows written, re-run upserts within the hour |
| 2026-10-08 | `pnpm fares` against Supabase | `pnpm fares` | ✅ cheapest per registered search (khứ hồi 18–22/11 = 2.673.158 ₫, 18–29/11 = 2.335.769 ₫) with fetch time |
| 2026-10-08 | **Member write path** (publishable key, as the browser will do) | `PATCH /rest/v1/member_trip?member_id=eq.SKJ-198` | ✅ 204; `v_member_stay` → nights 4 / days 5 / NB 4 / HN 0 / complete; `v_headcount_per_day` reflected it live; reversed stay → `400 check constraint "member_trip_order"`; test row reset |
| 2026-10-09 | Web app builds | `pnpm --filter web build` | ✅ Next 16.4 (webpack) — 8 routes, type-check clean |
| 2026-10-09 | All routes respond | `pnpm --filter web start` + curl | ✅ `/`, `/enroll`, `/track`, `/members`, `/trips`, `/stay` → 200 |
| 2026-10-09 | **Member flow, real browser** | Playwright against the running app | ✅ picked a name → `18/11/2026 14:00` / `22/11/2026 10:00` → live preview "5 ngày · 4 đêm · Tam Chúc 4" → "Đã lưu. Cảm ơn bạn!" → Supabase row showed `14:00`/`10:00` VN |
| 2026-10-09 | **Board** | same browser run, `/track` | ✅ 22 members · 1/22 filled · headcount 1 on 18–22/11 with VIKC/Hà Nội tags · member row "4 đêm · thiếu phòng" |
| 2026-10-09 | Derived view gap found by the E2E | 400 `column v_member_stay.outside_nights does not exist` | ✅ migration `20261009000002_stay_outside_nights.sql` recreates the view with `outside_nights`; the SQL-vs-TS agreement test now covers it and applies **all** migrations in order |
| 2026-10-08 | VietJet probe | `npx tsx scripts/spike-vietjet.ts` (headless Chromium **and** real Chrome) | ⚠️ form fills correctly and the page reaches `/vi/select-flight`, `get-session` → 200 with `sessionId`, but **no `search-flight` call is made** → results show “Không tìm thấy chuyến bay”. AWS WAF present. Outcome: not usable in automated headless; headed run is the untried option (T5) |
| 2026-10-08 | install/uninstall of a scheduler | `scripts/crawl-local.sh install` + `uninstall` | ✅ verified, then **removed** — owner triggers runs by hand (no LaunchAgent remains) |

## 4. Environment

| Thing | Value |
|---|---|
| Branch | `feat/flight-crawler` (web track); `main` = `3e6a4da` |
| Node / pnpm | v24.16.0 / 10.33.0, installed via **mise** |
| Crawl | on demand: `./scripts/crawl.sh run` · `pnpm crawl` · report `pnpm fares` |
| Scheduler | **none** (no launchd, no GitHub Actions, no Vercel cron) |
| Store | Supabase when `.env` holds the secret key → else local embedded Postgres `data/fares` |
| Log | `data/crawl.log` (git-ignored with `data/`) |
| Providers | Vietnam Airlines ✅ · VietJet ⏳ (T5) · SerpApi ❌ dropped |
| Supabase project | exists (`ivxj…supabase.co`), **no tables yet** |
| Web app | `apps/web` — Refine 5 + AntD 5 + Next 16 (App Router, webpack); `dev`/`build`/`start` scripts, needs the two `NEXT_PUBLIC_*` vars |
| Vercel project | none yet |
| Owner shell | fish — wrap bash loops in `bash -c '...'`; `scripts/crawl.sh` is bash |

## 5. Secrets & env (names only — never values)

| Name | Where | Status |
|---|---|---|
| `SUPABASE_URL` | root `.env` | ✅ real project |
| `SUPABASE_ACCESS_TOKEN` | root `.env` | ✅ Management API PAT (`sbp_…`) → `scripts/db-apply.mjs` can run migrations |
| `SUPABASE_SERVICE_ROLE_KEY` | root `.env` | ✅ project **secret** key (`sb_secret_…`) → crawler + scripts |
| `SUPABASE_PUBLISHABLE_KEY` | root `.env` → Vercel as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (T3) | ✅ publishable key; verified it can read the roster/views and write `member_trip` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env (T3) | ❌ not set |

`SERPAPI_KEY` is no longer used anywhere. No GitHub secrets at all. `.env` is git-ignored;
`.env.example` documents which key kind each variable needs.

## 6. Owner gates (agent cannot do these)

- Push the branch / open the PR (T0).
- ~~secret key / migrations~~ — done 2026-10-08 (agent used the owner's Management API token).
- Create the Vercel project and set its env vars (T3).
- Answer the 5 enrollment decisions in [T7](tasks/T7-enrollment-and-registration.md).
- Approve the VietJet browser adapter (T5) — the boundary in handoff §2 applies (no evasion; a
  challenge means "blocked" and stop).

## 7. Risks / open questions

- **Staleness**: with no scheduler, prices age until the owner runs a crawl. `status` must make the
  last run obvious (T6), and the UI must show "cập nhật lúc …" rather than implying live prices.
- **Coverage**: VNA only answers round-trip calendars — no flight numbers, no one-way legs, no
  low-cost carriers. The four one-way searches are empty until T5 lands; the UI must say so.
- **Blocked-by-WAF risk**: the VietJet browser leg may be challenged (the 2026-10-08 spike saw
  headless detection). Fallbacks are in T5; escalation is out of bounds.
- **Migrations are applied through the Management API**, because this machine has no DB password
  and `supabase link` was never run. If the schema changes, `node scripts/db-apply.mjs` (PAT in
  `.env`) is the path; the CLI `db push` would need the owner's DB password.
- **Trust trade-off accepted** (T7 decision 1a): with no login, anyone holding the link can edit any
  member's trip row. That is the owner's explicit choice for a 22-person club tool; the app must say
  so in the footer.
- **VietJet coverage** is parked, not solved: VNA-only means no low-cost-carrier prices and no
  one-way legs. Fares are a secondary panel now, so this no longer blocks the product.
- **VNA price semantics** unverified — the UI must not label it "tổng giá" until T4 passes.
- **Schema changes**: once the migration is applied to the project, never edit it — add a new file.

## 8. Frozen / dropped tracks

- **Spreadsheet track** (Google Sheets generator, `CHI PHÍ`, `LỊCH TRÌNH`, `TỔNG QUAN`): dropped.
  Docs in [`archive/spreadsheet-track/`](archive/spreadsheet-track/); the generator
  (`tools/build_trip_registration.py`) and workbook (`deliverables/`) remain untouched. Its spec is
  still the best written source for the T7 domain rules (categories, VNA/VKF fees, deadlines).
- **SerpApi**: dropped; no keyed/paid data source in the design.
- **Schedulers**: no launchd job, no GitHub Actions workflow, no Vercel cron.
