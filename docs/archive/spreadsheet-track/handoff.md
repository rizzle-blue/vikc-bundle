# HANDOFF — continue the [refined] VIKC 2026 trip registration sheet

> Read this first if you are a new agent/session on another machine.
> It captures the context, decisions and exact next steps from the session that
> produced Phases 1–4.

## 0. TL;DR — how to resume

```bash
git clone git@github.com:rizzle-blue/vikc-bundle.git && cd vikc-bundle
python3 -m venv .venv
.venv/bin/pip install -r tools/vikc-guide/requirements.txt   # pymupdf, openpyxl
.venv/bin/python tools/build_trip_registration.py            # rebuild the workbook
```

Then:
1. Read [`spec-trip-registration.md`](spec-trip-registration.md) and
   [`status-trip-registration.md`](status-trip-registration.md).
2. **Ask the user the 3 open questions** (§8) before Phase 5.
3. Implement **Phase 5** in `tools/build_trip_registration.py`, rebuild, verify,
   commit, push. Continue Phases 6–9.

## 1. Background

The repo `vikc-2026` is a machine-readable corpus of the **1st Vietnam
International Kendo Championships 2026** user guide (`resources/user-guide/`,
converted by `tools/vikc-guide/`).

The user then asked for a **separate deliverable**: a refined Google Spreadsheet
(generated as `.xlsx`) for the **Shakaijin Kendo Team** delegation trip,
motivated by their existing sheet
`Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026`
(Drive id `1zCP3RXb8-P0IyofnCuqjpgGZ96mkbIAMSTLNKhuOqjs`).

New file name: **`Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026 [refined]`**.

## 2. What the spreadsheet must do (original request)

1. Let members **enroll** in the trip.
2. Let members **register categories**: dan/kyu exam, team shiai 3, team shiai 5,
   Hà Nội dojo exchange.
3. Let members **estimate cost**.
4. Let admins **track datetime / agenda**.

Scope = whole window: **VIKC 19–22/11/2026** (Tam Chúc, Ninh Bình) + **Hà Nội
exchange 23–29/11/2026**.

## 3. Ground facts pulled from the user guide

- Event: 19–22/11/2026, Vesak International Convention Center, Tam Chúc.
- Kyu/Dan exam: **Fri 20/11**. Team-3: **Sat 21/11**. Team-5: **Sun 22/11**.
  Seminar + Godo Keiko: **Thu 19/11**.
- Deadlines: **20/10/2026** (Kyu/Dan + team), **25/10/2026** (payment).
- Bank: VKF BIDV `8680065219`, syntax `Tên đội_1vikc`; email
  `vikc@vietnamkendo.com`, `info@kendo.vn`.
- VKF fee tables (package room × 1–2 nội dung, extra nights, exam fees) — see
  `CẤU HÌNH` in the workbook; sources are user-guide docs 02/03/05.
- Bus/transfer prices seeded in `Provider` `BUS` block (doc 02/03).

## 4. Environment

- Python venv at `.venv`; deps from `tools/vikc-guide/requirements.txt`
  (`pymupdf>=1.24`, `openpyxl>=3.1`).
- Generator must be run with `.venv/bin/python`.
- No LibreOffice on the session machine → formulas are **not recalculated**
  locally; correctness is by construction + review (and ultimately Google Sheets).

## 5. Files

| Path | What |
|---|---|
| `tools/build_trip_registration.py` | the generator (single source of truth) |
| `deliverables/VIKC2026-trip-registration-refined.xlsx` | built workbook |
| `docs/spec-trip-registration.md` | full spec |
| `docs/status-trip-registration.md` | phase status |
| `docs/handoff.md` | this file |
| `resources/members.json` | 22-member roster (source for `THÀNH VIÊN`) |
| `resources/reference/Kopie-von-…xlsx` | v1 sheet; only used by `--carryover` |
| `resources/VIKC2026-SHAKAIJIN-…xlsx` | Drive sheet retrieved into the project |

