# Task board — VIKC 2026 web migration

One card = one unit of work. Read [`../handoff.md`](../handoff.md) first, then the card.
Progress lives in [`../status-web.md`](../status-web.md).

Two tracks, one goal — the **web app is the entry point for members to enroll and register**;
fares are collected on demand by a script and shown in that app.

ExecutionContext: **no scheduler anywhere**. The owner triggers the crawl by hand
(`./scripts/crawl.sh run` / `pnpm crawl`); nothing runs in the background.

## Order

```
PRIORITY (owner clarification 2026-10-08): members enter arrival + departure datetimes so the trip
is tracked programmatically. Everything else is secondary.

T1 (Supabase schema + first write) ──► T3 (apps/web scaffold) ──► T7 (arrival/departure + tracking)  ← the product

Optional / secondary
T6 (manual crawl workflow + data health)   T4 (verify VNA price semantics)   T5 (VietJet — PARKED)
```

## Cards

| Card | Task | Who | Depends on | Status |
|---|---|---|---|---|
| [T0](T0-commit-and-pr.md) | Commit step 1 and open a PR | agent (needs owner OK to push) | — | ⏳ ready |
| [T1](T1-supabase-live.md) | Supabase schema + seed + first live write | owner 👤 + agent | T0 | ⏳ needs the secret key |
| ~~T2~~ | ~~SerpApi real fixture~~ — dropped 2026-10-08 | — | — | ❌ |
| [T3](T3-web-app.md) | `apps/web`: Refine + AntD app (admin CRUD + member pages) | agent | T1 | ✅ built, Vercel deploy left |
| [T4](T4-verify-vna-taxes.md) | Verify VNA fare-matrix price semantics | agent or owner | — | ⏳ |
| [T5](T5-vietjet-browser-adapter.md) | VietJet browser-capture adapter | agent | owner restart | 🅿️ parked |
| [T6](T6-manual-crawl-and-data-health.md) | Manual crawl workflow + data health | agent | T1 | ⏳ secondary |
| [T7](T7-enrollment-and-registration.md) | **Arrival/departure datetime capture + progress tracking** | agent | T1, T3 | ✅ built + verified |

## Rules for every card

1. **One card at a time.** Finish, verify, report to the owner, commit — then take the next.
2. `pnpm test && pnpm typecheck` green before every commit; the 10 tests must never regress.
3. Feature branch only. Never push to or merge into `main` without the owner's OK.
4. No scheduler: no GitHub Actions cron, no launchd job, no Vercel cron. Scripts stay foreground.
5. Don't create cloud resources, spend quota, or change an already-applied migration without asking.
6. Record the evidence (command + observed result + date) in `../status-web.md`.
7. If a source turns out to be unreachable, close the card with a written "blocked — not feasible"
   note in the spec/handoff. Never work around bot protection, WAFs or captchas (handoff §2).
