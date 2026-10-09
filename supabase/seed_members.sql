-- GENERATED FILE — do not edit by hand. Source: resources/members.json
-- Regenerate: node scripts/gen-member-seed.mjs
-- Idempotent: safe to run after every migration, and after roster edits.

insert into public.members (id, vkf_id, full_name, gender, date_of_birth, rank, email, phone) values
  ('SKJ-198', '251000156', 'Trương Hứa Dân', 'Nam', '1994-06-02', '4 dan', 'l3un.kun@gmail.com', '0369252359'),
  ('SKJ-201', null, 'Ngô Đình Quốc Tuấn', 'Nam', null, '3 dan', null, null),
  ('SKJ-023', '251000150', 'Nguyễn Trương Hải Huy', 'Nam', '2003-11-18', '2 dan', 'haihuynguyen18112003@gmail.com', '0906986055'),
  ('SKJ-960', '251000158', 'Hoàng Duy', 'Nam', '1999-10-08', '1 dan', 'hoangduyno09@gmail.com', '0769743467'),
  ('SKJ-494', '260600326', 'Tăng Hưng Bình', 'Nam', '1999-04-10', '1 kyu', 'tanghungbinh104@gmail.com', '0988473159'),
  ('SKJ-275', '251000154', 'Ngô Mai Ngọc Hân', 'Nữ', '2002-01-14', '1 dan', 'hanngomaingoc14@gmail.com', '0962273500'),
  ('SKJ-746', '251000143', 'Ngô Quốc Bảo', 'Nam', '1999-01-21', '1 dan', 'pandangoo2101@gmail.com', '0907687015'),
  ('SKJ-930', '251000155', 'Nguyễn Võ Huyền Vi', 'Nữ', '2001-09-30', '1 dan', 'hvinguyen.309@gmail.com', '0703317105'),
  ('SKJ-281', '251000144', 'Phùng Thanh Nhật Uyên', 'Nữ', '1994-03-22', '1 dan', 'ether.sigmata@gmail.com', '0908049049'),
  ('SKJ-826', '251000168', 'Trần Bảo Tín', 'Nam', '1996-01-30', '1 dan', 'tbaotin96@gmail.com', '0338620648'),
  ('SKJ-195', '251000151', 'Trần Lê Vĩnh Huy', 'Nam', '1997-02-12', '1 dan', 'huytranle13@gmail.com', '0961430298'),
  ('SKJ-619', '251000163', 'Nguyễn Đức Khải', 'Nam', null, '1 dan', null, null),
  ('SKJ-785', '251000113', 'Nguyễn Thị Bích Liên', 'Nữ', '1990-02-20', '1 dan', 'nguyenlien2191@gmail.com', '0343871468'),
  ('SKJ-291', '251000149', 'Nguyễn Thị Ngọc Diễm', 'Nữ', null, '1 dan', null, null),
  ('SKJ-108', '251000161', 'Đào Duy Khoa', 'Nam', '1996-12-02', '1 dan', 'khoadduy@gmail.com', '0911569711'),
  ('SKJ-109', '260600321', 'Nguyễn Thị Cẩm Tú', 'Nữ', '1997-05-27', null, 'Nguyen28.w@gmail.com', '0866195026'),
  ('SKJ-088', '260600322', 'Nguyễn Thị Trà My', 'Nữ', '1992-05-01', null, 'huixin2688@gmail.com', '0763265388'),
  ('SKJ-036', '260600325', 'Nguyễn Thuý An', 'Nữ', '2004-12-11', null, 'alice.anthuynguyen@gmail.com', '0985063466'),
  ('SKJ-074', null, 'Nguyễn Ngọc Hân', 'Nữ', '2003-12-14', null, 'nnh14122003@gmail.com', '0903872644'),
  ('SKJ-235', null, 'Hà My Phụng Vỹ', 'Nữ', null, null, null, null),
  ('SKJ-258', null, 'Lê Vy', 'Nữ', null, null, null, null),
  ('SKJ-855', null, 'Phạm Ngọc Thuý', 'Nữ', null, null, null, null)
on conflict (id) do update set
  vkf_id        = excluded.vkf_id,
  full_name     = excluded.full_name,
  gender        = excluded.gender,
  date_of_birth = excluded.date_of_birth,
  rank          = excluded.rank,
  email         = excluded.email,
  phone         = excluded.phone;

-- Nothing is pre-enrolled: the roster is reference data. A registrations row appears only when
-- a member signs up (docs/spec-events.md); the expected flag is the operator's own marker.
