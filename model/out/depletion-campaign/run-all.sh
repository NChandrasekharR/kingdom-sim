#!/usr/bin/env bash
# Depletion follow-through campaign runner.
# Runs all campaign seeds at 25 years, baseline (no trade rescue) and TRADE=1.
# CSVs land beside this script; per-run stderr summaries collect in summaries.txt.
set -euo pipefail
cd "$(dirname "$0")/../../.."   # -> worktree root
OUT="model/out/depletion-campaign"
YEARS="${1:-25}"
SEEDS="8 37 42 7 123"

: > "$OUT/summaries.txt"
for s in $SEEDS; do
  echo "=== seed $s  baseline ($YEARS y) ===" | tee -a "$OUT/summaries.txt"
  node model/simulate.mjs "$YEARS" "$s" \
    > "$OUT/seed-$s-baseline.csv" 2>> "$OUT/summaries.txt"
done
for s in 8 37; do
  echo "=== seed $s  TRADE ($YEARS y) ===" | tee -a "$OUT/summaries.txt"
  TRADE=1 node model/simulate.mjs "$YEARS" "$s" \
    > "$OUT/seed-$s-trade.csv" 2>> "$OUT/summaries.txt"
done
echo "ALL DONE"
