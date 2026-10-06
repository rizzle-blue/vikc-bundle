# VIKC 2026 user-guide conversion pipeline

Turns `resources/user-guide/` (PDF + XLSX — human-only formats) into the
machine-readable corpus in `content/user-guide/`.

## Run

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/vikc-guide/requirements.txt
.venv/bin/python tools/vikc-guide/convert.py            # incremental (sha256 based)
.venv/bin/python tools/vikc-guide/convert.py --force    # rebuild everything
.venv/bin/python tools/vikc-guide/convert.py --only 04  # one document
.venv/bin/python tools/vikc-guide/convert.py --check     # CI: are the artefacts stale?
```

OCR needs macOS + Xcode command line tools (`swift`, Vision framework).

## Files

| File | Role |
|---|---|
| `convert.py` | the whole pipeline: catalogue, extraction, rendering, index, schema |
| `ocr.swift` | macOS Vision OCR CLI (page image → lines with confidence + normalized boxes) |
| `requirements.txt` | Python dependencies |

## How each source type is handled

**Text PDFs** (`kind: pdf-text`) — no OCR involved:

1. `pymupdf` exposes the embedded text layer as blocks → lines → spans.
2. Lines are re-assembled into *visual rows* (bullet glyphs are often their own
   PDF line), then rows are grouped into paragraphs using font size, blank
   space, bullet/numbered/lettered patterns.
3. Tables are detected geometrically (`page.find_tables()`); rows that fall
   inside a table are dropped from the text stream so content is not duplicated,
   and tables are re-emitted as Markdown pipe tables (merged cells repeat the
   anchor value, `None` → empty string).
4. Blocks are ordered by page, then y, then x.

**Scanned PDFs and raster images** (`kind: pdf-scan` / `image`) — no text layer:

1. Pages are rendered at 300 dpi into `content/user-guide/assets/`.
2. `ocr.swift` runs Vision's accurate recogniser with `vi-VN,en-US`.
3. Lines are re-ordered with a recursive **XY-cut**, which recovers column-major
   reading order for brochure/itinerary layouts instead of interleaving columns.
4. Lines below 0.5 confidence are flagged inline and in the front matter;
   image-only pages are recorded as `image` blocks pointing at the render.

For a standalone raster file (`kind: image`, e.g. the site map) the file itself
is copied into `assets/` and OCR'd directly — one "page".

**Spreadsheets** (`kind: xlsx`):

- Every sheet is exported to `data/<slug>.csv` and `data/<slug>.json`
  (values verbatim, formulas as cached results, merged ranges listed).
- The Markdown file describes the sheet with a column dictionary built from the
  two header rows plus the example row.

## Adding a document

1. Drop the file into `resources/user-guide/`.
2. Add a `Doc(...)` entry to `CATALOGUE` in `convert.py` (id, slug, filename,
   title, lang, kind, tags).
3. Run `convert.py --only <id>`.

`--check` fails when a source file's sha256 no longer matches the hash recorded
in the generated JSON, so it can be wired into CI.
