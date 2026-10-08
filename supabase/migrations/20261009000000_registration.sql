-- Registration: the delegation roster and, per member, the datetimes they arrive and leave.
-- Purpose: from these two datetimes the trip is tracked programmatically (nights, days, which leg,
-- headcount per day, per-member progress).
--
-- Identity decision (owner, 2026-10-08): members pick their own name from the roster — no login.
-- That makes member_trip writable with the publishable/anon key, which is a deliberate,
-- documented trust trade-off for a 22-person club tool (see docs/tasks/T7-*.md).

create table public.members (
  id            text primary key,               -- SKJ-###
  vkf_id        text,                           -- null when not a VKF member
  full_name     text not null,
  gender        text check (gender in ('Nam', 'Nữ')),
  date_of_birth date,
  rank          text,                           -- '4 dan', '2 kyu', …
  email         text,
  phone         text
);

create table public.member_trip (
  member_id     text primary key references public.members(id) on delete cascade,
  arrival_at    timestamptz,                    -- when they land / reach the venue (VN time)
  departure_at  timestamptz,                    -- when they fly home
  room_type     text check (room_type in ('Đôi', 'Ba', 'Đơn')),
  roommate      text,
  exam_grade    text,                           -- '1 kyu' … '5 dan' when sitting the exam
  team3         boolean not null default false,
  team5         boolean not null default false,
  dojo_exchange boolean not null default false,
  notes         text,
  updated_at    timestamptz not null default now(),
  -- a member cannot leave before they arrive
  constraint member_trip_order check (arrival_at is null or departure_at is null or departure_at > arrival_at)
);

create index member_trip_arrival_idx   on public.member_trip (arrival_at);
create index member_trip_departure_idx on public.member_trip (departure_at);

-- One row per night actually spent in Vietnam (the night is dated by its check-in day, the same
-- convention as a hotel bill). Used for the Tam Chúc / Hà Nội split.
create view public.v_member_nights with (security_invoker = true) as
select t.member_id,
       n.vn_night::date as vn_night,
       (n.vn_night::date between date '2026-11-18' and date '2026-11-22') as tam_chuc_leg,
       (n.vn_night::date between date '2026-11-23' and date '2026-11-29') as ha_noi_leg
from public.member_trip t
cross join lateral generate_series(
       (t.arrival_at at time zone 'Asia/Ho_Chi_Minh')::date,
       (t.departure_at at time zone 'Asia/Ho_Chi_Minh')::date - 1,
       interval '1 day') as n(vn_night)
where t.arrival_at is not null and t.departure_at is not null;

-- Derived stay per member: nights, days, and how the nights split across the two legs.
create view public.v_member_stay with (security_invoker = true) as
select m.id as member_id,
       m.full_name,
       t.arrival_at,
       t.departure_at,
       t.room_type,
       t.roommate,
       t.exam_grade,
       t.team3,
       t.team5,
       t.dojo_exchange,
       t.notes,
       t.updated_at,
       coalesce(s.nights, 0)    as nights,
       coalesce(s.nights, 0) + (case when s.nights is null then 0 else 1 end) as days,
       coalesce(s.tam_chuc_nights, 0) as tam_chuc_nights,
       coalesce(s.ha_noi_nights, 0)   as ha_noi_nights,
       (t.arrival_at is not null and t.departure_at is not null) as has_datetimes,
       (t.arrival_at is not null and t.departure_at is not null and t.room_type is not null) as complete
from public.members m
left join public.member_trip t on t.member_id = m.id
left join (
  select member_id,
         count(*)::int as nights,
         count(*) filter (where tam_chuc_leg)::int as tam_chuc_nights,
         count(*) filter (where ha_noi_leg)::int   as ha_noi_nights
  from public.v_member_nights
  group by member_id
) s on s.member_id = m.id;

-- Headcount for every day of the delegation window: a member counts as present from their arrival
-- day through their departure day (that is exactly nights + 1 days).
create view public.v_headcount_per_day with (security_invoker = true) as
select d.vn_day::date as vn_day,
       -- present: we know they have arrived by this day (a missing departure counts as "still here")
       count(t.member_id) filter (where t.arrival_at is not null
                                    and (t.arrival_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.vn_day::date
                                    and (t.departure_at is null or (t.departure_at at time zone 'Asia/Ho_Chi_Minh')::date >= d.vn_day::date)) as present,
       -- confirmed: both datetimes are filled in and this day falls inside the stay
       count(t.member_id) filter (where t.arrival_at is not null and t.departure_at is not null
                                    and (t.arrival_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.vn_day::date
                                    and (t.departure_at at time zone 'Asia/Ho_Chi_Minh')::date >= d.vn_day::date) as confirmed,
       (d.vn_day::date between date '2026-11-19' and date '2026-11-22') as vikc_days,
       (d.vn_day::date between date '2026-11-23' and date '2026-11-29') as ha_noi_days
from generate_series(date '2026-11-18', date '2026-11-30', interval '1 day') as d(vn_day)
left join public.member_trip t
       on (t.arrival_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.vn_day::date
      and (t.departure_at is null or (t.departure_at at time zone 'Asia/Ho_Chi_Minh')::date >= d.vn_day::date)
group by d.vn_day
order by d.vn_day;

alter table public.members      enable row level security;
alter table public.member_trip  enable row level security;

create policy "roster readable" on public.members
  for select to anon, authenticated using (true);

-- Trust-based editing (decision 1a): the app shows the roster, a member picks their name and fills
-- in their own row. No login, so the anon key may read and write trip rows.
create policy "trip readable" on public.member_trip
  for select to anon, authenticated using (true);
create policy "trip insertable" on public.member_trip
  for insert to anon, authenticated with check (true);
create policy "trip updatable" on public.member_trip
  for update to anon, authenticated using (true) with check (true);
