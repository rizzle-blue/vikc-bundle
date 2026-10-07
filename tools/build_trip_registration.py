#!/usr/bin/env python3
"""Build the [refined] ShakAIJIN VIKC 2026 trip registration spreadsheet.

Spec: docs/spec-trip-registration.md
Phases implemented:
  1  skeleton + HƯỚNG DẪN + THÀNH VIÊN + CẤU HÌNH
  2  ĐĂNG KÝ core (identity, status, trip, datetime, derived nights/days)
  3  ĐĂNG KÝ categories + HỒ SƠ VKF + ĐỘI
Later phases: Provider, CHI PHÍ, LỊCH TRÌNH, TỔNG QUAN.

Usage:
    .venv/bin/python tools/build_trip_registration.py
    .venv/bin/python tools/build_trip_registration.py --carryover   # seed v1 data
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parents[1]
MEMBERS_JSON = ROOT / "resources" / "members.json"
REFERENCE_XLSX = (ROOT / "resources" / "reference"
                  / "Kopie-von-SHAKAIJIN-NinhBinh-HaNoi-2026.xlsx")
DEFAULT_OUT = ROOT / "deliverables" / "VIKC2026-trip-registration-refined.xlsx"
FILE_NAME = "Kopie von [SHAKAIJIN] Ninh Bình - Hà Nội 2026 [refined]"
LAST = 40  # last data row on member-facing sheets

# v1 exam-grade labels -> refined labels
DAN_MAP = {"shodan": "1 dan", "nidan": "2 dan", "sandan": "3 dan",
           "yondan": "4 dan", "godan": "5 dan"}

# --------------------------------------------------------------------------- #
# styling
# --------------------------------------------------------------------------- #
FONT = "Arial"
C_TITLE_BG = "FF1F3864"
C_SECTION_BG = "FFD9E2F3"
C_HEADER_BG = "FF44546A"
C_INPUT_BG = "FFFFF2CC"   # yellow  -> member input
C_AUTO_BG = "FFF2F2F2"    # grey    -> formula / auto
C_ADMIN_BG = "FFE2EFDA"   # green   -> admin input

THIN = Side(style="thin", color="FFBFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

F_TITLE = Font(name=FONT, size=14, bold=True, color="FFFFFFFF")
F_SECTION = Font(name=FONT, size=11, bold=True, color="FF1F3864")
F_HEADER = Font(name=FONT, size=10, bold=True, color="FFFFFFFF")
F_BODY = Font(name=FONT, size=10)
F_NOTE = Font(name=FONT, size=9, italic=True, color="FF808080")


def fill(color: str) -> PatternFill:
    return PatternFill("solid", fgColor=color)


def put(ws, coord, value, *, font=F_BODY, bg=None, fmt=None, wrap=False,
        halign=None, valign="center", border=False):
    c = ws[coord]
    c.value = value
    c.font = font
    if bg:
        c.fill = fill(bg)
    if fmt:
        c.number_format = fmt
    c.alignment = Alignment(wrap_text=wrap, horizontal=halign, vertical=valign)
    if border:
        c.border = BORDER
    return c


def title_row(ws, row: int, text: str, last_col: str):
    ws.merge_cells(f"A{row}:{last_col}{row}")
    put(ws, f"A{row}", text, font=F_TITLE, bg=C_TITLE_BG, halign="left")
    ws.row_dimensions[row].height = 24


def section_row(ws, row: int, text: str, last_col: str):
    ws.merge_cells(f"A{row}:{last_col}{row}")
    put(ws, f"A{row}", text, font=F_SECTION, bg=C_SECTION_BG, halign="left")


def header_row(ws, row: int, headers: dict[str, str], height: int = 30):
    for col, text in headers.items():
        put(ws, f"{col}{row}", text, font=F_HEADER, bg=C_HEADER_BG, wrap=True,
            halign="center", border=True)
    ws.row_dimensions[row].height = height


def widths(ws, spec: dict[str, int]):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


def dv_list(ws, formula1, ranges, allow_blank=True):
    dv = DataValidation(type="list", formula1=formula1, allow_blank=allow_blank,
                        showDropDown=False)
    ws.add_data_validation(dv)
    for rng in ranges:
        dv.add(rng)
    return dv


# --------------------------------------------------------------------------- #
# data sources
# --------------------------------------------------------------------------- #
def load_members() -> list[dict]:
    return json.loads(MEMBERS_JSON.read_text(encoding="utf-8"))


def load_carryover() -> dict:
    """Read existing registrations from the v1 'Kopie von' reference sheet."""
    if not REFERENCE_XLSX.exists():
        return {"vikc": {}, "giao": {}}
    wb = load_workbook(REFERENCE_XLSX, data_only=True)
    vikc: dict[str, dict] = {}
    if "VIKC2026" in wb.sheetnames:
        for row in wb["VIKC2026"].iter_rows(min_row=4, values_only=True):
            if row and row[0]:
                vikc[str(row[0])] = {
                    "status": row[3], "dan": row[4], "seminar": row[5],
                    "t3": row[6], "t5": row[7], "team": row[8],
                }
    giao: dict[str, dict] = {}
    if "GIAOLUU" in wb.sheetnames:
        for row in wb["GIAOLUU"].iter_rows(min_row=4, values_only=True):
            if row and row[0]:
                giao[str(row[0])] = {
                    "days": list(row[3:10]),
                    "club": row[11] if len(row) > 11 else None,
                }
    return {"vikc": vikc, "giao": giao}


def parse_dob(value: str):
    if not value:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


# --------------------------------------------------------------------------- #
# HƯỚNG DẪN
# --------------------------------------------------------------------------- #
def build_guide(wb: Workbook):
    ws = wb.create_sheet("HƯỚNG DẪN")
    widths(ws, {"A": 4, "B": 42, "C": 60, "D": 18, "E": 30})
    title_row(ws, 1, "SHAKAIJIN — VIKC 2026 · ĐĂNG KÝ & DỰ TOÁN CHUYẾN ĐI", "E")

    facts = [
        ("1ST VIETNAM INTERNATIONAL KENDO CHAMPIONSHIPS 2026", ""),
        ("Giải đấu", "19–22/11/2026"),
        ("Địa điểm", "Trung tâm Hội nghị Quốc tế Vesak, Tam Chúc, Ninh Bình"),
        ("Hà Nội — giao lưu võ đường", "23–29/11/2026"),
        ("Đơn vị tổ chức", "Liên đoàn Kendo Việt Nam (VKF)"),
    ]
    r = 3
    for k, v in facts:
        if k:
            put(ws, f"B{r}", k, font=Font(name=FONT, size=10, bold=True))
            put(ws, f"C{r}", v)
        r += 1

    r += 1
    section_row(ws, r, "CÁCH SỬ DỤNG", "E"); r += 1
    for s in [
        "1. Mở tab ĐĂNG KÝ. Mỗi thành viên điền vào DÒNG CỦA MÌNH.",
        "2. Chọn Mã thành viên ở cột A — Họ tên, Kyu/Dan, tư cách VKF, SĐT, "
        "email sẽ tự điền.",
        "3. Chọn Trạng thái, đánh dấu Tham gia, nhập Điểm đi, Ngày/Giờ đến-về "
        "(dự kiến).",
        "4. Chọn hạng mục: Thi Dan?, Seminar?, Godo Keiko?, Team-3, Team-5, "
        "Giao lưu HN.",
        "5. Chọn võ đường muốn giao lưu (Yushinkai / Thăng Long / Hà Nội / "
        "Yuei — chọn nhiều).",
        "6. Chọn Loại phòng; admin phân đội ở tab ĐỘI rồi chọn Mã đội.",
        "7. Nếu có Thi Dan?, điền tab HỒ SƠ VKF.",
        "8. Xem Chi phí dự kiến (tự tính — Phase 5). Cập nhật Đã thanh toán.",
        "9. Theo dõi mốc thời gian và chương trình ở tab LỊCH TRÌNH.",
    ]:
        put(ws, f"B{r}", s, wrap=True)
        ws.merge_cells(f"B{r}:E{r}")
        ws.row_dimensions[r].height = 16
        r += 1

    r += 1
    section_row(ws, r, "QUY ƯỚC MÀU", "E"); r += 1
    legend = [
        (C_INPUT_BG, "Vàng", "Thành viên tự nhập"),
        (C_AUTO_BG, "Xám", "Tự động — KHÔNG sửa"),
        (C_ADMIN_BG, "Xanh", "Ban tổ chức / admin nhập (CẤU HÌNH, Provider, ĐỘI)"),
    ]
    for bg, name, desc in legend:
        put(ws, f"B{r}", name, bg=bg, border=True)
        put(ws, f"C{r}", desc)
        ws.merge_cells(f"C{r}:E{r}")
        r += 1

    r += 1
    section_row(ws, r, "HẠN CHÓT & THANH TOÁN", "E"); r += 1
    info = [
        ("Hạn đăng ký Kyu/Dan & đội hình", "Thứ Ba 20/10/2026"),
        ("Hạn hoàn thành phí tham dự", "25/10/2026"),
        ("Tài khoản", "Liên đoàn Kendo Việt Nam — BIDV 8680065219"),
        ("Cú pháp chuyển khoản", "Tên đội_1vikc"),
        ("Email hồ sơ", "vikc@vietnamkendo.com · info@kendo.vn"),
    ]
    for k, v in info:
        put(ws, f"B{r}", k, font=Font(name=FONT, size=10, bold=True))
        put(ws, f"C{r}", v)
        ws.merge_cells(f"C{r}:E{r}")
        r += 1

    r += 1
    section_row(ws, r, "LƯU Ý CHO ADMIN", "E"); r += 1
    notes = [
        "• Sheet dùng chung: ai có link đều sửa được. Vào Data → Protect sheets "
        "and ranges để giới hạn quyền sửa CẤU HÌNH, Provider, ĐỘI, TỔNG QUAN "
        "chỉ với tài khoản admin.",
        "• Cột TRUE/FALSE có thể chuyển thành checkbox: chọn vùng → Insert → "
        "Checkbox (công thức vẫn chạy).",
        "• Ngày dùng date picker của Google Sheets; giờ nhập HH:MM.",
        "• Sheet này KHÔNG liên kết với 'Shakaijin - member and money'.",
        "• Lưu ý: Khách sạn Tam Chúc (VIKC 19–22) do VKF cung cấp — chọn "
        "Loại phòng, không chọn ở Provider. Mục 'Khách sạn Hà Nội' ở Provider "
        "chỉ dùng cho chặng Hà Nội (23–29/11).",
    ]
    for n in notes:
        put(ws, f"B{r}", n, wrap=True)
        ws.merge_cells(f"B{r}:E{r}")
        ws.row_dimensions[r].height = 28
        r += 1
    return ws


# --------------------------------------------------------------------------- #
# THÀNH VIÊN
# --------------------------------------------------------------------------- #
def build_members(wb: Workbook, members: list[dict]):
    ws = wb.create_sheet("THÀNH VIÊN")
    widths(ws, {"A": 14, "B": 13, "C": 26, "D": 10, "E": 13, "F": 11,
                "G": 30, "H": 15, "I": 16, "J": 24})
    title_row(ws, 1, "THÀNH VIÊN — SHAKAIJIN KENDO TEAM", "J")
    header_row(ws, 2, {
        "A": "Mã thành viên", "B": "Mã VKF", "C": "Họ tên", "D": "Giới tính",
        "E": "Ngày sinh", "F": "Kyu/Dan", "G": "Email", "H": "SĐT",
        "I": "Thành viên VKF?", "J": "Ghi chú",
    })
    r = 3
    for m in members:
        put(ws, f"A{r}", m.get("memberId", ""), border=True)
        put(ws, f"B{r}", m.get("vkfId", ""), border=True)
        put(ws, f"C{r}", m.get("fullName", ""), border=True)
        put(ws, f"D{r}", m.get("gender", ""), border=True)
        put(ws, f"E{r}", parse_dob(m.get("dateOfBirth", "")), fmt="dd/mm/yyyy",
            border=True)
        put(ws, f"F{r}", m.get("rank", ""), border=True)
        put(ws, f"G{r}", m.get("email", ""), border=True)
        put(ws, f"H{r}", m.get("phone", ""), border=True)
        put(ws, f"I{r}", f'=IF(OR(B{r}="-",B{r}=""),"Không","Có")',
            bg=C_AUTO_BG, border=True)
        put(ws, f"J{r}", "", bg=C_INPUT_BG, border=True)
        r += 1
    dv_list(ws, '"Nam,Nữ"', ["D3:D200"])
    dv_list(ws, "'CẤU HÌNH'!$G$5:$G$19", ["F3:F200"])
    ws.freeze_panes = "C3"
    return ws


# --------------------------------------------------------------------------- #
# CẤU HÌNH
# --------------------------------------------------------------------------- #
def build_config(wb: Workbook):
    ws = wb.create_sheet("CẤU HÌNH")
    widths(ws, {"A": 30, "B": 18, "C": 18, "D": 44, "E": 26, "F": 14,
                "G": 14, "H": 14})
    title_row(ws, 1, "🔒 CẤU HÌNH (admin) — danh mục, biểu phí, đơn giá", "H")

    section_row(ws, 3, "DANH MỤC", "H")
    for col, label in (("A", "Trạng thái"), ("C", "Giới tính"),
                       ("E", "Loại phòng"), ("G", "Bậc Kyu/Dan")):
        put(ws, f"{col}4", label, font=F_HEADER, bg=C_HEADER_BG,
            halign="center", border=True)
    for i, v in enumerate(["Quan tâm", "Tạm xác nhận", "Đã xác nhận", "Hủy"]):
        put(ws, f"A{5+i}", v, bg=C_ADMIN_BG, border=True)
    for i, v in enumerate(["Nam", "Nữ"]):
        put(ws, f"C{5+i}", v, bg=C_ADMIN_BG, border=True)
    for i, v in enumerate(["Phòng đôi (ghép)", "Phòng ba (ghép)", "Phòng đơn"]):
        put(ws, f"E{5+i}", v, bg=C_ADMIN_BG, border=True)
    ranks = ["-", "6 kyu", "5 kyu", "4 kyu", "3 kyu", "2 kyu", "1 kyu",
             "1 dan", "2 dan", "3 dan", "4 dan", "5 dan", "6 dan", "7 dan",
             "8 dan"]
    for i, v in enumerate(ranks):
        put(ws, f"G{5+i}", v, bg=C_ADMIN_BG, border=True)

    section_row(ws, 21, "BẬC THI KYU/DAN & LỆ PHÍ ĐĂNG KÝ THI", "D")
    header_row(ws, 22, {"A": "Bậc thi", "B": "Phí VKF", "C": "Phí không VKF",
                        "D": "Ghi chú"}, 20)
    exam = [("1 kyu", 1_000_000, 2_000_000), ("1 dan", 1_500_000, 2_500_000),
            ("2 dan", 2_200_000, 4_200_000), ("3 dan", 3_000_000, 5_000_000),
            ("4 dan", 4_500_000, 6_500_000), ("5 dan", 6_000_000, 8_000_000)]
    for i, (g, a, b) in enumerate(exam):
        rr = 23 + i
        put(ws, f"A{rr}", g, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", a, fmt="#,##0", bg=C_ADMIN_BG, border=True)
        put(ws, f"C{rr}", b, fmt="#,##0", bg=C_ADMIN_BG, border=True)
    put(ws, "D29", "Lệ phí cấp chứng chỉ = 30% lệ phí thi (hoàn lại nếu không đạt)",
        font=F_NOTE)

    section_row(ws, 30, "GÓI THI ĐẤU — THÀNH VIÊN VKF", "D")
    header_row(ws, 31, {"A": "Loại phòng", "B": "1 nội dung", "C": "2 nội dung",
                        "D": "Ghi chú"}, 20)
    pkg = [("Phòng đôi (ghép)", 1_550_000, 1_850_000),
           ("Phòng ba (ghép)", 1_450_000, 1_750_000),
           ("Phòng đơn", 1_900_000, 2_200_000)]
    for i, (room, a, b) in enumerate(pkg):
        rr = 32 + i
        put(ws, f"A{rr}", room, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", a, fmt="#,##0", bg=C_ADMIN_BG, border=True)
        put(ws, f"C{rr}", b, fmt="#,##0", bg=C_ADMIN_BG, border=True)

    section_row(ws, 36, "GÓI THI ĐẤU — KHÔNG PHẢI THÀNH VIÊN VKF", "D")
    header_row(ws, 37, {"A": "Loại phòng", "B": "1 nội dung", "C": "2 nội dung",
                        "D": "Ghi chú"}, 20)
    pkg2 = [("Phòng đôi (ghép)", 1_950_000, 2_350_000),
            ("Phòng ba (ghép)", 1_850_000, 2_250_000),
            ("Phòng đơn", 2_400_000, 2_800_000)]
    for i, (room, a, b) in enumerate(pkg2):
        rr = 38 + i
        put(ws, f"A{rr}", room, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", a, fmt="#,##0", bg=C_ADMIN_BG, border=True)
        put(ws, f"C{rr}", b, fmt="#,##0", bg=C_ADMIN_BG, border=True)

    section_row(ws, 42, "ĐÊM THÊM / NGƯỜI KHÔNG THI ĐẤU — VKF", "D")
    header_row(ws, 43, {"A": "Loại phòng", "B": "Giá/đêm", "C": "Ghi chú"}, 20)
    for i, (room, a) in enumerate([("Phòng đôi (ghép)", 350_000),
                                   ("Phòng ba (ghép)", 250_000),
                                   ("Phòng đơn", 700_000)]):
        rr = 44 + i
        put(ws, f"A{rr}", room, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", a, fmt="#,##0", bg=C_ADMIN_BG, border=True)
    section_row(ws, 48, "ĐÊM THÊM / NGƯỜI KHÔNG THI ĐẤU — KHÔNG VKF", "D")
    header_row(ws, 49, {"A": "Loại phòng", "B": "Giá/đêm", "C": "Ghi chú"}, 20)
    for i, (room, a) in enumerate([("Phòng đôi (ghép)", 450_000),
                                   ("Phòng ba (ghép)", 350_000),
                                   ("Phòng đơn", 900_000)]):
        rr = 50 + i
        put(ws, f"A{rr}", room, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", a, fmt="#,##0", bg=C_ADMIN_BG, border=True)
    for i, (k, v) in enumerate([("Ăn trưa", 120_000), ("Ăn tối", 200_000),
                                ("Tiệc chào mừng", 700_000)]):
        put(ws, f"A{54+i}", k, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{54+i}", v, fmt="#,##0", bg=C_ADMIN_BG, border=True)

    section_row(ws, 58, "CHI PHÍ CHUYẾN ĐI (đơn giá mặc định)", "D")
    header_row(ws, 59, {"A": "Khoản", "B": "Đơn vị", "C": "Đơn giá",
                        "D": "Ghi chú"}, 20)
    unit = [("Di chuyển sân bay ↔ Tam Chúc / Hà Nội", "/người", 750_000),
            ("Khách sạn Hà Nội (mặc định nếu không chọn Provider)",
             "/người/đêm", None),
            ("Ăn uống Hà Nội", "/người/ngày", None),
            ("Đi lại nội thành Hà Nội", "/người/ngày", None),
            ("Dự phòng / khác", "/người", None)]
    for i, (k, u, v) in enumerate(unit):
        rr = 60 + i
        put(ws, f"A{rr}", k, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", u, bg=C_ADMIN_BG, border=True)
        put(ws, f"C{rr}", v, fmt="#,##0", bg=C_ADMIN_BG, border=True)

    section_row(ws, 69, "VÕ ĐƯỜNG GIAO LƯU (Hà Nội)", "D")
    header_row(ws, 70, {"A": "Mã", "B": "Võ đường", "C": "Ghi chú"}, 20)
    for i, (code, name) in enumerate([("HNK01", "Yushinkai"),
                                      ("HNK02", "Thăng Long"),
                                      ("HNK03", "Hà Nội"), ("HNK04", "Yuei")]):
        rr = 71 + i
        put(ws, f"A{rr}", code, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{rr}", name, bg=C_ADMIN_BG, border=True)

    section_row(ws, 76, "MÃ ĐỘI", "D")
    header_row(ws, 77, {"A": "Mã đội", "B": "Tên đội", "C": "Ghi chú"}, 20)
    for i in range(6):
        rr = 78 + i
        put(ws, f"A{rr}", f"SKJ {i+1:02d}", bg=C_ADMIN_BG, border=True)
    return ws


# --------------------------------------------------------------------------- #
# ĐĂNG KÝ  (Phase 2 core + Phase 3 categories)
# --------------------------------------------------------------------------- #
def build_signup(wb: Workbook, members: list[dict], carry: dict):
    ws = wb.create_sheet("ĐĂNG KÝ")
    widths(ws, {
        "A": 13, "B": 24, "C": 10, "D": 8, "E": 13, "F": 26, "G": 15, "H": 10,
        "I": 18, "J": 12, "K": 10, "L": 12, "M": 10, "N": 16, "O": 16, "P": 9,
        "Q": 9, "R": 12, "S": 10, "T": 12, "U": 9, "V": 9, "W": 12, "X": 11,
        "Y": 11, "Z": 10, "AA": 8, "AB": 12, "AC": 20, "AD": 20,
        "AE": 14, "AF": 12, "AG": 16, "AH": 18, "AI": 34,
    })
    title_row(ws, 1, "ĐĂNG KÝ CHUYẾN ĐI — mỗi thành viên điền dòng của mình "
                     "(thông tin · tham gia · hạng mục · chọn dịch vụ)", "AI")
    header_row(ws, 2, {
        "A": "Mã thành viên", "B": "Họ tên", "C": "Kyu/Dan", "D": "VKF?",
        "E": "SĐT", "F": "Email", "G": "Trạng thái", "H": "Tham gia?",
        "I": "Điểm đi", "J": "Ngày đến", "K": "Giờ đến", "L": "Ngày về",
        "M": "Giờ về", "N": "Đến (datetime)", "O": "Về (datetime)",
        "P": "Số đêm", "Q": "Số ngày", "R": "Thi Dan?", "S": "Seminar?",
        "T": "Godo Keiko?", "U": "Team-3", "V": "Team-5", "W": "Giao lưu HN",
        "X": "Yushinkai", "Y": "Thăng Long", "Z": "Hà Nội", "AA": "Yuei",
        "AB": "Mã đội", "AC": "Loại phòng", "AD": "Bạn cùng phòng",
        "AE": "Mã vé MB (FL)", "AF": "Mã xe (BUS)",
        "AG": "Mã KS Hà Nội (HTL)", "AH": "Gợi ý NCC (auto)",
        "AI": "Ghi chú",
    }, height=42)

    vikc = carry.get("vikc", {})
    giao = carry.get("giao", {})

    for i in range(LAST - 2):
        r = 3 + i
        mid = members[i].get("memberId", "") if i < len(members) else ""
        status = arrive = depart = note = participate = None
        dan = seminar = t3 = t5 = team = None
        if mid:
            v = vikc.get(mid) or {}
            status = v.get("status") or None
            raw_dan = v.get("dan") or None
            dan = DAN_MAP.get(raw_dan, raw_dan) if raw_dan else None
            seminar, t3, t5 = v.get("seminar"), v.get("t3"), v.get("t5")
            team = v.get("team") or None
            g = giao.get(mid) or {}
            days = g.get("days") or []
            ticked = [23 + j for j, d in enumerate(days) if d is True]
            if ticked:
                arrive = datetime(2026, 11, min(ticked)).date()
                depart = datetime(2026, 11, max(ticked)).date()
            if g.get("club"):
                note = f"Giao lưu (v1): {g['club']}"
            if (status and status != "Hủy") or ticked:
                participate = True

        put(ws, f"A{r}", mid or "", bg=C_INPUT_BG, border=True)
        put(ws, f"B{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,3,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"C{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,6,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"D{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,9,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"E{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,8,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"F{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,7,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"G{r}", status or "", bg=C_INPUT_BG, border=True)
        put(ws, f"H{r}", participate, bg=C_INPUT_BG, border=True)
        put(ws, f"I{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"J{r}", arrive, fmt="dd/mm/yyyy", bg=C_INPUT_BG, border=True)
        put(ws, f"K{r}", None, fmt="hh:mm", bg=C_INPUT_BG, border=True)
        put(ws, f"L{r}", depart, fmt="dd/mm/yyyy", bg=C_INPUT_BG, border=True)
        put(ws, f"M{r}", None, fmt="hh:mm", bg=C_INPUT_BG, border=True)
        put(ws, f"N{r}", f'=IF($J{r}="","",$J{r}+IF($K{r}="",0,$K{r}))',
            fmt="dd/mm/yyyy hh:mm", bg=C_AUTO_BG, border=True)
        put(ws, f"O{r}", f'=IF($L{r}="","",$L{r}+IF($M{r}="",0,$M{r}))',
            fmt="dd/mm/yyyy hh:mm", bg=C_AUTO_BG, border=True)
        put(ws, f"P{r}",
            f'=IF(OR($N{r}="",$O{r}=""),"",MAX(0,INT($O{r})-INT($N{r})))',
            bg=C_AUTO_BG, border=True)
        put(ws, f"Q{r}",
            f'=IF(OR($N{r}="",$O{r}=""),"",MAX(0,INT($O{r})-INT($N{r}))+1)',
            bg=C_AUTO_BG, border=True)
        put(ws, f"R{r}", dan or "", bg=C_INPUT_BG, border=True)
        put(ws, f"S{r}", seminar, bg=C_INPUT_BG, border=True)
        put(ws, f"T{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"U{r}", t3, bg=C_INPUT_BG, border=True)
        put(ws, f"V{r}", t5, bg=C_INPUT_BG, border=True)
        put(ws, f"W{r}", None, bg=C_INPUT_BG, border=True)
        for col in ("X", "Y", "Z", "AA"):
            put(ws, f"{col}{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"AB{r}", team or None, bg=C_INPUT_BG, border=True)
        put(ws, f"AC{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"AD{r}", None, bg=C_INPUT_BG, border=True)
        for col in ("AE", "AF", "AG"):
            put(ws, f"{col}{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"AH{r}",
            f'=IF($I{r}="","",IF(COUNTIF(Provider!$K$5:$K$14,$I{r})=0,"—",'
            f'IF(COUNTIF(Provider!$K$5:$K$14,$I{r})=1,'
            f'INDEX(Provider!$A$5:$A$14,MATCH($I{r},Provider!$K$5:$K$14,0)),'
            f'COUNTIF(Provider!$K$5:$K$14,$I{r})&" lựa chọn")))',
            bg=C_AUTO_BG, border=True)
        put(ws, f"AI{r}", note or None, bg=C_INPUT_BG, border=True)

    dv_list(ws, "'THÀNH VIÊN'!$A$3:$A$200", [f"A3:A{LAST}"])
    dv_list(ws, "'CẤU HÌNH'!$A$5:$A$8", [f"G3:G{LAST}"])
    dv_list(ws, '"TP. Hồ Chí Minh,Hà Nội,Đà Nẵng,Cần Thơ,Khác"', [f"I3:I{LAST}"])
    dv_list(ws, "'CẤU HÌNH'!$A$23:$A$28", [f"R3:R{LAST}"])
    for col in ("H", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA"):
        dv_list(ws, '"TRUE,FALSE"', [f"{col}3:{col}{LAST}"])
    dv_list(ws, "'CẤU HÌNH'!$A$78:$A$83", [f"AB3:AB{LAST}"])
    dv_list(ws, "'CẤU HÌNH'!$E$5:$E$7", [f"AC3:AC{LAST}"])
    dv_list(ws, "Provider!$A$5:$A$14", [f"AE3:AE{LAST}"])
    dv_list(ws, "Provider!$A$18:$A$27", [f"AF3:AF{LAST}"])
    dv_list(ws, "Provider!$A$31:$A$40", [f"AG3:AG{LAST}"])
    ws.freeze_panes = "C3"
    return ws


# --------------------------------------------------------------------------- #
# HỒ SƠ VKF
# --------------------------------------------------------------------------- #
def build_vkf(wb: Workbook):
    ws = wb.create_sheet("HỒ SƠ VKF")
    widths(ws, {"A": 13, "B": 24, "C": 26, "D": 12, "E": 24, "F": 12, "G": 18,
                "H": 14, "I": 12, "J": 9, "K": 13, "L": 26, "M": 30, "N": 16,
                "O": 24, "P": 12, "Q": 22, "R": 12, "S": 12, "T": 30, "U": 16,
                "V": 24})
    title_row(ws, 1, "HỒ SƠ VKF — chỉ hiển thị thành viên có 'Thi Dan?' ở "
                     "tab ĐĂNG KÝ", "V")
    header_row(ws, 2, {
        "A": "Mã thành viên", "B": "Họ tên", "C": "Họ tên Latin (IN HOA)",
        "D": "Dùng tên Latin trên chứng nhận?", "E": "Họ tên chữ Hán (Kanji)",
        "F": "Dùng Kanji trên chứng nhận?", "G": "CCCD / Hộ chiếu",
        "H": "Quốc tịch", "I": "Ngày sinh", "J": "Giới tính", "K": "SĐT",
        "L": "Email", "M": "Địa chỉ", "N": "Nghề nghiệp", "O": "Tên CLB",
        "P": "Trình độ hiện tại", "Q": "Nơi cấp bằng hiện tại",
        "R": "Ngày cấp", "S": "Kyu/Dan đăng ký thi",
        "T": "Địa chỉ nhận bằng", "U": "Xác nhận của CLB", "V": "Ghi chú",
    }, height=44)

    for i in range(LAST - 2):
        r = 3 + i
        check = f"'ĐĂNG KÝ'!$R{r}"
        gate = f'IF($A{r}="","",'
        put(ws, f"A{r}", f'=IF({check}="","",\'ĐĂNG KÝ\'!$A{r})',
            bg=C_AUTO_BG, border=True)
        put(ws, f"B{r}", f'=IF($A{r}="","",\'ĐĂNG KÝ\'!$B{r})',
            bg=C_AUTO_BG, border=True)
        put(ws, f"C{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"D{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"E{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"F{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"G{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"H{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"I{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,5,FALSE),\"\"))",
            fmt="dd/mm/yyyy", bg=C_AUTO_BG, border=True)
        put(ws, f"J{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,4,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"K{r}", f'=IF($A{r}="","",\'ĐĂNG KÝ\'!$E{r})',
            bg=C_AUTO_BG, border=True)
        put(ws, f"L{r}", f'=IF($A{r}="","",\'ĐĂNG KÝ\'!$F{r})',
            bg=C_AUTO_BG, border=True)
        put(ws, f"M{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"N{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"O{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"P{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,6,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"Q{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"R{r}", None, fmt="dd/mm/yyyy", bg=C_INPUT_BG, border=True)
        put(ws, f"S{r}", f'=IF($A{r}="","",\'ĐĂNG KÝ\'!$R{r})',
            bg=C_AUTO_BG, border=True)
        put(ws, f"T{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"U{r}", None, bg=C_INPUT_BG, border=True)
        put(ws, f"V{r}", None, bg=C_INPUT_BG, border=True)

    dv_list(ws, '"Yes,No"', [f"D3:D{LAST}", f"F3:F{LAST}"])
    dv_list(ws, '"Đã xác nhận,Chưa xác nhận"', [f"U3:U{LAST}"])
    ws.freeze_panes = "C3"
    return ws


# --------------------------------------------------------------------------- #
# ĐỘI
# --------------------------------------------------------------------------- #
def build_teams(wb: Workbook):
    ws = wb.create_sheet("ĐỘI")
    widths(ws, {"A": 13, "B": 24, "C": 10, "D": 9, "E": 16, "F": 12, "G": 8,
                "H": 26})
    title_row(ws, 1, "🔒 ĐỘI HÌNH (admin) — phân đội Đồng đội 3 / Đồng đội 5",
              "H")
    header_row(ws, 2, {
        "A": "Mã thành viên", "B": "Họ tên", "C": "Kyu/Dan", "D": "Giới tính",
        "E": "Nội dung", "F": "Mã đội", "G": "Vị trí", "H": "Ghi chú",
    })
    for i in range(40):
        r = 3 + i
        put(ws, f"A{r}", None, bg=C_ADMIN_BG, border=True)
        put(ws, f"B{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,3,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"C{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,6,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"D{r}", f'=IF($A{r}="","",IFERROR(VLOOKUP($A{r},'
                         f"'THÀNH VIÊN'!$A$3:$J$200,4,FALSE),\"\"))",
            bg=C_AUTO_BG, border=True)
        put(ws, f"E{r}", None, bg=C_ADMIN_BG, border=True)
        put(ws, f"F{r}", None, bg=C_ADMIN_BG, border=True)
        put(ws, f"G{r}", None, bg=C_ADMIN_BG, border=True)
        put(ws, f"H{r}", None, bg=C_ADMIN_BG, border=True)

    dv_list(ws, "'THÀNH VIÊN'!$A$3:$A$200", ["A3:A42"])
    dv_list(ws, '"Đồng đội 3,Đồng đội 5"', ["E3:E42"])
    dv_list(ws, "'CẤU HÌNH'!$A$78:$A$83", ["F3:F42"])
    dv_list(ws, '"1,2,3,4,5"', ["G3:G42"])

    section_row(ws, 45, "TỔNG HỢP", "H")
    for i, (k, e) in enumerate([("Đồng đội 3", "Đồng đội 3"),
                                ("Đồng đội 5", "Đồng đội 5")]):
        put(ws, f"A{46+i}", k, bg=C_SECTION_BG, border=True)
        put(ws, f"B{46+i}", f'=COUNTIF($E$3:$E$42,"{e}")',
            bg=C_AUTO_BG, border=True)
    for i, code in enumerate(["SKJ 01", "SKJ 02", "SKJ 03", "SKJ 04", "SKJ 05",
                              "SKJ 06"]):
        put(ws, f"D{46+i}", code, bg=C_SECTION_BG, border=True)
        put(ws, f"E{46+i}", f'=COUNTIF($F$3:$F$42,"{code}")',
            bg=C_AUTO_BG, border=True)
    ws.freeze_panes = "C3"
    return ws


# --------------------------------------------------------------------------- #
# Provider
# --------------------------------------------------------------------------- #
PROVIDER_HEADERS = {
    "A": "Mã", "B": "Scope", "C": "Nhà cung cấp", "D": "Liên hệ",
    "E": "SĐT", "F": "Email", "G": "Tuyến / Chặng", "H": "Chiều",
    "I": "Hãng / ĐV", "J": "Ngày giờ", "K": "Điểm đi", "L": "Điểm đến",
    "M": "Điều kiện", "N": "Đơn giá/người", "O": "Phí DV",
    "P": "Tổng/người", "Q": "Hiệu lực đến", "R": "Trạng thái",
    "S": "Ghi chú",
}

BUS_SEEDS = [
    {"nha": "Noi Bai taxi", "sdt": "0888.100.100", "gia": 750_000,
     "note": "3–4 người gồm hành lý · 2–2.5 giờ"},
    {"nha": "Bus 16 chỗ", "sdt": "0904409090", "gia": 1_800_000,
     "note": "tối đa 9 người kèm hành lý"},
    {"nha": "Bus 29 chỗ", "sdt": "0904409090", "gia": 2_300_000,
     "note": "có khoang hành lý riêng"},
    {"nha": "Bus 35 chỗ", "sdt": "0904409090", "gia": 2_800_000,
     "note": ""},
    {"nha": "Bus 45 chỗ", "sdt": "0904409090", "gia": 3_500_000,
     "note": ""},
]

PROVIDER_BLOCKS = [
    ("VÉ MÁY BAY (FL)", "Vé máy bay", "FL", 10, []),
    ("XE / DI CHUYỂN (BUS)", "Xe", "BUS", 10, BUS_SEEDS),
    ("KHÁCH SẠN HÀ NỘI (HTL)", "Khách sạn Hà Nội", "HTL", 10, []),
]


def build_provider(wb: Workbook):
    ws = wb.create_sheet("Provider")
    widths(ws, {"A": 10, "B": 14, "C": 22, "D": 16, "E": 14, "F": 24,
                "G": 24, "H": 10, "I": 16, "J": 16, "K": 18, "L": 18,
                "M": 26, "N": 16, "O": 12, "P": 16, "Q": 14, "R": 14,
                "S": 30})
    title_row(ws, 1, "🔒 Provider — danh mục nhà cung cấp theo scope "
                     "(admin cập nhật; thành viên chọn mã ở tab ĐĂNG KÝ)", "S")
    scope_ranges = {}
    cur = 3
    for title, scope, prefix, n, seeds in PROVIDER_BLOCKS:
        section_row(ws, cur, f"{title}   ·   mã {prefix}-###", "S")
        header_row(ws, cur + 1, PROVIDER_HEADERS, height=34)
        first = cur + 2
        for i in range(n):
            r = first + i
            code = f"{prefix}-{i+1:03d}"
            seed = seeds[i] if i < len(seeds) else {}
            put(ws, f"A{r}", code, font=Font(name=FONT, size=10, bold=True),
                bg=C_ADMIN_BG, border=True)
            put(ws, f"B{r}", scope, bg=C_AUTO_BG, border=True)
            put(ws, f"C{r}", seed.get("nha", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"D{r}", seed.get("lh", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"E{r}", seed.get("sdt", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"F{r}", seed.get("email", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"G{r}", seed.get("tuyen", "Nội Bài ↔ Tam Chúc"
                                    if "gia" in seed else ""),
                bg=C_ADMIN_BG, border=True)
            put(ws, f"H{r}", seed.get("chieu", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"I{r}", seed.get("hang", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"J{r}", seed.get("ngay", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"K{r}", seed.get("di", "Hà Nội" if "gia" in seed else ""),
                bg=C_ADMIN_BG, border=True)
            put(ws, f"L{r}", seed.get("den", "Tam Chúc" if "gia" in seed else ""),
                bg=C_ADMIN_BG, border=True)
            put(ws, f"M{r}", seed.get("dk", ""), bg=C_ADMIN_BG, border=True)
            put(ws, f"N{r}", seed.get("gia"), fmt="#,##0", bg=C_ADMIN_BG,
                border=True)
            put(ws, f"O{r}", None, fmt="#,##0", bg=C_ADMIN_BG, border=True)
            put(ws, f"P{r}", f'=IF($N{r}="","",$N{r}+IF($O{r}="",0,$O{r}))',
                fmt="#,##0", bg=C_AUTO_BG, border=True)
            put(ws, f"Q{r}", None, fmt="dd/mm/yyyy", bg=C_ADMIN_BG, border=True)
            put(ws, f"R{r}", "Còn hiệu lực", bg=C_ADMIN_BG, border=True)
            put(ws, f"S{r}", seed.get("note", ""), bg=C_ADMIN_BG, border=True)
        scope_ranges[prefix] = (first, first + n - 1)
        cur = first + n + 1

    dv_list(ws, '"Còn hiệu lực,Hết hiệu lực"', ["R5:R60"])
    ws.freeze_panes = "C5"
    return ws, scope_ranges


# --------------------------------------------------------------------------- #
# stubs (later phases)
# --------------------------------------------------------------------------- #
def stub(wb: Workbook, name: str, phase: str, columns: dict[str, str], last: str):
    ws = wb.create_sheet(name)
    widths(ws, {c: 18 for c in columns})
    title_row(ws, 1, name, last)
    ws.merge_cells(f"A2:{last}2")
    put(ws, "A2", f"⏳ Sẽ hoàn thiện ở {phase}", font=F_NOTE)
    if columns:
        header_row(ws, 3, columns)
    return ws


def build_stubs(wb: Workbook):
    stub(wb, "CHI PHÍ", "Phase 5", {
        "A": "Mã thành viên", "B": "Họ tên", "C": "Gói VKF", "D": "Lệ phí thi",
        "E": "Đêm thêm NB", "F": "Vé MB", "G": "Di chuyển", "H": "KS HN",
        "I": "Ăn HN", "J": "Đi lại HN", "K": "Zekken", "L": "Bảo hiểm",
        "M": "Khác", "N": "Tổng", "O": "Đã TT", "P": "Còn lại"}, "P")
    stub(wb, "LỊCH TRÌNH", "Phase 6", {
        "A": "Ngày", "B": "Thứ", "C": "Từ", "D": "Đến", "E": "Hoạt động",
        "F": "Địa điểm", "G": "PIC", "H": "Ghi chú"}, "H")
    stub(wb, "TỔNG QUAN", "Phase 7", {
        "A": "Chỉ số", "B": "Giá trị", "C": "Ghi chú"}, "C")


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def build(out: Path, *, carryover: bool = False):
    members = load_members()
    carry = load_carryover() if carryover else {"vikc": {}, "giao": {}}
    wb = Workbook()
    wb.remove(wb.active)

    build_guide(wb)
    build_members(wb, members)
    build_config(wb)
    build_signup(wb, members, carry)
    build_vkf(wb)
    build_teams(wb)
    build_provider(wb)
    build_stubs(wb)

    order = ["HƯỚNG DẪN", "THÀNH VIÊN", "CẤU HÌNH", "ĐĂNG KÝ", "HỒ SƠ VKF",
             "ĐỘI", "Provider", "CHI PHÍ", "LỊCH TRÌNH", "TỔNG QUAN"]
    wb._sheets = [wb[n] for n in order]

    wb.properties.title = FILE_NAME
    wb.properties.creator = "Shakaijin Kendo Team"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    return out, len(members)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--carryover", action="store_true",
                    help="seed ĐĂNG KÝ with v1 registrations (default: off)")
    args = ap.parse_args()
    out, n = build(args.out, carryover=args.carryover)
    print(f"Wrote {out} ({n} members, carryover={'on' if args.carryover else 'off'})")


if __name__ == "__main__":
    main()
