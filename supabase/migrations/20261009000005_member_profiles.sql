-- Member paperwork + the exam submission.
--
-- VKF's registration workbook (resources/vikc-2026/data/09) asks for data the roster does not carry:
-- Latin/Kanji name for the certificate, CCCD, nationality, address, occupation, dojo, emergency
-- contact, mailing address, and the *current grade's* date, issuer and photo. The roster stays
-- reference data; a member fills their own paperwork once and it is reused by every submitted form.
--
-- Design: docs/spec-member-registration.md.

create table if not exists public.member_profiles (
  member_id                    text primary key references public.members(id) on delete cascade,
  -- as printed on the certificate
  full_name_latin              text,
  full_name_kanji              text,
  use_kanji_on_certificate     boolean not null default false,
  -- identity / contact
  national_id                  text,        -- CCCD or passport number
  nationality                  text,        -- 'Việt Nam' by default in the UI
  address                      text,        -- địa chỉ thường trú (also the emergency contact's address context)
  occupation                   text,
  dojo_name                    text,        -- CLB / đơn vị
  emergency_contact            text,        -- name + phone, as VKF asks
  certificate_mailing_address  text,        -- địa chỉ nhận bằng
  -- the current grade's paperwork
  current_rank                 text,
  current_rank_issued_on       date,
  current_rank_issued_by       text,
  current_rank_photo_url       text,        -- ảnh bằng (ghi rõ họ tên)
  updated_at                   timestamptz not null default now()
);

-- One row per candidate per exam event. The grade paperwork is snapshotted: editing the profile
-- later must not silently change what was submitted to VKF.
create table if not exists public.exam_entries (
  id                      bigint generated always as identity primary key,
  member_id               text not null references public.members(id) on delete cascade,
  event_id                bigint not null references public.events(id) on delete cascade,
  grade_applied           text not null check (grade_applied in ('1 kyu','1 dan','2 dan','3 dan','4 dan','5 dan')),
  -- 1 Kyu candidates may go straight to Shodan upon passing (doc 05)
  also_shodan             boolean not null default false,
  current_rank            text,
  current_rank_issued_on  date,
  current_rank_issued_by  text,
  dojo_approved           boolean not null default false,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint exam_entries_unique unique (member_id, event_id)
);
create index if not exists exam_entries_event_idx on public.exam_entries (event_id);

-- Everything VKF's workbook wants about a candidate, in one row per exam entry.
create or replace view public.v_exam_submission with (security_invoker = true) as
select e.id                        as exam_entry_id,
       m.id                        as member_id,
       m.full_name                 as full_name_roster,
       coalesce(p.full_name_latin, upper(m.full_name)) as full_name_latin,
       case when p.use_kanji_on_certificate then p.full_name_kanji end as full_name_kanji,
       m.gender,
       m.date_of_birth,
       m.email,
       m.phone,
       p.national_id,
       coalesce(p.nationality, 'Việt Nam') as nationality,
       p.address,
       p.occupation,
       coalesce(p.dojo_name, 'Shakaijin') as dojo_name,
       p.emergency_contact,
       p.certificate_mailing_address,
       (m.vkf_id is not null)      as vkf_member,
       m.vkf_id                    as vkf_member_id,
       coalesce(e.current_rank, p.current_rank, m.rank) as current_rank,
       coalesce(e.current_rank_issued_on, p.current_rank_issued_on) as current_rank_issued_on,
       coalesce(e.current_rank_issued_by, p.current_rank_issued_by) as current_rank_issued_by,
       p.current_rank_photo_url,
       e.grade_applied,
       e.also_shodan,
       e.dojo_approved,
       ev.id                       as event_id,
       ev.code                     as event_code,
       ev.starts_at                as exam_at,
       r.role,
       r.arrival_at,
       r.departure_at,
       r.room_type,
       r.roommate,
       -- nights from the arrival/departure the member entered (VN calendar, night = check-in day)
       coalesce(n.nights, 0)       as nights,
       coalesce(n.tam_chuc_nights, 0) as tam_chuc_nights,
       coalesce(n.ha_noi_nights, 0)   as ha_noi_nights,
       -- VKF fee bracket: members pay the lower exam fee
       (m.vkf_id is not null)      as vkf_fee_bracket,
       e.updated_at
from public.exam_entries e
join public.members m  on m.id = e.member_id
join public.events  ev on ev.id = e.event_id
left join public.member_profiles p on p.member_id = m.id
left join public.registrations  r on r.member_id = m.id
left join (
  select member_id,
         count(*)::int as nights,
         count(*) filter (where tam_chuc_leg)::int as tam_chuc_nights,
         count(*) filter (where ha_noi_leg)::int   as ha_noi_nights
  from public.v_member_nights group by member_id
) n on n.member_id = m.id;

-- Profile completeness, so the operator can chase the people who have not filled it in.
create or replace view public.v_member_profile with (security_invoker = true) as
select m.id as member_id,
       m.full_name,
       m.rank,
       m.expected,
       p.full_name_latin,
       p.full_name_kanji,
       p.national_id,
       p.address,
       p.occupation,
       p.dojo_name,
       p.emergency_contact,
       p.certificate_mailing_address,
       coalesce(p.current_rank, m.rank) as current_rank,
       p.current_rank_issued_on,
       p.current_rank_issued_by,
       p.current_rank_photo_url,
       p.updated_at,
       (case when nullif(p.full_name_latin, '') is null then 1 else 0 end
      + case when nullif(p.national_id, '') is null then 1 else 0 end
      + case when nullif(p.address, '') is null then 1 else 0 end
      + case when nullif(p.occupation, '') is null then 1 else 0 end
      + case when nullif(p.emergency_contact, '') is null then 1 else 0 end
      + case when p.current_rank_issued_on is null then 1 else 0 end
      + case when nullif(p.current_rank_issued_by, '') is null then 1 else 0 end) as missing_fields
from public.members m
left join public.member_profiles p on p.member_id = m.id;

-- ------------------------------------------------------------------ grants + RLS
alter table public.member_profiles enable row level security;
alter table public.exam_entries   enable row level security;

grant select, insert, update on public.member_profiles to anon, authenticated;
grant select, insert, update, delete on public.member_profiles to service_role;
grant select, insert, update on public.exam_entries to anon, authenticated;
grant select, insert, update, delete on public.exam_entries to service_role;
grant select on public.v_exam_submission, public.v_member_profile to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- a member fills their own paperwork from /enroll (decision 1a: shared member code, no accounts)
drop policy if exists "profiles readable" on public.member_profiles;
create policy "profiles readable" on public.member_profiles for select to anon, authenticated using (true);
drop policy if exists "profiles insertable" on public.member_profiles;
create policy "profiles insertable" on public.member_profiles for insert to anon, authenticated with check (true);
drop policy if exists "profiles updatable" on public.member_profiles;
create policy "profiles updatable" on public.member_profiles for update to anon, authenticated using (true) with check (true);

drop policy if exists "exam entries readable" on public.exam_entries;
create policy "exam entries readable" on public.exam_entries for select to anon, authenticated using (true);
drop policy if exists "exam entries insertable" on public.exam_entries;
create policy "exam entries insertable" on public.exam_entries for insert to anon, authenticated with check (true);
drop policy if exists "exam entries updatable" on public.exam_entries;
create policy "exam entries updatable" on public.exam_entries for update to anon, authenticated using (true) with check (true);
