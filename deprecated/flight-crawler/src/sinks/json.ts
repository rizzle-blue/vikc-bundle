import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_SEARCHES } from "../searches.js";
import type { FareOffer } from "../types.js";
import type { CrawlRun, Sink } from "./types.js";

/** --dry-run: collect everything, write one out/crawl-<timestamp>.json. */
export function jsonSink(dir = "out"): Sink {
  const runs: (CrawlRun & { offers: FareOffer[] })[] = [];
  return {
    loadSearches: async () => DEFAULT_SEARCHES,
    record: async (run, offers) => void runs.push({ ...run, offers }),
    report: async () => "dry-run: nothing is stored (use `pnpm fares` against a real store)", 
    async close() {
      await mkdir(dir, { recursive: true });
      const file = join(dir, `crawl-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      await writeFile(file, JSON.stringify(runs, null, 2));
      console.log(`wrote ${file}`);
    },
  };
}
