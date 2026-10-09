# STATUS — VIKC 2026 Shakaijin trip app

Handoff: [`handoff.md`](handoff.md) · Task board: [`tasks/README.md`](tasks/README.md)
Last updated: **2026-10-09** (Events schema live; roster is reference-only)

Single source of truth for where the project stands. Update it whenever a card finishes or a check
changes.

## 1. Progress

| Area | Status |
|---|---|
| Schema + roster seed on Supabase (`members`, `member_trip`, 3 views, grants, RLS) | ✅ live in project `vikc-tracker` |
| Domain rules as pure TypeScript (`src/lib/registration`) | ✅ built, tested |
| `/enroll` — member enters arrival + departure, live nights/days | ✅ built + verified in a browser |
| `/track` — headcount per day, progress, deadlines | ✅ built + verified |
| Refine admin screens (roster, trip rows + edit form, stay view) | ✅ built |
| Repo re-shaped: app at the root, earlier tracks in `deprecated/` | ✅ done |
| **Events**: `events` / `event_sessions` / `event_signups` + the VIKC programme seeded (9 events, 3 Godo sessions) | ✅ live in Supabase |
| Roster is reference-only: `registrations` is opt-in, `members.expected` flag added | ✅ live (a row appears when a member signs up) |
| Operator event editor + member "check to enrol" UI + the two access codes | ⏳ **next** (T8) |
| Vercel deploy + member link handed out | ⏳ T3 (owner) |
| CSV export for the organisers | ⏳ small, unstarted |
| Fee/cost estimation in the app | 🔒 later (D10): the model already carries the inputs (entry count, room type, exam grade, extras) |
| Teams (assignment for team 3 / team 5) | 🔒 later (C7): members mark interest today; four separate events encode the gender/size |

Dropped: the flight-fare crawler (incl. the VietJet browser attempt), the `.xlsx` spreadsheet
generator, the extracted corpus → [`../deprecated/`](../deprecated/README.md).

## 2. Verification evidence

Reproducible with the commands in the handoff §0; record the date and the observed result.

| Date | Check | Command | Result |
|---|---|---|---|
| 2026-10-08 | Migrations on PGlite | apply all `supabase/migrations/*.sql` + seeds twice | ✅ applies, seeds idempotent (22 members, 22 trip rows) |
| 2026-10-08 | Schema live | `node scripts/db-apply.mjs` | ✅ flights + registration + grants applied; `notify pgrst` reload |
| 2026-10-08 | Grants | same | ✅ this project does not auto-expose tables → explicit `GRANT`s (`…_grants.sql`); before that every read answered `42501` |
| 2026-10-08 | Secret key | project API keys (`?reveal=true`) | ✅ `sb_secret_…` in `.env`; **the masked value without `reveal=true` answers 401** |
| 2026-10-08 | Member write path (publishable key) | `PATCH /rest/v1/member_trip?member_id=eq.SKJ-198` | ✅ 204 → `v_member_stay` nights 4 / days 5 / NB 4 / HN 0 / complete; reversed stay → `400 check constraint "member_trip_order"` |
| 2026-10-09 | Domain rules | `pnpm test` | ✅ 18 tests (nights, splits, headcount, progress, warnings, VN calendar) |
| 2026-10-09 | **SQL views vs TypeScript rules** | same | ✅ `v_member_stay` / `v_member_nights` / `v_headcount_per_day` match `deriveStay` / `presenceDays` / `headcountByDay` day by day; the test applies **all** migrations |
| 2026-10-09 | App builds at the repo root | `pnpm build` | ✅ Next 16.4 (webpack), 8 routes, type-check clean |
| 2026-10-09 | All routes serve | `pnpm start` + curl | ✅ `/`, `/enroll`, `/track`, `/members`, `/trips`, `/stay` → 200 |
| 2026-10-09 | **Member flow, real browser** | Playwright against the running app | ✅ name → `18/11/2026 14:00` / `22/11/2026 10:00` → "5 ngày · 4 đêm · Tam Chúc 4" → "Đã lưu. Cảm ơn bạn!" → Supabase row showed those VN times (test row reset) |
| 2026-10-09 | **Board** | same browser run, `/track` | ✅ 22 members · 1/22 filled · headcount 1 on 18–22/11 with VIKC/Hà Nội tags · member row "4 đêm · thiếu phòng" |
| 2026-10-09 | Derived-view gap found by the E2E | 400 `column v_member_stay.outside_nights does not exist` | ✅ migration `20261009000002` recreates the view, re-grants, and the agreement test covers the column |
| 2026-10-09 | Events migration + programme seed | `node scripts/db-apply.mjs` | ✅ `events`(9) · `event_sessions`(3 Godo) · `event_signups`; `counts_as_entry` true for exactly the 4 team shiai events |
| 2026-10-09 | Entry counting (1 vs 2 "nội dung" for the package price) | `v_member_entry_count` | ✅ athlete in both team events → 2, in one → 1, seminar only → 0 |
| 2026-10-09 | Sign-up boundary | REST probes with the publishable key | ✅ `event_signups` insert/update allowed; `events` insert **denied** (operator writes through the server route with the service key) |
| 2026-10-09 | Migration tracking | `node scripts/db-apply.mjs --status` | ✅ applied migrations are recorded in `schema_migrations` and skipped; seeds still re-run |
| 2026-10-09 | Tests | `pnpm test` | ✅ 21 tests — registry of the roster being reference-only, the seeded programme, entry counting, sign-up uniqueness (incl. per-session) and the anon-write boundary |
| 2026-10-09 | Vercel | — | ❌ not deployed; needs the owner to import the repo and set the two `NEXT_PUBLIC_*` vars |

