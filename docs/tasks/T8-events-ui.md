# T8 — Events UI (operator editor, member check-in, access codes)

**Read first:** [`docs/spec-events.md`](../spec-events.md) (the design and the decisions it encodes),
[`docs/status.md`](../status.md). The schema is already live in Supabase.
**Status:** ⏳ next.

## Goal

The operator defines the programme; members check themselves in to it. Today the schema exists but
nothing in the app uses it.

## Scope

1. **Access codes (D9)** — two shared codes, member and admin. Simple gate first: a small login page
   sets an httpOnly cookie; middleware protects `/enroll/*` with the member code and `/admin/*` with
   the admin code. Codes come from env (`MEMBER_ACCESS_CODE`, `ADMIN_ACCESS_CODE`) and are never
   shipped to the browser. The member page's language must state this plainly: the code keeps the
   link private, it is not an account.
2. **Operator area** (`/admin`, admin code):
   - events list (`v_event_signup_counts`): name, when, kind, entry flag, sign-ups / capacity;
   - create + edit an event (name vi/en, kind, start/end, venue, `counts_as_entry`,
     `included_in_package`, price, capacity, sign-up window, team size/gender, notes, active);
   - sessions per event (Godo ×3 already; the Hà Nội exchange gets one session per day, each titled
     with the dojo name);
   - per-event sign-up list (who, status, answers) with **CSV export** (this also closes T7's export);
   - the `expected` flag per member (roster screen);
   - **writes go through a server route** (`/api/admin/*`) that holds the service key — the anon key
     is read-only on `events`, `event_sessions` and `members` (verified in `test/schema.test.ts`).
3. **Member area** (`/enroll`, member code): after the trip fields, the programme as check-ins —
   team 3 / team 5 / exam (with the `form_schema` fields: grade, optional Kanji name) / seminar /
   Godo (per session) / party / the Hà Nội exchange (per day, one dojo per session) — plus a live
   count of **entries** ("bạn đang đăng ký 2 nội dung → gói 2 nội dung") because that drives the
   VKF package price. Sign-ups write to `event_signups` with the anon key (allowed by design).
4. **Board** (`/track`): per-event counts, entries distribution (how many members have 1 vs 2),
   and the roster framing flipped to "đã đăng ký: N" + "dự kiến: M" — no "21 missing out of 22".

## Done when

The operator can set up the whole programme from the app, a member can check in to it in one screen,
the counts on `/track` match the database, and `pnpm test && pnpm typecheck && pnpm build` are green.

## Don't

- Don't put the service key in any client component or `NEXT_PUBLIC_*`.
- Don't treat the codes as real auth; if a second operator needs accountability, move to Supabase
  Auth instead of adding more shared codes.
