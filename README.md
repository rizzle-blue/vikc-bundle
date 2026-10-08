# VIKC 2026 — user guide corpus

Machine-readable version of the 1st Vietnam International Kendo Championships
2026 user guide.

> **Web migration in progress:** flight-fare crawler → Supabase → Vercel web app.
> Start at [`docs/handoff.md`](docs/handoff.md) · status [`docs/status-web.md`](docs/status-web.md) ·
> task board [`docs/tasks/`](docs/tasks/README.md) · engine spec
> [`docs/spec-flight-crawler.md`](docs/spec-flight-crawler.md).

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

## Web migration (active work)

The trip tooling is moving to a **web app on Vercel** (Supabase for data): the entry point where
Shakaijin members **enroll in the trip, register their categories and see their estimated cost** —
plus a view of current SGN↔HAN fares. A TypeScript crawler collects those fares on demand
(`pnpm crawl`); it runs when the owner triggers it, with no scheduler anywhere.

```bash
pnpm install && pnpm test && pnpm typecheck && pnpm crawl --dry-run
pnpm crawl                          # one crawl → Supabase, else the local store (data/fares)
pnpm fares                          # cheapest fare per registered search
./scripts/crawl.sh run|status       # same, plus data/crawl.log
```

- [`docs/handoff.md`](docs/handoff.md) — **start here to continue the work**
- [`docs/status-web.md`](docs/status-web.md) — step/task status + verification evidence
- [`docs/tasks/`](docs/tasks/README.md) — one card per task (T7 = the app members use)
- [`docs/spec-flight-crawler.md`](docs/spec-flight-crawler.md) — crawler engine spec

**Dropped tracks:** the earlier Google-Spreadsheet deliverable
(`tools/build_trip_registration.py`, `deliverables/`) is frozen and unmaintained — see
[`docs/archive/spreadsheet-track/`](docs/archive/spreadsheet-track/README.md) (its spec still holds
the enrollment/cost domain rules for the web app). SerpApi was dropped in favour of first-party
sources (Vietnam Airlines public endpoint + a VietJet browser adapter).
