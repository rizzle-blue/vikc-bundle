import { createClient } from "@supabase/supabase-js";
import type { SearchQuery } from "../types.js";
import type { Sink } from "./types.js";

/** Writes with the service-role key (bypasses RLS); never ship this key to the browser. */
export function supabaseSink(url: string, serviceKey: string): Sink {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  return {
    async loadSearches() {
      const { data, error } = await db
        .from("flight_searches")
        .select("id, origin, destination, depart_date, return_date, adults")
        .eq("active", true)
        .order("id");
      if (error) throw new Error(`load flight_searches: ${error.message}`);
      return data.map(
        (r): SearchQuery => ({
          id: r.id,
          origin: r.origin,
          destination: r.destination,
          departDate: r.depart_date,
          returnDate: r.return_date,
          adults: r.adults,
        }),
      );
    },
    async record(run, offers) {
      const { data, error } = await db
        .from("crawl_runs")
        .insert({
          provider: run.provider,
          search_id: run.searchId,
          started_at: run.startedAt.toISOString(),
          finished_at: run.finishedAt.toISOString(),
          status: run.status,
          error: run.error,
          offer_count: run.offerCount,
        })
        .select("id")
        .single();
      if (error) throw new Error(`insert crawl_runs: ${error.message}`);
      if (!offers.length) return;
      const rows = offers.map((o) => ({
        run_id: data.id,
        search_id: run.searchId,
        provider: o.provider,
        kind: o.kind,
        airline_code: o.airlineCode,
        airline_name: o.airlineName,
        flight_no: o.flightNo,
        origin: o.origin,
        destination: o.destination,
        depart_date: o.departDate,
        return_date: o.returnDate,
        depart_at: o.departAt,
        arrive_at: o.arriveAt,
        duration_min: o.durationMin,
        stops: o.stops,
        cabin: o.cabin,
        price_amount: o.priceAmount,
        price_currency: o.priceCurrency,
        fx_rate: o.fxRate,
        price_vnd: o.priceVnd,
        dedupe_key: o.dedupeKey,
        fetched_at: run.finishedAt.toISOString(),
      }));
      // One row per offer per VN clock hour: same-hour re-crawls overwrite, each hour is history.
      const up = await db.from("fare_offers").upsert(rows, { onConflict: "dedupe_key,fetched_hour" });
      if (up.error) throw new Error(`upsert fare_offers: ${up.error.message}`);
    },
    async report() {
      const { data, error } = await db
        .from("cheapest_by_date")
        .select("origin, destination, depart_date, return_date, provider, min_price_vnd")
        .order("min_price_vnd", { ascending: true })
        .limit(8);
      if (error) throw new Error(`report cheapest_by_date: ${error.message}`);
      const vnd = (n: number) => n.toLocaleString("vi-VN");
      const rows = data.filter((r) => r.min_price_vnd != null);
      return [
        `store: Supabase ${new URL(url).host} · ${rows.length} priced date pair(s)`,
        "",
        "cheapest current fares:",
        ...rows.map((c) => `  ${c.origin}→${c.destination} ${c.depart_date}${c.return_date ? "→" + c.return_date : ""}  ${vnd(c.min_price_vnd as number)} ₫  ${c.provider}`),
      ].join("\n");
    },
    close: async () => {},
  };
}
