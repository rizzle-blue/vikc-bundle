# VIKC 2026 · Shakaijin trip registration

A Next.js app (Refine + Ant Design + Supabase) for the Shakaijin Kendo Team's trip to the
1st Vietnam International Kendo Championships 2026 — **Tam Chúc, Ninh Bình 19–22/11/2026** plus a
**Hà Nội dojo exchange 23–29/11/2026**.

The purpose is small and specific: **each member enters the datetime they arrive and the datetime
they leave**, and from those two values the app derives everything the organisers track.

| Page | Who | What |
|---|---|---|
| `/enroll` | members | pick your name, enter arrival + departure datetime, see nights/days instantly |
| `/track` | organisers | members, filled/missing, total nights, headcount per day 18–30/11, deadlines |
| `/members`, `/trips`, `/trips/edit/:id`, `/stay` | organisers | Refine CRUD on the roster, the trip rows, the edit form and the derived stay view |

Derived from the two datetimes: nights and days (Vietnam calendar), which nights belong to the Tam
Chúc leg (18–22/11) vs the Hà Nội leg (23–29/11), per-member progress, and headcount for every day.

## Run

```bash
pnpm install
cp .env.example .env.local     # fill in the two NEXT_PUBLIC_* values
pnpm dev                       # http://localhost:3000
pnpm test                      # domain rules + SQL views must agree (18 tests)
pnpm typecheck
```

## Deploy

Vercel → import this repository (root directory = the repo root), set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the **publishable** key — never the
secret one), deploy. Share `/enroll` with the members and `/track` with the organisers.

## Layout

| Path | What |
|---|---|
| `src/app/` | routes: `/`, `/enroll`, `/track` and the Refine admin screens under `(admin)/` |
| `src/lib/supabase.ts` | the client the browser uses — publishable key, everything passes through RLS |
| `src/lib/resources.ts` | the Refine resources (roster, trip rows, derived stay view) |
| `src/lib/registration/` | the trip domain rules as pure functions: `deriveStay`, `presenceDays`, `headcountByDay`, `progressOf` |
| `supabase/migrations/` | the schema: `members`, `member_trip`, derived views, grants, RLS |
| `supabase/seed_members.sql` | the roster + one trip row per member (generated from `resources/members.json`) |
| `scripts/db-apply.mjs` | applies migrations + seeds to the Supabase project (Management API) |
| `scripts/gen-member-seed.mjs` | regenerates the roster seed after roster edits |
| `test/` | vitest: the domain rules, plus a check that every SQL view matches them day by day |
| `docs/` | [`handoff.md`](docs/handoff.md) · [`status.md`](docs/status.md) · [`tasks/`](docs/tasks/README.md) |
| `resources/` | the roster (`members.json`) and the original user-guide PDFs |
| `deprecated/` | parked earlier attempts — see [`deprecated/README.md`](deprecated/README.md) |

Identity: **no login** — a member picks their name from the roster, so anyone with the link can edit
any row. That is a deliberate choice for a 22-person club tool (the page says so). The anon key may
read the roster and write trip rows; `members` itself is read-only.
