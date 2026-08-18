#!/bin/sh
# One woodBase value across seeds. Usage: sh model/wood-one.sh <base> [seeds...]
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/model/out/polish"
mkdir -p "$OUT"
BASE="$1"; shift
VAR=$((BASE / 2))
SEEDS="$*"
[ -z "$SEEDS" ] && SEEDS="42 7 123 99"
for s in $SEEDS; do
  KSIM_WOOD_BASE=$BASE KSIM_WOOD_VAR=$VAR \
    node "$ROOT/model/depletion-polish-run.mjs" 25 "$s" \
    > "$OUT/wood-$BASE-$s.json" 2> "$OUT/wood-$BASE-$s.err" &
done
wait
for s in $SEEDS; do cat "$OUT/wood-$BASE-$s.json"; done
