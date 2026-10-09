-- A member may un-tick the exam on /enroll, but the anon key has no DELETE on exam_entries (same
-- reasoning as event_signups): the row is a record of what was submitted. Withdrawing sets a flag
-- and the submission view ignores it, so the audit trail survives.
alter table public.exam_entries add column if not exists withdrawn boolean not null default false;

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
       coalesce(n.nights, 0)       as nights,
       coalesce(n.tam_chuc_nights, 0) as tam_chuc_nights,
       coalesce(n.ha_noi_nights, 0)   as ha_noi_nights,
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
) n on n.member_id = m.id
where not e.withdrawn;

grant select on public.v_exam_submission to anon, authenticated, service_role;
