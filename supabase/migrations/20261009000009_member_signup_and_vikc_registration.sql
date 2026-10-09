-- Two scopes only (owner, 2026-10-09):
--   1. Member sign-up   — basic info + the personal data VKF requires, filled by the member.
--   2. VIKC registration — that information pre-filled from the members, for the club's submission.
--
-- The roster stays the club's own record (`members`, read-only for the browser key). What the member
-- *declares* lives in `member_profiles`, and every registration view resolves
-- `coalesce(declared, roster)` — so a member confirms or corrects their own details without touching
-- the club's record, and nothing has to be retyped by the operator.

alter table public.member_profiles
  add column if not exists full_name_vi   text,
  add column if not exists gender         text,
  add column if not exists date_of_birth  date,
  add column if not exists phone          text,
  add column if not exists email          text,
  add column if not exists declared_vkf_member boolean,   -- the member's answer (Có/Không)
  add column if not exists declared_vkf_id     text;      -- their VKF number, if they have it

do $$ begin
  alter table public.member_profiles
    add constraint member_profiles_gender_check check (gender in ('Nam', 'Nữ'));
exception when duplicate_object then null; end $$;

-- The personal record with basic info resolved against the roster, plus what is still missing.
-- Dropped first: the column list changes (rank -> the member's declared values).
drop view if exists public.v_member_profile;
drop view if exists public.v_vikc_registration;

create view public.v_member_profile with (security_invoker = true) as
select m.id as member_id,
       coalesce(nullif(p.full_name_vi, ''), m.full_name) as full_name,
       coalesce(p.gender, m.gender)                      as gender,
       coalesce(p.date_of_birth, m.date_of_birth)        as date_of_birth,
       coalesce(nullif(p.phone, ''), m.phone)            as phone,
       coalesce(nullif(p.email, ''), m.email)            as email,
       coalesce(p.declared_vkf_member, m.vkf_id is not null) as vkf_member,
       coalesce(nullif(p.declared_vkf_id, ''), m.vkf_id) as vkf_id,
       coalesce(p.current_rank, m.rank)                  as current_rank,
       m.rank as roster_rank,
       m.expected,
       p.full_name_latin,
       p.full_name_kanji,
       p.use_kanji_on_certificate,
       p.national_id,
       p.nationality,
       p.address,
       p.occupation,
       p.dojo_name,
       p.emergency_contact,
       p.certificate_mailing_address,
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
      + case when nullif(p.current_rank_issued_by, '') is null then 1 else 0 end
      + case when nullif(p.current_rank_photo_url, '') is null then 1 else 0 end) as missing_fields
from public.members m
left join public.member_profiles p on p.member_id = m.id;

-- Scope 2: one row per member who has signed up, with every column VKF's workbook wants,
-- pre-filled from their own entry and falling back to the club's roster.
create view public.v_vikc_registration with (security_invoker = true) as
select mp.member_id,
       -- identity
       coalesce(nullif(mp.full_name_vi, ''), m.full_name) as full_name,
       coalesce(mp.full_name_latin, upper(m.full_name))   as full_name_latin,
       case when mp.use_kanji_on_certificate then mp.full_name_kanji end as full_name_kanji,
       coalesce(mp.gender, m.gender)                      as gender,
       coalesce(mp.date_of_birth, m.date_of_birth)        as date_of_birth,
       coalesce(nullif(mp.phone, ''), m.phone)            as phone,
       coalesce(nullif(mp.email, ''), m.email)            as email,
       -- safety + VKF membership
       mp.emergency_contact,
       coalesce(mp.declared_vkf_member, m.vkf_id is not null) as vkf_member,
       coalesce(nullif(mp.declared_vkf_id, ''), m.vkf_id)     as vkf_id,
       -- personal data VKF asks for
       mp.national_id, coalesce(mp.nationality, 'Việt Nam') as nationality, mp.address, mp.occupation,
       coalesce(mp.dojo_name, 'Shakaijin') as dojo_name, mp.certificate_mailing_address,
       -- current grade + its certificate
       coalesce(mp.current_rank, m.rank) as current_rank,
       mp.current_rank_issued_on, mp.current_rank_issued_by, mp.current_rank_photo_url,
       -- what they entered for the exam (null when they are not sitting it)
       ee.grade_applied, ee.also_shodan, ee.dojo_approved,
       -- the trip they booked
       r.role, r.arrival_at, r.departure_at, r.room_type, r.roommate,
       coalesce(n.nights, 0) as nights,
       coalesce(n.tam_chuc_nights, 0) as tam_chuc_nights,
       coalesce(n.ha_noi_nights, 0)   as ha_noi_nights,
       -- how many competition entries -> the VKF package price column
       coalesce(entries.entries, 0) as entries,
       -- readiness for the submission
       (case when nullif(mp.full_name_latin, '') is null then 1 else 0 end
      + case when nullif(mp.national_id, '') is null then 1 else 0 end
      + case when nullif(mp.address, '') is null then 1 else 0 end
      + case when nullif(mp.occupation, '') is null then 1 else 0 end
      + case when nullif(mp.emergency_contact, '') is null then 1 else 0 end
      + case when mp.current_rank_issued_on is null then 1 else 0 end
      + case when nullif(mp.current_rank_issued_by, '') is null then 1 else 0 end
      + case when nullif(mp.current_rank_photo_url, '') is null then 1 else 0 end) as missing_fields,
       greatest(mp.updated_at, r.updated_at) as updated_at
from public.member_profiles mp
join public.members m on m.id = mp.member_id
left join public.registrations r on r.member_id = mp.member_id
left join public.exam_entries ee on ee.member_id = mp.member_id and not ee.withdrawn
left join (
  select member_id, count(*)::int as nights,
         count(*) filter (where tam_chuc_leg)::int as tam_chuc_nights,
         count(*) filter (where ha_noi_leg)::int   as ha_noi_nights
  from public.v_member_nights group by member_id
) n on n.member_id = mp.member_id
left join public.v_member_entry_count entries on entries.member_id = mp.member_id;

grant select on public.v_member_profile, public.v_vikc_registration to anon, authenticated, service_role;
