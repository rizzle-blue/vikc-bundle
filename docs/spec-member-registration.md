# SPEC — Member data model & registration form (VIKC exam submission)

Status: **designed with the owner 2026-10-09**, implemented together with this doc.
Sources: `resources/vikc-2026/md/05-thi-kyu-dan-va-mau-dang-ky.md` (exam form + eligibility + fees),
`resources/vikc-2026/md/09-mau-dang-ky-thi-kyu-dan.md` + `resources/vikc-2026/data/09-mau-dang-ky.csv`
(VKF's 48-column registration workbook), `md/06` (payment), `md/01` (programme), `md/02`/`03` (fees).

## What VKF actually requires per person

The club submits **one Excel file** to `vikc@vietnamkendo.com` + `info@kendo.vn` together with every
member's paper exam form (overseas delegations also send passport photos). The workbook asks for:

| Group | Fields |
|---|---|
| Identity | STT · Họ và tên · Giới tính (Nam/Nữ) · Ngày/Tháng/Năm sinh · Số CCCD · Số điện thoại · Email |
| Safety | Thông tin liên hệ trong trường hợp khẩn cấp |
| VKF membership | Thành viên VKF (Có/Không) · Mã số thành viên VKF |
| Current grade | Trình độ hiện tại · **Ngày cấp bằng hiện có** · **Nơi/đơn vị cấp bằng** · **Link ảnh bằng** (photo of the certificate with the name legible) |
| Exam entry | 1 Kyu · Dan |
| Competition | Nội dung · Đăng ký (X) · Tên đội · **Vị trí trận đầu tiên** (e.g. Sempo) |
| Referee duty | 21/11 · 22/11 (only above 5 Dan) |
| Lodging | one column per night 18–23/11 (room type per night; **Sat 21/11 is mandatory for athletes**) · Ở cùng ai |
| Party | Tham dự Tiệc chào mừng |
| Meals | type (breakfast / lunch / dinner) × day 18–23/11 — "lunch on competition days is already in the fee but must still be ticked here" |
| Role | Vai trò (VĐV / Khác) |
| Cost | Chi phí thi · phí thi đấu theo gói · chi phí ở · chi phí ăn · tổng (their formulas) |

The paper form (doc 05) adds: **full name in Latin (BLOCK CAPITALS)**, **full name in Kanji**, quốc
tịch, địa chỉ, nghề nghiệp, tên CLB, **địa chỉ nhận bằng**, dojo/organisation approval, signature.

**Eligibility rules to validate against** (doc 05): 1 Kyu needs a valid 2 Kyu issued by VKF (foreign
candidates exempt); 1 Dan — after passing 1 Kyu, min age 13; 2 Dan — 1 year after 1 Dan, min 14;
3 Dan — 2 years after 2 Dan, min 16; 4 Dan — 3 years after 3 Dan, min 19; 5 Dan — 4 years after
4 Dan, min 23. Special case: a candidate may register 1 Kyu **and** go straight to Shodan on passing.

## What we already had, and the gaps

| Already (roster, preserved) | Missing for VKF |
|---|---|
| `member_id` · `vkr_id` · `full_name` · `gender` · `date_of_birth` · `rank` · `email` · `phone` | Latin/Kanji name, CCCD, nationality, address, occupation, dojo, **emergency contact**, **date + issuer + photo of the current certificate**, certificate mailing address, team position |

The roster stays **reference data** (owner decision): it is never the set of people we expect to
register. A member fills their own paperwork once, and it is reused by every form the club submits.

## Model

```
members                 roster, preserved (member_id, vkf_id, full_name, gender, dob, rank, email, phone)
                        + expected  (operator's own marker)

member_profiles         the personal paperwork, one row per member, member-editable
  member_id PK · full_name_latin (IN HOA, printed on the certificate) · full_name_kanji
  use_kanji_on_certificate · national_id (CCCD/hộ chiếu) · nationality · address · occupation
  dojo_name · emergency_contact (name + phone) · certificate_mailing_address
  current_rank · current_rank_issued_on · current_rank_issued_by · current_rank_photo_url
  updated_at

registrations           the trip (arrival/departure, room type, roommate, role, notes)

exam_entries            one row per member per exam event — the exam submission
  member_id + event_id (unique) · grade_applied · current_rank · current_rank_issued_on
  current_rank_issued_by · dojo_approved · notes · updated_at
  (the rank paperwork is snapshotted so a later profile edit cannot change what was submitted)

event_signups           the generic "I take part" record for every event, incl. competition and the exam
```

Deliberately **not** new tables:

- **Referee duty** (21/11, 22/11) → the operator creates a `referee` event with one session per day.
- **Meals** → `meal` events with one session per day/type (the events model already does this).
- **Hotel per night** → derived from `registrations.arrival_at`/`departure_at` (the member states when
  they arrive and leave; the per-night grid is generated for the VKF export). Room type is one value
  per member, matching VKF's rule "mỗi người một loại phòng thống nhất".
- **Costs** → still later (D10); the inputs (entries, room type, grade, extras) are all present.

### Views

- `v_exam_submission` — one row per exam entry with **every column VKF's workbook expects** (identity,
  emergency contact, VKF flag + number, current grade + issued date/place/photo, grade applied,
  the trip's room and nights, VKF/non-VKF fee bracket). This is what the club's Excel export reads.
- `v_member_profile` — profile + roster + what is still missing, so the operator can see who has not
  completed their paperwork (one row per member, `missing_fields` count).

### Ownership and write rules

Same trust model as the rest of the app (decision 1a, two shared codes):

- `member_profiles` and `exam_entries` — readable by the anon key, writable by it too, because a
  member fills their own paperwork from `/enroll`. The operator can write them through the
  service-key routes.
- `members` stays read-only for the anon key.
- Nothing about validation is enforced by the database beyond key constraints; the app warns
  (e.g. "chưa đủ 2 năm từ 2 Dan") instead of blocking, because VKF is the authority.

## The form (`/enroll`)

Four sections, in the order a member thinks:

1. **Bạn là ai** — pick your name (roster). Identity then comes from the roster.
2. **Lịch đi** — arrival + departure datetime, live nights/days and the Tam Chúc/Hà Nội split.
3. **Hồ sơ cá nhân (VKF yêu cầu)** — latin name (IN HOA), Kanji name + "in tên Kanji trên bằng",
   CCCD/hộ chiếu, quốc tịch, địa chỉ, nghề nghiệp, CLB, liên hệ khẩn cấp, địa chỉ nhận bằng.
4. **Đăng ký nội dung** — the events (competition, exam, seminar/Godo/party, dojo exchange). When the
   exam is ticked it expands into: grade applied, current grade + date issued + issuer + photo link,
   and a "CLB xác nhận" tick.
5. **Phòng & ghi chú** — room type, roommate, notes.

The page shows computed guidance next to the exam section: eligibility warning from the date of the
current certificate (min age and minimum training period), and "you may register 1 Kyu and go
straight to Shodan" for the 1 Kyu case.

## Submission export (next card)

`/admin` gains a "VKF exam workbook (CSV)" export built from `v_exam_submission`, with the VKF column
order, one row per candidate. Meals/referee columns come from the corresponding events once the
operator creates them; hotel columns come from arrival/departure. That export, plus the members'
paper forms, is the club's submission package.
