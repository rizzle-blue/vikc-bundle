# HANDOFF — VIKC 2026 web migration (Vercel + Supabase)

> Audience: any coding agent (written for DeepSeek) picking this up cold.
> Read this file fully, then open **one** task card in [`docs/tasks/`](tasks/) and
> do only that task. Every card is self-contained.
> Live progress: [`status-web.md`](status-web.md) · Engine spec: [`spec-flight-crawler.md`](spec-flight-crawler.md)

## 0. TL;DR — how to resume

```bash
git checkout feat/flight-crawler     # all web-migration work lives here (not merged to main yet)
pnpm install                         # Node 24, pnpm 10 (owner uses mise)
pnpm test                            # 10 tests, must stay green
pnpm typecheck
pnpm crawl --dry-run                 # live VNA crawl → packages/flight-crawler/out/crawl-*.json
pnpm crawl                           # one crawl now → Supabase or the local store
pnpm fares                           # cheapest fare per registered search
./scripts/crawl.sh run|status        # same, with a log in data/crawl.log
```

Expected dry-run output (prices change daily):

```
[vna-fare-matrix] SGN-HAN 2026-11-18→2026-11-22: ok (46)
[vna-fare-matrix] SGN-HAN 2026-11-18→2026-11-29: ok (49)
```

State as of **2026-10-08** (verified on the owner machine):

| Check | Result |
|---|---|
| `pnpm test` | ✅ 3 files, 10 tests passed |
| `pnpm typecheck` | ✅ clean |
| `pnpm crawl --dry-run` | ✅ live VNA fare matrix fetched (46 + 49 rows) |
| `pnpm crawl` (real store) | ✅ 95 offers written to the local store (`data/fares`) in ~4 s |
| `pnpm fares` | ✅ cheapest per registered search (2 round trips priced, 4 one-way legs have no provider) |
| Supabase | ✅ live: project `vikc-tracker`, both migrations + seeds applied, grants added, crawler writing, member write path verified (T1 done 2026-10-08) |
| VietJet | ❌ no adapter yet — probe script written, not run (T5) |
| Crawl schedule | ❌ none — runs are triggered by hand (`./scripts/crawl.sh run` / `pnpm crawl`). No launchd job, no GitHub Actions, no cron. |
| Git | branch `feat/flight-crawler`, step-1 work **uncommitted** (T0), `main` = `3e6a4da` |

Cadence: **on demand**, triggered by the owner. Providers: **Vietnam Airlines** (public endpoint,
works) + **VietJet** (browser-driven, T5) — **SerpApi dropped**.

The app is built and verified against Supabase locally: `/enroll` (member: name + arrival/departure,
live nights/days) and `/track` (headcount 18–30/11, progress, deadlines), plus Refine admin pages for
the roster, trip rows, the stay view and the edit form.
Next action: **deploy to Vercel** (owner: create the project, set the two `NEXT_PUBLIC_*` vars), then
hand the link to the members. See [`docs/tasks/README.md`](tasks/README.md).

## 1. Why this exists

The project started as a Python generator for an `.xlsx` trip sheet for the
Shakaijin Kendo Team going to **VIKC 2026** (Tam Chúc, Ninh Bình, 19–22/11/2026)
plus a Hà Nội dojo exchange (23–29/11/2026). Members fly **SGN → HAN** (Nội Bài
is the airport for Tam Chúc).

The owner decided to move the whole thing to a **free-hosted web app**:

- **Vercel Hobby** — Next.js web app: the **entry point for members to enroll in the trip and
  register their categories**; it also shows the current fares.
- **Supabase Free** — Postgres + REST + RLS.
- **The owner's machine** — where the crawler is triggered by hand (`./scripts/crawl.sh run`).
  No scheduler anywhere: no GitHub Actions, no launchd job, no Vercel cron. The crawler writes to
  Supabase when `.env` holds the project's secret key, otherwise to a local embedded Postgres
  (`data/fares`) using the same schema.

Step 1 (done, uncommitted at hand-off time) = flight-fare crawler engine.

**Scope notes.**

