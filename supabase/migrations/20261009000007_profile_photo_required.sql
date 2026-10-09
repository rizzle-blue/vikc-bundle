-- VKF's workbook column 16 is "Link ảnh bằng (Ảnh ghi rõ họ tên)" — a photo of the current
-- certificate with the name legible. It was in the table but not counted as required paperwork,
-- and the member form had no field for it. Count it.
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
      + case when nullif(p.current_rank_issued_by, '') is null then 1 else 0 end
      + case when nullif(p.current_rank_photo_url, '') is null then 1 else 0 end) as missing_fields
from public.members m
left join public.member_profiles p on p.member_id = m.id;

grant select on public.v_member_profile to anon, authenticated, service_role;
