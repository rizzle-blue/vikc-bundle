# AGENTS.md

This repository **is a Next.js app** (Refine + Ant Design + Supabase) for the Shakaijin team's
VIKC 2026 trip. Members enter the datetime they arrive and the datetime they leave; the app derives
nights, days and a per-day headcount, and organisers track progress against the deadlines.

Start here: [`docs/handoff.md`](docs/handoff.md) → [`docs/status.md`](docs/status.md) →
[`docs/tasks/`](docs/tasks/README.md).

```bash
pnpm install
pnpm test             # 18 tests: domain rules + SQL view agreement — must stay green
pnpm typecheck
pnpm dev              # http://localhost:3000  (/login → /enroll for members, /admin + /track for organisers)
pnpm e2e              # browser smoke test (needs `pnpm start -p 3100` running)
pnpm build && pnpm start
node scripts/db-apply.mjs   # migrations + seeds → Supabase (needs SUPABASE_ACCESS_TOKEN)
pnpm seed:members           # regenerate supabase/seed_members.sql from resources/members.json
```

Rules of the road:

- One task card at a time: **build → verify → report → commit** on a feature branch. Never push to
  `main` without the user's OK.
- The access codes gate the UI only: operator writes go through `src/app/api/admin/*` with the
  service key, so never widen the anon grants on `events`, `event_sessions` or `members`.
- `pnpm test && pnpm typecheck` green before every commit; a schema change means a **new** migration
  file and a re-run of `scripts/db-apply.mjs`.
- The browser only ever sees the **publishable** key; secrets stay in the git-ignored `.env`.
- `deprecated/` is parked history — do not build on it, do not "fix" it.
- Ask before: pushing, creating cloud resources, changing an applied migration, or handing a link to
  real members.

Traps that cost time here (details in the handoff):

- TypeScript 7 removed `baseUrl`; Next must be ≥ 16.2.11 for TS 7, and the app builds with
  `next build --webpack` (alias + `resolve.extensionAlias` live in `next.config.mjs`).
- Refine reads `useSearchParams` → its provider needs a `<Suspense>` boundary; AntD + RSC means the
  app renders dynamically (`export const dynamic = "force-dynamic"`).
- `member_trip`'s primary key is `member_id`, so Refine hooks need `meta: { idColumnName: "member_id" }`.
- Commits are SSH-signed through 1Password: export
  `SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"` in tool
  shells (and retry once) or signing/pushing fails.
