# AGENTS.md

If you are continuing work on the **[refined] VIKC 2026 trip registration
spreadsheet**, start with:

1. [`docs/handoff.md`](docs/handoff.md) — full context transfer + exact next steps
2. [`docs/spec-trip-registration.md`](docs/spec-trip-registration.md) — the spec
3. [`docs/status-trip-registration.md`](docs/status-trip-registration.md) — phase status

Setup:

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/vikc-guide/requirements.txt
.venv/bin/python tools/build_trip_registration.py
```

Work one phase at a time: **build → verify → show the user → proceed → commit**.
Phase 5 (`CHI PHÍ` cost engine) is next; ask the 3 open questions in
`docs/handoff.md` §8 first.

The rest of the repo is the VIKC 2026 user-guide corpus — see `README.md` and
`tools/vikc-guide/`.
