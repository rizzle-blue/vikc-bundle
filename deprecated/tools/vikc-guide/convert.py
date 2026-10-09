#!/usr/bin/env python3
"""VIKC 2026 user-guide conversion pipeline.

Turns ``resources/user-guide/`` (PDF + XLSX, human-only formats) into
machine-readable documents that keep the original structure:

    content/user-guide/
        README.md              index of the generated corpus
        md/*.md                one Markdown file per source document
        json/*.json            block-level structure (headings, paragraphs,
                               lists, tables with cells + bounding boxes)
        data/*.csv, *.json     spreadsheet exports
        assets/*.png           rendered pages of the scanned documents

Usage:
    python tools/vikc-guide/convert.py                 # convert everything
    python tools/vikc-guide/convert.py --only 4        # convert one document id
    python tools/vikc-guide/convert.py --check         # verify freshness only
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover
    sys.exit("pymupdf is required: python -m venv .venv && .venv/bin/pip install pymupdf openpyxl")

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "resources" / "user-guide"
OUT = ROOT / "content" / "user-guide"
OCR_SWIFT = Path(__file__).resolve().parent / "ocr.swift"

OCR_DPI = 300
OCR_LANGS = "vi-VN,en-US"

# --------------------------------------------------------------------------
# Source catalogue. Explicit so that file naming, slugs and OCR/table hints
# stay stable and reviewable instead of being guessed at runtime.
# --------------------------------------------------------------------------


@dataclass
class Doc:
    id: str
    slug: str
    src: str
    title: str
    lang: str
    kind: str  # "pdf-text" | "pdf-scan" | "xlsx" | "image"
    tags: list[str] = field(default_factory=list)


CATALOGUE: list[Doc] = [
    Doc(
        id="01",
        slug="01-chuong-trinh-thi-dau",
        src="1_1ST VIKC 2026_Chương_trình_VIE.pdf",
        title="Chương trình giải / Championships programme",
        lang="vi",
        kind="pdf-text",
        tags=["programme", "schedule"],
    ),
    Doc(
        id="02",
        slug="02-le-phi-thanh-vien-vkf",
        src="2_1ST VIKC 2026 Entry Fee (Thành viên VKF).pdf",
        title="Entry fee — thành viên VKF / VKF members",
        lang="vi",
        kind="pdf-text",
        tags=["fees", "entry"],
    ),
    Doc(
        id="03",
        slug="03-le-phi-khong-phai-thanh-vien-vkf",
        src="3_1ST VIKC 2026 Entry Fee (Không là tv VKF).pdf",
        title="Entry fee — không phải thành viên VKF / non-VKF members",
        lang="vi",
        kind="pdf-text",
        tags=["fees", "entry"],
    ),
    Doc(
        id="04",
        slug="04-dieu-le",
        src="4_1ST VIKC 2026 Điều lệ.pdf",
        title="Điều lệ thi đấu / Competition regulations",
        lang="vi",
        kind="pdf-text",
        tags=["regulations", "rules"],
    ),
    Doc(
        id="05",
        slug="05-thi-kyu-dan-va-mau-dang-ky",
        src="5_ 1ST VIKC 2026 Thông tin thi Kyu Dan và Mẫu đăng ký (cập nhật).pdf",
        title="Thông tin thi Kyu/Dan và mẫu đăng ký / Kyu-Dan exam information & application form",
        lang="vi",
        kind="pdf-text",
        tags=["grading", "kyu-dan", "form"],
    ),
    Doc(
        id="06",
        slug="06-huong-dan-thanh-toan",
        src="6_1ST VIKC 2026_Hướng dẫn thanh toán.pdf",
        title="Hướng dẫn thanh toán / Payment instructions",
        lang="vi",
        kind="pdf-text",
        tags=["payment"],
    ),
    Doc(
        id="07",
        slug="07-tour-tam-chuc-1-ngay",
        src="Tam Chuc Tour.pdf",
        title="Tam Chúc 1-day tour itinerary",
        lang="en",
        kind="pdf-scan",
        tags=["venue", "tour"],
    ),
    Doc(
        id="08",
        slug="08-dia-diem-tam-chuc",
        src="The Venue_Tam Chuc.pdf",
        title="The venue — Tam Chúc (Vesak International Convention Center)",
        lang="en",
        kind="pdf-scan",
        tags=["venue"],
    ),
    Doc(
        id="09",
        slug="09-mau-dang-ky-thi-kyu-dan",
        src="Mẫu đăng ký_VIKC2026_updated.xlsx",
        title="Mẫu đăng ký thi Kyu/Dan / Kyu-Dan registration workbook",
        lang="vi",
        kind="xlsx",
        tags=["form", "registration", "data"],
    ),
    Doc(
        id="10",
        slug="10-ban-do-tam-chuc",
        src="Tam Chuc Map.jpg",
        title="Bản đồ Tam Chúc / Tam Chúc site map",
        lang="en",
        kind="image",
        tags=["venue", "map"],
    ),
]

# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------


def strip_accents(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.replace("đ", "d").replace("Đ", "D")
    return value


def norm_ws(text: str) -> str:
    return re.sub(r"[ \t\u00a0]+", " ", text.replace("\u200b", "")).strip()


def md_escape_cell(text: str) -> str:
    text = norm_ws(text)
    text = text.replace("\\", "\\\\").replace("|", "\\|")
    return text.replace("\n", "<br>")


def slugify(text: str, fallback: str = "item") -> str:
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or fallback


def yaml_scalar(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


# --------------------------------------------------------------------------
# PDF text extraction
# --------------------------------------------------------------------------


@dataclass
class Block:
    page: int
    type: str  # heading | paragraph | list | table
    text: str
    markdown: str
    bbox: tuple[float, float, float, float]
    level: int | None = None
    rows: list[list[str | None]] | None = None
    font_size: float | None = None

    def to_json(self) -> dict:
        data: dict = {
            "page": self.page,
            "type": self.type,
            "text": self.text,
            "markdown": self.markdown,
            "bbox": [round(v, 2) for v in self.bbox],
        }
        if self.level is not None:
            data["level"] = self.level
        if self.rows is not None:
            data["rows"] = self.rows
        if self.font_size is not None:
            data["fontSize"] = round(self.font_size, 2)
        return data


def body_font_size(doc: "pymupdf.Document") -> float:
    """Most common rounded span size across the document == body text size."""
    counts: dict[float, int] = {}
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    if not norm_ws(span["text"]):
                        continue
                    size = round(span["size"], 1)
                    counts[size] = counts.get(size, 0) + len(norm_ws(span["text"]))
    if not counts:
        return 12.0
    return max(counts.items(), key=lambda kv: kv[1])[0]


def heading_level(size: float, body: float) -> int | None:
    if size >= body * 1.85:
        return 1
    if size >= body * 1.45:
        return 2
    if size >= body * 1.18:
        return 3
    return None


def looks_like_page_number(text: str) -> bool:
    return bool(re.fullmatch(r"[-–—\s]*\d{1,3}[-–—\s]*", text))


BULLET_START = re.compile(r"^[•·▪●\-\*–]\s+")
NUMBERED_SECTION = re.compile(r"^\d{1,2}\.\s+\S")
LETTERED_SECTION = re.compile(r"^[a-z]\)\s+\S")


def is_numbered_section(first: str, lines: list) -> bool:
    """Detect headings such as '3. Quy định trang phục' or '1. Thi 1 Kyu | Kyu Examination'."""
    if len(lines) > 1 or len(first) > 120:
        return False
    if not NUMBERED_SECTION.match(first):
        return False
    return not first.rstrip().endswith(".") or len(first) <= 100


def table_to_markdown(rows: list[list[str | None]]) -> str:
    width = max(len(r) for r in rows)
    grid = [[md_escape_cell(c or "") for c in (r + [None] * (width - len(r)))] for r in rows]
    lines = ["| " + " | ".join(grid[0]) + " |", "|" + "---|" * width]
    for row in grid[1:]:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def table_to_text(rows: list[list[str | None]]) -> str:
    return "\n".join(" | ".join(norm_ws(c or "") for c in r) for r in rows)


def block_bbox(block: dict) -> tuple[float, float, float, float]:
    return tuple(round(v, 2) for v in block["bbox"])  # type: ignore[return-value]


def intersection_ratio(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    inter = (x1 - x0) * (y1 - y0)
    area = max((a[2] - a[0]) * (a[3] - a[1]), 1e-6)
    return inter / area


def visual_rows(block: dict, table_boxes: list[tuple[float, float, float, float]] | None = None) -> list[dict]:
    """Re-assemble PDF lines of a block into visual rows.

    Some generators put the bullet marker and the bullet text in separate
    "lines" that share the same y; rows are clustered by vertical centre and
    then ordered left-to-right.
    """
    lines: list[dict] = []
    for line in block.get("lines", []):
        text = "".join(span["text"] for span in line["spans"])
        cleaned = norm_ws(text)
        if not cleaned:
            continue
        sizes = [span["size"] for span in line["spans"] if norm_ws(span["text"])]
        x0, y0, x1, y1 = line["bbox"]
        lines.append(
            {"text": cleaned, "x0": x0, "y0": y0, "x1": x1, "y1": y1,
             "cy": (y0 + y1) / 2, "size": max(sizes) if sizes else 0.0}
        )
    lines.sort(key=lambda ln: (ln["cy"], ln["x0"]))

    rows: list[dict] = []
    for line in lines:
        if rows:
            last = rows[-1]
            tolerance = 0.6 * min(line["y1"] - line["y0"], last["y1"] - last["y0"])
            if abs(line["cy"] - last["cy"]) <= tolerance:
                last["parts"].append(line)
                last["cy"] = sum(p["cy"] for p in last["parts"]) / len(last["parts"])
                last["x0"] = min(last["x0"], line["x0"])
                last["y0"] = min(last["y0"], line["y0"])
                last["x1"] = max(last["x1"], line["x1"])
                last["y1"] = max(last["y1"], line["y1"])
                last["size"] = max(last["size"], line["size"])
                continue
        rows.append(
            {"parts": [line], "cy": line["cy"], "x0": line["x0"], "y0": line["y0"],
             "x1": line["x1"], "y1": line["y1"], "size": line["size"]}
        )

    out: list[dict] = []
    for row in rows:
        parts = sorted(row["parts"], key=lambda p: p["x0"])
        entry = {
            "text": norm_ws(" ".join(p["text"] for p in parts)),
            "bbox": (row["x0"], row["y0"], row["x1"], row["y1"]),
            "size": row["size"],
        }
        # A block can span the table *and* the text below it, so the table
        # filter has to run per row, not per block.
        if table_boxes and any(intersection_ratio(entry["bbox"], tb) > 0.5 for tb in table_boxes):
            continue
        out.append(entry)
    return out


def group_rows_into_paragraphs(rows: list[dict], body: float) -> list[list[dict]]:
    """Split a block's visual rows into paragraphs / headings / lists."""
    if not rows:
        return []
    heights = [r["bbox"][3] - r["bbox"][1] for r in rows]
    typical = sorted(heights)[len(heights) // 2]
    groups: list[list[dict]] = [[rows[0]]]
    for prev, row in zip(rows, rows[1:]):
        text = row["text"]
        delta = row["bbox"][1] - prev["bbox"][3]
        row_big = row["size"] >= body * 1.18
        prev_big = prev["size"] >= body * 1.18
        if (
            BULLET_START.match(text)
            or NUMBERED_SECTION.match(text)
            or NUMBERED_SECTION.match(prev["text"])
            or (row_big and not prev_big)
            or (prev_big and not row_big)
            or LETTERED_SECTION.match(text)
            or delta > 0.5 * typical
        ):
            groups.append([row])
        else:
            groups[-1].append(row)
    return groups


def classify_paragraph(group: list[dict], body: float) -> tuple[str, int | None, str]:
    """Return (block type, heading level, markdown) for a paragraph group."""
    text = "\n".join(r["text"] for r in group)
    first = group[0]["text"]
    size = max(r["size"] for r in group)
    level = heading_level(size, body)
    if len(group) <= 1 and LETTERED_SECTION.match(first) and len(first) <= 120:
        return "heading", 4, "#### " + text.replace("\n", " ")
    if len(group) <= 3 and len(text) <= 160 and (level or is_numbered_section(first, group)):
        level = level or 3
        return "heading", level, "#" * level + " " + text.replace("\n", " ")
    if any(BULLET_START.match(r["text"]) for r in group):
        md_lines = [re.sub(r"^[•·▪●]\s*", "- ", r["text"]) for r in group]
        return "list", None, "\n".join(md_lines)
    return "paragraph", None, text


def extract_pdf_text(doc: "pymupdf.Document", d: Doc) -> tuple[list[Block], list[str]]:
    body = body_font_size(doc)
    blocks: list[Block] = []
    warnings: list[str] = []

    for pno, page in enumerate(doc, start=1):
        try:
            found = page.find_tables()
            tables = list(getattr(found, "tables", []) or [])
        except Exception as exc:  # pragma: no cover
            warnings.append(f"page {pno}: table detection failed ({exc})")
            tables = []

        table_entries = []
        for t in tables:
            rows = t.extract()
            if not rows or not any(any(norm_ws(c) for c in r if c) for r in rows):
                continue
            table_entries.append((tuple(round(v, 2) for v in t.bbox), rows))
        table_boxes = [e[0] for e in table_entries]

        items: list[tuple[float, float, str, object]] = []
        for bbox, rows in table_entries:
            items.append((bbox[1], bbox[0], "table", (bbox, rows)))

        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            bbox = block_bbox(block)
            if any(intersection_ratio(bbox, tb) > 0.5 for tb in table_boxes):
                continue
            rows = visual_rows(block, table_boxes)
            if not rows:
                continue
            for group in group_rows_into_paragraphs(rows, body):
                text = "\n".join(r["text"] for r in group)
                if looks_like_page_number(text):
                    continue
                gx0 = min(r["bbox"][0] for r in group)
                gy0 = min(r["bbox"][1] for r in group)
                gx1 = max(r["bbox"][2] for r in group)
                gy1 = max(r["bbox"][3] for r in group)
                kind, level, markdown = classify_paragraph(group, body)
                items.append(
                    (gy0, gx0, "text",
                     (kind, level, markdown, text, (gx0, gy0, gx1, gy1),
                      max(r["size"] for r in group)))
                )

        items.sort(key=lambda it: (round(it[0], 1), it[1]))

        for _, _, kind, payload in items:
            if kind == "table":
                bbox, rows = payload  # type: ignore[misc]
                blocks.append(
                    Block(page=pno, type="table", text=table_to_text(rows),
                          markdown=table_to_markdown(rows), bbox=bbox, rows=rows)
                )
                continue

            btype, level, markdown, text, bbox, size = payload  # type: ignore[misc]
            blocks.append(
                Block(page=pno, type=btype, level=level, text=text, markdown=markdown,
                      bbox=bbox, font_size=size)
            )

    return blocks, warnings


# --------------------------------------------------------------------------
# OCR (scanned PDFs)
# --------------------------------------------------------------------------


def render_pages(pdf: Path, out_dir: Path, dpi: int = OCR_DPI) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    paths = []
    try:
        for i, page in enumerate(doc, start=1):
            path = out_dir / f"page-{i:02d}.png"
            page.get_pixmap(dpi=dpi).save(path)
            paths.append(path)
    finally:
        doc.close()
    return paths


def run_ocr(images: list[Path], json_out: Path) -> list[dict]:
    cmd = ["swift", str(OCR_SWIFT), "--lang", OCR_LANGS, "--out", str(json_out)]
    cmd += [str(p) for p in images]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"OCR failed: {proc.stderr.strip()}")
    return json.loads(json_out.read_text())


