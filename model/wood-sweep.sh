#!/bin/sh
# Wood retune sweep: woodBase ∈ {250,350,450} × seeds, 25-year runs.
# Usage: sh model/wood-sweep.sh
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/model/out/polish"
mkdir -p "$OUT"
for base in 250 350 450; do
  var=$((base / 2))
  for s in 42 7 123; do
    KSIM_WOOD_BASE=$base KSIM_WOOD_VAR=$var \
      node "$ROOT/model/depletion-polish-run.mjs" 25 "$s" \
      > "$OUT/wood-$base-$s.json" 2> "$OUT/wood-$base-$s.err" &
  done
done
wait
for base in 250 350 450; do
  for s in 42 7 123; do cat "$OUT/wood-$base-$s.json"; done
done
