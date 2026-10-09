import type { ProviderContext } from "./types.js";

/** USD→VND etc. via open.er-api.com (free, keyless). One fetch per base currency per run. */
export function createFx(fetchFn: typeof fetch): ProviderContext["toVnd"] {
  const cache = new Map<string, Promise<number | null>>();
  const rate = (base: string) => {
    let p = cache.get(base);
    if (!p) {
      p = fetchFn(`https://open.er-api.com/v6/latest/${base}`)
        .then(async (r) => {
          const j = (await r.json()) as { result?: string; rates?: Record<string, number> };
          return j.result === "success" ? (j.rates?.VND ?? null) : null;
        })
        .catch(() => null);
      cache.set(base, p);
    }
    return p;
  };
  return async (amount, currency) => {
    if (currency === "VND") return { fxRate: 1, priceVnd: Math.round(amount) };
    const r = await rate(currency);
    return r ? { fxRate: r, priceVnd: Math.round(amount * r) } : { fxRate: null, priceVnd: null };
  };
}