def _split_axis(idx: list[int], boxes: dict[int, tuple], axis: int, min_gap: float) -> tuple[list[list[int]], float]:
    """Group indices on whitespace corridors along one axis. Returns (groups, widest gap)."""
    lo, hi = (0, 2) if axis == 0 else (1, 3)
    ordered = sorted(idx, key=lambda i: boxes[i][lo])
    groups: list[list[int]] = [[ordered[0]]]
    reach = boxes[ordered[0]][hi]
    biggest = 0.0
    for i in ordered[1:]:
        gap = boxes[i][lo] - reach
        if gap > 0:
            biggest = max(biggest, gap)
        if gap >= min_gap:
            groups.append([i])
            reach = boxes[i][hi]
        else:
            groups[-1].append(i)
            reach = max(reach, boxes[i][hi])
    return groups, biggest


def _xy_cut(idx: list[int], boxes: dict[int, tuple], depth: int = 0) -> list[int]:
    """Recursive XY-cut: recover column/row reading order from raw OCR boxes.

    Scanned layouts (itineraries, brochures) are multi-column; plain
    top-to-bottom ordering interleaves the columns and destroys meaning.
    """
    if len(idx) <= 1 or depth >= 6:
        return sorted(idx, key=lambda i: (round(boxes[i][1], 3), boxes[i][0]))
    x_groups, x_gap = _split_axis(idx, boxes, 0, min_gap=0.025)
    y_groups, y_gap = _split_axis(idx, boxes, 1, min_gap=0.020)
    if len(x_groups) > 1 and x_gap >= y_gap:
        out: list[int] = []
        for group in x_groups:
            out.extend(_xy_cut(group, boxes, depth + 1))
        return out
    if len(y_groups) > 1:
        out = []
        for group in y_groups:
            out.extend(_xy_cut(group, boxes, depth + 1))
        return out
    return sorted(idx, key=lambda i: (round(boxes[i][1], 3), boxes[i][0]))


