# Task board

Two cards left. Read [`../handoff.md`](../handoff.md) first; live status in [`../status.md`](../status.md).
Done/parked cards: [`../../deprecated/tasks/`](../../deprecated/tasks/).

| Card | Task | Who | Depends on | Status |
|---|---|---|---|---|
| [T3](T3-web-app.md) | Deploy the app to Vercel and hand out the `/enroll` link | owner + agent | — | ⏳ next |
| [T7](T7-enrollment-and-registration.md) | The app itself (arrival/departure + tracking) | agent | — | ✅ built · CSV export open |

Rules: one card at a time; **build → verify → report → commit**; `pnpm test && pnpm typecheck` green
before every commit; feature branch, never push to `main` without the user's OK; a schema change means
a new migration file plus `node scripts/db-apply.mjs`; record evidence in `../status.md`.
