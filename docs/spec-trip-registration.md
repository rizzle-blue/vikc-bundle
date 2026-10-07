# SPEC — SHAKAIJIN Trip Registration & Cost Estimation (VIKC 2026)

Status: **draft for review** · Owner: Shakaijin Kendo Team · Target: Google Spreadsheet
Motivated by: `Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026`
(`1zCP3RXb8-P0IyofnCuqjpgGZ96mkbIAMSTLNKhuOqjs`)
New file name: `Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026 [refined]`

---

## 1. Goals

A single Google Spreadsheet that lets Shakaijin members:

1. **Enroll** in the delegation trip (whole window: VIKC 19–22/11 + Hà Nội 23–29/11).
2. **Register categories**: dan/kyu exam, team shiai 3, team shiai 5, Hà Nội dojo exchange.
3. **Estimate cost** automatically from VKF official fees + chosen travel-provider options.
4. **Track datetime / agenda**: prep milestones, official programme, Hanoi leg, countdowns.

Non-goals:
- Not connected to `Shakaijin - member and money` (that sheet is internal-only).
- No email automation / Apps Script in v1.
- No payment gateway; payment status is tracked manually.
- No Google Form.

## 2. Personas & permissions

| Role | Can edit | Cannot edit |
|---|---|---|
| Member | `ĐĂNG KÝ`, `HỒ SƠ VKF` (own row), dojo pick | `CẤU HÌNH`, `Provider`, `ĐỘI`, agenda admin cells |
| Admin | everything | — |

Access = **anyone with the link can edit** (per decision). True enforcement is *not* possible with that setting, so:
- Admin-only sheets are visually marked (grey + `🔒 ADMIN` in the title) and documented.
- **Recommended manual step** after delivery: Google Sheets → *Data → Protect sheets and ranges* → restrict `CẤU HÌNH`, `NHÀ CUNG CẤP`, `ĐỘI`, `TỔNG QUAN` to the admin account only. (My tooling cannot set protection; this is a 2-minute manual step I will document in `HƯỚNG DẪN`.)

## 3. Source data

| Data | Source | Handling |
|---|---|---|
| Member roster (id, VKF id, name, gender, DOB, rank, email, phone) | `resources/members.json` | imported verbatim into `THÀNH VIÊN` |
| VKF-required exam fields | user-guide doc 05 | `HỒ SƠ VKF` tab, only for exam candidates |
| VKF fees (package, extra nights, exam) | user-guide docs 02/03/05 | seeded in `CẤU HÌNH`, editable |
| Official programme | user-guide doc 01 | pre-filled in `LỊCH TRÌNH` |
| Deadlines / account / email | user-guide docs 02/05/06 | seeded in `LỊCH TRÌNH` + `HƯỚNG DẪN` |
| Travel provider quotes (flight/bus/hotel/insurance/zekken) | admin-maintained table | `Provider`, segmented by scope |
| Existing registrations | `Kopie von …` (VIKC2026 + GIAOLUU tabs) | carried into `ĐĂNG KÝ` |

Reference facts locked into the sheet:
- Event: **19–22/11/2026**, Vesak International Convention Center, Tam Chúc, Ninh Bình.
- Exam: **Fri 20/11**. Team 3: **Sat 21/11**. Team 5: **Sun 22/11**. Seminar/Godo: **Thu 19/11**.
- Hanoi leg (dojo exchange): **23–29/11/2026**.
- Deadlines: **20/10/2026** (Kyu/Dan + team), **25/10/2026** (payment).
- Bank: VKF BIDV `8680065219`, syntax `Tên đội_1vikc`; email `vikc@vietnamkendo.com`, `info@kendo.vn`.

## 4. Data flow

```
members.json ──import──► THÀNH VIÊN ──lookup──► ĐĂNG KÝ ──► CHI PHÍ ──► TỔNG QUAN
                                   CẤU HÌNH ──fees──┘           ▲
                                 Provider ──matched options──────┘
                                   LỊCH TRÌNH ──agenda/milestones──► TỔNG QUAN (countdown)
HỒ SƠ VKF ──exam details──► ĐĂNG KÝ (flag)     ĐỘI ──team rosters──► TỔNG QUAN
```

## 5. Sheets

