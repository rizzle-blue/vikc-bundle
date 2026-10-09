import type { FareOffer, RunStatus, SearchQuery } from "../types.js";

export interface CrawlRun {
  provider: string;
  searchId: number | null;
  startedAt: Date;
  finishedAt: Date;
  status: RunStatus;
  error: string | null;
  offerCount: number;
}

export interface Sink {
  loadSearches(): Promise<SearchQuery[]>;
  record(run: CrawlRun, offers: FareOffer[]): Promise<void>;
  /** Human-readable snapshot of what is stored (used by `pnpm fares`). */
  report(): Promise<string>;
  close(): Promise<void>;
}