def order_ocr_lines(lines: list[dict]) -> list[dict]:
    if len(lines) <= 2:
        return sorted(lines, key=lambda ln: (round(ln["y"], 3), ln["x"]))
    boxes = {
        i: (ln["x"], ln["y"], ln["x"] + ln["w"], ln["y"] + ln["h"])
        for i, ln in enumerate(lines)
    }
    return [lines[i] for i in _xy_cut(list(boxes), boxes)]


def ocr_lines_to_blocks(raw: list[dict], d: Doc, kept: list[Path]) -> tuple[list[Block], list[str]]:
    blocks: list[Block] = []
    warnings: list[str] = []
    for page_no, page in enumerate(raw, start=1):
        lines = order_ocr_lines(page.get("lines", []))
        low = [ln for ln in lines if ln["confidence"] < 0.5]
        if low:
            warnings.append(f"page {page_no}: {len(low)} low-confidence OCR line(s)")
        if not lines:
            warnings.append(f"page {page_no}: no text detected (image-only page)")
            asset = next((a for a in kept if a.name.startswith(f"{d.id}-")), None)
            rel = asset.relative_to(ROOT).as_posix() if asset else ""
            blocks.append(
                Block(
                    page=page_no,
                    type="image",
                    text="image-only page",
                    markdown=f"> Image-only page. Source render: `{rel}`",
                    bbox=(0.0, 0.0, 0.0, 0.0),
                )
            )
            continue
        for ln in lines:
            flag = "" if ln["confidence"] >= 0.5 else " <!-- low-confidence OCR -->"
            blocks.append(
                Block(
                    page=page_no,
                    type="ocr-line",
                    text=ln["text"],
                    markdown=ln["text"] + flag,
                    bbox=(ln["x"], ln["y"], ln["x"] + ln["w"], ln["y"] + ln["h"]),
                )
            )
    return blocks, warnings