- The spreadsheet track was **dropped**; its docs are frozen in
  [`docs/archive/spreadsheet-track/`](archive/spreadsheet-track/) together with the Python
  generator (`tools/build_trip_registration.py`) and the built workbook (`deliverables/`).
  Nothing there is maintained. The user-guide corpus (`content/`, `tools/vikc-guide/`) stays —
  it is the data source for trip facts the web app will eventually render.
- **SerpApi was dropped** (owner decision, 2026-10-08): the adapter, its fixture, its tests and
  the `SERPAPI_KEY` env wiring are gone. No paid/keyed data source is in the design.
- Coverage target is now **Vietnam Airlines + VietJet only**, both first-party.

## 2. Decisions already made — do not reopen

| Topic | Decision |
|---|---|
| Routes | SGN ↔ HAN only. Out 18/11 or 19/11, back 22/11 or 29/11. Routes are **data** (`flight_searches` rows), not code. |
| Stack | pnpm TypeScript monorepo. `packages/*`, `apps/*`. Python spreadsheet tooling is frozen and out of scope. |
| Providers | **Vietnam Airlines** (official public fare-matrix JSON) + **VietJet** (browser-driven capture, T5). SerpApi, Bamboo and Vietravel are out. |
| Cadence | **On demand** — the owner triggers every run (`./scripts/crawl.sh run` / `pnpm crawl`). No scheduler exists; add one only if staleness becomes a real problem. |
| Runner | none. No background job is installed anywhere; the repo ships scripts only. |
| UI stack (2026-10-09) | **Refine 5** (MIT) + **AntD 5** + Next 16 App Router, deployed on Vercel Hobby. Refine supplies the admin CRUD surface (list/edit/form/table/filters) so we don't hand-build it; it reads Supabase through the **publishable** key + RLS. Rejected alternatives: Payload/Directus need the Postgres password (we only have publishable + PAT) and an always-on service. |
| Product | The **web app is the entry point and the tracker**: each member enters the datetime they **arrive** and the datetime they **leave**; the system derives nights/days, the Tam Chúc vs Hà Nội split and a per-day headcount, and admins watch progress against the deadlines (đăng ký 20/10/2026, thanh toán 25/10/2026). Categories/fees/fares are secondary. |
| Core data | `member_trip.arrival_at` + `departure_at` (`timestamptz`, Asia/Ho_Chi_Minh) per member — everything else is derived or optional. |
| Identity (T7 decision 1a, 2026-10-08) | **Pick your name from the roster, no login.** The anon key may read the roster and insert/update trip rows — a deliberate, documented trust trade-off for a 22-person club tool. Revisit if spoofed edits ever matter. |
| T7 v1 fields (decision 2) | Required: arrival + departure datetime, room type. Optional: roommate, exam grade, team-3, team-5, dojo exchange, notes. No fees in v1. |
| Night convention | A night is dated by its **check-in day** (hotel-bill convention): arrive 18/11 + leave 22/11 = 4 nights; Tam Chúc nights = 18–22/11, Hà Nội nights = 23–29/11; the VKF package covers the 21/11 night. |
| FX | USD→VND via `open.er-api.com` (free, keyless), fetched once per run; store original amount + rate + VND. |
| Capture method | First-party public surface only: an unauthenticated public endpoint, else a **real browser driving the public UI** (Playwright) reading the response the page itself receives. |
| **Bot-protection boundary** | **Never circumvent protections.** Not allowed: re-implementing request signing/encryption, forging WAF/anti-bot tokens, stealth/anti-detection patches, captcha solving, proxy/IP rotation, third-party cookie farming, retrying past a challenge. Allowed: a normal browser session at human pace. A challenge (captcha, 403/429, WAF interstitial, or a bogus "no flights" for a route that has flights) → `BlockedError`, provider skipped for the rest of the run, run logged `blocked`. If a site cannot be read this way, the card closes with a written "blocked — not feasible" note; we do not escalate. |
| Secrets | Never in git, chat, logs, or docs. Refer by name only. `.env` is git-ignored; `.env.example` lists names. |

## 3. Repo map (web track)

