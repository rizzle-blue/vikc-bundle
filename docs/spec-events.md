# SPEC — Events (operator-set events, members check to enrol)

Status: **agreed with the owner 2026-10-09**, schema implemented. Source of truth for the domain:
`resources/vikc-2026/md/` (VKF user guide) + the owner's answers below.

## Why

The member page only captured arrival/departure datetimes. The trip also has a programme: the VIKC
events at Tam Chúc and the Hà Nội dojo exchange. The operator (owner) needs to **set those up** and
members need to **check in to them** — not toggle a hard-coded switch.

Also settled at the same time: the roster is **reference data only**. Nothing is pre-enrolled; a row
appears when a member actually signs up.

## Decisions (owner, 2026-10-09)

| # | Question | Answer |
|---|---|---|
| A1 | Expected flag per member | **Yes** — `members.expected`, operator-set, "we know this person is coming" (so they can be chased). It is *not* a denominator. |
| B2 | Seminar / Godo | From the programme: Seminar first (19/11 15:00–17:00), Godo Keiko after (19/11 17:00), plus Godo on 21/11 and 22/11 → **one Godo event with three sessions**. |
| B3 | Which events count as a "nội dung" for the package price | **Only the team shiai events** (Team 3 on 21/11, Team 5 on 22/11). Exam = separate fee; seminar/Godo/party = not entries. → `events.counts_as_entry` |
| B4 | "Tam Chúc tour" | **Not an event** — Tam Chúc is the *venue* of the tournament. The Tam Chúc side is registration options: room type, meals, exam kind, extra nights. |
| B5 | Hà Nội dojo exchange | Shakaijin visits Hà Nội dojos (Yushinkai, Thăng Long, Hà Nội Kendo Club, Yuei, Đông Á, …). **One dojo per day**, and the operator configures them → one `dojo` event with **one session per day**, each session carrying the dojo name. |
| C6 | Exam fields in the app | Minimal: **grade applied for** (+ optional Kanji name for the certificate) and notes. The rest stays on VKF's paper form. |
| C7 | Teams | **Later.** For now members just mark interest; the operator assigns teams afterwards (so no team tables yet). Gender comes from the event itself (Team 3 Nữ / Team 3 Nam / Team 5 Nữ / Team 5 Nam are four separate events). |
| C8 | Capacity / deadlines | Optional per event (nullable). |
| D9 | Access | **Two shared codes**: one for members, one for admin/operator. Simple gate first — no accounts. |
| D10 | Fee calculator | **Later.** The model must carry the inputs (entry count, room type, exam grade, extras) so it can be added without a migration. |

## Model

```
members                    reference roster (preserved, never pre-enrolled)
  + expected boolean        operator marks who they know is coming

registrations              opt-in trip row, created when a member signs up
  member_id PK, role(competitor|manager|family|guest), arrival_at, departure_at,
  room_type, roommate, exam_grade, team3, team5, dojo_exchange, notes, updated_at
  (was `member_trip`; team3/team5/dojo_exchange are kept until the event sign-ups replace them)

events                     operator-created programme items
  code, name_vi, name_en, kind(seminar|godo|exam|team_shiai|party|tour|dojo|meeting|ceremony|meal|other),
  starts_at, ends_at, venue,
  counts_as_entry      → the VKF package's 1-vs-2 "nội dung"
  included_in_package  → breakfast / competition-day lunch / welcome party the package already pays
  price_vnd            → null = included or quoted later
  capacity, signup_opens_at, signup_closes_at, requires_team, team_size, team_gender,
  form_schema jsonb    → extra per-signup fields (the exam's grade field uses this)
  sort_order, active, notes

event_sessions             one row per occurrence (Godo ×3, dojo exchange ×N — one dojo per day)
  event_id, starts_at, ends_at, title (e.g. the dojo name), venue, notes

event_signups              the "check to enrol" part
  event_id + member_id + session_id (null = the whole event)
  status(interested|confirmed|waitlist|cancelled), answers jsonb, notes, timestamps
  unique nulls not distinct (event_id, member_id, session_id)
```

Views: `v_event_signup_counts` (per event: sign-ups, confirmed, capacity) ·
`v_member_signups` (member × event × session) · `v_member_entry_count` (how many entry-counting
events a member joined → drives the 1-vs-2 package price) · `v_member_stay` / `v_headcount_per_day`
as before, now over `registrations`.

Write rules: `event_signups` is writable with the anon key (members self-serve, decision 1a).
`events` / `event_sessions` / `members.expected` are **read-only for the anon key** — the operator
writes them through a server route that holds the service key, so the shared admin code is a UI gate
rather than the only thing between the public and your events.

## Seeded events (operator-editable)

| code | name | when | entry | in package |
|---|---|---|---|---|
| `seminar` | Kendo Seminar (Hamasaki Mitsuru Sensei) | 19/11 15:00–17:00 | – | ✓ |
| `godo` | Godo Keiko | 19/11 17:00 · 21/11 17:00 · 22/11 17:30 (sessions) | – | ✓ |
| `exam` | Kỳ thi Kyu/Dan | 20/11 08:00–17:00 | – (own fee) | – |
| `team3-nu` / `team3-nam` | Đồng đội Nữ/Nam 3 người | 21/11 | ✓ | ✓ |
| `team5-nu` / `team5-nam` | Đồng đội Nữ/Nam 5 người | 22/11 | ✓ | ✓ |
| `party` | Tiệc chào mừng | 21/11 19:30–22:00 | – | ✓ (700k otherwise) |
| `dojo-hn` | Giao lưu võ đường Hà Nội | 23–29/11, one session per day | – | – |

Meals (lunch 120k / dinner 200k for extra days) are **not** seeded — the operator adds `meal`
events when they need them.

## Still open

1. B3 confirmation (only team shiai counts as a "nội dung"?).
2. Do members sign up for the **whole** dojo exchange or **per day**? (The model supports both; the
   UI default will be per-day with a "join all" shortcut.)
3. Whether the exam's paper dossier gets digitised later (C6 default: no).
