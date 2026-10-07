# VIKC 2026 — user guide corpus

Machine-readable version of the 1st Vietnam International Kendo Championships
2026 user guide.

## Layout

| Path | What |
|---|---|
| `resources/user-guide/` | **source of truth** — the original PDFs and the registration workbook |
| `content/user-guide/md/` | Markdown per document, structure preserved (headings, lists, tables) + YAML front matter |
| `content/user-guide/json/` | block-level structure (type, page, bbox, table rows, heading outline) — the format to consume from code |
| `content/user-guide/data/` | spreadsheet exports (CSV + JSON per sheet) |
| `content/user-guide/assets/` | 300 dpi page renders of the scanned brochures |
| `content/user-guide/schema.json` | JSON Schema for `json/*.json` |
| `tools/vikc-guide/` | the conversion pipeline (`convert.py`, `ocr.swift`) |

Start at [`content/user-guide/README.md`](content/user-guide/README.md) for the
document index, and [`tools/vikc-guide/README.md`](tools/vikc-guide/README.md)
for how the conversion works and how to add a document.

## Documents

| ID | Document | Extracted from |
|---|---|---|
| 01 | Chương trình / programme | embedded text layer |
| 02 | Entry fee — VKF members | embedded text layer |
| 03 | Entry fee — non-VKF members | embedded text layer |
| 04 | Điều lệ / regulations | embedded text layer |
| 05 | Kyu/Dan exam info & application form | embedded text layer |
| 06 | Payment instructions | embedded text layer |
| 07 | Tam Chúc 1-day tour | OCR (macOS Vision) |
| 08 | The venue — Tam Chúc | OCR (macOS Vision) |
| 09 | Kyu/Dan registration workbook | openpyxl → CSV/JSON |
| 10 | Bản đồ Tam Chúc / site map | OCR (macOS Vision) |

## Refresh

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/vikc-guide/requirements.txt
.venv/bin/python tools/vikc-guide/convert.py --force
.venv/bin/python tools/vikc-guide/convert.py --check   # fails if artefacts are stale
```

Conversion is incremental: a document is rebuilt only when its source file's
sha256 changes. Regenerating never touches `resources/`.

## Trip registration spreadsheet (separate deliverable)

A separate, spec-driven rebuild of the Shakaijin team's VIKC 2026 signup sheet
(enroll · categories · cost estimate · agenda). See:

- [`docs/spec-trip-registration.md`](docs/spec-trip-registration.md) — spec
- [`docs/status-trip-registration.md`](docs/status-trip-registration.md) — phase status
- [`docs/handoff.md`](docs/handoff.md) — **start here to continue the work**

```bash
.venv/bin/python tools/build_trip_registration.py
```
