-- v_member_stay did not expose the nights that fall outside both legs (the "something is wrong with
-- this stay" signal the admin board wants). Recreate the view with `outside_nights` appended.
-- Nothing depends on the view, so a drop + create keeps the column list unambiguous.

drop view if exists public.v_member_stay;

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
       (t.arrival_at is not null and t.departure_at is not null and t.room_type is not null) as complete,
       coalesce(s.outside_nights, 0)  as outside_nights
from public.members m
left join public.member_trip t on t.member_id = m.id
left join (
  select member_id,
         count(*)::int as nights,
         count(*) filter (where tam_chuc_leg)::int as tam_chuc_nights,
         count(*) filter (where ha_noi_leg)::int   as ha_noi_nights,
         count(*) filter (where not tam_chuc_leg and not ha_noi_leg)::int as outside_nights
  from public.v_member_nights
  group by member_id
) s on s.member_id = m.id;

-- grants do not survive a drop
grant select on public.v_member_stay to anon, authenticated, service_role;