| Path | What |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` | workspace root; root scripts `test`, `typecheck`, `crawl` |
| `packages/flight-crawler/src/types.ts` | zod schemas `SearchQuery`, `FareOffer`; `FlightProvider` interface; `BlockedError` |
| `packages/flight-crawler/src/providers/vietnam-airlines.ts` | VNA adapter + pure parser `parseVnaFareMatrix` |
| `packages/flight-crawler/src/providers/index.ts` | provider registry (add new adapters here) |
| `packages/flight-crawler/src/providers/vietjet-browser.ts` | **to be created** (T5): browser capture + pure parser `parseVietjetSearchFlight` |
| `packages/flight-crawler/src/runner.ts` | `runCrawl` (sequential, retry once, block isolation), `allFailed` |
| `packages/flight-crawler/src/sinks/{json,supabase,types}.ts` | output sinks |
| `packages/flight-crawler/src/money.ts` | `createFx` currency → VND |
| `packages/flight-crawler/src/searches.ts` | default searches for dry-run (mirror of `supabase/seed.sql`) |
| `packages/flight-crawler/src/cli.ts` | CLI flags `--provider --from --to --date --return --dry-run`; loads `.env` |
| `packages/flight-crawler/scripts/spike.ts` | probe tool: `pnpm --filter @vikc/flight-crawler spike <name> <url>` dumps JSON traffic to `out/spike/` |
| `packages/flight-crawler/certs/` | public GlobalSign intermediate (see §6) |
| `packages/flight-crawler/test/` | vitest; fixtures under `test/fixtures/<provider>/` |
| `scripts/crawl.sh` | on-demand runner: `run [--dry-run|--from …]`, `status`; logs to `data/crawl.log` (same as `pnpm crawl`, with a log) |
| `packages/registration/` | the trip-domain rules as pure TS: `vnDate`, `deriveStay`, `presenceDays`, `headcountByDay`, `progressOf`, `summarize` (+ tests that cross-check the SQL views) |
| `supabase/migrations/20261009000000_registration.sql` | `members`, `member_trip`, views `v_member_nights` / `v_member_stay` / `v_headcount_per_day`, RLS |
| `supabase/seed_members.sql` | roster + one empty trip row per member (generated by `pnpm seed:members` from `resources/members.json`) |
| `scripts/gen-member-seed.mjs` | regenerates that seed after roster edits |
| `packages/flight-crawler/src/store.ts` | chooses the store: Supabase if `.env` has the **secret** key, else the local one (`--store local|supabase|json`) |
| `packages/flight-crawler/src/sinks/pglite.ts` | durable local store (embedded Postgres, same migration as Supabase) at `data/fares` |
| `data/fares`, `data/crawl.log` | local store + run log (git-ignored) |
| `supabase/migrations/20261008000000_flights.sql` | schema (**validated on PGlite; not yet applied to the remote project**) |
| `supabase/seed.sql` | 6 default searches, idempotent |
| `.env` (git-ignored) | local secrets for the crawl: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `docs/spec-flight-crawler.md` | engine spec + spike findings |
| `docs/status-web.md` | live step/task status + verification evidence |
| `docs/tasks/` | one card per task, plus the board in `docs/tasks/README.md` |
| `docs/archive/spreadsheet-track/` | frozen pre-web plan (do not maintain) |

## 4. Data model (Supabase)

- `flight_searches(id, origin, destination, depart_date, return_date?, adults, active, label)`
  — `return_date null` = one-way (served by the VietJet adapter; VNA's endpoint is round-trip
  only). Unique with `nulls not distinct`.
- `crawl_runs(id, provider, search_id, started_at, finished_at, status, error, offer_count)`
  — `status ∈ ok | empty | blocked | error | skipped`.
- `fare_offers` — one normalised priced option. `kind = calendar` (lowest price for a date
  pair, no flight number — VNA) or `itinerary` (concrete flights — VietJet).
  **One row per offer per VN clock hour** (this is a storage key, not a schedule — runs are
  triggered by hand): generated `fetched_day` (VN day, for day-level
  charts) + generated `fetched_hour` (VN clock hour), unique `(dedupe_key, fetched_hour)` —
  two runs inside the same hour overwrite each other, a later hour adds rows (24 potential rows
  per offer per day). Validated on PGlite 2026-10-08 (migration applies, seed idempotent,
  same-hour upsert collapses, next hour inserts).
- Views (security_invoker): `latest_fares` (latest row per `dedupe_key` = the current price),
  `cheapest_by_date` (min `price_vnd` per route/date pair/provider over those current rows).
  "hourly" *history* lives in `fare_offers`, not in the views — the web chart (T3) queries
  `fare_offers` grouped by `fetched_hour`.
- RLS: `select` for `anon` + `authenticated` on all three tables. No write policies →
  only the service-role key (GitHub secret) can write.

Schema was validated on PGlite (embedded Postgres 17): migration applies, seed is
idempotent, same-hour upsert collapses and the next hour inserts (2026-10-08).
**Not yet applied to the remote Supabase project** — a read probe on 2026-10-08 answered
`PGRST205: Could not find the table 'public.flight_searches'`.
The project itself exists (`ivxj…supabase.co`), but `.env` currently holds a **publishable**
(`sb_publishable_…`) key, which cannot write: `/rest/v1/` answers `401 Secret API key required`.
Use the project's **secret** key (`sb_secret_…`) for `SUPABASE_SERVICE_ROLE_KEY` (T1).

## 5. Provider status

| Carrier | Method | Status |
|---|---|---|
| Vietnam Airlines | `POST https://integration-middleware-website.vietnamairlines.com/api/v1/public/flight/fare-matrix` — public, unauthenticated; round-trip only (`returnDate` required), 7×7 grid ±3 days, USD with `decimalPlaces: 2` | ✅ adapter works live |
| VietJet | real browser on `https://www.vietjetair.com/vi` → read the `search-flight` response the page itself sends | ❌ to build (T5). Direct API is AES-encrypted + SHA-256 signed + device-id + AWS WAF → **off-limits to re-implement** |
| Bamboo, Vietravel | — | ❌ out of scope |

