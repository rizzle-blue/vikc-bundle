import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { deriveStay, headcountByDay, presenceDays, progressOf, vnDate, type TripRow } from "../src/lib/registration/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");
const SEEDS = [join(ROOT, "supabase/seed_members.sql"), join(ROOT, "supabase/seed_events.sql")];

/** The fixtures the SQL views and the TypeScript rules must agree on. */
const FIXTURES: TripRow[] = [
  { memberId: "SKJ-198", arrivalAt: "2026-11-18T14:00:00+07:00", departureAt: "2026-11-22T10:00:00+07:00", roomType: "Đôi", roommate: "SKJ-023" },
  { memberId: "SKJ-023", arrivalAt: "2026-11-20T09:30:00+07:00", departureAt: "2026-11-29T20:00:00+07:00", roomType: "Ba" },
  { memberId: "SKJ-960", arrivalAt: "2026-11-19T08:00:00+07:00", departureAt: null, roomType: null }, // partial: no departure
  { memberId: "SKJ-201", arrivalAt: "2026-11-15T10:00:00+07:00", departureAt: "2026-11-20T10:00:00+07:00", roomType: "Đơn" }, // outside the window
];

const day = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

describe("registration schema (local Postgres) + agreement with the TypeScript rules", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon noinherit; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated noinherit; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role noinherit bypassrls; end if;
      end $$;
    `);
    // apply the whole migration set, in order — the views build on each other
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    }
    for (const seed of SEEDS) {
      await db.exec(readFileSync(seed, "utf8"));
      await db.exec(readFileSync(seed, "utf8")); // idempotent
    }

    // registrations are opt-in: the fixtures create their own rows
    for (const f of FIXTURES) {
      await db.query(
        `insert into public.registrations (member_id, arrival_at, departure_at, room_type, roommate)
         values ($1, $2, $3, $4, $5)
         on conflict (member_id) do update
            set arrival_at = excluded.arrival_at, departure_at = excluded.departure_at,
                room_type = excluded.room_type, roommate = excluded.roommate, updated_at = now()`,
        [f.memberId, f.arrivalAt, f.departureAt, f.roomType ?? null, f.roommate ?? null],
      );
    }
  }, 60_000);

  it("seeds the roster as reference data and pre-enrols nobody", async () => {
    const members = await db.query<{ n: number }>("select count(*)::int as n from public.members");
    const regs = await db.query<{ n: number }>("select count(*)::int as n from public.registrations");
    expect(members.rows[0]?.n).toBe(22);
    // the roster is not a list of expected attendees: one row per member who actually signed up
    expect(regs.rows[0]?.n).toBe(FIXTURES.length);
  });

  it("seeds the VIKC programme as events, with the entry-counting ones flagged", async () => {
    const { rows } = await db.query<{ code: string; kind: string; counts_as_entry: boolean; included_in_package: boolean }>(
      "select code, kind, counts_as_entry, included_in_package from public.events order by code",
    );
    expect(rows).toHaveLength(9);
    expect(rows.filter((r) => r.counts_as_entry).map((r) => r.code)).toEqual([
      "team3-nam", "team3-nu", "team5-nam", "team5-nu",
    ]);
    // the package already covers the seminar, Godo and the welcome party
    expect(rows.filter((r) => r.included_in_package).map((r) => r.code).sort()).toEqual([
      "godo", "party", "seminar", "team3-nam", "team3-nu", "team5-nam", "team5-nu",
    ]);
    const sessions = await db.query<{ n: number }>(
      "select count(*)::int as n from public.event_sessions s join public.events e on e.id = s.event_id where e.code = 'godo'",
    );
    expect(sessions.rows[0]?.n).toBe(3);
  });

  it("counts a member's entries the way the VKF package price needs (1 vs 2 nội dung)", async () => {
    // one athlete in both team events, one in a single event, one only in the included seminar
    await db.exec(`
      insert into public.event_signups (event_id, member_id, status)
      select id, 'SKJ-198', 'confirmed' from public.events where code in ('team3-nam', 'team5-nam');
      insert into public.event_signups (event_id, member_id, status)
      select id, 'SKJ-023', 'interested' from public.events where code = 'team3-nam';
      insert into public.event_signups (event_id, member_id, status)
      select id, 'SKJ-960', 'confirmed' from public.events where code = 'seminar';
    `);
    const { rows } = await db.query<{ member_id: string; entries: number }>(
      `select member_id, entries from public.v_member_entry_count
        where member_id in ('SKJ-198', 'SKJ-023', 'SKJ-960') order by member_id`,
    );
    expect(rows).toEqual([
      { member_id: "SKJ-023", entries: 1 },
      { member_id: "SKJ-198", entries: 2 },
      { member_id: "SKJ-960", entries: 0 }, // the seminar is not an entry
    ]);
  });

  it("keeps one sign-up per member per event (and per session) and counts them", async () => {
    await db.exec(`
      insert into public.event_signups (event_id, member_id, status)
      select id, 'SKJ-201', 'interested' from public.events where code = 'godo'
      on conflict (event_id, member_id, session_id) do update set status = 'confirmed';
      insert into public.event_signups (event_id, member_id, status)
      select id, 'SKJ-201', 'confirmed' from public.events where code = 'godo'
      on conflict (event_id, member_id, session_id) do update set status = 'confirmed';
    `);
    const upserted = await db.query<{ n: number; status: string }>(
      `select count(*)::int as n, max(status) as status from public.event_signups
        where member_id = 'SKJ-201'`,
    );
    expect(upserted.rows[0]).toEqual({ n: 1, status: "confirmed" });

    // a per-session sign-up is a different row (dojo exchange: one dojo per day)
    const session = await db.query<{ id: number }>(
      `select s.id from public.event_sessions s join public.events e on e.id = s.event_id
        where e.code = 'godo' order by s.starts_at limit 1`,
    );
    await db.query(
      `insert into public.event_signups (event_id, session_id, member_id, status)
       select e.id, $1, 'SKJ-201', 'confirmed' from public.events e where e.code = 'godo'
       on conflict (event_id, member_id, session_id) do nothing`,
      [session.rows[0]!.id],
    );
    const counts = await db.query<{ signups: number; confirmed: number }>(
      `select signups, confirmed from public.v_event_signup_counts where code = 'godo'`,
    );
    expect(counts.rows[0]).toEqual({ signups: 2, confirmed: 2 });
  });

  it("v_member_stay agrees with deriveStay()/progressOf() for every fixture", async () => {
    const { rows } = await db.query<{
      member_id: string; nights: number; days: number; tam_chuc_nights: number;
      ha_noi_nights: number; outside_nights: number; has_datetimes: boolean; complete: boolean;
    }>(`select member_id, nights, days, tam_chuc_nights, ha_noi_nights, outside_nights, has_datetimes, complete
          from public.v_member_stay order by member_id`);

    for (const f of FIXTURES) {
      const sql = rows.find((r) => r.member_id === f.memberId);
      const ts = deriveStay(f);
      expect(sql, `row for ${f.memberId}`).toBeTruthy();
      expect(
        { nights: sql!.nights, days: sql!.days, tam: sql!.tam_chuc_nights, hn: sql!.ha_noi_nights, out: sql!.outside_nights, has: sql!.has_datetimes },
        `stay for ${f.memberId}`,
      ).toEqual({ nights: ts.nights, days: ts.days, tam: ts.tamChucNights, hn: ts.haNoiNights, out: ts.outsideNights, has: ts.nights > 0 });
      expect(sql!.complete, `complete flag for ${f.memberId}`).toBe(progressOf(f) === "complete");
    }
  });

  it("v_member_nights lists exactly the nights presenceDays() implies", async () => {
    const { rows } = await db.query<{ member_id: string; vn_night: Date }>(
      "select member_id, vn_night from public.v_member_nights where member_id = 'SKJ-198' order by vn_night",
    );
    const fromTs = presenceDays(FIXTURES[0]!).slice(0, -1); // nights = presence days minus the last day
    expect(rows.map((r) => day(r.vn_night))).toEqual(fromTs);
  });

  it("v_headcount_per_day agrees with headcountByDay() for the whole window", async () => {
    const { rows } = await db.query<{ vn_day: Date; present: number; confirmed: number; vikc_days: boolean; ha_noi_days: boolean }>(
      "select vn_day, present, confirmed, vikc_days, ha_noi_days from public.v_headcount_per_day order by vn_day",
    );
    const ts = headcountByDay(FIXTURES);
    expect(rows).toHaveLength(ts.length);
    expect(rows.map((r) => ({ day: day(r.vn_day), present: r.present, confirmed: r.confirmed, vikc: r.vikc_days, hn: r.ha_noi_days })))
      .toEqual(ts.map((d) => ({ day: d.day, present: d.present, confirmed: d.confirmed, vikc: d.vikcDay, hn: d.haNoiDay })));
    expect(ts.length).toBe(13); // 18/11 … 30/11
  });

  it("keeps a Vietnamese instant on the right calendar day", async () => {
    const { rows } = await db.query<{ d: Date }>(
      `select ((timestamptz '2026-11-17T18:00:00Z') at time zone 'Asia/Ho_Chi_Minh')::date as d`,
    );
    expect(day(rows[0]!.d)).toBe(vnDate("2026-11-17T18:00:00Z"));
    expect(day(rows[0]!.d)).toBe("2026-11-18");
  });

  it("rejects a departure before the arrival", async () => {
    await expect(
      db.query(`update public.registrations set arrival_at = timestamptz '2026-11-20T10:00:00+07',
                                             departure_at = timestamptz '2026-11-19T10:00:00+07'
                where member_id = 'SKJ-198'`),
    ).rejects.toThrow(/registrations_order/);
  });

  it("lets the anon role read the roster and write trip rows (decision 1a), but not add members", async () => {
    const { rows } = await db.query<{ policyname: string; cmd: string; roles: string[]; tablename: string }>(
      "select policyname, cmd, roles::text[] as roles, tablename from pg_policies where schemaname = 'public' order by policyname",
    );
    const names = rows.map((r) => `${r.policyname}:${r.cmd}`);
    expect(names).toContain("roster readable:SELECT");
    expect(names).toContain("trip readable:SELECT");
    expect(names).toContain("trip insertable:INSERT");
    expect(names).toContain("trip updatable:UPDATE");
    expect(rows.some((r) => r.policyname.startsWith("members") && r.cmd === "INSERT")).toBe(false);

    // members check themselves in; the programme itself is the operator's to write (server route
    // with the service key), so the anon key may only read events and sessions
    expect(rows.filter((r) => r.tablename === "events").map((r) => r.cmd)).toEqual(["SELECT"]);
    expect(rows.filter((r) => r.tablename === "event_sessions").map((r) => r.cmd)).toEqual(["SELECT"]);
    expect(rows.filter((r) => r.tablename === "event_signups").map((r) => r.cmd).sort())
      .toEqual(["INSERT", "SELECT", "UPDATE"]);
  });
});