def ocr_document(pdf: Path, d: Doc, tmp_dir: Path, assets_dir: Path) -> tuple[list[Block], list[str], list[Path]]:
    images = render_pages(pdf, tmp_dir / d.id)
    kept: list[Path] = []
    for src in images:
        dst = assets_dir / f"{d.id}-{src.name}"
        shutil.copyfile(src, dst)
        kept.append(dst)
    raw = run_ocr(images, tmp_dir / f"{d.id}-ocr.json")
    blocks, warnings = ocr_lines_to_blocks(raw, d, kept)
    return blocks, warnings, kept


def ocr_image(path: Path, d: Doc, tmp_dir: Path, assets_dir: Path) -> tuple[list[Block], list[str], list[Path]]:
    """OCR a standalone raster image (e.g. a map or poster) and keep it as an asset."""
    dst = assets_dir / f"{d.id}-{slugify(path.stem)}{path.suffix.lower()}"
    shutil.copyfile(path, dst)
    raw = run_ocr([path], tmp_dir / f"{d.id}-ocr.json")
    blocks, warnings = ocr_lines_to_blocks(raw, d, [dst])
    return blocks, warnings, [dst]


# --------------------------------------------------------------------------
# XLSX
# --------------------------------------------------------------------------


def render_sheet_markdown(title: str, rows: list[list[str | None]], csv_name: str, max_col: int) -> str:
    """Describe a spreadsheet sheet: header rows become a column dictionary, data stays in data/*.csv."""
    lines = [
        f"### Sheet: {title}",
        "",
        f"{len(rows)} non-empty rows x {max_col} columns. Values exported to `data/{csv_name}`.",
        "",
    ]
    # Rows 5 and 6 of this workbook are the two header rows (group + sub-header),
    # row 7 is the filled-in example row.
    if len(rows) >= 7:
        group_row, header_row, example_row = rows[4], rows[5], rows[6]
        lines += [
            "| # | Cột / Column | Nhóm / Group | Ví dụ / Example |",
            "|---|---|---|---|",
        ]
        for c in range(max_col):
            group = norm_ws(group_row[c]) if c < len(group_row) and group_row[c] else ""
            label = norm_ws(header_row[c]) if c < len(header_row) and header_row[c] else group
            example = norm_ws(example_row[c]) if c < len(example_row) and example_row[c] else ""
            lines.append(
                f"| {c + 1} | {md_escape_cell(label)} | {md_escape_cell(group)} | {md_escape_cell(example)} |"
            )
        lines.append("")
    return "\n".join(lines)


