# SPEC — Member data model

Status: **current** (read off the live database 2026-10-09). Companion to
[`spec-member-registration.md`](spec-member-registration.md) (which fields VKF demands and why).
Project: `vikc-tracker`.

## The two scopes (owner, 2026-10-09)

Everything in the app serves exactly two screens:

1. **Member sign-up form** (`/enroll`) — the member gives their **basic info** (name, gender, DOB,
   phone, email, VKF membership + number) and the **personal data VKF requires** (latin/Kanji name,
   CCCD, nationality, address, occupation, dojo, emergency contact, mailing address, the current
   grade's date/issuer/photo), plus their trip dates, room and event check-ins.
2. **VIKC Registration** (`/admin/registration`) — the club's registration sheet, **pre-filled from
   what each member entered**: every column VKF's workbook asks for, with `missing_fields` marked so
   nothing incomplete is sent. One click gives the CSV in VKF's column order.

The basic info is pre-filled from the club's roster and the member confirms or corrects it. Their
answer is stored on their own record, so the roster is never rewritten: every registration column is
`coalesce(declared, roster)` (see `v_vikc_registration`).

## The rule behind it

The model keeps one rule: **what cannot change is preserved and never edited through the app; what
the member chooses is captured per trip; and whatever was submitted is frozen as it was submitted.**

## Three tiers

| Tier | Where | Who writes it | Changes? |
|---|---|---|---|
| **① Preserved identity** | `members` | migrations only (`seed_members.sql` from `resources/members.json`) | **Never.** Read-only for the anon key at the database level — no policy grants it INSERT/UPDATE/DELETE |
| **② Personal record** (the VKF dossier) | `member_profiles` | the member, from `/enroll` | Editable until it is submitted. The identity that ends up on a certificate (latin/Kanji name, CCCD, nationality) is entered once; **the submitted copy is snapshotted** into `exam_entries` |
| **③ Changeable logistics** | `registrations`, `event_signups`, `exam_entries` | the member (self-service) and the operator | Anytime — arrival/departure, room, roommate, which events |

Operator-only, outside the tiers: `members.expected` (your "I know they are coming" marker) and the
whole `events` / `event_sessions` programme — both written through the service-key routes.

## ① `members` — preserved identity (reference data)

| Column | Type | Note |
|---|---|---|
| `id` | text PK | `SKJ-###` — the club's own id, never recycled |
| `vkf_id` | text | VKF membership number; null = non-member (**drives the exam fee bracket**) |
| `full_name` | text not null | Vietnamese name as recorded |
| `gender` | text | `Nam` / `Nữ` |
| `date_of_birth` | date | VKF needs it for the minimum-age rule |
| `rank` | text | `4 dan`, `1 kyu` … the club's record of the current grade |
| `email`, `phone` | text | contact |
| `expected` | boolean not null default false | **operator-only** marker, not a denominator |

Source: `resources/members.json` → `pnpm seed:members` → `supabase/seed_members.sql` (idempotent
upsert). The roster is *not* the list of people expected to register (owner decision).

## ② `member_profiles` — the personal record (one row per member)

Filled once by the member; the eight fields VKF cannot get anywhere else are counted by
`v_member_profile.missing_fields`.

| Column | Type | VKF use |
|---|---|---|
| `member_id` | text PK → `members.id` | |
| `full_name_latin` | text | printed on the certificate (IN HOA) |
| `full_name_kanji` | text | printed on the certificate when requested |
| `use_kanji_on_certificate` | boolean not null | gates the Kanji name in every export |
| `national_id` | text | CCCD / passport number (identity) |
| `nationality` | text | `Việt Nam` |
| `address` | text | permanent address |
| `occupation` | text | |
| `dojo_name` | text | club name on the form |
| `emergency_contact` | text | name + phone |
| `certificate_mailing_address` | text | where the certificate is posted |
| `current_rank` | text | the grade the member declares as current |
| `current_rank_issued_on` | date | **VKF's training-period rule reads this** |
| `current_rank_issued_by` | text | issuer of the current certificate |
| `current_rank_photo_url` | text | link to a photo of the certificate, name legible |
| `updated_at` | timestamptz | |

## ③ Changeable tables

**`registrations`** (one row per member who signed up — created on sign-up, never pre-seeded)

| Column | Type | Note |
|---|---|---|
| `member_id` | text PK → `members.id` | |
| `role` | text not null default `'competitor'` | competitor / manager / family / guest |
| `arrival_at`, `departure_at` | timestamptz | **the two datetimes everything is derived from** (VN time) |
| `room_type` | text | Đôi / Ba / Đơn (one value per member, as VKF requires) |
| `roommate` | text | |
| `notes` | text | |
| `updated_at` | timestamptz | |

**`event_signups`** (the "check to enrol" row: member × event × optional session)

| Column | Type | Note |
|---|---|---|
| `id` | bigint PK | |
| `event_id` | bigint → `events.id` | |
| `session_id` | bigint → `event_sessions.id` | null = the whole event; used for Godo slots and one dojo per day |
| `member_id` | text → `members.id` | |
| `status` | text not null default `'confirmed'` | interested / confirmed / waitlist / **cancelled** (there is no DELETE for the member key) |
| `answers` | jsonb not null default `{}` | only for events the operator gives a `form_schema` |
| `notes`, `created_at`, `updated_at` | | |

**`exam_entries`** (one row per candidate per exam event — the submission)

| Column | Type | Note |
|---|---|---|
| `id` | bigint PK | |
| `member_id`, `event_id` | unique together | |
| `grade_applied` | text not null | 1 kyu … 5 dan |
| `also_shodan` | boolean not null | the 1 Kyu → Shodan allowance |
| `current_rank`, `current_rank_issued_on`, `current_rank_issued_by` | text / date / text | **snapshot** of the grade paperwork at submission |
| `dojo_approved` | boolean not null | the club's confirmation |
| `withdrawn` | boolean not null | un-ticking the exam flags it instead of deleting the record |
| `notes`, `created_at`, `updated_at` | | |

## Derived (never written by hand)

| View | What it answers |
|---|---|
| `v_member_nights` | one row per night spent, dated by check-in day, flagged Tam Chúc / Hà Nội |
| `v_member_stay` | nights, days, the leg split, `has_datetimes`, `complete`, `outside_nights` per member |
| `v_headcount_per_day` | who is in Vietnam each day 18–30/11 (VIKC and Hà Nội days flagged) |
| `v_member_entry_count` | how many entry-counting events a member joined → the 1-vs-2 "nội dung" package price |
| `v_member_signups` | member × event × session, with status and answers |
| `v_event_signup_counts` | sign-ups / confirmed / capacity per event |
| `v_member_profile` | the personal record + `missing_fields` (the 8 VKF-required values) |
| `v_exam_submission` | **every column VKF's workbook expects** for a candidate, incl. the fee bracket and the trip's room/nights |

The same night/day arithmetic exists twice on purpose — pure TypeScript in
`src/lib/registration/` for the live preview, SQL views for queries and exports — and
`test/schema.test.ts` compares them day by day so they cannot drift.

## Who may write what (verified in `test/schema.test.ts`)

| Object | anon (the browser) | service role (operator routes, scripts) |
|---|---|---|
| `members` | SELECT only | SELECT, UPDATE (`expected`) |
| `member_profiles` | SELECT, INSERT, UPDATE | all |
| `registrations` | SELECT, INSERT, UPDATE | all |
| `exam_entries` | SELECT, INSERT, UPDATE | all |
| `event_signups` | SELECT, INSERT, UPDATE | all |
| `events`, `event_sessions` | **SELECT only** | all |
| all `v_*` views | SELECT | SELECT |

So the preserved identity cannot be edited with the key the browser holds, and the programme cannot
be changed by the member code.

## Cleanup applied with this document

`registrations` still carried four columns from before the events model — `exam_grade`, `team3`,
`team5`, `dojo_exchange` — which nothing writes any more (the exam lives in `exam_entries`, the
teams in the four team events). They are dropped, together with their appearance in `v_member_stay`,
so the model above is exactly what exists.
