#!/bin/zsh
cd "$(dirname "$0")/.."
while true; do
  n=$(wc -l < model/out/deposit-sweep/summaries.jsonl 2>/dev/null || echo 0)
  if [ "$n" -ge 20 ]; then echo "sweep complete: $n runs"; break; fi
  sleep 20
done