def convert_xlsx(path: Path, d: Doc, data_dir: Path) -> tuple[list[Block], list[str], list[Path]]:
    import openpyxl

    warnings: list[str] = []
    notes: list[str] = []
    wb = openpyxl.load_workbook(path, data_only=True)
    blocks: list[Block] = []
    written: list[Path] = []

    for sheet_no, ws in enumerate(wb.worksheets, start=1):
        sheet_slug = slugify(f"{d.id}-{ws.title}")
        rows = list(ws.iter_rows(values_only=True))
        trimmed: list[list[str | None]] = []
        for r in rows:
            if all(c is None or str(c).strip() == "" for c in r):
                continue
            trimmed.append([None if c is None else str(c) for c in r])
        if not trimmed:
            continue

        csv_path = data_dir / f"{sheet_slug}.csv"
        with csv_path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerows(trimmed)
        written.append(csv_path)

        json_path = data_dir / f"{sheet_slug}.json"
        json_path.write_text(
            json.dumps(
                {
                    "source": str(path.relative_to(ROOT)),
                    "sheet": ws.title,
                    "dimensions": ws.dimensions,
                    "rows": trimmed,
                    "mergedCells": sorted(str(m) for m in ws.merged_cells.ranges),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        written.append(json_path)

        blocks.append(
            Block(
                page=sheet_no,
                type="table",
                text=f"Sheet: {ws.title}",
                markdown=render_sheet_markdown(ws.title, trimmed, csv_path.name, ws.max_column),
                bbox=(0, 0, 0, 0),
                rows=trimmed[:200],
            )
        )
        notes.append(f"sheet '{ws.title}': {len(trimmed)} non-empty rows exported to data/")

    return blocks, notes, written


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------


def render_markdown(d: Doc, blocks: list[Block], meta: dict) -> str:
    front = [
        "---",
        f"docId: {d.id}",
        f"slug: {d.slug}",
        f"title: {yaml_scalar(d.title)}",
        f"source: {yaml_scalar(str(Path('resources/user-guide') / d.src))}",
        f"lang: {d.lang}",
        f"kind: {d.kind}",
        f"tags: [{', '.join(d.tags)}]",
        f"pages: {meta.get('pageCount', 1)}",
        f"sourceSha256: {meta['sha256']}",
        f"generatedBy: tools/vikc-guide/convert.py",
        f"generatedOn: {meta['generatedOn']}",
    ]
    warnings: list[str] = []
    if d.kind in ("pdf-scan", "image", "xlsx") or meta.get("warnings") or meta.get("notes"):
        method = {
            "pdf-scan": "ocr (macOS Vision, " + OCR_LANGS + ")",
            "image": "ocr (macOS Vision, " + OCR_LANGS + ")",
            "xlsx": "openpyxl (cell values, cached formula results)",
        }.get(d.kind, "embedded PDF text layer")
        front.append("extraction:")
        front.append(f"  method: {method}")
        if meta.get("warnings"):
            front.append("  warnings:")
            for w in meta["warnings"]:
                front.append(f"    - {yaml_scalar(w)}")
        if meta.get("notes"):
            front.append("  notes:")
            for n in meta["notes"]:
                front.append(f"    - {yaml_scalar(n)}")
    front += [
        "---",
        "",
        f"# {d.title}",
        "",
    ]

    body: list[str] = []
    current_page = 0
    for b in blocks:
        if b.page != current_page:
            current_page = b.page
            if meta.get("pageCount", 1) > 1 or d.kind not in ("pdf-text", "xlsx"):
                body.append(f"<!-- page {current_page} -->")
        if b.type == "table":
            body.append(b.markdown)
        else:
            body.append(b.markdown)
        body.append("")

    parts = front + body
    text = "\n".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.rstrip() + "\n"


def render_document_json(d: Doc, blocks: list[Block], meta: dict) -> dict:
    return {
        "docId": d.id,
        "slug": d.slug,
        "title": d.title,
        "source": str(Path("resources/user-guide") / d.src),
        "lang": d.lang,
        "kind": d.kind,
        "tags": d.tags,
        "pageCount": meta.get("pageCount", 1),
        "sha256": meta["sha256"],
        "generatedOn": meta["generatedOn"],
        "warnings": meta.get("warnings", []),
        "notes": meta.get("notes", []),
        "assets": meta.get("assets", []),
        "outline": [
            {"level": b.level, "text": b.text, "page": b.page}
            for b in blocks if b.type == "heading"
        ],
        "blocks": [b.to_json() for b in blocks],
    }


# --------------------------------------------------------------------------
# Driver
# --------------------------------------------------------------------------


def sha256_of(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def convert(d: Doc, tmp_dir: Path, force: bool) -> dict:
    src = SRC / d.src
    if not src.exists():
        return {"docId": d.id, "status": "missing", "path": str(src)}

    md_dir, json_dir, data_dir, assets_dir = (
        OUT / "md", OUT / "json", OUT / "data", OUT / "assets",
    )
    for p in (md_dir, json_dir, data_dir, assets_dir):
        p.mkdir(parents=True, exist_ok=True)

    md_path = md_dir / f"{d.slug}.md"
    json_path = json_dir / f"{d.slug}.json"
    digest = sha256_of(src)

    if not force and md_path.exists() and json_path.exists():
        try:
            existing = json.loads(json_path.read_text())
            if existing.get("sha256") == digest:
                return {"docId": d.id, "status": "unchanged", "path": str(md_path.relative_to(ROOT))}
        except json.JSONDecodeError:
            pass

    warnings: list[str] = []
    notes: list[str] = []
    assets: list[str] = []
    page_count = 1

    if d.kind == "xlsx":
        blocks, notes, _ = convert_xlsx(src, d, data_dir)
    elif d.kind == "pdf-scan":
        doc = pymupdf.open(src)
        page_count = doc.page_count
        doc.close()
        blocks, warnings, kept = ocr_document(src, d, tmp_dir, assets_dir)
        assets = [str(p.relative_to(ROOT)) for p in kept]
    elif d.kind == "image":
        blocks, warnings, kept = ocr_image(src, d, tmp_dir, assets_dir)
        assets = [str(p.relative_to(ROOT)) for p in kept]
    else:
        doc = pymupdf.open(src)
        page_count = doc.page_count
        blocks, warnings = extract_pdf_text(doc, d)
        doc.close()

    meta = {
        "sha256": digest,
        "generatedOn": date.today().isoformat(),
        "pageCount": page_count,
        "warnings": warnings,
        "notes": notes,
        "assets": assets,
    }

    md_path.write_text(render_markdown(d, blocks, meta), encoding="utf-8")
    json_path.write_text(
        json.dumps(render_document_json(d, blocks, meta), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    counts: dict[str, int] = {}
    for b in blocks:
        counts[b.type] = counts.get(b.type, 0) + 1

    return {
        "docId": d.id,
        "status": "converted",
        "path": str(md_path.relative_to(ROOT)),
        "blocks": len(blocks),
        "blockTypes": counts,
        "warnings": warnings,
        "notes": notes,
    }


def write_index(results: list[dict]) -> None:
    rows = []
    for d in CATALOGUE:
        rows.append(
            f"| {d.id} | [{d.title}](md/{d.slug}.md) | `{d.kind}` | {d.lang} | "
            f"[json](json/{d.slug}.json) | {', '.join(d.tags)} |"
        )
    body = "\n".join(rows)
    text = f"""---
title: "VIKC 2026 user guide — machine-readable corpus"
generatedBy: tools/vikc-guide/convert.py
generatedOn: {date.today().isoformat()}
---

# VIKC 2026 user guide — machine-readable corpus

Generated from `resources/user-guide/` by `tools/vikc-guide/convert.py`.

Everything here is derived and reproducible: re-run the converter to refresh.

## Layout

- `md/*.md` — one document per source file, structure preserved (headings,
  lists, Markdown tables), YAML front matter with `docId`, `slug`, `source`,
  `lang`, `tags`, `pages` and the source `sha256`.
- `json/*.json` — block-level structure: typed blocks (heading / paragraph /
  list / table / ocr-line) with `page`, `bbox`, `level`, table `rows` and an
  `outline` of headings. This is the format to consume from code.
- `data/*.csv` + `data/*.json` — spreadsheet sheets, one file pair per sheet.
- `assets/*.png` — page renders of the scanned documents (300 dpi) used for OCR.
- `schema.json` — JSON Schema for the `json/*.json` documents.

## Consume from code

```python
import json, pathlib

doc = json.loads(pathlib.Path("content/user-guide/json/04-dieu-le.json").read_text())

tables = [b for b in doc["blocks"] if b["type"] == "table"]
print(doc["outline"])          # section headings, in order
print(tables[0]["rows"][0])    # first row of the first table
```

## Documents

| ID | Document | Kind | Lang | Structured | Tags |
|----|----------|------|------|------------|------|
{body}

## Provenance & fidelity

- Text PDFs: text, reading order and tables are extracted from the PDF's own
  text layer (`pymupdf`), so wording is exact; tables are rebuilt from detected
  cell geometry (merged cells repeat the anchor cell, `None` → empty string).
- Scanned PDFs (`07`, `08`) and images (`10`): no text layer exists, content is
  recovered with macOS Vision OCR (`tools/vikc-guide/ocr.swift`) using
  `{OCR_LANGS}`. Expect OCR-level typos; the original renders are kept in
  `assets/` as the source of truth.
- Spreadsheets: cell values are exported verbatim; formulas are exported as
  their cached results (`data_only=True`), and merged ranges are listed in the
  JSON.

## Reproduce

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/vikc-guide/requirements.txt
.venv/bin/python tools/vikc-guide/convert.py --force
```

Requires macOS with Xcode command line tools for OCR (`swift`).

`--check` exits non-zero when any generated file is stale relative to its source.
"""
    (OUT / "README.md").write_text(text, encoding="utf-8")


SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "VIKC 2026 user-guide document",
    "type": "object",
    "required": ["docId", "slug", "title", "source", "sha256", "blocks"],
    "properties": {
        "docId": {"type": "string"},
        "slug": {"type": "string"},
        "title": {"type": "string"},
        "source": {"type": "string", "description": "path of the original file in the repository"},
        "lang": {"enum": ["vi", "en"]},
        "kind": {"enum": ["pdf-text", "pdf-scan", "xlsx", "image"]},
        "tags": {"type": "array", "items": {"type": "string"}},
        "pageCount": {"type": "integer"},
        "sha256": {"type": "string", "description": "hash of the source file at conversion time"},
        "generatedOn": {"type": "string", "format": "date"},
        "warnings": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "array", "items": {"type": "string"}},
        "assets": {"type": "array", "items": {"type": "string"}},
        "outline": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["level", "text", "page"],
                "properties": {
                    "level": {"type": "integer", "minimum": 1, "maximum": 6},
                    "text": {"type": "string"},
                    "page": {"type": "integer", "minimum": 1},
                },
            },
        },
        "blocks": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["page", "type", "text", "markdown", "bbox"],
                "properties": {
                    "page": {"type": "integer", "minimum": 1},
                    "type": {
                        "enum": ["heading", "paragraph", "list", "table", "ocr-line", "image"]
                    },
                    "text": {"type": "string"},
                    "markdown": {"type": "string"},
                    "bbox": {
                        "type": "array",
                        "items": {"type": "number"},
                        "minItems": 4,
                        "maxItems": 4,
                        "description": "[x0, y0, x1, y1] in PDF points, or fractions for OCR blocks",
                    },
                    "level": {"type": "integer", "minimum": 1, "maximum": 6},
                    "fontSize": {"type": "number"},
                    "rows": {
                        "type": "array",
                        "items": {"type": "array", "items": {"type": ["string", "null"]}},
                    },
                },
            },
        },
    },
}


