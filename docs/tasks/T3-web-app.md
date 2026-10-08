# T3 — `apps/web`: Next.js app + fares page on Vercel

**Read first:** [`docs/handoff.md`](../handoff.md) §2 (Product), §4. Requires T1 (data in Supabase).
Status: ⏳ blocked on T1. This is **step 1 of the member-facing app** — T7 adds enrollment and
category registration to the same app.

## Goal

The app skeleton on Vercel, with the read-only fares view: what SGN↔HAN costs on the trip dates
and how prices move. Vietnamese UI. Free Vercel Hobby deploy.

## Scope (MVP)
- `/` — one card per active `flight_searches` row (use `label`): cheapest current
  price per provider from `cheapest_by_date` (match exact depart/return date),
  "cập nhật lúc …" from latest `crawl_runs.finished_at`.
- `/search/[id]` —
  - table of `latest_fares` for that search: airline, flight no., giờ đi/đến (Asia/Ho_Chi_Minh),
    stops, price VND (`Intl.NumberFormat('vi-VN')`), provider; sorted by price.
  - VNA calendar searches: 7×7 grid (depart × return) of `price_vnd`, cheapest cell highlighted.
  - price history: minimum `price_vnd` from `fare_offers` grouped by `fetched_hour` (one row per
    offer per VN clock hour) or by day for a longer window (simple line chart).
- Footer: data sources + "giá tham khảo, không phải giá đặt vé".

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
- Owner gets the Vercel preview URL, and [`docs/status-web.md`](../status-web.md) §1–§3 are updated.

## Don't
- No service-role key anywhere in `apps/web`. No auth/login in MVP. No booking links that
  imply we sell tickets — link to the airline homepage at most.