10 tabs, in this order:

1. `HƯỚNG DẪN` — how to fill, legend, deadlines, contacts, admin protection note.
2. `THÀNH VIÊN` — roster (read-mostly).
3. `CẤU HÌNH` — 🔒 admin: lists, fee tables, unit costs, dojos, routes.
4. `Provider` — 🔒 admin: provider quote catalogue, **segmented into scopes** (Vé máy bay / Xe / Khách sạn / Bảo hiểm / Zekken).
5. `ĐĂNG KÝ` — member-facing main table.
6. `HỒ SƠ VKF` — VKF exam application details (only for exam candidates).
7. `ĐỘI` — 🔒 admin: team-3 / team-5 rosters.
8. `CHI PHÍ` — per-member cost breakdown + totals.
9. `LỊCH TRÌNH` — milestones + detailed agenda (specific datetimes).
10. `TỔNG QUAN` — 🔒 admin: dashboard.

### 5.1 `THÀNH VIÊN`
| Col | Header | Kind |
|---|---|---|
| A | Mã thành viên | key |
| B | Mã VKF | text |
| C | Họ tên | text |
| D | Giới tính | dropdown Nam/Nữ |
| E | Ngày sinh | date |
| F | Kyu/Dan | dropdown |
| G | Email | text |
| H | SĐT | text |
| I | Thành viên VKF? | `=IF(OR(B2="-",B2=""),"Không","Có")` |
| J | Ghi chú | text |

### 5.2 `CẤU HÌNH` (blocks, exact addresses frozen in the builder)
- **Lists**: Trạng thái, Giới tính, Loại phòng, Bậc Kyu/Dan, Bậc thi, Võ đường, Mã đội, Tuyến.
- **VKF package** (room × 1–2 nội dung): Đôi 1.550/1.850k, Ba 1.450/1.750k, Đơn 1.900/2.200k.
- **Non-VKF package**: Đôi 1.950/2.350k, Ba 1.850/2.250k, Đơn 2.400/2.800k.
- **Extra night / non-competitor**: VKF Đôi 350k, Ba 250k, Đơn 700k; non-VKF 450/350/900k; lunch 120k, dinner 200k, party 700k.
- **Exam fee**: 1 kyu 1.000/2.000k; 1 dan 1.500/2.500k; 2 dan 2.200/4.200k; 3 dan 3.000/5.000k; 4 dan 4.500/6.500k; 5 dan 6.000/8.000k (VKF/non-VKF).
- **Unit costs** (editable): airport transfer, Hanoi hotel/night, Hanoi meals/day, Hanoi transport/day, zekken, insurance, contingency.
- Note: certificate fee = 30% of exam fee (informational).

### 5.2b `Provider` (provider catalogue, segmented by scope)
One sheet, physically separated into scope blocks, so children sheets can query either the whole
catalogue or a single scope, and dropdowns can be built per scope:

| Scope | Code prefix | Seed |
|---|---|---|
| Vé máy bay | `FL-###` | quote slots |
| Xe / di chuyển | `BUS-###` | 16/29/35/45-seat bus, taxi (from user guide) |
| Khách sạn Hà Nội | `HTL-###` | Hà Nội leg only (23–29/11) |

> **Tam Chúc lodging is VKF-managed**, not a provider: it is driven by `ĐĂNG KÝ.Loại phòng`
> plus the package / extra-night rates in `CẤU HÌNH`.
>
> **Bảo hiểm and Zekken were dropped** (no real source yet).

Per-option columns: `Mã | Scope | Nhà cung cấp | Liên hệ | SĐT | Email | Tuyến/Chặng | Chiều | Hãng/ĐV | Ngày giờ | Điểm đi | Điểm đến | Điều kiện | Đơn giá/người | Phí DV | Tổng/người | Hiệu lực đến | Trạng thái | Ghi chú`.
Members never free-type a price; they pick a `Mã` (or a filtered dropdown of the relevant scope).
`CHI PHÍ` resolves the picked `Mã` back to `Tổng/người`. Stable codes + fixed scope ranges make both
uses valid: **selection** (`ĐĂNG KÝ`) and **tracking** (`CHI PHÍ`, `TỔNG QUAN`).

