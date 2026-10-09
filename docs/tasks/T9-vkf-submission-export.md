# T9 — VKF submission workbook (CSV)

**Read first:** [`docs/spec-member-registration.md`](../spec-member-registration.md) §Submission export,
[`status.md`](../status.md). The data is already collected; this is the export the club sends VKF.
**Status:** ⏳ next.

## Goal

One export from `/admin` that reproduces **VKF's own workbook columns**
(`resources/vikc-2026/data/09-mau-dang-ky.csv`, 48 columns) for the candidates, so the club can paste
it into VKF's Excel template instead of retyping 20 rows. Sent to `vikc@vietnamkendo.com` +
`info@kendo.vn` together with the members' paper forms, before **20/10/2026**.

## Steps

1. Export route `GET /api/admin/export?kind=vkf` reading `v_exam_submission` (already carries
   identity, emergency contact, VKF flag + number, grade + date/issuer/photo, grade applied, trip
   room/nights, fee bracket).
2. Column order = VKF's: STT · Họ và tên · Giới tính · Ngày/Tháng/Năm sinh · Số CCCD · SĐT · Email ·
   liên hệ khẩn cấp · Thành viên VKF · Mã VKF · trình độ hiện tại · ngày cấp · nơi cấp · link ảnh
   bằng · 1 Kyu · Dan · nội dung · đăng ký · tên đội · vị trí trận đầu · (referee days) · hotel
   nights 18–23/11 · ở cùng ai · tiệc · meals by type × day · vai trò · chi phí.
   - Hotel nights come from `arrival_at`/`departure_at` (one row per night the member is there).
   - Meals/referee columns fill from the corresponding events once the operator creates them.
   - Competition "nội dung" comes from the team-shiai sign-ups (with the event's name).
3. A second, wider export for our own use: one row per member × event × session (`?kind=signups`
   already does this).
4. Warn on the page when a candidate is missing required paperwork (`v_member_profile.missing_fields`)
   or sits below VKF's eligibility line — VKF rejects incomplete dossiers.
5. Note the export path in `README.md` and the received-date/payment deadline in the operator page.

## Done when

The CSV pastes into VKF's template without manual reordering, every exam entry carries the eight
required paperwork fields, and the operator page flags the incomplete ones.
