#!/bin/zsh
# Deposit sweep: 4 scenarios x 5 seeds, 25 years each.
# Writes summaries.jsonl + one trajectory CSV per run under model/out/deposit-sweep/.
cd "$(dirname "$0")/.."
OUT=model/out/deposit-sweep
mkdir -p "$OUT"
: > "$OUT/summaries.jsonl"
for scen in "low 60 40" "mid 90 90" "high 150 150" "rec 250 150" "control inf inf"; do
  set -- ${=scen}
  name=$1; stone=$2; ore=$3
  for seed in 8 42 7 123 99; do
    echo "run: $name seed=$seed (stone=$stone ore=$ore)" >&2
    KSIM_STONE_BASE=$stone KSIM_ORE_BASE=$ore \
      node model/deposit-sweep-run.mjs 25 $seed "$OUT/${name}-s${seed}.csv" \
      | sed "s/^{/{\"scenario\":\"$name\",/" >> "$OUT/summaries.jsonl"
  done
done
echo done >&2
