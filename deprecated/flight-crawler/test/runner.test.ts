import { describe, expect, it } from "vitest";
import { allFailed, runCrawl } from "../src/runner.js";
import type { CrawlRun, Sink } from "../src/sinks/types.js";
import { BlockedError, type FareOffer, type FlightProvider, type SearchQuery } from "../src/types.js";

const q = (d: string, ret: string | null = null): SearchQuery => ({ id: null, origin: "SGN", destination: "HAN", departDate: d, returnDate: ret, adults: 1 });
const offer = (d: string): FareOffer => ({
  provider: "fake", kind: "calendar", airlineCode: "VN", airlineName: null, flightNo: null, origin: "SGN", destination: "HAN",
  departDate: d, returnDate: null, departAt: null, arriveAt: null, durationMin: null, stops: null, cabin: null,
  priceAmount: 1, priceCurrency: "VND", fxRate: 1, priceVnd: 1, dedupeKey: d,
});
const memSink = () => {
  const runs: CrawlRun[] = [];
  const sink: Sink = { loadSearches: async () => [], record: async (r) => void runs.push(r), report: async () => "", close: async () => {} };
  return { sink, runs };
};
const ctx = { fetch, env: {}, toVnd: async () => ({ fxRate: 1, priceVnd: 1 }) };
const fake = (id: string, impl: FlightProvider["search"], supports: FlightProvider["supports"] = () => true): FlightProvider => ({
  id, enabled: () => true, supports, search: impl,
});

describe("runCrawl", () => {
  it("isolates provider failures and records every run", async () => {
    const { sink, runs } = memSink();
    let calls = 0;
    await runCrawl({
      providers: [
        fake("ok", async (s) => [offer(s.departDate)]),
        fake("flaky", async () => { calls++; throw new Error("boom"); }),
      ],
      searches: [q("2026-11-18")],
      sink, ctx, delayMs: () => 0, log: () => {},
    });
    expect(runs.map((r) => [r.provider, r.status])).toEqual([["ok", "ok"], ["flaky", "error"]]);
    expect(calls).toBe(2); // one retry
  });

  it("stops hitting a provider after it blocks", async () => {
    const { sink, runs } = memSink();
    let calls = 0;
    await runCrawl({
      providers: [fake("b", async () => { calls++; throw new BlockedError("403"); })],
      searches: [q("2026-11-18"), q("2026-11-19")],
      sink, ctx, delayMs: () => 0, log: () => {},
    });
    expect(calls).toBe(1);
    expect(runs.map((r) => r.status)).toEqual(["blocked", "skipped"]);
    expect(allFailed(runs)).toBe(true);
  });

  it("routes searches by supports()", async () => {
    const { sink, runs } = memSink();
    await runCrawl({
      providers: [fake("rt", async () => [], (s) => s.returnDate != null)],
      searches: [q("2026-11-18"), q("2026-11-18", "2026-11-22")],
      sink, ctx, delayMs: () => 0, log: () => {},
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe("empty");
    expect(allFailed(runs)).toBe(false);
  });
});
