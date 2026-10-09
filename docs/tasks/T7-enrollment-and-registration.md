# T7 — Web app core: arrival/departure datetime + progress tracking

**Read first:** [`docs/handoff.md`](../handoff.md) §1–2. Domain reference (categories, VKF fees,
deadlines, the exact datetime requirements): the archived spreadsheet spec
[`docs/archive/spreadsheet-track/spec-trip-registration.md`](../archive/spreadsheet-track/spec-trip-registration.md).
**Status:** ✅ **built and verified** (2026-10-09) — schema live, `/enroll` + `/track` working against
Supabase, member flow proven in a real browser. Remaining: deploy to Vercel and hand out the link.

## Decisions (owner, 2026-10-08) — done

1. Identity: **(a) pick your name from the roster, no login.** The anon key may read `members` and
   insert/update `member_trip`; the app footer must state that edits are open to whoever has the link.
2. v1 fields: **defaults** — required arrival + departure datetime + room type; optional roommate,
   exam grade, team-3, team-5, dojo exchange, notes. No fees in v1.

## Goal (what the owner actually needs)

A member opens one link, identifies themselves, and enters **the datetime they arrive and the
datetime they leave**. From that the system works out, programmatically:

- nights and days per member (Vietnam calendar),
- which nights are Tam Chúc (VIKC 19–22/11) vs Hà Nội (23–29/11),
- a **headcount per day** across the whole window (18–30/11/2026),
- per-member **progress**: not started / partial / complete (datetimes + optional fields),
- progress against the deadlines: registration **20/10/2026**, payment **25/10/2026**.

Admins get one screen with those numbers. Everything else (fares, categories, fees) is secondary.

## Decisions needed before coding (only 2)

1. **Identity** — pick one:
   - *a. Pick your name from the roster* (22 members from `resources/members.json`), no login. Fastest
     to ship, closest to the old spreadsheet; whoever has the link can edit any row. **Recommended
     for v1.**
   - *b. Magic link to the member's roster email* (Supabase Auth allow-list) — trustworthy edits,
     more friction and more work.
   - *c. Magic link + roster pick* — b, then choose which member you are.
2. **Optional fields in v1** — beyond arrival/departure datetimes, tick what to include:
   room type (Đôi/Ba/Đơn) + roommate · exam category (1 kyu–5 dan) · team-3 / team-5 intent ·
   dojo exchange · notes. *(Default: room type + roommate + exam + teams + notes; no fees yet.)*

## Data model (new migration — never edit an applied one)

- `members` — seeded from `resources/members.json` (id, vkf id, name, gender, dob, rank, email, phone).
- `member_trip` — one row per member: `member_id` · `arrival_at timestamptz` · `departure_at timestamptz` ·
  `room_type` · `roommate` · `exam_grade` · `team3` · `team5` · `dojo` · `notes` ·
  `updated_at`, plus an `updated_by` marker when auth is added.
- Views: `v_headcount_per_day` (VN dates 18–30/11, count of members present, and NB vs HN split)
  · `v_member_progress` (per member: filled/partial/missing, nights, days, which legs).
- RLS: with option 1a, `select` + `update` for anon on `member_trip` (it is a trust-based club tool)
  — say so explicitly in the app footer; `members` is `select` only. With 1b/1c, rows are restricted
  to the signed-in member (own row) + admins.

## Rules to implement (from the archived spec — already decided once)

- **Specific datetimes**, not just dates: date picker + `HH:MM`, stored `timestamptz`
  (Asia/Ho_Chi_Minh). Sheets had no combined picker; the web app can use `<input type=datetime-local>`.
- Window 18–30/11/2026. Departure must be after arrival; dates outside the window get a soft warning.
- Nights = VN-calendar date difference; days = nights + 1.
- Tam Chúc window 19–22/11, Hà Nội window 23–29/11 → extra Tam Chúc nights are the ones outside the
  VKF package night (package includes the Sat 21/11 night, per the parked spreadsheet decision).

## Steps

1. ~~Get the 2 decisions; record them in `docs/handoff.md` §2.~~ ✅
2. ~~Migration + roster seed + derived views; prove the derivations on PGlite~~ ✅
   `supabase/migrations/20261009000000_registration.sql`, `supabase/seed_members.sql`
   (`pnpm seed:members`), pure rules in `packages/registration/`, cross-check test
   `packages/registration/test/views.test.ts`.
3. ✅ `apps/web` (T3 scaffold): `/enroll` — roster pick, two datetime fields, optional fields, mobile
   first, Vietnamese, instant preview of "đêm / ngày" and which legs the dates produce.
4. ✅ `/track` — headcount per day 18–30/11, progress list, countdown to 20/10 and 25/10.
   (CSV export still open.)
5. Deploy to Vercel, hand over the link, test with two real members end-to-end.

## Done when

A member can enter their arrival + departure datetimes on a phone in under a minute, the derived
nights/days are visibly correct, and the admin screen answers "who is here on which day" and
"who hasn't filled it in yet" without opening a spreadsheet.

## Don't

- Don't rebuild the spreadsheet (fees/packages/agenda tabs) — only what this goal needs.
- Don't put the Supabase secret key anywhere near `apps/web`.
- Don't block this on the fare crawler (VNA/VietJet) — fares are a separate, optional panel.
