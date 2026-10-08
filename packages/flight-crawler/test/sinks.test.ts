import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pgliteSink } from "../src/sinks/pglite.js";
import type { CrawlRun } from "../src/sinks/types.js";
import type { FareOffer } from "../src/types.js";

const dir = mkdtempSync(join(tmpdir(), "vikc-sink-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (at: string, status: CrawlRun["status"] = "ok", offerCount = 1): CrawlRun => ({
  provider: "vna-fare-matrix",
  searchId: 1,
  startedAt: new Date(at),
  finishedAt: new Date(at),
  status,
  error: null,
  offerCount,
});

const offer = (priceVnd: number): FareOffer => ({
  provider: "vna-fare-matrix",
  kind: "calendar",
  airlineCode: "VN",
  airlineName: "Vietnam Airlines",
  flightNo: null,
  origin: "SGN",
  destination: "HAN",
  departDate: "2026-11-18",
  returnDate: "2026-11-22",
  departAt: null,
  arriveAt: null,
  durationMin: null,
  stops: null,
  cabin: null,
  priceAmount: 90,
  priceCurrency: "USD",
  fxRate: 26000,
  priceVnd,
  dedupeKey: "vna|SGN-HAN|2026-11-18|2026-11-22|ADT1",
});

describe("local (PGlite) sink", () => {
  const sink = pgliteSink(dir);

  it("applies the schema, seeds the 6 searches and reports an empty store", async () => {
    const searches = await sink.loadSearches();
    expect(searches).toHaveLength(6);
    expect(searches[0]).toMatchObject({ origin: "SGN", destination: "HAN", departDate: "2026-11-18" });
    expect(await sink.report()).toContain("0 offer rows");
  });

  it("keeps one row per offer per hour and adds a new row in the next hour", async () => {
    await sink.record(run("2026-11-18T03:15:00+07:00"), [offer(2340000)]);
    await sink.record(run("2026-11-18T03:45:00+07:00"), [offer(2400000)]); // same VN hour → overwrite
    await sink.record(run("2026-11-18T04:05:00+07:00"), [offer(2460000)]); // next VN hour → new row

    const report = await sink.report();
    // 3 crawls, same-hour one overwrote its predecessor → 2 stored offers in 2 hour buckets
    expect(report).toContain("2 offer rows in 2 hour-bucket(s)");
    expect(report).toContain("2.460.000 ₫"); // current price = the latest row
    expect(report).toContain("Khứ hồi 18–22/11");
    // one-way searches have no source yet and must say so instead of looking broken
    expect(report).toContain("cần adapter VietJet");
  });

  it("records blocked runs without offers", async () => {
    await sink.record({ ...run("2026-11-18T05:15:00+07:00", "blocked", 0), error: "captcha" }, []);
    expect(await sink.report()).toContain("vna-fare-matrix  blocked (0)");
  });
});
