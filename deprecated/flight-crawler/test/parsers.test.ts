import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseVnaFareMatrix } from "../src/providers/vietnam-airlines.js";
import type { SearchQuery } from "../src/types.js";

const fixture = (p: string) => JSON.parse(readFileSync(new URL(`./fixtures/${p}`, import.meta.url), "utf8"));

describe("parseVnaFareMatrix", () => {
  const q: SearchQuery = { id: 1, origin: "SGN", destination: "HAN", departDate: "2026-11-18", returnDate: "2026-11-22", adults: 1 };
  const offers = parseVnaFareMatrix(fixture("vna/fare-matrix-SGN-HAN-20261118-20261122.json"), q);

  it("keeps only available cells of the 7×7 grid", () => {
    expect(offers).toHaveLength(46);
  });

  it("applies currency decimal places", () => {
    const center = offers.find((o) => o.departDate === "2026-11-18" && o.returnDate === "2026-11-22");
    expect(center).toMatchObject({ priceAmount: 90, priceCurrency: "USD", kind: "calendar", airlineCode: "VN" });
    expect(Math.min(...offers.map((o) => o.priceAmount))).toBe(78.2);
  });

  it("has unique dedupe keys", () => {
    expect(new Set(offers.map((o) => o.dedupeKey)).size).toBe(offers.length);
  });

  it("throws on unsuccessful response", () => {
    expect(() => parseVnaFareMatrix({ success: false, message: "x" }, q)).toThrow(/VNA fare-matrix: x/);
  });
});
