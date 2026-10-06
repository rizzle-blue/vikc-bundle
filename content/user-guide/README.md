---
title: "VIKC 2026 user guide — machine-readable corpus"
generatedBy: tools/vikc-guide/convert.py
generatedOn: 2026-10-06
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
| 01 | [Chương trình giải / Championships programme](md/01-chuong-trinh-thi-dau.md) | `pdf-text` | vi | [json](json/01-chuong-trinh-thi-dau.json) | programme, schedule |
| 02 | [Entry fee — thành viên VKF / VKF members](md/02-le-phi-thanh-vien-vkf.md) | `pdf-text` | vi | [json](json/02-le-phi-thanh-vien-vkf.json) | fees, entry |
| 03 | [Entry fee — không phải thành viên VKF / non-VKF members](md/03-le-phi-khong-phai-thanh-vien-vkf.md) | `pdf-text` | vi | [json](json/03-le-phi-khong-phai-thanh-vien-vkf.json) | fees, entry |
| 04 | [Điều lệ thi đấu / Competition regulations](md/04-dieu-le.md) | `pdf-text` | vi | [json](json/04-dieu-le.json) | regulations, rules |
| 05 | [Thông tin thi Kyu/Dan và mẫu đăng ký / Kyu-Dan exam information & application form](md/05-thi-kyu-dan-va-mau-dang-ky.md) | `pdf-text` | vi | [json](json/05-thi-kyu-dan-va-mau-dang-ky.json) | grading, kyu-dan, form |
| 06 | [Hướng dẫn thanh toán / Payment instructions](md/06-huong-dan-thanh-toan.md) | `pdf-text` | vi | [json](json/06-huong-dan-thanh-toan.json) | payment |
| 07 | [Tam Chúc 1-day tour itinerary](md/07-tour-tam-chuc-1-ngay.md) | `pdf-scan` | en | [json](json/07-tour-tam-chuc-1-ngay.json) | venue, tour |
| 08 | [The venue — Tam Chúc (Vesak International Convention Center)](md/08-dia-diem-tam-chuc.md) | `pdf-scan` | en | [json](json/08-dia-diem-tam-chuc.json) | venue |
| 09 | [Mẫu đăng ký thi Kyu/Dan / Kyu-Dan registration workbook](md/09-mau-dang-ky-thi-kyu-dan.md) | `xlsx` | vi | [json](json/09-mau-dang-ky-thi-kyu-dan.json) | form, registration, data |
| 10 | [Bản đồ Tam Chúc / Tam Chúc site map](md/10-ban-do-tam-chuc.md) | `image` | en | [json](json/10-ban-do-tam-chuc.json) | venue, map |

## Provenance & fidelity

- Text PDFs: text, reading order and tables are extracted from the PDF's own
  text layer (`pymupdf`), so wording is exact; tables are rebuilt from detected
  cell geometry (merged cells repeat the anchor cell, `None` → empty string).
- Scanned PDFs (`07`, `08`) and images (`10`): no text layer exists, content is
  recovered with macOS Vision OCR (`tools/vikc-guide/ocr.swift`) using
  `vi-VN,en-US`. Expect OCR-level typos; the original renders are kept in
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
