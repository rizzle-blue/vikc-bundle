# AGENTS.md

The active work in this repo is the **VIKC 2026 web migration** (Vercel + Supabase):
a flight-fare crawler plus a fares web app for the Shakaijin Kendo Team trip
(VIKC 19–22/11/2026, Tam Chúc, Ninh Bình + Hà Nội exchange 23–29/11/2026; SGN ↔ HAN).

Start here:

1. [`docs/handoff.md`](docs/handoff.md) — full context transfer + exact next steps
2. [`docs/status-web.md`](docs/status-web.md) — live step/task status + verification evidence
3. [`docs/tasks/README.md`](docs/tasks/README.md) — task board, then **pick one card**
4. [`docs/spec-flight-crawler.md`](docs/spec-flight-crawler.md) — engine spec

Setup and baseline checks (branch `feat/flight-crawler`):

```bash
pnpm install
pnpm test            # 10 tests, must stay green
pnpm typecheck
pnpm crawl --dry-run # live VNA fare matrix → packages/flight-crawler/out/
pnpm crawl           # one crawl now → Supabase (secret key in .env) or the local store
pnpm fares           # cheapest fare per registered search
./scripts/crawl.sh run|status
```

**No scheduler anywhere.** The owner triggers crawls by hand — do not add a launchd job, a GitHub
Actions cron or a Vercel cron. `scripts/crawl.sh` is a foreground script on purpose.

Work one task card at a time: **build → verify → report to the user → commit**.
Feature branch only; never push to or merge into `main` without the user's OK.
Next up: **deploy `apps/web` to Vercel** (user creates the project + the two `NEXT_PUBLIC_*` vars),
then hand the `/enroll` link to the members.

Owner gates (ask first): pushing/merging, editing `.env` secrets, applying a migration to the
Supabase project, creating cloud resources, budget spend. Never work around bot protection, WAFs
or captchas (handoff §2) — a blocked source is reported, not circumvented.

The **spreadsheet track is dropped** and frozen — see
[`docs/archive/spreadsheet-track/`](docs/archive/spreadsheet-track/README.md). Do not
maintain or extend `tools/build_trip_registration.py` / `deliverables/`.

The rest of the repo is the VIKC 2026 user-guide corpus (the data source for trip
facts) — see `README.md` and `tools/vikc-guide/`.
