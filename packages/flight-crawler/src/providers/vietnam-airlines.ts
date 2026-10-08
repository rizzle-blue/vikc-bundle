import { z } from "zod";
import { BlockedError, type FareOffer, type FlightProvider, type ProviderContext, type SearchQuery } from "../types.js";

// Public fare-calendar endpoint behind vietnamairlines.com's booking widget.
// Round-trip only; returns a 7×7 grid (±3 days) of lowest total price per date pair.
const ENDPOINT = "https://integration-middleware-website.vietnamairlines.com/api/v1/public/flight/fare-matrix";

const Cell = z.object({
  departureDate: z.string(),
  returnDate: z.string(),
  totalPrice: z.number().optional(),
  currencyCode: z.string().optional(),
  available: z.boolean(),
});
const Response = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      currencyCode: z.string(),
      dictionaries: z.object({ currency: z.record(z.string(), z.object({ decimalPlaces: z.number() })) }).partial(),
      rows: z.array(z.object({ cells: z.array(Cell) })),
    })
    .nullable()
    .optional(),
});

export type VnaRawOffer = Omit<FareOffer, "fxRate" | "priceVnd">;

export function parseVnaFareMatrix(raw: unknown, q: SearchQuery): VnaRawOffer[] {
  const res = Response.parse(raw);
  if (!res.success || !res.data) throw new Error(`VNA fare-matrix: ${res.message ?? "no data"}`);
  const { data } = res;
  return data.rows.flatMap((row) =>
    row.cells
      .filter((c) => c.available && c.totalPrice != null)
      .map((c): VnaRawOffer => {
        const currency = c.currencyCode ?? data.currencyCode;
        const decimals = data.dictionaries.currency?.[currency]?.decimalPlaces ?? 0;
        return {
          provider: "vna-fare-matrix",
          kind: "calendar",
          airlineCode: "VN",
          airlineName: "Vietnam Airlines",
          flightNo: null,
          origin: q.origin,
          destination: q.destination,
          departDate: c.departureDate,
          returnDate: c.returnDate,
          departAt: null,
          arriveAt: null,
          durationMin: null,
          stops: null,
          cabin: "economy",
          priceAmount: c.totalPrice! / 10 ** decimals,
          priceCurrency: currency,
          dedupeKey: `vna|${q.origin}-${q.destination}|${c.departureDate}|${c.returnDate}|ADT${q.adults}`,
        };
      }),
  );
}

export const vietnamAirlines: FlightProvider = {
  id: "vna-fare-matrix",
  enabled: () => true,
  supports: (q) => q.returnDate != null,
  async search(q: SearchQuery, ctx: ProviderContext) {
    const r = await ctx.fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.vietnamairlines.com",
        Referer: "https://www.vietnamairlines.com/",
      },
      body: JSON.stringify({
        departureDate: q.departDate,
        returnDate: q.returnDate,
        originLocationCode: q.origin,
        destinationLocationCode: q.destination,
        flexibility: 3,
        commercialFareFamilies: ["WEB"],
        travelers: Array.from({ length: q.adults }, () => ({ passengerTypeCode: "ADT" })),
        totalCol: 7,
        countryCode: "VN",
      }),
    });
    if (r.status === 403 || r.status === 429) throw new BlockedError(`VNA HTTP ${r.status}`);
    if (!r.ok) throw new Error(`VNA HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const offers = parseVnaFareMatrix(await r.json(), q);
    return Promise.all(offers.map(async (o) => ({ ...o, ...(await ctx.toVnd(o.priceAmount, o.priceCurrency)) })));
  },
};