def write_schema() -> Path:
    path = OUT / "schema.json"
    path.write_text(json.dumps(SCHEMA, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def check_freshness(selected: list[Doc]) -> int:
    stale: list[str] = []
    for d in selected:
        src = SRC / d.src
        json_path = OUT / "json" / f"{d.slug}.json"
        md_path = OUT / "md" / f"{d.slug}.md"
        if not src.exists():
            stale.append(f"{d.id}: source missing ({src})")
            continue
        if not (json_path.exists() and md_path.exists()):
            stale.append(f"{d.id}: not generated yet")
            continue
        recorded = json.loads(json_path.read_text()).get("sha256")
        if recorded != sha256_of(src):
            stale.append(f"{d.id}: source changed since generation")
    if stale:
        for item in stale:
            print(f"STALE {item}")
        print("\nrun: .venv/bin/python tools/vikc-guide/convert.py")
        return 1
    print(f"ok: {len(selected)} document(s) up to date")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", action="append", default=[], help="doc id(s) to convert, e.g. --only 04")
    ap.add_argument("--force", action="store_true", help="reconvert even when the source hash is unchanged")
    ap.add_argument("--tmp", default="/tmp/vikc-guide", help="working directory for OCR renders")
    ap.add_argument("--check", action="store_true", help="only verify that generated files are up to date")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    tmp_dir = Path(args.tmp)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    selected = [d for d in CATALOGUE if not args.only or d.id in args.only]

    if args.check:
        return check_freshness(selected)

    results = []
    for d in selected:
        res = convert(d, tmp_dir, force=args.force)
        results.append(res)
        flag = {"converted": "OK ", "unchanged": "-- ", "missing": "!! "}.get(res["status"], "?  ")
        extra = f"{res.get('blocks', 0)} blocks" if res.get("blocks") else ""
        print(f"{flag}{d.id} {d.slug:45s} {res['status']:9s} {extra}")
        for w in res.get("warnings", []):
            print(f"     warn: {w}")
        for n in res.get("notes", []):
            print(f"     note: {n}")

    write_index(results)
    write_schema()
    print(f"\nindex written: {(OUT / 'README.md').relative_to(ROOT)}")

    if any(r["status"] == "missing" for r in results):
        print("\nsome sources were missing — check resources/user-guide/ contents", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
