#!/bin/sh
# Run every war doctrine across seeds (Campaign 17, design/FATES.md §10).
# Usage: sh model/warlord-saga-batch.sh [years] [seeds...]
# PARALLEL=n sets how many reigns run at once (default 4).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
YEARS="${1:-40}"
shift 1 2>/dev/null || shift $#
SEEDS="$*"
[ -z "$SEEDS" ] && SEEDS="1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20"
OUT="$ROOT/model/out/warlord-saga"
mkdir -p "$OUT"
DOCTRINES="${DOCTRINES:-butcher merciful opportunist mixed payer turtle}"
for d in $DOCTRINES; do
  for s in $SEEDS; do echo "$d $s"; done
done | xargs -P "${PARALLEL:-4}" -n 2 sh -c 'node "'"$ROOT"'/model/warlord-saga-run.mjs" "$0" "'"$YEARS"'" "$1" > "'"$OUT"'/$0-$1.json" 2> "'"$OUT"'/$0-$1.err"'
echo done
