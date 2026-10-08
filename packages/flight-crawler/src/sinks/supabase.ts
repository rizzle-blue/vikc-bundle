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
      const [searches, cheapest, runs] = await Promise.all([
        db.from("flight_searches").select("id, label, origin, destination, depart_date, return_date").eq("active", true).order("id"),
        db.from("cheapest_by_date").select("origin, destination, depart_date, return_date, provider, min_price_vnd, fetched_at"),
        db.from("crawl_runs").select("provider, status, offer_count, finished_at").order("id", { ascending: false }).limit(5),
      ]);
      for (const r of [searches, cheapest, runs]) if (r.error) throw new Error(`report: ${r.error.message}`);
      const searchRows = searches.data ?? [];
      const cheapestRows = cheapest.data ?? [];
      const runRows = runs.data ?? [];

      const vnd = (n: number) => n.toLocaleString("vi-VN");
      const dmy = (d: string) => d.split("-").reverse().join("/");
      const clock = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", timeStyle: "short" });
      const key = (s: { origin: string; destination: string; depart_date: string; return_date: string | null }) =>
        `${s.origin.trim()}|${s.destination.trim()}|${s.depart_date}|${s.return_date ?? ""}`;
      const best = new Map<string, { min_price_vnd: number; provider: string; fetched_at: string }>();
      for (const c of cheapestRows) {
        const k = key(c);
        const prev = best.get(k);
        if (!prev || (c.min_price_vnd ?? Infinity) < prev.min_price_vnd) {
          best.set(k, { min_price_vnd: c.min_price_vnd as number, provider: c.provider, fetched_at: c.fetched_at as string });
        }
      }

      const rows = searchRows.map((s) => {
        const hit = best.get(key(s));
        const label = (s.label ?? `${s.origin}→${s.destination}`).padEnd(28);
        return hit
          ? `  ${label} ${vnd(hit.min_price_vnd).padStart(12)} ₫  ${hit.provider} · cập nhật ${clock(hit.fetched_at)}`
          : `  ${label} ${"—".padStart(12)}    ${
              s.return_date === null
                ? "chưa có nguồn: VNA chỉ trả khứ hồi → cần adapter VietJet (T5)"
                : `chưa crawl cặp ngày này (${dmy(s.depart_date)})`
            }`;
      });

      const last = runRows[0];
      return [
        `Supabase ${new URL(url).host} · ${cheapestRows.length} priced date pair(s) in the grid · ` +
          `${last?.offer_count ?? 0} offers in the last run` + (last ? ` · ${clock(last.finished_at)}` : " · no runs yet"),
        "",
        "cheapest current fare per registered search:",
        ...rows,
        "",
        "recent runs:",
        ...runRows.map((r) => `  ${clock(r.finished_at)}  ${r.provider}  ${r.status} (${r.offer_count})`),
      ].join("\n");
    },
    close: async () => {},
  };
}
