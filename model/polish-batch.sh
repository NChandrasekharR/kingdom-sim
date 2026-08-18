#!/bin/sh
# Run the depletion-polish measurement across seeds in parallel.
# Usage: sh model/polish-batch.sh <tag> [years] [seeds...]
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-run}"
YEARS="${2:-25}"
shift 2 2>/dev/null || shift $#
SEEDS="$*"
[ -z "$SEEDS" ] && SEEDS="42 7 123 99"
OUT="$ROOT/model/out/polish"
mkdir -p "$OUT"
for s in $SEEDS; do
  node "$ROOT/model/depletion-polish-run.mjs" "$YEARS" "$s" > "$OUT/$TAG-$s.json" 2> "$OUT/$TAG-$s.err" &
done
wait
for s in $SEEDS; do cat "$OUT/$TAG-$s.json"; done
