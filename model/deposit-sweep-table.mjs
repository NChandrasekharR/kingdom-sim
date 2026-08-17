// Aggregate model/out/deposit-sweep/summaries.jsonl into the sweep table.
import { readFileSync } from 'node:fs';

const lines = readFileSync(new URL('./out/deposit-sweep/summaries.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));

const fmt = (v) => (v == null ? '—' : typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : String(v));
const med = (arr) => {
  const a = arr.filter((v) => v != null).sort((x, y) => x - y);
  if (!a.length) return null;
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const rng = (arr) => {
  const a = arr.filter((v) => v != null);
  return a.length ? `${Math.min(...a)}-${Math.max(...a)}` : '—';
};

console.log('per-run detail:');
console.log(['scen', 'seed', 'q1stDepl', 'q1stReloc', 'm1stDepl', 'm1stReloc', 'vein1st',
  'hillsFlat', 'veinsSpent', 'cascStone', 'ironLastYr', 'oreFrac', 'stoneFrac', 'pop', 'minPop', 'gold', 'iron', 'stone', 'ore',
  'mines(depl)', 'quarries(depl)', 'keepFalls'].join('\t'));
for (const r of lines) {
  console.log([r.scenario, r.seed, fmt(r.firsts.quarryDepleted), fmt(r.firsts.quarryRelocated),
    fmt(r.firsts.mineDepleted), fmt(r.firsts.mineRelocated), fmt(r.firsts.veinSpent),
    r.hillsFlattened, r.veinsSpent, fmt(r.cascadeStone), fmt(r.lastIronGainYear),
    fmt(r.oreFracConsumed), fmt(r.stoneFracConsumed),
    r.final.pop, r.final.minPop, r.final.gold, r.final.iron, r.final.stone, r.final.ore,
    `${r.final.mines}(${r.final.minesDepleted})`, `${r.final.quarries}(${r.final.quarriesDepleted})`,
    r.final.keepFalls].join('\t'));
}

console.log('\nscenario medians (ranges):');
console.log(['scen', 'q1stDepl', 'm1stDepl', 'vein1st', 'hillsFlat', 'veinsSpent',
  'oreFrac', 'pop', 'gold', 'iron', 'keepFalls'].join('\t'));
for (const scen of ['low', 'mid', 'high', 'rec', 'control']) {
  const g = lines.filter((r) => r.scenario === scen);
  const col = (f) => g.map(f);
  console.log([scen,
    `${fmt(med(col((r) => r.firsts.quarryDepleted)))} (${rng(col((r) => r.firsts.quarryDepleted))})`,
    `${fmt(med(col((r) => r.firsts.mineDepleted)))} (${rng(col((r) => r.firsts.mineDepleted))})`,
    `${fmt(med(col((r) => r.firsts.veinSpent)))} (${rng(col((r) => r.firsts.veinSpent))})`,
    `${fmt(med(col((r) => r.hillsFlattened)))} (${rng(col((r) => r.hillsFlattened))})`,
    `${fmt(med(col((r) => r.veinsSpent)))} (${rng(col((r) => r.veinsSpent))})`,
    fmt(med(col((r) => r.oreFracConsumed))),
    `${fmt(med(col((r) => r.final.pop)))} (${rng(col((r) => r.final.pop))})`,
    `${fmt(med(col((r) => r.final.gold)))} (${rng(col((r) => r.final.gold))})`,
    `${fmt(med(col((r) => r.final.iron)))} (${rng(col((r) => r.final.iron))})`,
    col((r) => r.final.keepFalls).reduce((a, b) => a + b, 0),
  ].join('\t'));
}
