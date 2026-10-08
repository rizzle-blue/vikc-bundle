# STATUS — [refined] VIKC 2026 Trip Registration spreadsheet

Spec: [`spec-trip-registration.md`](spec-trip-registration.md)
Last updated: Phase 4 complete · Next: Phase 5 (cost engine)

## Artifacts

| Path | What |
|---|---|
| `tools/build_trip_registration.py` | generator (phased; single source of truth for the workbook) |
| `deliverables/VIKC2026-trip-registration-refined.xlsx` | built workbook (10 tabs, Phases 1–4) |
| `resources/reference/Kopie-von-SHAKAIJIN-NinhBinh-HaNoi-2026.xlsx` | v1 sheet (motivation), used only by `--carryover` |
| `resources/VIKC2026-SHAKAIJIN-NinhBinh-HaNoi-2026.xlsx` | Drive sheet retrieved into the project |
| `docs/spec-trip-registration.md` | spec |
| `docs/status-trip-registration.md` | this file |

Regenerate:
```bash
.venv/bin/python tools/build_trip_registration.py
.venv/bin/python tools/build_trip_registration.py --carryover   # seed v1 data (off by default)
```

## Phase progress

| Phase | Scope | Status |
|---|---|---|
| 0 | Spec + decisions | ✅ |
| 1 | Skeleton + `HƯỚNG DẪN` + `THÀNH VIÊN` + `CẤU HÌNH` | ✅ |
| 2 | `ĐĂNG KÝ` core (identity, status, trip, datetime, nights/days) | ✅ |
| 3 | `ĐĂNG KÝ` categories + `HỒ SƠ VKF` + `ĐỘI` | ✅ |
| 4 | `Provider` catalogue + pick/suggestion flow | ✅ |
| 5 | `CHI PHÍ` cost engine + totals | ⏳ next |
| 6 | `LỊCH TRÌNH` (milestones + agenda + countdown) | ⏳ |
| 7 | `TỔNG QUAN` dashboard | ⏳ |
| 8 | Polish (conditional formats, protection guidance) | ⏳ |
| 9 | Delivery: upload + convert to Google Sheet in My Drive | ⏳ |

## Workbook structure (10 tabs)

1. `HƯỚNG DẪN` — how-to, colour legend, deadlines, bank, admin notes.
2. `THÀNH VIÊN` — 22 members imported from `resources/members.json`; `Thành viên VKF?` auto.
3. `CẤU HÌNH` (🔒) — lists, exam fees, VKF/non-VKF packages, extra-night rates, meals, trip unit costs, dojos, team codes.
4. `ĐĂNG KÝ` — member-facing, 35 cols (see below).
5. `HỒ SƠ VKF` — exam dossier, auto-gated on `ĐĂNG KÝ.Thi Dan?`.
6. `ĐỘI` (🔒) — admin long-format team roster + summary.
7. `Provider` (🔒) — scoped provider catalogue.
8. `CHI PHÍ` — stub (Phase 5).
9. `LỊCH TRÌNH` — stub (Phase 6).
10. `TỔNG QUAN` (🔒) — stub (Phase 7).

### `ĐĂNG KÝ` columns (A–AI)
`Mã TV · Họ tên* · Kyu/Dan* · VKF?* · SĐT* · Email* · Trạng thái · Tham gia? ·
Điểm đi · Ngày đến · Giờ đến · Ngày về · Giờ về · Đến (datetime)# · Về (datetime)# ·
Số đêm# · Số ngày# · Thi Dan? · Seminar? · Godo Keiko? · Team-3 · Team-5 ·
Giao lưu HN · Yushinkai · Thăng Long · Hà Nội · Yuei · Mã đội · Loại phòng ·
Bạn cùng phòng · Mã vé MB (FL) · Mã xe (BUS) · Mã KS Hà Nội (HTL) ·
Gợi ý NCC (auto)# · Ghi chú`
(`*` auto from `THÀNH VIÊN`, `#` formula — grey cells)

### `Provider` scopes
| Scope | Codes | Rows |
|---|---|---|
| Vé máy bay | `FL-###` | 5–14 |
| Xe / di chuyển | `BUS-###` | 18–27 (seeded with taxi + 16/29/35/45-seat bus) |
| Khách sạn Hà Nội | `HTL-###` | 31–40 |

## Decisions locked

- Members & admins share one link (anyone-with-link edits); soft separation of admin tabs + a documented manual *Protect ranges* step.
- Whole delegation window tracked: **VIKC 19–22/11** + **Hà Nội exchange 23–29/11**.
- Specific **datetime** arrival/departure per person (date picker + `HH:MM`); nights/days derived.
- Only the extra VKF form fields are collected (`HỒ SƠ VKF`); identity comes from `members.json`.
- Dan/kyu target grades `1 kyu`–`5 dan`.
- Team intent + admin assignment in `ĐỘI`; dojo = multi-select.
- Cost = official VKF package/exam/extra-night rates + provider picks + Hà Nội costs; VND.
- Payment tracked as `Đã thanh toán` / `Còn lại`; not linked to `Shakaijin - member and money`.
- **Tam Chúc lodging = VKF-managed** (room type + package); `Provider.HTL` = **Hà Nội only**.
- **Bảo hiểm (INS) and Zekken (ZEK) dropped**.
- v1 carry-over is **off** by default (`--carryover` to enable).
- Output name: `Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026 [refined]`.

## Open questions (block Phase 5)

1. **Hà Nội lodging** — free pick from `HTL`, or fixed/arranged? *(default: free pick)*
2. **Tam Chúc nights** — confirm package includes **1 night (Sat 21/11)**; other nights at VKF extra-night rates (extra = `nights on 19–22 − 1`). *(default: yes)*
3. **Fallback** — no `HTL` pick → use `CẤU HÌNH` Hà Nội rate, or force a pick? *(default: fallback + flag)*

## Delivery notes

- My Drive tooling has **no "create spreadsheet" API**; delivery = build `.xlsx` → review → upload + convert to a Google Sheet in **My Drive** (requires write mode enabled).
- Google Sheets has no combined date-time picker → date picker + `HH:MM` cell.
- `TRUE/FALSE` dropdowns can be converted to native checkboxes (one click); formulas keep working.

## Known data notes (from `members.json`)
- Non-VKF: `SKJ-201`, `SKJ-074`, `SKJ-235`, `SKJ-258`, `SKJ-855`.
- No Kyu/Dan: `SKJ-109`, `SKJ-088`, `SKJ-036`, `SKJ-074`, `SKJ-235`, `SKJ-258`, `SKJ-855`.
