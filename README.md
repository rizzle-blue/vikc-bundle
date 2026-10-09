# VIKC 2026 · Shakaijin trip registration

A Next.js app (Refine + Ant Design + Supabase) for the Shakaijin Kendo Team's trip to the
1st Vietnam International Kendo Championships 2026 — **Tam Chúc, Ninh Bình 19–22/11/2026** plus a
**Hà Nội dojo exchange 23–29/11/2026**.

The purpose is small and specific: **each member enters the datetime they arrive and the datetime
they leave**, and from those two values the app derives everything the organisers track.

The site is behind **two shared access codes** (owner decision): the member code opens `/enroll`;
the admin code opens everything else with data — `/track` (the board), `/admin` (the programme
editor), the roster and registration screens. Only `/` and `/login` are public. It is a private-link
gate, not accounts — the codes are set in `.env.local` (`MEMBER_ACCESS_CODE`, `ADMIN_ACCESS_CODE`)
and in Vercel for production; changing them needs a redeploy. See `docs/spec-events.md`.

| Page | Who | What |
|---|---|---|
| `/enroll` | members | pick your name, arrival + departure datetime, live nights/days, and **check in to the events** you take part in (team shiai, exam with grade, seminar, Godo per session, party, Hà Nội dojo exchange) |
| `/track` | organisers | registrations, expected attendees, entry split (1 vs 2 "nội dung"), event sign-ups, headcount per day 18–30/11 |
| `/admin` | operator | the programme with sign-up counts, the `expected` switch per member, CSV exports; `/admin/events/new` + `/admin/events/[id]` to create and edit events and their sessions |
| `/members`, `/trips`, `/trips/edit/:id`, `/stay` | organisers | Refine CRUD on the roster, the registrations, the edit form and the derived stay view |

Derived from the two datetimes: nights and days (Vietnam calendar), which nights belong to the Tam
Chúc leg (18–22/11) vs the Hà Nội leg (23–29/11), per-member progress, and headcount for every day.

## Run

```bash
pnpm install
cp .env.example .env.local     # NEXT_PUBLIC_* + MEMBER_ACCESS_CODE + ADMIN_ACCESS_CODE
pnpm dev                       # http://localhost:3000
pnpm test                      # domain rules + SQL views + the events model (21 tests)
pnpm typecheck
pnpm e2e                       # browser smoke test (needs `pnpm start -p 3100` running)
node scripts/db-apply.mjs      # migrations + seeds → Supabase
```

## Deploy

Vercel → import this repository (root directory = the repo root) and set four variables:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the **publishable** key),
`SUPABASE_SERVICE_ROLE_KEY` (server-only, for the operator routes), and the two access codes
`MEMBER_ACCESS_CODE` / `ADMIN_ACCESS_CODE`. Deploy, then share `/login` with the member code and
keep the admin code for the organisers.

## Layout

| Path | What |
|---|---|
| `src/app/` | routes: `/`, `/enroll`, `/track` and the Refine admin screens under `(admin)/` |
| `src/lib/supabase.ts` | the client the browser uses — publishable key, everything passes through RLS |
| `src/lib/resources.ts` | the Refine resources (roster, trip rows, derived stay view) |
| `src/lib/registration/` | the trip domain rules as pure functions: `deriveStay`, `presenceDays`, `headcountByDay`, `progressOf` |
| `src/app/admin/`, `src/app/api/admin/` | the operator area and its service-key routes |
| `src/middleware.ts`, `src/lib/auth.ts` | the two access codes |
| `supabase/migrations/` | the schema: `members`, `member_trip`, derived views, grants, RLS |
| `supabase/seed_members.sql` | the roster + one trip row per member (generated from `resources/members.json`) |
| `scripts/db-apply.mjs` | applies migrations + seeds to the Supabase project (Management API) |
| `scripts/gen-member-seed.mjs` | regenerates the roster seed after roster edits |
| `test/` | vitest: the domain rules, the events model, plus a check that every SQL view matches them day by day |
| `scripts/e2e.mjs` | `pnpm e2e` — the browser smoke test (gate, check-in, CSV) |
| `docs/` | [`handoff.md`](docs/handoff.md) · [`status.md`](docs/status.md) · [`tasks/`](docs/tasks/README.md) |
| `resources/` | the roster (`members.json`) and the original user-guide PDFs |
| `deprecated/` | parked earlier attempts — see [`deprecated/README.md`](deprecated/README.md) |

Identity: **no login** — a member picks their name from the roster, so anyone with the link can edit
any row. That is a deliberate choice for a 22-person club tool (the page says so). The anon key may
read the roster and write trip rows; `members` itself is read-only.
