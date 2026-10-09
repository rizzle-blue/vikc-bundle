# HANDOFF — VIKC 2026 Shakaijin trip app

> For the next agent/session. Read this, then [`status.md`](status.md) and one card in
> [`tasks/`](tasks/README.md).
>
> **Shape of the repo (2026-10-09):** this *is* a Next.js app at the repository root. The flight
> crawler, the spreadsheet generator and the extracted user-guide corpus were parked in
> [`../deprecated/`](../deprecated/README.md). Supabase is the backend; Refine + AntD is the UI.

## 0. TL;DR — how to resume

```bash
pnpm install
cp .env.example .env.local     # fill NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm test                      # 18 tests, must stay green
pnpm typecheck
pnpm dev                       # http://localhost:3000  → /enroll (members), /track (organisers)
pnpm build && pnpm start
```

State as of **2026-10-09** (verified on the owner's machine):

| Check | Result |
|---|---|
| `pnpm test` | ✅ 18 tests (domain rules + every SQL view compared against them) |
| `pnpm typecheck` | ✅ clean |
| `pnpm build` / `start` | ✅ 8 routes, all respond 200 |
| Member flow | ✅ verified in a real browser: pick name → 18/11 14:00 / 22/11 10:00 → "Đã lưu" → row in Supabase |
| Board | ✅ 22 members, 1/22 filled, headcount per day, deadline countdown |
| Supabase | ✅ project `vikc-tracker`; migrations + seeds + grants applied; publishable key reads and writes through RLS |
| Vercel | ❌ not deployed yet — the owner's next step (root directory = repo root, two `NEXT_PUBLIC_*` vars) |
| Git | everything committed and pushed to `main` (`57ce438`) |

## 1. What the app is for

The delegation goes to **VIKC 2026 (Tam Chúc, Ninh Bình, 19–22/11/2026)** and then to a **Hà Nội
dojo exchange (23–29/11/2026)**. Members fly SGN ↔ HAN.

The single purpose (owner's words, 2026-10-08): *members choose their arrival datetime and departure
datetime so the trip can be tracked programmatically.* Everything else in the app is derived from
those two values or optional.

| Page | Who | What it does |
|---|---|---|
| `/enroll` | members | pick your name, enter arrival + departure, live nights/days preview, optional room/exam/teams/notes, save |
| `/track` | organisers | members · filled/missing · total nights · progress · countdown to 20/10 & 25/10 · headcount 18–30/11 (VIKC/Hà Nội tagged) · per-member table |
| `/members` | organisers | the roster (read-only) |
| `/trips`, `/trips/edit/:id` | organisers | every member's datetimes, via Refine's list + form |
| `/stay` | organisers | the derived `v_member_stay` view |

## 2. Decisions already made — do not reopen

| Topic | Decision |
|---|---|
| Stack | **Next.js 16 (App Router) + Refine 5 + Ant Design 5 + Supabase**, deployed on Vercel Hobby. Refine supplies the CRUD surface (list/form/table/filters) so it isn't hand-built. |
| Data access | The browser uses the **publishable key** only (`NEXT_PUBLIC_SUPABASE_ANON_KEY`); every read/write goes through RLS + explicit grants. |
| Identity | **No login** (decision 1a, 2026-10-08): a member picks their name from the roster. Anyone with the link can edit any row — deliberate for a 22-person club tool, and stated on the page. `members` is read-only for the anon key; `member_trip` is insertable/updatable. |
| Core data | `member_trip.arrival_at` + `departure_at` (`timestamptz`, Asia/Ho_Chi_Minh) per member. Everything else derived or optional. |
| v1 fields | Required: arrival, departure, room type. Optional: roommate, exam grade (1 kyu–5 dan), team-3, team-5, dojo exchange, notes. No fees. |
| Night convention | A night is dated by its **check-in day** (hotel-bill convention). Arrive 18/11 + leave 22/11 = 4 nights. Tam Chúc nights 18–22/11, Hà Nội nights 23–29/11; the VKF package covers the 21/11 night. |
| Trip window | 18–30/11/2026 tracked; VIKC days 19–22/11; Hà Nội days 23–29/11. Deadline đăng ký **20/10/2026**, thanh toán **25/10/2026**. |
| Migrations | Applied with `node scripts/db-apply.mjs` through the **Management API** (this machine has no DB password / `supabase link`). Never edit an applied migration — add a new file. |
| Events (2026-10-09) | The operator sets up **events**; members **check in** to them. `events` + `event_sessions` + `event_signups`, seeded with the VIKC programme from `resources/vikc-2026/md/01`. `counts_as_entry` marks the team shiai events (the VKF package price is 1 vs 2 "nội dung"). Full design: [`spec-events.md`](spec-events.md). |
| Roster | **Reference data only** — nothing is pre-enrolled. A `registrations` row appears when a member signs up; `members.expected` is the operator's own "I know they're coming" marker. |
| Access (D9) | Two shared codes: one for members, one for the operator. A UI gate, not a security boundary — so `events`/`event_sessions`/`members.expected` are written **only** through a server route holding the service key; the anon key keeps read-only on them. |
| Teams / fees | Later: teams are assigned after sign-ups (C7); the fee calculator comes after the data (D10). |
| Parked | Flight-fare crawler (incl. VietJet browser capture), the `.xlsx` spreadsheet generator, the extracted corpus → [`../deprecated/`](../deprecated/README.md). The spreadsheet spec stays in [`archive/spreadsheet-track/`](archive/spreadsheet-track/spec-trip-registration.md) as the domain reference (fees, categories, deadlines). |

## 3. Repo map

| Path | What |
|---|---|
| `src/app/layout.tsx` | AntD registry + `vi_VN` locale + Refine providers; `force-dynamic` |
| `src/app/providers.tsx` | Refine wiring: `dataProvider(supabase)` + the App Router router |
| `src/app/enroll/page.tsx` | the member page (the thing members actually use) |
| `src/app/track/page.tsx` | the organisers' board |
| `src/app/(admin)/…` | Refine list/edit screens (roster, trip rows, stay view) |
| `src/lib/supabase.ts` | the publishable-key client + `supabaseConfigured` guard |
| `src/lib/resources.ts` | Refine resources (`meta.idColumnName: "member_id"` for trip rows) |
| `src/lib/registration/{trip,stay}.ts` | the domain rules: `vnDate`, `deriveStay`, `presenceDays`, `headcountByDay`, `progressOf`, `summarize`, `daysUntil` |
| `supabase/migrations/` | `…_flights` (parked crawler tables), `…_registration`, `…_grants`, `…_stay_outside_nights`, `…_events`, `…_event_view_grants` |
| `supabase/seed_events.sql` | the VIKC programme as operator-editable events (idempotent, never overwrites edits) |
| `src/lib/registration/` | the trip rules (nights, days, headcount, progress) — `events` will reuse them |
| `supabase/seed.sql`, `seed_members.sql` | the 6 fare searches (legacy) and the roster + empty trip rows |
| `scripts/db-apply.mjs`, `gen-member-seed.mjs` | apply SQL to the project; regenerate the roster seed |
| `test/schema.test.ts` | applies **all** migrations on PGlite and compares every view against the TS rules |
| `resources/members.json` | roster source for the seed |
| `deprecated/`, `docs/archive/` | parked code/artifacts and the frozen spreadsheet plan |

## 4. Database shape (Supabase)

- `members` — id (`SKJ-###`), vkf_id, full_name, gender, date_of_birth, rank, email, phone.
- `member_trip` — `member_id` PK → `arrival_at`, `departure_at`, `room_type`, `roommate`,
  `exam_grade`, `team3`, `team5`, `dojo_exchange`, `notes`, `updated_at`,
  plus `check (departure_at > arrival_at)` (`member_trip_order`).
- `v_member_nights` — one row per night spent (dated by check-in day), flagged Tam Chúc / Hà Nội.
- `v_member_stay` — per member: nights, days, tam_chuc_nights, ha_noi_nights, outside_nights,
  `has_datetimes`, `complete`.
- `v_headcount_per_day` — 18–30/11 with `present`, `confirmed`, `vikc_days`, `ha_noi_days`.
- Grants: roster read-only, trip rows writable for `anon`/`authenticated`, crawler tables for the
  service role. The project does **not** auto-expose new tables — a new object needs an explicit
  `GRANT` or the API answers `42501 permission denied`.

## 5. Gotchas

- **TypeScript 7 removed `baseUrl`.** `tsconfig.json` declares `"paths": { "@/*": ["./src/*"] }`
  without it, and `next.config.mjs` mirrors the alias for webpack.
- **Next must be ≥ 16.2.11 for TS 7.** The app builds with `next build --webpack`; the webpack config
  adds `resolve.extensionAlias` so the NodeNext-style `./trip.js` imports inside
  `src/lib/registration` resolve to `.ts`.
- **Refine + App Router**: the provider reads `useSearchParams`, so it sits inside a `<Suspense>`
  boundary; AntD does not prerender cleanly under RSC, so the root layout sets
  `export const dynamic = "force-dynamic"` (everything is a client component with live data anyway).
- **`member_trip` has no `id`** — pass `meta: { idColumnName: "member_id" }` to Refine hooks.
- **Vitest must skip `deprecated/`** (`vitest.config.mts`); that parked code imports a deleted
  `tsconfig.base.json`.
- **`.next/` and `*.tsbuildinfo` are git-ignored** — keep it that way.
- **Migrations**: `node scripts/db-apply.mjs` (needs `SUPABASE_ACCESS_TOKEN`, a `sbp_…` token).
  Applied migrations are recorded in `public.schema_migrations` and skipped — `--status` lists what
  is pending. Seeds always re-run (they are idempotent). The API masks secret keys unless requested
  with `?reveal=true`.
- **Commits are SSH-signed through 1Password.** A tool shell often inherits a launchd
  `SSH_AUTH_SOCK` with no identities → `1Password: failed to fill whole buffer` on commit or an auth
  failure on push. Fix: `export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"`
  and retry once. `git ls-remote origin` tells you whether auth works while signing does not.
- Owner shell is **fish**; wrap bash-style loops in `bash -c '...'`.

## 6. Task board

[`docs/tasks/README.md`](tasks/README.md) — currently: **T8** (the Events UI: operator editor +
member check-in + the two access codes), **T3** (deploy to Vercel) and **T7** (the app; CSV export). Done and parked cards live in
[`../deprecated/tasks/`](../deprecated/tasks/).

## 7. Definition of done

- Members enroll from one link on a phone in under a minute; nights/days are visibly correct.
- Organisers answer "who is in Vietnam on which day" and "who hasn't filled it in" without a
  spreadsheet, and can export the list.
- A new agent can reproduce all of it from this handoff, the status file and the cards.
