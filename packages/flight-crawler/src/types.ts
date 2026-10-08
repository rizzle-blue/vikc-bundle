import { z } from "zod";

const iata = z.string().regex(/^[A-Z]{3}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SearchQuery = z.object({
  id: z.number().int().nullable(),
  origin: iata,
  destination: iata,
  departDate: isoDate,
  returnDate: isoDate.nullable(),
  adults: z.number().int().min(1).default(1),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const FareOffer = z.object({
  provider: z.string(),
  // calendar = lowest price for a date (pair), no flight detail; itinerary = concrete flights
  kind: z.enum(["calendar", "itinerary"]),
  airlineCode: z.string().min(2).max(3),
  airlineName: z.string().nullable(),
  flightNo: z.string().nullable(),
  origin: iata,
  destination: iata,
  departDate: isoDate,
  returnDate: isoDate.nullable(),
  departAt: z.string().nullable(),
  arriveAt: z.string().nullable(),
  durationMin: z.number().int().nullable(),
  stops: z.number().int().nullable(),
  cabin: z.string().nullable(),
  priceAmount: z.number().positive(),
  priceCurrency: z.string().length(3),
  fxRate: z.number().positive().nullable(),
  priceVnd: z.number().int().positive().nullable(),
  dedupeKey: z.string(),
});
export type FareOffer = z.infer<typeof FareOffer>;

export type RunStatus = "ok" | "empty" | "blocked" | "error" | "skipped";

export interface ProviderContext {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  toVnd(amount: number, currency: string): Promise<{ fxRate: number | null; priceVnd: number | null }>;
}

export interface FlightProvider {
  id: string;
  /** Missing credentials etc. → provider silently skipped. */
  enabled(env: ProviderContext["env"]): boolean;
  supports(q: SearchQuery): boolean;
  search(q: SearchQuery, ctx: ProviderContext): Promise<FareOffer[]>;
}

/** Thrown when a site answers with 403/429/captcha: stop, don't evade. */
export class BlockedError extends Error {
  override name = "BlockedError";
}
