import { BlockedError, FareOffer, type FlightProvider, type ProviderContext, type RunStatus, type SearchQuery } from "./types.js";
import type { CrawlRun, Sink } from "./sinks/types.js";

export interface RunnerOptions {
  providers: FlightProvider[];
  searches: SearchQuery[];
  sink: Sink;
  ctx: ProviderContext;
  /** Polite gap between requests to the same site. */
  delayMs?: () => number;
  log?: (msg: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runCrawl(o: RunnerOptions): Promise<CrawlRun[]> {
  const delay = o.delayMs ?? (() => 3000 + Math.random() * 5000);
  const log = o.log ?? console.log;
  const runs: CrawlRun[] = [];
  const blocked = new Set<string>();

  for (const p of o.providers) {
    if (!p.enabled(o.ctx.env)) {
      log(`[${p.id}] skipped (not configured)`);
      continue;
    }
    let first = true;
    for (const q of o.searches.filter((s) => p.supports(s))) {
      const startedAt = new Date();
      let status: RunStatus;
      let error: string | null = null;
      let offers: FareOffer[] = [];
      if (blocked.has(p.id)) {
        status = "skipped";
        error = "provider blocked earlier in this run";
      } else {
        if (!first) await sleep(delay());
        first = false;
        try {
          offers = await withRetry(() => p.search(q, o.ctx), delay);
          offers = offers.map((x) => FareOffer.parse(x));
          status = offers.length ? "ok" : "empty";
        } catch (e) {
          status = e instanceof BlockedError ? "blocked" : "error";
          if (status === "blocked") blocked.add(p.id);
          error = e instanceof Error ? e.message : String(e);
        }
      }
      const run: CrawlRun = {
        provider: p.id,
        searchId: q.id,
        startedAt,
        finishedAt: new Date(),
        status,
        error,
        offerCount: offers.length,
      };
      await o.sink.record(run, offers);
      runs.push(run);
      log(`[${p.id}] ${q.origin}-${q.destination} ${q.departDate}${q.returnDate ? `→${q.returnDate}` : ""}: ${status} (${offers.length})${error ? ` ${error}` : ""}`);
    }
  }
  return runs;
}

async function withRetry<T>(fn: () => Promise<T>, delay: () => number): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BlockedError) throw e;
    await new Promise((r) => setTimeout(r, delay()));
    return fn();
  }
}

/** Fail the job only when nothing worked at all. */
export const allFailed = (runs: CrawlRun[]) =>
  runs.length > 0 && runs.every((r) => r.status === "error" || r.status === "blocked" || r.status === "skipped");
