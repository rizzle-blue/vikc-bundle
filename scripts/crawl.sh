#!/usr/bin/env bash
# Run the flight-fare crawl on demand (no scheduler, no background job).
#
#   ./scripts/crawl.sh run             crawl now → Supabase if .env holds the project's
#                                      SECRET key, otherwise the local store (data/fares)
#   ./scripts/crawl.sh run --dry-run   crawl to a JSON file in packages/flight-crawler/out/
#   ./scripts/crawl.sh run --from SGN --to HAN --date 2026-11-18 --return 2026-11-22
#   ./scripts/crawl.sh status          recent runs + cheapest fare per registered search
#
# Equivalent without the wrapper: `pnpm crawl …` and `pnpm fares`.
# Every run is appended to data/crawl.log.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
mkdir -p data

cmd_run() {
  echo "$(date '+%F %T') run: pnpm crawl $*" | tee -a data/crawl.log
  pnpm crawl "$@" 2>&1 | tee -a data/crawl.log
}

cmd_status() {
  echo "== stored fares =="
  pnpm --silent fares 2>&1 | grep -v '^\[store\]'
  echo
  echo "== last runs (data/crawl.log) =="
  [ -f data/crawl.log ] && grep -E 'run: pnpm crawl|^\[store\]|^\[vna|^\[vietjet' data/crawl.log | tail -n 12 || echo "no runs yet"
}

case "${1:-}" in
  run)    shift; cmd_run "$@" ;;
  status) cmd_status ;;
  *) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
