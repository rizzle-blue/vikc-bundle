# T6 — Manual crawl workflow + data health

**Read first:** [`docs/handoff.md`](../handoff.md) §6; `scripts/crawl.sh`.
**Status:** ⏳ blocked on T1 (needs working writes). Small card.

## Goal

The crawl is triggered by the owner, on demand, and it is obvious afterwards what ran and how
fresh the prices are. No scheduler is introduced — the owner runs it, that is the decision.

## Steps

1. Make `pnpm crawl` / `./scripts/crawl.sh run` the documented one-liner (already working) and
   confirm `./scripts/crawl.sh status` shows: recent runs with status + offer counts, and the
   cheapest fare per registered search. Both must work against **either** store.
2. Add a freshness line the owner can trust: last successful run older than ~24 h → print
   `STALE (last run <date>)` in `status` (fares are not "current" after that).
3. Decide what to do with dry-run JSON (`packages/flight-crawler/out/`) — git-ignored, keep.
4. Check the same-hour overwrite rule still holds when the owner runs a crawl twice in an hour
   (it should: one row per offer per VN hour) and that a *later* hour adds rows instead.
5. Document in the README: how to run, how to read `status`, how to switch stores, where logs are.
6. Record evidence in [`status-web.md`](../status-web.md).

## Done when

Owner can answer "when did it last run, what did it find, is it stale?" from one command, in both
store configurations.

## Don't

- Don't install a background job, launchd agent or CI cron. The owner explicitly wants to trigger
  runs by hand; `crawl.sh` must stay a foreground script.
