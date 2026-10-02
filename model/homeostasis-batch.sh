#!/bin/sh
# Run every homeostasis variant across seeds, 4 at a time.
# Usage: sh model/homeostasis-batch.sh [years] [seeds...]
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
YEARS="${1:-30}"
shift 1 2>/dev/null || shift $#
SEEDS="$*"
[ -z "$SEEDS" ] && SEEDS="42 7 123 99 2024"
OUT="$ROOT/model/out/homeostasis"
mkdir -p "$OUT"
VARIANTS="${VARIANTS:-baseline shipped sqrt sqrtsoft sqrtA sqrtB leanfood taperfood charcoal combined combined2}"
for v in $VARIANTS; do
  for s in $SEEDS; do echo "$v $s"; done
done | xargs -P 4 -n 2 sh -c 'node "'"$ROOT"'/model/homeostasis-run.mjs" "$0" "'"$YEARS"'" "$1" > "'"$OUT"'/$0-$1.json" 2> "'"$OUT"'/$0-$1.err"'
echo done
