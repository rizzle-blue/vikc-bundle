-- Before the events model, the trip row also carried the member's exam grade and their team/dojo
-- intentions as booleans. Nothing writes them any more: the exam lives in `exam_entries`, and the
-- team shiai + dojo exchange are real events the member checks in to. Drop them so the member data
-- model is exactly what exists (docs/spec-member-data-model.md).
--
-- Order matters: `v_member_stay` selects those columns, so it goes first.

drop view if exists public.v_member_stay;

alter table public.registrations drop column if exists exam_grade;
alter table public.registrations drop column if exists team3;
alter table public.registrations drop column if exists team5;
alter table public.registrations drop column if exists dojo_exchange;

create view public.v_member_stay with (security_invoker = true) as
select m.id as member_id,
       m.full_name,
       m.expected,
       t.role,
       t.arrival_at,
       t.departure_at,
       t.room_type,
       t.roommate,
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
