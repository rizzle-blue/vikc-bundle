# T3 — Deploy the app to Vercel

**Read first:** [`docs/handoff.md`](../handoff.md) §2 (Product), §4. Requires T1 (data in Supabase).
Status: ✅ **built** (2026-10-09) — `apps/web` on Refine + AntD + Next 16, all routes green, member
flow and board verified end-to-end. Remaining: the Vercel deploy (owner).

## Goal

The app skeleton on Vercel, with the read-only fares view: what SGN↔HAN costs on the trip dates
and how prices move. Vietnamese UI. Free Vercel Hobby deploy.

## Scope

- Import the repository into Vercel (Hobby), **root directory = the repo root**.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the
  **publishable** key — never the secret one).
- Framework detection: Next.js; the build command is `next build --webpack` (already in
  `package.json`).
- Verify after deploy: `/` loads, `/enroll` lists the 22 members and saves a test datetime, `/track`
  shows the headcount board. Then reset the test row.

## Tech
- `pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --use-pnpm`
  (workspace already globs `apps/*`).
- Data access: Server Components with `@supabase/supabase-js`, **publishable/anon key only**:
  env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the key already sitting in the
  local `.env` is a publishable one — that is exactly what the browser is allowed to see).
  Add both names to `.env.example`.
- `export const revalidate = 600` (the crawl is triggered by hand; this keeps the page within
  ~10 min of the last run without hammering Supabase).
- Types: hand-write row types or `supabase gen types typescript --linked > apps/web/src/lib/db.ts`.
- Root `package.json`: add `"web": "pnpm --filter web dev"`.

## Deploy
👤 Owner: Vercel → Add New Project → import `rizzle-blue/vikc-bundle`, Root Directory
`apps/web`, set the two env vars, deploy. (Vercel CLI isn't installed on owner machine.)

## Done when
- `pnpm --filter web build` passes; `pnpm test` still green.
- Locally `pnpm web` shows the 6 searches with real prices from Supabase.
- Empty states handled (no runs yet, provider blocked, no offers).
- Owner gets the Vercel preview URL, and [`status.md`](../status.md) is updated.

## Don't
- No service-role key anywhere in `apps/web`. No auth/login in MVP. No booking links that
  imply we sell tickets — link to the airline homepage at most.