### 5.4 `ĐĂNG KÝ` (main)
Row 2 = header, data from row 3. Pre-filled with all members.
Columns: `Mã TV` (dropdown) → auto `Họ tên`, `Kyu/Dan`, `VKF?`; `Trạng thái`; `Tham gia?`;
**datetime** `Ngày giờ đến (dự kiến)` / `Ngày giờ về (dự kiến)` (specific datetime, per person);
auto `Số ngày`, `Số đêm NB`, `Số đêm HN` derived from the datetimes; `Thi Dan?`; `Seminar?`;
`Godo Keiko?`; `Team-3`; `Team-5`; `Giao lưu HN`; dojo picks (multi-select); `Mã đội`;
`Loại phòng`; `Bạn cùng phòng`; `Điểm đi`; provider picks `Mã vé MB`, `Mã xe`, `Mã KS Hà Nội`;
`Gợi ý NCC (auto)`; auto `Chi phí dự kiến`; `Đã thanh toán`; auto `Còn lại`; `Ghi chú`.
Boolean cells use `TRUE/FALSE` (convert to checkboxes in Sheets with one click; formulas keep working).
Transport is chosen **per person** (not club-booked).

### 5.5 `HỒ SƠ VKF`
Members with `Thi Dan?` ≠ empty fill: Họ tên Latin (IN HOA), Tên Kanji, CCCD/Hộ chiếu, Quốc tịch, Địa chỉ, Nghề nghiệp, Tên CLB, Nơi cấp bằng, Ngày cấp, Địa chỉ nhận bằng, Xác nhận CLB. Auto from `THÀNH VIÊN`: Họ tên, Ngày sinh, Giới tính, SĐT, Email, Trình độ hiện tại. Auto from `ĐĂNG KÝ`: Kyu/Dan đăng ký thi.

### 5.6 `ĐỘI`
`Đội 3 người`: Mã đội | Tên đội | Giới tính | TV1 | TV2 | TV3 | Tổng Kyu/Dan | Ghi chú.
`Đội 5 người`: same with TV1…TV5.

### 5.7 `CHI PHÍ`
Per member (aligned to `ĐĂNG KÝ` row numbers):
`Gói VKF | Lệ phí thi | Đêm thêm NB | Vé MB | Di chuyển sân bay | KS HN | Ăn HN | Đi lại HN | Zekken | Bảo hiểm | Khác | Tổng | Đã TT | Còn lại`, plus a totals + by-component summary block.

Cost rules:
- Package = 0 if 0 competition events; else `room × events(1|2)` by member VKF flag.
- Exam fee = 0 unless `Thi Dan?` set; lookup by grade × VKF flag.
- Extra NB nights = `MAX(0, nights at Tam Chúc − 1)` × room extra-night rate, where nights are derived from the arrival/departure datetimes.
- Flight/bus = chosen `Provider` `Tổng/người` if `Tham gia?`; else 0.
- HN hotel = nights in Hà Nội (derived) × (picked `HTL` rate, else `CẤU HÌNH` fallback rate); meals & local transport = days in Hà Nội × rate.
- No zekken / insurance line items (dropped in v1).

### 5.8 `LỊCH TRÌNH`
- **Milestones**: hạn đăng ký 20/10, hạn thanh toán 25/10, chốt danh sách, khởi hành, VIKC, Hà Nội leg, về — each with status, PIC, countdown `=ngày − TODAY()`.
- **Agenda**: pre-filled official programme 19–22/11 + Hanoi 23–29/11 skeleton; columns Ngày | Thứ | Từ (giờ) | Đến (giờ) | Hoạt động | Địa điểm | PIC | Ghi chú — **specific datetimes**, not just dates.

### 5.9 `TỔNG QUAN`
KPIs: tổng thành viên, đã đăng ký, đã xác nhận, tham gia trip; đếm theo hạng mục (dan exam, team-3, team-5, seminar, giao lưu); quân số theo từng ngày 19–29/11; chi phí (tổng dự kiến, đã thu, còn lại, bình quân/người, tổng theo khoản).

## 6. Interaction flows