## 3. Environment

| Thing | Value |
|---|---|
| App | Next 16.4 + Refine 5 + AntD 5, repository root, `pnpm dev` / `build` / `start` |
| Tests | vitest at the root (`vitest.config.mts`), 18 tests |
| Supabase project | `vikc-tracker` (ap-northeast-1, healthy) |
| Vercel project | none yet |
| Node / pnpm | v24.16.0 / 10.33.0 (installed via mise) |
| Owner shell | fish — wrap bash loops in `bash -c '...'` |
| Git | `main` @ `57ce438`, pushed |

## 4. Secrets (names only — never values)

| Name | Where | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` locally, Vercel in production | ✅ set locally (publishable key) |
| `SUPABASE_URL` | root `.env` (scripts) | ✅ |
| `SUPABASE_ACCESS_TOKEN` | root `.env` (`sbp_…` Management API token) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | root `.env` (project secret key, server-side only) | ✅ |
| `SUPABASE_PUBLISHABLE_KEY` | root `.env` (source for the app's anon var) | ✅ |

## 5. Owner gates

- Deploy to Vercel and share the `/enroll` link with the members (T3).
- Decide what else the organisers need on the board (CSV export, fees, agenda).
- Approve any change to an already-applied migration.

## 6. Risks / open questions

- **Trust-based editing** is the accepted trade-off (no login): whoever has the link can edit any
  row. The page states it; revisit only if spoofed edits ever matter.
- **Two organisers editing at once** — last write wins (no row-level locking). Acceptable at this
  scale; worth noting if the board gets busy.
- **Time zones**: everything is `timestamptz` and displayed in `Asia/Ho_Chi_Minh`; the derived
  day/night maths uses the VN calendar (`vnDate`). Don't compare ISO strings directly.
- **Mobile**: the member page is single-column and works on a phone, but it has only been verified in
  a desktop browser viewport — check on a real phone once deployed.
- **Fees/costs** are not in the app. The rules (VKF/non-VKF packages, exam, extra nights) live in the
  archived spreadsheet spec if the owner wants them later.
