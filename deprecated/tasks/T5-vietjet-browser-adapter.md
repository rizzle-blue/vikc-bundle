# T5 — VietJet browser-capture adapter (PARKED)

**Status:** 🅿️ **parked 2026-10-08** — not on the critical path. The product needs arrival/departure
datetimes and progress tracking (T7); the VNA crawl already covers the optional fares panel.
Restart only if the owner asks for VietJet coverage again.

**Read first:** [`docs/handoff.md`](../handoff.md) §2 (**Bot-protection boundary**), §5, §6.
**Owner gate:** the site is WAF-protected; the boundary in handoff §2 is binding.

## Where it got to (2026-10-08, ~10 probe iterations, `scripts/spike-vietjet.ts`)

Working: real Chrome reaches the site; form field map established (one-way radio, departure = un-id'd
MUI input, destination `#arrivalPlaceDesktop`); the date widget is `react-date-range` and the date
**can** be set via DOM events on `.rdrDayNumber` (verified `Ngày đi 18/11/2026`).

Not working: the MUI autocomplete route selection does not reliably commit to app state (the input
shows `SGN`/`HAN` but the app resets it on submit → its own validation message *"Vui lòng điền đầy
đủ thông tin tìm kiếm chuyến bay"*), and marketing overlays intermittently intercept pointer clicks.
No search has ever completed with a valid route+date, so no results HTML has been captured and no
parser exists yet. **No protection wall was hit** — the blockers are ordinary front-end complexity.

## Goal

Fares for VietJet (VJ) and the four one-way legs the VNA adapter cannot answer, captured by
driving the **public booking UI in a real browser** and reading the response the page itself
sends. No unsigned public endpoint is known; the direct API is AES-encrypted, SHA-256 signed,
device-id gated and behind AWS WAF — **we do not re-implement any of that**.

## Hard rules

**Allowed**
- Playwright driving the public UI like a person: fill origin/destination/date, click search.
- Read `POST vietjet-api.vietjetair.com/booking/api/v1/search-flight` from
  `page.on("response")` — the request the page itself made, in our own browser session.
- A plain, unmodified browser: real Chrome channel, normal UA/viewport, headless or headed as
  the site permits — no flags added to look like something it is not.
- Human pace: 3–8 s between actions, ≤ 1 date search per run per route, no parallel tabs.

**Not allowed — stop and close the card instead**
- Re-implementing the request encryption / `_signature` / device-id generation.
- Forging or refreshing WAF/anti-bot tokens, or replaying captured tokens.
- Stealth/anti-detection plugins, fingerprint spoofing, captcha solving, proxy/IP rotation.
- Retrying past a challenge (captcha, 403, WAF interstitial, endless "đang tìm kiếm").
- A bogus `Không tìm thấy chuyến bay` for a route that obviously has flights counts as
  **blocked**, not as "empty".

On any challenge: throw `BlockedError` with the evidence (final URL, HTTP status, screenshot
path), let the runner mark the run `blocked` and skip the provider for the rest of the run.

## Steps

1. **Spike (done 2026-10-08, `scripts/spike-vietjet.ts`).** Headless Chromium and the machine's real
   Google Chrome both reach `/vi/select-flight` with the route applied and get a session
   (`POST /booking/api/v1/get-session` → 200 `sessionId`), but the page never issues the
   `search-flight` request, so results render “Không tìm thấy chuyến bay”. AWS WAF is active.
   **Next experiment (needs the owner at the machine):** the same script with `--headed` — a visible
   Chrome window that a person could have opened. If a headed run still produces no `search-flight`
   request, close this card as *blocked — not feasible without evading protections* (handoff §2)
   and keep VNA as the only source.
2. `src/providers/vietjet-browser.ts` — two clearly separated parts:
   - `captureVietjetSearch(q, opts)` — Playwright: navigate, fill the form, submit, await the
     `search-flight` response, return raw JSON. Bounded timeouts; screenshot + final URL into
     `out/` on failure.
   - `parseVietjetSearchFlight(raw, q)` — **pure** function → `FareOffer[]` (`kind: "itinerary"`,
     `priceCurrency: "VND"`, `dedupeKey: vietjet|SGN-HAN|date|flightNo|ADT1`). No network, so the
     unit test uses a committed fixture.
3. Register in `src/providers/index.ts`; `supports()` must accept the four one-way searches and
   the round-trip ones VNA also covers (VNA's `calendar` rows stay; VJ adds `itinerary` rows).
4. Fixture: one successful capture, **scrubbed** of session ids/tokens/cookies, saved as
   `test/fixtures/vietjet/real-<route>-<date>.json` + a test that every offer passes
   `FareOffer.parse` and dates/flight numbers match the query.
5. `pnpm crawl --dry-run --provider vietjet --from SGN --to HAN --date 2026-11-18` → `ok (n)`.
6. Run it on demand (this is the production path — no CI, no scheduler):
   ```bash
   pnpm exec playwright install chromium        # one-time, ~150 MB
   pnpm crawl --dry-run --provider vietjet --from SGN --to HAN --date 2026-11-18
   ./scripts/crawl.sh run                       # VNA + VietJet
   ```
   The browser must work from the owner's machine (residential IP, headed or headless — an
   unmodified browser either way). If the browser leg makes runs uncomfortably slow, keep VietJet
   on a `--provider vietjet` invocation the owner triggers separately from the VNA crawl.
7. Prove stability: ≥ 3 successful runs triggered at different times, with VJ offers and no
   `blocked` status, before calling it done.

## If the capture gets blocked

Report the evidence, then pick **with the owner**:
- run the browser leg only when the owner triggers it (e.g. `pnpm crawl --provider vietjet`), less
  often than the VNA crawl, while VNA keeps running on demand as usual; or
- accept VNA-only coverage and say so in the UI; or
- buy a licensed data source.

Never "fix" it by evading the block.

## Done when

Adapter returns VJ offers in ≥ 3 runs triggered at different times, fixture test green,
`pnpm test && pnpm typecheck` green, spec + [`status-web.md`](../status-web.md) updated — or the
card is closed with the written blocked note and the same doc updates.