**Enroll**: pick `Mã TV` → auto identity → set `Trạng thái` → tick trip + days → pick categories → pick room + provider options → see `Chi phí dự kiến` → pay → enter `Đã thanh toán`.
**Exam**: set `Thi Dan?` → row appears/fills `HỒ SƠ VKF` → member completes VKF fields → admin confirms.
**Team**: tick `Team-3`/`Team-5` → admin assigns in `ĐỘI` → `Mã đội` auto-links.
**Provider matching**: `Điểm đi` + `Loại DV` + `Ngày` → offer matching `NHÀ CUNG CẤP` codes → if one match auto-fill, if many a filtered dropdown; price flows to `CHI PHÍ`.

## 7. Validation & integrity

- Dropdowns everywhere a fixed set exists; free text only for names/addresses/notes.
- Duplicate `Mã TV` in `ĐĂNG KÝ` flagged by conditional format.
- `Thi Dan?` grade must be ≥ current rank consistent (soft warning via conditional format).
- Cost cells numeric with `#,##0` (VND); dates `dd/mm/yyyy`.
- Frozen header rows; grey = auto, yellow = member input, blue = admin input, red = warning.
- Carried-over data: statuses/dan/team from `VIKC2026`, Hanoi days from `GIAOLUU`.

## 8. Phases (implement one by one)

| Phase | Scope | Deliverable / acceptance |
|---|---|---|
| 0 | **Spec** (this doc) + decisions locked | you approve; open questions in §9 closed |
| 1 | Workbook skeleton + `THÀNH VIỆN` + `CẤU HÌNH` + `HƯỚNG DẪN` | 10 tabs exist; roster = members.json; dropdowns + fee tables present |
| 2 | `ĐĂNG KÝ` core (identity lookup, status, trip flag, 11-day attendance, counts) + carry-over | rows for all members; auto columns correct |
| 3 | Categories & admin: `Thi Dan?`, seminar/godo, team-3/5 intent, dojo multi-pick, `HỒ SƠ VKF`, `ĐỘI` | exam candidates captured; teams assignable |
| 4 | `NHÀ CUNG CẤP` catalogue + matching/pick flow | picking a code fills price |
| 5 | `CHI PHÍ` engine + totals | totals match hand-checked sample |
| 6 | `LỊCH TRÌNH` (milestones + agenda + countdown) | official programme pre-filled |
| 7 | `TỔNG QUAN` dashboard | counts/totals reconcile with source tabs |
| 8 | Polish: conditional formats, protection guidance, bilingual notes | review pass |
| 9 | Delivery: build `.xlsx` → review → upload+convert to Google Sheet in **My Drive** | link live; old sheet untouched |

Each phase: build → verify → show you → proceed. Any phase can be re-opened.

## 9. Open questions (blocking Phase 1–4 details)

Resolved:
1. Soft separation (mark admin tabs, document the manual *Protect ranges* step). ✅
2. `Provider` = one tab, scope blocks, stable typed codes for selection + tracking. ✅
3. Each person picks their own transport. ✅
4. Dojo pick = multi-select. ✅
5. **Specific datetime** via the Sheets date-time UI (date picker + time entry), nights derived from datetimes. ✅
6. `HỒ SƠ VKF` = separate tab. ✅
7. Name = `Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026 [refined]`. ✅
8. **Bảo hiểm (INS) dropped**, **Zekken (ZEK) dropped**. ✅
9. `Provider` scope `Khách sạn` = **Khách sạn Hà Nội** only; Tam Chúc lodging is VKF-driven. ✅

Open:
- **Q3** — Hà Nội lodging: free pick from `HTL`, or arranged/fixed?
- **Q4** — confirm VKF package includes **1 night (Sat 21/11)**; all other Tam Chúc nights at VKF extra-night rates.
- **Q5** — fallback when no `HTL` picked: use CẤU HÌNH "Khách sạn Hà Nội" unit rate (proposed) or require a pick.

## 10. Risks

- Provider prices change → keep `CẤU HÌNH`/`NHÀ CUNG CẤP` editable and date-stamped.
- Google Sheets import may turn `TRUE/FALSE` dropdowns into plain values → one-click checkbox conversion documented.
- Anonymous-link editing cannot be truly locked → protection step documented.
- My tooling has no "create spreadsheet" call; delivery uses xlsx→Google Sheet conversion (needs write mode enabled) — otherwise I hand you the `.xlsx`.
