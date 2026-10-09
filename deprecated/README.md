# deprecated

Parked code from earlier attempts. Kept for reference and history — **not built, not tested, not
maintained**. Nothing in `src/`, `supabase/` or `scripts/` imports anything from here.

| Path | What it was | Why it is here |
|---|---|---|
| `flight-crawler/` | TypeScript flight-fare crawler (Vietnam Airlines fare matrix, local/Supabase sinks, CLI) | The product became the member app; fare tracking is secondary and the VietJet adapter was never made to work. Self-contained: `cd deprecated/flight-crawler && pnpm install && pnpm test` if it is ever needed again. |
| `tools/build_trip_registration.py` | Python generator that built the original Google-Sheets-bound `.xlsx` trip sheet | Replaced by the web app. The spreadsheet spec lives on in `docs/archive/spreadsheet-track/`. |
| `tools/vikc-guide/` | PDF → Markdown/JSON conversion pipeline for the user-guide corpus | Only needed to regenerate `content/`, which nothing uses any more. |
| `content/` | Generated corpus (per-document Markdown, JSON, CSV, page renders) | Regenerable from `resources/user-guide/` with `deprecated/tools/vikc-guide`. |
| `deliverables/` | The built `VIKC2026-trip-registration-refined.xlsx` workbook | Superseded by the app + Supabase. |
| `reference-sheets/` | The v1 sheets and the copy pulled from Drive | Historical input for the spreadsheet generator. |

Relative links inside these files point at where those documents used to live (for example
`../handoff.md`, `status-web.md`); they now sit in `docs/`. Nothing here is link-checked.

Still in use: `resources/members.json` (the roster that `pnpm seed:members` turns into
`supabase/seed_members.sql`) and `resources/user-guide/` (the original PDFs, the source of truth for
trip facts).
