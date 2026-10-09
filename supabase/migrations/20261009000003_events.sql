-- Events: the programme the operator sets up, and the member sign-ups ("check to enrol").
--
-- Domain source: resources/vikc-2026/md/01-chuong-trinh-thi-dau.md (programme) plus the owner's
-- answers in docs/spec-events.md. The roster is reference data: nothing is pre-enrolled, so
-- `member_trip` becomes `registrations` and only exists for members who signed up.

-- ---------------------------------------------------------------- roster is reference only
alter table public.members add column if not exists expected boolean not null default false;

-- ------------------------------------------------------- Member trip row -> registration row
alter table public.member_trip rename to registrations;
alter table public.registrations rename constraint member_trip_order to registrations_order;
alter index public.member_trip_arrival_idx   rename to registrations_arrival_idx;
alter index public.member_trip_departure_idx rename to registrations_departure_idx;

-- who this row is for: an athlete, or someone travelling with the delegation
alter table public.registrations add column if not exists role text not null default 'competitor';
alter table public.registrations drop constraint if exists registrations_role_check;
alter table public.registrations add constraint registrations_role_check
  check (role in ('competitor', 'manager', 'family', 'guest'));

comment on table public.registrations is
  'One row per member who signed up (opt-in). Created on sign-up, not pre-seeded from the roster.';

-- ------------------------------------------------------------------------------- events
create table if not exists public.events (
  id            bigint generated always as identity primary key,
  code          text not null unique,
  name_vi       text not null,
  name_en       text,
  kind          text not null check (kind in ('seminar','godo','exam','team_shiai','party','tour','dojo','meeting','ceremony','meal','other')),
  starts_at     timestamptz,
  ends_at       timestamptz,
  venue         text,
  -- joining this event counts towards the VKF package's "một nội dung / 2 nội dung" price
  counts_as_entry      boolean not null default false,
  -- breakfast, competition-day lunch and the welcome party are already in the package
  included_in_package  boolean not null default false,
  -- null = included in the package, or quoted later
  price_vnd     bigint,
  capacity      int,
  signup_opens_at   timestamptz,
  signup_closes_at  timestamptz,
  requires_team boolean not null default false,
  team_size     int,
  team_gender   text check (team_gender in ('Nam', 'Nữ', 'Hỗn hợp')),
  -- extra per-signup fields: [{ "name": "grade", "label": "Kyu/Dan đăng ký thi", "type": "select",
  --   "required": true, "options": ["1 kyu", "1 dan", …] }]
  form_schema   jsonb,
  sort_order    int not null default 0,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists events_sort_idx on public.events (sort_order, starts_at);

-- one row per occurrence: Godo has three, the Hà Nội exchange has one per day (one dojo each)
create table if not exists public.event_sessions (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  title      text,   -- e.g. the dojo name for an exchange session
  venue      text,
  notes      text,
  unique nulls not distinct (event_id, starts_at, title)
);
create index if not exists event_sessions_event_idx on public.event_sessions (event_id, starts_at);

-- the member's check-in. session_id null = the whole event.
create table if not exists public.event_signups (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events(id) on delete cascade,
  session_id bigint references public.event_sessions(id) on delete cascade,
  member_id  text not null references public.members(id) on delete cascade,
  status     text not null default 'confirmed' check (status in ('interested','confirmed','waitlist','cancelled')),
  answers    jsonb not null default '{}'::jsonb,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_signups_unique unique nulls not distinct (event_id, member_id, session_id)
);
create index if not exists event_signups_member_idx on public.event_signups (member_id);

-- ------------------------------------------------------------------------------- views
create or replace view public.v_event_signup_counts with (security_invoker = true) as
select e.id as event_id,
       e.code,
       e.name_vi,
       e.kind,
       e.starts_at,
       e.counts_as_entry,
       e.included_in_package,
       e.price_vnd,
       e.capacity,
       e.sort_order,
       count(s.id) filter (where s.status <> 'cancelled')::int as signups,
       count(s.id) filter (where s.status = 'confirmed')::int  as confirmed
from public.events e
left join public.event_signups s on s.event_id = e.id
where e.active
group by e.id;

create or replace view public.v_member_signups with (security_invoker = true) as
select s.member_id,
       m.full_name,
       s.event_id,
       e.code,
       e.name_vi,
       e.kind,
       e.starts_at,
       s.session_id,
       ss.title  as session_title,
       ss.starts_at as session_starts_at,
       s.status,
       s.answers,
       s.updated_at
from public.event_signups s
join public.members m on m.id = s.member_id
join public.events  e on e.id = s.event_id
left join public.event_sessions ss on ss.id = s.session_id;

-- how many "nội dung" a member entered: drives the 1-vs-2 package price (fee table comes later)
create or replace view public.v_member_entry_count with (security_invoker = true) as
select m.id as member_id,
       m.full_name,
       coalesce((
         select count(*)::int
         from public.event_signups s
         join public.events e on e.id = s.event_id
         where s.member_id = m.id and e.counts_as_entry and s.status <> 'cancelled'
       ), 0) as entries
from public.members m;

-- ------------------------------------------------------------------------------- grants + RLS
alter table public.events         enable row level security;
alter table public.event_sessions enable row level security;
alter table public.event_signups  enable row level security;

grant select on public.events, public.event_sessions to anon, authenticated;
grant select on public.v_event_signup_counts, public.v_member_signups, public.v_member_entry_count to anon, authenticated;
grant select, insert, update, delete on public.events, public.event_sessions to service_role;

-- members check themselves in and out (decision 1a: trust-based, no login)
grant select, insert, update on public.event_signups to anon, authenticated;
grant select, insert, update, delete on public.event_signups to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

drop policy if exists "events readable" on public.events;
create policy "events readable" on public.events
  for select to anon, authenticated using (true);
drop policy if exists "sessions readable" on public.event_sessions;
create policy "sessions readable" on public.event_sessions
  for select to anon, authenticated using (true);

-- NOTE: events and sessions are deliberately NOT writable with the anon key. The operator writes
-- them through the app's server route, which holds the service key (see docs/spec-events.md).
drop policy if exists "signups readable" on public.event_signups;
create policy "signups readable" on public.event_signups
  for select to anon, authenticated using (true);
drop policy if exists "signups insertable" on public.event_signups;
create policy "signups insertable" on public.event_signups
  for insert to anon, authenticated with check (true);
drop policy if exists "signups updatable" on public.event_signups;
create policy "signups updatable" on public.event_signups
  for update to anon, authenticated using (true) with check (true);

-- the operator marks who they expect, via the server route → anon keeps read-only on members
grant select on public.members to anon, authenticated, service_role;
grant update on public.members to service_role;

-- v_member_stay gains the two new facts the board needs: whether the operator expects this member,
-- and the role they travel as.
drop view if exists public.v_member_stay;
create view public.v_member_stay with (security_invoker = true) as
select m.id as member_id,
       m.full_name,
       m.expected,
       t.role,
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
       (t.arrival_at is not null and t.departure_at is not null and t.room_type is not null) as complete,
       coalesce(s.outside_nights, 0)  as outside_nights
from public.members m
left join public.registrations t on t.member_id = m.id
left join (
  select member_id,
         count(*)::int as nights,
         count(*) filter (where tam_chuc_leg)::int as tam_chuc_nights,
         count(*) filter (where ha_noi_leg)::int   as ha_noi_nights,
         count(*) filter (where not tam_chuc_leg and not ha_noi_leg)::int as outside_nights
  from public.v_member_nights
  group by member_id
) s on s.member_id = m.id;

grant select on public.v_member_stay to anon, authenticated, service_role;
