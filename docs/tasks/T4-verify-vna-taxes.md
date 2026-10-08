# T4 — Verify VNA fare-matrix price semantics

**Read first:** [`docs/handoff.md`](../handoff.md) §5–6; `src/providers/vietnam-airlines.ts`.
Status: ⏳ ready (independent of T0/T1).

## Goal
Confirm `totalPrice` from VNA `fare-matrix` = total for 1 adult, round trip, **taxes and
fees included**, and that USD is the only currency returned. Result decides whether the
UI may label it "tổng giá".

## Steps
1. `pnpm crawl --dry-run --provider vna --from SGN --to HAN --date 2026-11-18 --return 2026-11-22`;
   note the VND + USD for the 18/11→22/11 cell.
2. On vietnamairlines.com (normal browser, human or real-browser automation, no scripting
   of their booking API), search SGN→HAN round trip 18/11–22/11, 1 adult, and read the
   cheapest "Tổng" incl. taxes.
3. Compare. Within ~5 % (FX + timing) → taxes included. Otherwise find out what the number is
   (base fare? one-way?) and document.
4. Optional single extra request: does adding `"currencyCode":"VND"` or an `Authorization`
   header change the currency? (Max 2 requests.)
5. Write findings into `docs/spec-flight-crawler.md` (Sources table + gotcha), adjust the
   adapter comment / field if semantics differ.

## Done when
Spec states verified semantics with date of check and the two numbers compared; the arrow in
[`docs/status-web.md`](../status-web.md) §3 and §7 reflects the outcome.
