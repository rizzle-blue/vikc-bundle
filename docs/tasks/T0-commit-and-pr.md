# T0 — Commit step 1 and open a PR

**Read first:** [`docs/handoff.md`](../handoff.md) §0, §8. Status: ⏳ ready (owner OK needed to push).

## Goal
Step-1 crawler work sits uncommitted on branch `feat/flight-crawler`. Commit it
cleanly and open a PR to `main`. **Ask the owner before pushing.**

## Steps
1. `git checkout feat/flight-crawler && git status` — expect new `packages/`, `scripts/`, `supabase/`,
   root workspace files, `docs/`, and edits to `.gitignore`, `AGENTS.md`, `README.md`.
2. Safety check — none of these may be staged: `.env`, `node_modules/`, `packages/flight-crawler/out/`,
   `supabase/.temp/`. Run `git add -A --dry-run | grep -E '\.env$|node_modules|/out/|supabase/\.temp'` → must print nothing.
3. `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck` → green (currently 7 tests).
4. Commit (suggested split):
   - `Add pnpm workspace and flight-crawler engine (VNA fare calendar) + on-demand runner`
   - `Add Supabase schema/seed`
   - `Add web-migration docs and handoff task cards`
5. With owner OK: `git push -u origin feat/flight-crawler`, then
   `gh pr create --base main --title "Web migration step 1: flight-fare crawler" --body-file <file>`.
   Body = summary of `docs/spec-flight-crawler.md` "Sources" table + test evidence.

## Done when
- Working tree clean, 7 tests pass, PR URL reported to owner.
- [`docs/status-web.md`](../status-web.md) §2 shows T0 ✅ with the commit hashes + PR URL.

## Don't
- Don't push to or merge into `main`. Don't amend/rewrite existing commits on `main`.
