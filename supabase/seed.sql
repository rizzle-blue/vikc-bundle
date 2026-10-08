-- Mirrors packages/flight-crawler/src/searches.ts.
insert into public.flight_searches (origin, destination, depart_date, return_date, label) values
  ('SGN', 'HAN', '2026-11-18', null,         'Đi Hà Nội 18/11'),
  ('SGN', 'HAN', '2026-11-19', null,         'Đi Hà Nội 19/11'),
  ('HAN', 'SGN', '2026-11-22', null,         'Về SGN 22/11 (sau VIKC)'),
  ('HAN', 'SGN', '2026-11-29', null,         'Về SGN 29/11 (sau giao lưu HN)'),
  ('SGN', 'HAN', '2026-11-18', '2026-11-22', 'Khứ hồi 18–22/11'),
  ('SGN', 'HAN', '2026-11-18', '2026-11-29', 'Khứ hồi 18–29/11')
on conflict do nothing;
