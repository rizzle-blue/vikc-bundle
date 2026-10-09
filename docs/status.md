# STATUS — VIKC 2026 Shakaijin trip app

Handoff: [`handoff.md`](handoff.md) · Task board: [`tasks/README.md`](tasks/README.md)
Last updated: **2026-10-09** (member paperwork + exam submission live — the VKF registration data)

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
| Access gate: member + admin codes (httpOnly cookie, middleware) | ✅ done (T8) |
| Operator area: dashboard, event editor, sessions, sign-up lists, `expected` toggle, CSV exports | ✅ done (T8) |
| Member check-in: per-event/session checkboxes, exam `form_schema` fields, live entry counter | ✅ done (T8) |
| Board reframed around registrations + events | ✅ done (T8) |
| **Member paperwork** for VKF (`member_profiles`: latin/Kanji name, CCCD, address, occupation, dojo, emergency contact, mailing address, current grade + date/issuer/photo) | ✅ live + in the form |
| **Exam submission** (`exam_entries`: grade applied, 1 kyu→shodan, snapshot of the grade paperwork, dojo approval, withdrawable) | ✅ live + in the form |
| Eligibility guidance against VKF's table (min age, training period per dan) | ✅ shown live in the form (`checkEligibility`) |
| **Scope 1 — Member sign-up form**: basic info (pre-filled from the roster, member can correct) + the personal data VKF requires | ✅ live |
| **Scope 2 — VIKC Registration**: the sheet pre-filled from the members, with `missing_fields` and a **VKF-column CSV** | ✅ live (`/admin/registration`, `?kind=vkf`) |
| Member data model documented (three tiers + write matrix) and the pre-events columns dropped | ✅ [`spec-member-data-model.md`](spec-member-data-model.md) |
| Vercel deploy + member link handed out (**needs `SUPABASE_SERVICE_ROLE_KEY` + the two codes in Vercel env**) | ⏳ T3 (owner) |
| CSV export for the organisers | ⏳ small, unstarted |
| VKF submission export (CSV in their column order) | ⏳ T9 |
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
| 2026-10-09 | Access gate (real browser) | `pnpm e2e` | ✅ `/enroll` + `/admin` redirect to `/login?next=…`; the member cookie cannot open `/admin`; both codes set their cookie |
| 2026-10-09 | Member check-in (real browser → live DB) | `pnpm e2e` | ✅ picked a name, 18/11 14:00 → 22/11 10:00, ticked Team 3 Nam + the exam with grade `3 dan` → saved; **entry counter = 1** (the exam is not a "nội dung"); rows present in `regrations`/`event_signups` |
| 2026-10-09 | Operator area | same run | ✅ dashboard lists the programme, CSV export returns 200 with the sign-up, `POST /api/admin/events` allowed for the admin cookie |
| 2026-10-09 | E2E as a repeatable check | `pnpm e2e` (playwright devDependency) | ✅ 18 checks, cleans up its own rows |
| 2026-10-09 | Access gate completeness | `pnpm e2e` | ✅ `/track`, `/members`, `/trips`, `/stay` were open to anyone with the URL → now behind the admin code; the member cookie is bounced from all of them, the admin cookie opens them |
| 2026-10-09 | Paperwork + exam rules | `pnpm test` | ✅ 33 tests — eligibility per dan (ages 13/14/16/19/23 and 1/2/3/4-year training periods), the missing certificate-date nudge, the foreign-candidate 1 kyu note, the 8 required VKF fields |
| 2026-10-09 | Paperwork storage + submission view | same | ✅ `v_member_profile.missing_fields` counts down as fields are filled (photo included); `v_exam_submission` snapshots the grade paperwork, hides withdrawn entries, marks the VKF fee bracket and carries the trip's room/nights |
| 2026-10-09 | Member form (real browser → live DB) | `pnpm e2e` | ✅ 23 checks — fills the whole VKF paperwork + exam fields, then the submission row reads back: grade `3 dan`, latin name, certificate date, dojo approval, 0 missing fields; the test cleans up |
| 2026-10-09 | Login robustness | `pnpm e2e` (repeated) | ✅ found a hydration race: clicking "Vào" before React hydrated did a native POST — no cookie, no message. The button is now disabled until hydration |
| 2026-10-09 | Scope 1 (real browser) | `pnpm e2e` | ✅ the basic info arrives pre-filled from the roster; correcting the phone is stored as the member's own value |
| 2026-10-09 | Scope 2 (real browser + DB) | `pnpm e2e` | ✅ the registration sheet pre-fills name, latin name, VKF member, exam grade and the trip (room Đôi, 4 nights); the CSV carries VKF's column names and the member; 23→29 checks total |
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

- **The codes are a UI gate, not auth** (accepted): anyone with the member code can edit any row;
  anyone with the admin code can edit the programme. Operator *writes* still go through the server
  route with the service key, so the member code cannot change events.
- **AntD `Form` cannot drive a server action** — the login page uses a plain `<form action={…}>`
  with `useActionState`. Keep it that way.
- **A member cannot `DELETE` a sign-up** (granted insert/select/update only, by design): cancelling
  an event sets `status = 'cancelled'` and re-checking flips it back to confirmed.

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