## 6. Decision log (from the session)

| # | Decision |
|---|---|
| Edit model | Anyone with the link can edit; admin tabs marked `🔒`, manual *Protect ranges* step documented (no hard lock). |
| Scope | Whole window: VIKC 19–22/11 **and** Hà Nội 23–29/11. |
| Identity | Only the **extra VKF-required** fields are collected; identity comes from `resources/members.json`. |
| Categories | Dan/kyu grades `1 kyu`–`5 dan`; team-3/team-5 intent + admin assignment in `ĐỘI`; dojo = **multi-select**. |
| Datetime | Specific arrival/departure datetime per person via **date picker + `HH:MM`** (Sheets has no combined picker); nights/days derived. |
| Transport | **Each person picks** (not club-booked). |
| Provider | **One `Provider` tab, scope blocks, stable typed codes** usable for both selection (`ĐĂNG KÝ`) and tracking (`CHI PHÍ`). |
| Costs | Auto-compute from official VKF tables + provider picks; VND integers; editable `CẤU HÌNH`. |
| Payment | `Đã thanh toán` / `Còn lại`; **not** linked to `Shakaijin - member and money`. |
| Agenda | Pre-filled official 19–22/11 programme + Hà Nội 23–29/11 + prep milestones + countdowns. |
| Language | Vietnamese primary. |
| Carry-over | v1 registrations **off by default**; `--carryover` seeds them (with `shodan→1 dan` normalisation). |
| `HỒ SƠ VKF` | Separate tab (not inline columns). |
| Delivery | Build `.xlsx` → review → upload + convert to a Google Sheet in **My Drive**. |
| Hotel | **Tam Chúc lodging = VKF-managed** (room type + package in `CẤU HÌNH`); `Provider.HTL` = **Hà Nội only**. |
| Dropped | **Bảo hiểm (INS)** and **Zekken (ZEK)** removed entirely. |
| Name | `Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026 [refined]`. |

## 7. Phase plan & status

| Phase | Scope | Status |
|---|---|---|
| 0 | Spec + decisions | ✅ |
| 1 | Skeleton + `HƯỚNG DẪN` + `THÀNH VIÊN` + `CẤU HÌNH` | ✅ |
| 2 | `ĐĂNG KÝ` core (identity, status, trip, datetime, nights/days) | ✅ |
| 3 | `ĐĂNG KÝ` categories + `HỒ SƠ VKF` + `ĐỘI` | ✅ |
| 4 | `Provider` catalogue + pick/suggestion flow | ✅ |
| **5** | **`CHI PHÍ` cost engine + totals** | ⏳ **NEXT** |
| 6 | `LỊCH TRÌNH` (milestones + agenda + countdown) | ⏳ |
| 7 | `TỔNG QUAN` dashboard | ⏳ |
| 8 | Polish (conditional formats, protection guidance) | ⏳ |
| 9 | Delivery: upload + convert to Google Sheet in My Drive | ⏳ |

Convention: **build → verify → show the user → proceed**.

## 8. Open questions (ASK before Phase 5)

1. **Hà Nội lodging** — free pick from the `HTL` block, or arranged/fixed?
   *(default: free pick)*
2. **Tam Chúc nights** — confirm the VKF package includes **1 night (Sat 21/11)**
   and every other Tam Chúc night is charged at VKF extra-night rates, i.e.
   `extra = nights on 19–22 − 1`. *(default: yes)*
3. **Fallback** — if no `HTL` code is picked, use the `CẤU HÌNH` "Khách sạn Hà Nội"
   rate (and flag "thiếu lựa chọn"), or force a pick? *(default: fallback + flag)*

## 9. Phase 5 spec (what to build next)

`CHI PHÍ` tab, **row-aligned with `ĐĂNG KÝ`** (same rows 3–40, so lookups are simple):

Columns: `Mã TV · Họ tên · Gói VKF · Lệ phí thi · Đêm thêm NB · Vé MB · Di chuyển ·
KS Hà Nội · Ăn HN · Đi lại HN · Khác · Tổng · Đã TT · Còn lại` + a totals/summary block.

