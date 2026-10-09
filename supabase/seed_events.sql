-- The VIKC 2026 programme as operator-editable events, from resources/vikc-2026/md/01.
-- Idempotent and non-destructive: re-running never overwrites edits the operator made
-- (on conflict do nothing), so this is a starting point, not a lock.

insert into public.events
  (code, name_vi, name_en, kind, starts_at, ends_at, venue, counts_as_entry, included_in_package,
   price_vnd, requires_team, team_size, team_gender, form_schema, sort_order, notes)
values
  ('seminar', 'Kendo Seminar — Hamasaki Mitsuru Sensei, 8-dan Hanshi', 'Kendo Seminar',
   'seminar', timestamptz '2026-11-19 15:00:00+07', timestamptz '2026-11-19 17:00:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', false, true, null, false, null, null, null, 10,
   'Seminar diễn ra trước, sau đó là Godo Keiko cùng ngày.'),

  ('godo', 'Godo Keiko', 'Godo Keiko',
   'godo', timestamptz '2026-11-19 17:00:00+07', timestamptz '2026-11-22 18:30:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', false, true, null, false, null, null, null, 20,
   'Ba buổi: tối 19/11, 21/11 và 22/11 (xem các buổi).'),

  ('exam', 'Kỳ thi Kyu/Dan', 'Kyu/Dan examination',
   'exam', timestamptz '2026-11-20 08:00:00+07', timestamptz '2026-11-20 17:00:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', false, false, null, false, null, null,
   '[{"name":"grade","label":"Kyu/Dan đăng ký thi","type":"select","required":true,"options":["1 kyu","1 dan","2 dan","3 dan","4 dan","5 dan"]},
     {"name":"kanji_name","label":"Họ tên chữ Hán (để in bằng)","type":"text","required":false},
     {"name":"certificate_kanji","label":"Bằng có in tên Kanji?","type":"boolean","required":false}]',
   30, 'Check-in 7:00, thi 8:00–17:00. Lệ phí theo cấp đẳng (bảng phí riêng). Thí sinh 1 Kyu có thể thi tiếp Shodan.'),

  ('team3-nu', 'Đồng đội Nữ 3 người', 'Women''s team of 3',
   'team_shiai', timestamptz '2026-11-21 08:00:00+07', timestamptz '2026-11-21 17:00:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', true, true, null, true, 3, 'Nữ', null, 40, null),
  ('team3-nam', 'Đồng đội Nam 3 người', 'Men''s team of 3',
   'team_shiai', timestamptz '2026-11-21 08:00:00+07', timestamptz '2026-11-21 17:00:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', true, true, null, true, 3, 'Nam', null, 41, null),
  ('team5-nu', 'Đồng đội Nữ 5 người', 'Women''s team of 5',
   'team_shiai', timestamptz '2026-11-22 08:30:00+07', timestamptz '2026-11-22 17:30:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', true, true, null, true, 5, 'Nữ', null, 50, null),
  ('team5-nam', 'Đồng đội Nam 5 người', 'Men''s team of 5',
   'team_shiai', timestamptz '2026-11-22 08:30:00+07', timestamptz '2026-11-22 17:30:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', true, true, null, true, 5, 'Nam', null, 51, null),

  ('party', 'Tiệc chào mừng', 'Welcome party',
   'party', timestamptz '2026-11-21 19:30:00+07', timestamptz '2026-11-21 22:00:00+07',
   'Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc', false, true, 700000, false, null, null, null, 60,
   'Đã bao gồm trong gói của vận động viên; người không thi đấu: 700.000đ.'),

  ('dojo-hn', 'Giao lưu võ đường Hà Nội', 'Hà Nội dojo exchange',
   'dojo', timestamptz '2026-11-23 00:00:00+07', timestamptz '2026-11-29 23:59:00+07',
   'Hà Nội', false, false, null, false, null, null, null, 70,
   'Mỗi ngày một võ đường (Yushinkai, Thăng Long, Hà Nội Kendo Club, Yuei, Đông Á…). Ban tổ chức thêm từng buổi.')
on conflict (code) do nothing;

-- sessions: the three Godo Keiko slots and nothing else until the operator configures the exchange
insert into public.event_sessions (event_id, starts_at, ends_at, title, venue)
select e.id, s.starts_at, s.ends_at, s.title, s.venue
from public.events e
join (values
  ('godo', timestamptz '2026-11-19 17:00:00+07', timestamptz '2026-11-19 18:00:00+07', 'Godo Keiko — ngày 1', 'Tam Chúc'),
  ('godo', timestamptz '2026-11-21 17:00:00+07', timestamptz '2026-11-21 18:00:00+07', 'Godo Keiko — ngày 2', 'Tam Chúc'),
  ('godo', timestamptz '2026-11-22 17:30:00+07', timestamptz '2026-11-22 18:30:00+07', 'Godo Keiko — ngày 3', 'Tam Chúc')
) as s(code, starts_at, ends_at, title, venue) on s.code = e.code
on conflict (event_id, starts_at, title) do nothing;
