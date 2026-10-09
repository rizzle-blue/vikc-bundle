import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { DEFAULT_SEARCHES } from "../searches.js";
import type { SearchQuery } from "../types.js";
import type { CrawlRun, Sink } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, "../../../../supabase/migrations/20261008000000_flights.sql");

/**
 * Durable local store (embedded Postgres) using the *same* migration as Supabase, so the
 * schema, views and queries are identical. Used when no Supabase credentials are present —
 * the hourly crawl keeps collecting price history without waiting for cloud setup.
 */
export function pgliteSink(dataDir = "data/fares"): Sink {
  mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  let ready: Promise<void> | null = null;

  const asDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

  async function init(): Promise<void> {
    // The migration ships Supabase's roles + RLS policies; create the roles first so the
    // same file applies unchanged here.
    await db.exec(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon')           then create role anon noinherit; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated')  then create role authenticated noinherit; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role')   then create role service_role noinherit bypassrls; end if;
      end $$;
    `);
    const { rows } = await db.query<{ exists: boolean }>(
      "select to_regclass('public.fare_offers') is not null as exists",
    );
    if (!rows[0]?.exists) await db.exec(readFileSync(MIGRATION, "utf8"));
    const { rows: counts } = await db.query<{ n: number }>("select count(*)::int as n from flight_searches");
    if (!(counts[0]?.n ?? 0)) await db.exec(readFileSync(resolve(HERE, "../../../../supabase/seed.sql"), "utf8"));
  }
  const ensure = () => (ready ??= init());

  return {
    async loadSearches() {
      await ensure();
      const { rows } = await db.query<{
        id: number; origin: string; destination: string;
        depart_date: unknown; return_date: unknown; adults: number;
      }>("select id, origin, destination, depart_date, return_date, adults from flight_searches where active order by id");
      if (!rows.length) return DEFAULT_SEARCHES;
      return rows.map((r): SearchQuery => ({
        id: r.id,
        origin: r.origin.trim(),
        destination: r.destination.trim(),
        departDate: asDate(r.depart_date),
        returnDate: r.return_date ? asDate(r.return_date) : null,
        adults: r.adults,
      }));
    },

    async record(run: CrawlRun, offers) {
      await ensure();
      const { rows: insertedRows } = await db.query<{ id: number }>(
        `insert into crawl_runs (provider, search_id, started_at, finished_at, status, error, offer_count)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [run.provider, run.searchId, run.startedAt.toISOString(), run.finishedAt.toISOString(),
         run.status, run.error, run.offerCount],
      );
      const runId = insertedRows[0]?.id;
      if (runId === undefined) throw new Error("insert crawl_runs returned no id");
      if (!offers.length) return;
      const fetchedAt = run.finishedAt.toISOString();
      await db.transaction(async (tx) => {
        for (const o of offers) {
          // hourly key: re-crawls in the same VN clock hour overwrite, each hour inserts a new row
          await tx.query(
            `insert into fare_offers (run_id, search_id, provider, kind, airline_code, airline_name,
               flight_no, origin, destination, depart_date, return_date, depart_at, arrive_at,
               duration_min, stops, cabin, price_amount, price_currency, fx_rate, price_vnd,
               dedupe_key, fetched_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
             on conflict (dedupe_key, fetched_hour) do update set
               run_id = excluded.run_id, price_amount = excluded.price_amount,
               price_currency = excluded.price_currency, fx_rate = excluded.fx_rate,
               price_vnd = excluded.price_vnd, fetched_at = excluded.fetched_at`,
            [runId, run.searchId, o.provider, o.kind, o.airlineCode, o.airlineName, o.flightNo,
             o.origin, o.destination, o.departDate, o.returnDate, o.departAt, o.arriveAt,
             o.durationMin, o.stops, o.cabin, o.priceAmount, o.priceCurrency, o.fxRate, o.priceVnd,
             o.dedupeKey, fetchedAt],
          );
        }
      });
    },

    async report() {
      await ensure();
      const { rows: summary } = await db.query<{ n: number; hours: number; runs: number; pairs: number }>(
        `select (select count(*)::int from fare_offers) as n,
                (select count(distinct fetched_hour)::int from fare_offers) as hours,
                (select count(*)::int from crawl_runs) as runs,
                (select count(distinct (depart_date, return_date))::int from fare_offers) as pairs`,
      );
      // Cheapest current price for each *registered* search. VNA answers a ±3-day grid around the
      // pairs we ask for, so extra date pairs exist in the store; only registered ones are listed.
      const { rows: searches } = await db.query<{
        label: string | null; origin: string; destination: string;
        depart_date: Date; return_date: Date | null; provider: string | null;
        min_price_vnd: number | null; fetched_at: Date | null;
      }>(
        `select s.label, s.origin, s.destination, s.depart_date, s.return_date,
                c.provider, c.min_price_vnd, c.fetched_at
           from flight_searches s
           left join cheapest_by_date c
             on c.origin = s.origin and c.destination = s.destination
            and c.depart_date = s.depart_date
            and c.return_date is not distinct from s.return_date
          where s.active
          order by s.id, c.min_price_vnd nulls last`,
      );
      const { rows: runs } = await db.query<{ provider: string; status: string; offer_count: number; finished_at: Date }>(
        `select provider, status, offer_count, finished_at from crawl_runs order by id desc limit 5`,
      );
      const vnd = (n: number) => n.toLocaleString("vi-VN");
      const day = (d: unknown) => asDate(d).split("-").reverse().join("/");
      const time = (d: Date) =>
        d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", timeStyle: "short" });
      const stamp = (d: Date) =>
        d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
      const s = summary[0] ?? { n: 0, hours: 0, runs: 0, pairs: 0 };
      const lastRun = runs[0]?.finished_at;
      const label = (r: (typeof searches)[number]) => (r.label ?? `${r.origin}→${r.destination}`).padEnd(28);
      return [
        `${s.n} offer rows in ${s.hours} hour-bucket(s) · ${s.pairs} date pairs · ${s.runs} provider run(s)` +
          (lastRun ? ` · last crawl ${stamp(lastRun)}` : " · no crawl yet"),
        "",
        "cheapest current fare per registered search:",
        ...searches.map((r) =>
          r.min_price_vnd != null
            ? `  ${label(r)} ${vnd(r.min_price_vnd).padStart(12)} ₫  ${r.provider} · ${r.fetched_at ? "cập nhật " + time(r.fetched_at) : ""}`
            : `  ${label(r)} ${"—".padStart(12)}    ${
                r.return_date === null
                  ? "chưa có nguồn: VNA chỉ trả khứ hồi → cần adapter VietJet (T5)"
                  : "chưa crawl cặp ngày này"
              }`),
        "",
        `grid note: Vietnam Airlines returns a 7×7 grid (±3 ngày) around each registered pair, so the`,
        `store holds ${s.pairs} date pairs — the table above only shows the ones members actually book.`,
        "",
        "recent runs:",
        ...runs.map((r) => `  ${stamp(r.finished_at)}  ${r.provider}  ${r.status} (${r.offer_count})`),
      ].join("\n");
    },

    close: async () => {
      if (ready) await db.close();
    },
  };
}

/** Read-only report against an existing local store (used by `pnpm fares`). */
export async function pgliteReport(dataDir = "data/fares"): Promise<string> {
  const sink = pgliteSink(dataDir);
  const text = await sink.report();
  await sink.close();
  return text;
}