## 6. Gotchas

- **TypeScript 7 removed `baseUrl`.** In `apps/web/tsconfig.json` the `@/*` alias exists without it
  (`"paths": { "@/*": ["./src/*"] }`) and the alias is *also* declared for webpack.
- **Next must be ≥ 16.2.11 for TypeScript 7** — older Next refuses the TS 7 compiler API.
  `apps/web` runs webpack explicitly (`next build --webpack`) because the workspace package
  `@vikc/registration` is NodeNext TS: webpack needs `resolve.extensionAlias` to map its `./x.js`
  specifiers back to `./x.ts`.
- **Refine + App Router**: the Refine provider reads `useSearchParams`, so it must sit inside a
  `<Suspense>` boundary, and AntD does not prerender cleanly under RSC → the app sets
  `export const dynamic = "force-dynamic"`.
- **`member_trip` has no `id` column** — its key is `member_id`, so every Refine hook needs
  `meta: { idColumnName: "member_id" }`.
- **Commits are SSH-signed through 1Password.** A non-interactive shell (agent, CI, tool runner)
  often gets a launchd `SSH_AUTH_SOCK` with no identities → `1Password: failed to fill whole buffer`
  when signing, or an auth failure on push. Fix: export the 1Password socket first, and retry once
  (the first signature request can time out):
  `export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"`.
  `git ls-remote origin` is a quick way to check whether auth works while signing does not.
- **`next build` leaves `.next/` and `*.tsbuildinfo`** — both are git-ignored; keep it that way.

- **Bot-protection boundary is a hard rule** (§2). A blocked site is a *finding*, not a puzzle.
- **Runs are manual.** Nothing collects fares unless someone runs it. `./scripts/crawl.sh status`
  shows the last runs and the current prices; stale `data/fares` = "no data", never "current price".
- **Store choice.** `src/store.ts` writes to Supabase only when `SUPABASE_URL` **and** a secret key
  (`sb_secret_…`, legacy `eyJ…`) are in `.env`; a publishable key gets 401, so it falls back to the
  local store and says why. Override with `--store local|supabase|json`.
- **The local store is real Postgres** (PGlite, same migration file, same views). First run creates
  `data/fares/`, seeds the 6 searches, and re-crawls in the same hour overwrite that hour's rows.
- **Local IP, but still detectable.** The browser leg runs from a residential IP now (better than
  a datacenter), yet the 2026-10-08 spike already saw headless detection on VietJet. Expect
  `BlockedError`; the fallbacks are in T5 ("if blocked"). Do not work around it.
