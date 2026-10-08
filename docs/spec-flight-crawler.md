# Flight-fare crawler (step 1 of the web migration)

Goal: move the trip tooling from the generated spreadsheet to a free-hosted web
app (**Vercel Hobby** for UI, **Supabase Free** for data). Step 1 = an engine
that collects SGN ↔ HAN fares for the VIKC window and stores them in Supabase.
Step 2 = Next.js UI on Vercel reading those tables with the publishable/anon key.

Execution: the engine is run **on demand by the owner** (`./scripts/crawl.sh run` / `pnpm crawl`)
and stores fares in Supabase (or in a local embedded Postgres when no secret key is configured).
No scheduler, no background job.

## Layout

| Path | What |
|---|---|
| `packages/flight-crawler/` | TypeScript engine (`pnpm crawl`) |
| `packages/flight-crawler/src/providers/` | one adapter per source |
| `packages/flight-crawler/scripts/spike.ts` | probe a booking page and dump its JSON traffic |
| `scripts/crawl.sh` | on-demand runner + installer-free wrapper (`run`, `status`; log in `data/crawl.log`) |
| `packages/flight-crawler/src/store.ts` | store selection (Supabase secret key → Supabase, else local PGlite) |
| `packages/flight-crawler/src/sinks/pglite.ts` | durable local store on the same migration (`data/fares`) |
| `supabase/migrations/` | schema (`flight_searches`, `crawl_runs`, `fare_offers`, views) |
| `supabase/seed.sql` | the 6 default searches (mirrors `src/searches.ts`) |

## Sources (spike 2026-10-08)

| Carrier | Source | Status |
|---|---|---|
| Vietnam Airlines (VN) | public fare-calendar JSON `integration-middleware-website.vietnamairlines.com/api/v1/public/flight/fare-matrix` | ✅ adapter `vna-fare-matrix` — round-trip only, 7×7 grid (±3 days), lowest total per date pair, USD → VND via open.er-api.com. Works live. |
| VietJet (VJ) | real browser on `https://www.vietjetair.com/vi`, reading the `search-flight` response the page itself sends | ⏳ **probe 2026-10-08 (script `scripts/spike-vietjet.ts`): the form can be driven to a real search, but the flight query is never issued.** Findings: the promo overlay must be dismissed first; trip type = click “Một chiều”; departure = 1st visible `input.MuiInputBase-input` (no id), destination = `#arrivalPlaceDesktop`; the search button is the last visible `button` with text “Tìm chuyến bay” (several hidden duplicates); the browser then lands on `/vi/select-flight` with the route applied. `POST vietjet-api.vietjetair.com/booking/api/v1/get-session` answers 200 with a `sessionId` (`googleCaptchaStatus: null`), but **no `search-flight` request is ever sent** and the results page renders “Không tìm thấy chuyến bay nào cho lựa chọn của bạn”. Same result with headless Chromium **and** the machine's real Google Chrome (`--channel chrome`). AWS WAF is active (`*.edge.sdk.awswaf.com` `/mp_verify` + `/telemetry`). Their direct API is AES-encrypted + SHA-256 signed + device-id gated → **not to be re-implemented**. Untried legitimate option: a headed (visible) browser window on the owner's machine — see `docs/tasks/T5-vietjet-browser-adapter.md`. |
| Bamboo (QH) | Amadeus DX at `digital.bambooairways.com` via form POST | ❌ out of scope. |
| Vietravel (VU) | not found in homepage bundles | ❌ out of scope. |

Rules: low volume, 3–8 s jitter between requests to one site, no login/booking,
**never bypass protections** — a captcha/403/429 answer raises `BlockedError`, the
provider is skipped for the rest of the run and the run is logged `blocked`.
Reading a response the browser page itself requested is allowed; re-implementing
their signing/encryption, forging WAF tokens, stealth patches, captcha solving and
proxy/IP rotation are not (see [`handoff.md`](handoff.md) §2).

TLS: VNA's host omits its intermediate cert; `certs/` holds the public
GlobalSign intermediate, loaded via `NODE_EXTRA_CA_CERTS` (verification stays on).

## Data model

- `flight_searches` — what to crawl (`return_date` null = one-way). Edit rows, not code.
- `crawl_runs` — one row per provider × search per run, `status ∈ ok|empty|blocked|error|skipped`.
- `fare_offers` — normalised offers; `kind = calendar` (no flight detail) or `itinerary`.
  Unique `(dedupe_key, fetched_hour)` (VN clock hour) → hourly price history; `fetched_day` is
  kept for day-level charts. Validated on PGlite 2026-10-08.
- Views `latest_fares`, `cheapest_by_date` (security-invoker).
- RLS: anon/auth `select` only; writes use the Supabase **secret** key, which lives only in the
  git-ignored local `.env` (the crawl runs on the owner's machine).

## Run

```bash
pnpm install
pnpm test
pnpm crawl --dry-run                                  # default searches → packages/flight-crawler/out/*.json
pnpm crawl --dry-run --from SGN --to HAN --date 2026-11-18 --return 2026-11-22
pnpm crawl --provider vna --from SGN --to HAN --date 2026-11-18 --return 2026-11-22 --dry-run
pnpm crawl                                            # writes to Supabase or the local store
pnpm fares                                            # cheapest fare per registered search

./scripts/crawl.sh run|status                          # same, plus data/crawl.log
```

## Setup (one-time, by the owner)

1. `supabase link --project-ref <ref>` → `supabase db push` → run `supabase/seed.sql`
   (SQL editor or `psql`). The migration has not been applied yet; it already carries the
   hour-bucket key (`fetched_hour`) and was validated on PGlite.
2. Put `SUPABASE_URL` and the project's **secret** key in the git-ignored root `.env`
   (`sb_secret_…`; a publishable key is rejected with `401 Secret API key required`).
3. `./scripts/crawl.sh run` → check prices with `pnpm fares`. (Runs are triggered by hand; there
   is deliberately no scheduler.)

## Next

Work is tracked as task cards — see [`docs/tasks/README.md`](tasks/README.md) and the live
status in [`docs/status-web.md`](status-web.md). Step 1 (this engine) is built but uncommitted (T0).

- T1 — apply the schema (hour granularity) + seed to the Supabase project, verify RLS, first live
  write from the local runner.
- T3 — `apps/web` Next.js on Vercel: fare table + cheapest-by-date chart per search.
- T4 — verify VNA price semantics (taxes included?).
- T5 — VietJet browser-capture adapter (the only remaining coverage gap).
- T6 — manual crawl workflow: keep run/status usable in both store modes, flag stale data.
- T7 — the app core: member enrollment, category registration, cost estimate (the product).

Dropped: SerpApi (2026-10-08) — no keyed/paid source in the design.

Later, owner-gated: trip registration + cost estimation in the web app (the successor of the
dropped spreadsheet track, see [`docs/archive/spreadsheet-track/`](archive/spreadsheet-track/README.md)).
