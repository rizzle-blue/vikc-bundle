# T1 — Supabase schema + first live write (from the local crawl)

**Read first:** [`docs/handoff.md`](../handoff.md) §4, §6. **Owner-only steps are marked 👤.**
**Status:** ✅ **done 2026-10-08** — schema + seed + grants applied to `vikc-tracker`, crawler writing, member write path verified (see `docs/status-web.md` §3).

## Goal

The crawl (triggered by hand) writes real, deduped rows into the Supabase project. No GitHub secrets
are involved any more — the crawl runs on the owner's machine.

## Known state (probed 2026-10-08)

- Project exists: `https://ivxj…supabase.co`.
- `.env` → `SUPABASE_URL` ✅, but `SUPABASE_SERVICE_ROLE_KEY` currently holds an
  **`sb_publishable_…`** key: `GET /rest/v1/` answers `401 Secret API key required`, so inserts
  will fail. A publishable key is the *anon* key — keep it for the web app (T3), not for writes.
- `public.flight_searches` does not exist yet (`PGRST205`), i.e. the migration has never been
  applied to this project. `supabase/config.toml` is initialised but the project is not linked
  (no `supabase/.temp/project-ref`).

## Steps

1. ~~Widen the dedupe granularity to the hour~~ — **done 2026-10-08**: the migration now has
   generated `fetched_day` + generated `fetched_hour` (VN clock hour) with unique
   `(dedupe_key, fetched_hour)`, validated on PGlite (applies, seed idempotent, same-hour upsert
   collapses, next hour inserts). Nothing to do here unless `db push` reports a conflict.
2. 👤 Supabase dashboard → **Project Settings → API → Secret keys** → copy the **secret** key
   (`sb_secret_…`). Put it in `.env` as `SUPABASE_SERVICE_ROLE_KEY`. Never paste it into chat,
   an issue, a commit or a doc.
   Keep the publishable key noted for `NEXT_PUBLIC_SUPABASE_ANON_KEY` (T3).
3. 👤 (or agent with the owner present) link + push + seed:
   ```bash
   supabase login                                  # 👤 access token
   supabase link --project-ref <ref>               # 👤 DB password
   supabase db push                                # applies the migration
   psql "$DB_URL" -f supabase/seed.sql             # or paste supabase/seed.sql in the SQL editor
   ```
   Verify: `select count(*) from flight_searches;` → 6.
4. `./scripts/crawl.sh run` → expect `ok` lines for VNA and no errors from the sink.
5. Verify in the SQL editor (or REST with the secret key):
   ```sql
   select provider, status, offer_count, finished_at from crawl_runs order by id desc limit 5;
   select provider, count(*) from latest_fares group by 1;
   select * from cheapest_by_date order by min_price_vnd limit 5;
   ```
   Re-run the crawl in the same hour → `fare_offers` count must **not** grow (same-hour upsert).
6. RLS check with the **publishable** key (this is what the web app will use):
   - `GET $SUPABASE_URL/rest/v1/latest_fares?select=price_vnd&limit=1` with `apikey: <publishable>` → 200 + data.
   - `POST $SUPABASE_URL/rest/v1/flight_searches` with the publishable key → must fail (401/403/RLS).

## Done when

Steps 4–6 verified; report the SQL outputs (counts/status only, no keys), and record the row
counts + RLS results in [`docs/status-web.md`](../status-web.md) §3.

## Don't

- Don't commit `.env`. Don't paste keys anywhere. Don't disable RLS. Don't use the secret key in
  any browser/Next.js code (T3 uses the publishable/anon key).
- Once `db push` has run, never edit the applied migration — add a new one.