- **VNA TLS chain incomplete.** Node fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
  Fix in place: `certs/globalsign-rsa-ov-ssl-ca-2018.pem` + `NODE_EXTRA_CA_CERTS` in the
  `crawl` script. Do **not** set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
  Any new script calling VNA must also set `NODE_EXTRA_CA_CERTS`.
- **VNA prices**: assumed taxes-included total for 1 adult — **unverified** (T4).
- **Politeness**: 3–8 s jitter between requests to one site (already in `runner.ts`);
  one VNA crawl = 2 fare-matrix calls. Keep it that way; don't parallelise a single site.
- **Owner shell is fish.** Bash-style loops (`for x in ...; do`) fail; wrap in `bash -c '...'`.
- **No Docker** on owner machine → `supabase start` unavailable; the remote project exists, so
  apply the schema with `supabase db push` against it (T1).
- `typescript@7`, `zod@4`, `vitest@5` — use current APIs (zod 4: `z.record(keySchema, valueSchema)`).
- TS config uses `verbatimModuleSyntax` + NodeNext → relative imports need `.js` suffix,
  type-only imports need `import type`.
- `packages/flight-crawler/out/` is git-ignored scratch output.

## 7. Task board

Full board with dependencies and status: [`docs/tasks/README.md`](tasks/README.md).

| Card | Task | Who | Depends on |
|---|---|---|---|
| [T0](tasks/T0-commit-and-pr.md) | Commit step 1 + open PR | agent (needs owner OK) | — |
| [T1](tasks/T1-supabase-live.md) | Apply the schema to the Supabase project, first live write | **owner** + agent | T0, owner supplies the secret key |
| ~~T2~~ | ~~SerpApi real fixture~~ — **dropped 2026-10-08** | — | — |
| [T3](tasks/T3-web-app.md) | `apps/web` Next.js app on Vercel (scaffold + fares panel) | agent | T1 |
| [T4](tasks/T4-verify-vna-taxes.md) | Verify VNA price = taxes-included | agent or owner | — |
| [T5](tasks/T5-vietjet-browser-adapter.md) | VietJet browser-capture adapter — **parked** (not on the critical path) | agent | owner restart |
| [T6](tasks/T6-manual-crawl-and-data-health.md) | Manual crawl workflow + data health | agent | T1 |
| [T7](tasks/T7-enrollment-and-registration.md) | **Core**: arrival/departure datetime capture + progress tracking app | agent | T1, T3, 2 decisions |

Beyond the board: the archived spreadsheet track already contains the domain rules for
enrollment and the datetime requirements (exam fees, VKF/non-VKF packages, extra nights) —
reuse it as the reference for **T7**, don't rebuild it as a spreadsheet.

**Priority (owner clarification 2026-10-08):** the purpose of the app is that members pick their
**arrival and departure datetimes** so the trip can be tracked programmatically. That makes T7 the
critical path and pushes fare coverage (T5 VietJet) out of the way — the VNA crawl we have is
plenty for the optional fares panel.

## 8. Working rules for the delegate

1. One card at a time: **build → verify → report to owner → commit** (feature branch, never `main`).
2. `pnpm test && pnpm typecheck` green before every commit.
3. Match existing style: small pure parsers, zod at boundaries, comments only for non-obvious *why*.
4. New provider = new file in `src/providers/`, register in `index.ts`, fixture + parser test.
   Browser capture must stay separate from the pure parser so tests need no network.
5. Ask the owner before: pushing, merging, creating cloud resources, changing schema already
   applied to production.
6. Report honestly: what ran, what output was, what was not verified. A blocked provider is a
   result to report, not a failure to hide.
7. Update [`status-web.md`](status-web.md) (status row + verification evidence) whenever a card
   is finished or a check changes.

## 9. Definition of done (whole migration)

- The web app is live: members enter **arrival and departure datetimes**, the app derives nights/days,
  and the admin view answers "who is where on which day" + "who hasn't filled it in" (T3, T7).
- Fares are a small optional panel fed by the manual VNA crawl; nothing else depends on them
  (T1, T4, T6 — VietJet parked).
- A new agent can reproduce the whole thing from this handoff + the task cards alone.