Rules:
- **Gói VKF** = 0 if 0 competition events, else `room × events(1|2)` by VKF flag
  (`CẤU HÌNH` rows 32–34 VKF / 38–40 non-VKF).
- **Lệ phí thi** = lookup `ĐĂNG KÝ.Thi Dan?` × VKF flag (`CẤU HÌNH` rows 23–28).
- **Đêm thêm NB** = `MAX(0, nights on 19–22 − 1)` × room extra-night rate
  (`CẤU HÌNH` rows 44–46 VKF / 50–52 non-VKF).
- **Vé MB** = `ĐĂNG KÝ.Mã vé MB` if set, else single matched `FL` row by `Điểm đi`.
- **Di chuyển / KS Hà Nội / Ăn HN / Đi lại HN** = provider picks or `CẤU HÌNH`
  unit rates (rows 60–64).
- **Khác** = `CẤU HÌNH` "Dự phòng / khác" if participating.
- Wire totals back: `ĐĂNG KÝ.Chi phí dự kiến` (auto), `Đã thanh toán` (input),
  `Còn lại` (auto).

Then Phases 6–9 per §7 and `spec-trip-registration.md`.

## 10. Key workbook addresses (Phase 5 will reference these)

`CẤU HÌNH`:
- status `A5:A8` · gender `C5:C6` · room `E5:E7` · ranks `G5:G19`
- exam grades + fees `A23:C28`
- VKF package `A32:C34` · non-VKF package `A38:C40`
- VKF extra night `A44:B46` · non-VKF extra night `A50:B52` · meals `A54:B56`
- trip unit costs `A60:C64` (transfer, HN hotel fallback, HN meals, HN transport, other)
- dojos `A71:B74` · team codes `A78:A83`

`ĐĂNG KÝ` (data rows 3–40): identity `A:F` · status/trip `G:H` · datetime `I:M` ·
derived `N:Q` · categories `R:W` · dojos `X:AA` · team/room `AB:AD` ·
provider picks `AE:AG` · suggestion `AH` · note `AI`.

`Provider`: `FL` 5–14 · `BUS` 18–27 · `HTL` 31–40 (codes in column A, price `N`,
service fee `O`, total `P`).

## 11. Tooling constraints / gotchas

- The agent's **Google Drive tools have no "create spreadsheet" API**; delivery =
  upload an `.xlsx` and convert (`mimeType = application/vnd.google-apps.spreadsheet`),
  which needs **write mode enabled**. Otherwise hand over the `.xlsx`.
- `gws` CLI was **not** installed on the session machine.
- Google Sheets **no combined date-time picker** → date picker + `HH:MM`.
- `TRUE/FALSE` list validations import as dropdowns, not native checkboxes →
  one-click conversion documented in `HƯỚNG DẪN`.
- `openpyxl` `showDropDown=False` is the OOXML-correct way to *show* the dropdown.
- Sheet names with spaces (`'ĐĂNG KÝ'`, `'CẤU HÌNH'`, …) must be quoted in formulas;
  `Provider` and `ĐỘI` need no quotes.
- Booleans are written as Python `True/False`; formulas use `=TRUE` comparisons.

## 12. Known data notes (`resources/members.json`)

- Non-VKF (blank/`-` Mã VKF → non-member fees): `SKJ-201`, `SKJ-074`, `SKJ-235`,
  `SKJ-258`, `SKJ-855`.
- No Kyu/Dan recorded: `SKJ-109`, `SKJ-088`, `SKJ-036`, `SKJ-074`, `SKJ-235`,
  `SKJ-258`, `SKJ-855`.

## 13. History

```
232c354  Add [refined] VIKC 2026 trip registration spreadsheet (Phases 1-4)
feaa31d  initiate project
```
Branch `main` ↔ `origin/main` (github.com:rizzle-blue/vikc-bundle).
