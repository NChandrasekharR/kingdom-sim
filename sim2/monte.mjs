// Monte Carlo harness: run a scenario across many seeds (and optionally sweep a
// parameter grid), then aggregate the "interestingness" distribution.
//
//   node sim2/monte.mjs <scenario> [--runs N] [--sweep key=a,b,c ...]
//
// Examples:
//   node sim2/monte.mjs baseline --runs 200
//   node sim2/monte.mjs baseline --runs 60 --sweep raid.raiderDmgPerTick=1.5,2.5,4 hp.decayPerTick=0.03,0.05,0.08
//
import { World } from './world.mjs';
import { DEFAULTS, withOverrides } from './params.mjs';
import { makeEventRunner } from './events.mjs';
import { runOnce, verdict } from './run.mjs';
import { writeFileSync } from 'node:fs';

async function loadScenario(name) {
  return (await import(`./scenarios/${name}.mjs`)).default;
}

// set a dotted path on a nested object (returns a fresh override object)
function dotOverride(path, value) {
  const parts = path.split('.');
  const root = {};
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = {}; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = value;
  return root;
}

function mergeAll(objs) {
  return objs.reduce((acc, o) => withOverrides(acc, o), {});
}

function parseArgs(argv) {
  const out = { runs: 100, sweeps: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--runs') out.runs = Number(argv[++i]);
    else if (argv[i] === '--sweep') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        const [key, vals] = argv[++i].split('=');
        out.sweeps.push({ key, values: vals.split(',').map(Number) });
      }
    } else if (!argv[i].startsWith('--') && !out.scenario) out.scenario = argv[i];
  }
  out.scenario ||= 'baseline';
  return out;
}

// cartesian product of sweep dimensions → list of {overrides, label}
function gridPoints(sweeps) {
  if (!sweeps.length) return [{ overrides: {}, label: 'default' }];
  let combos = [[]];
  for (const s of sweeps) {
    const next = [];
    for (const c of combos) for (const v of s.values) next.push([...c, { key: s.key, value: v }]);
    combos = next;
  }
  return combos.map((combo) => ({
    overrides: mergeAll(combo.map((c) => dotOverride(c.key, c.value))),
    label: combo.map((c) => `${c.key.split('.').pop()}=${c.value}`).join(' '),
  }));
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenario = await loadScenario(args.scenario);
  const points = gridPoints(args.sweeps);

  console.log(`\nMonte Carlo — scenario "${scenario.name}", ${args.runs} seeds × ${points.length} grid point(s)\n`);

  const table = [];
  for (const pt of points) {
    const merged = { ...scenario, params: withOverrides(scenario.params || {}, pt.overrides) };
    const labels = {};
    const finals = [], crisis = [], prosp = [], recov = [];
    let interesting = 0, spirals = 0, collapses = 0;

    for (let i = 0; i < args.runs; i++) {
      const seed = 1000 + i * 7919;
      const { world } = runOnce(merged, seed);
      const v = verdict(world);
      labels[v.label] = (labels[v.label] || 0) + 1;
      if (v.interesting) interesting++;
      if (v.label === 'DEATH-SPIRAL') spirals++;
      if (v.collapsed) collapses++;
      crisis.push(v.crisisFrac);
      prosp.push(v.finalProsperity);
      if (v.avgRecoveryTicks) recov.push(v.avgRecoveryTicks);
    }

    const row = {
      point: pt.label,
      interesting: +(interesting / args.runs).toFixed(2),
      collapse: +(collapses / args.runs).toFixed(2),
      spiral: +(spirals / args.runs).toFixed(2),
      crisisMed: +pct(crisis, 0.5).toFixed(2),
      prospMed: Math.round(pct(prosp, 0.5)),
      prospP90: Math.round(pct(prosp, 0.9)),
      recovMean: Math.round(mean(recov)),
      breakdown: Object.entries(labels).sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k}:${n}`).join(' '),
    };
    table.push(row);
    console.log(`${pt.label.padEnd(38)} interesting=${(row.interesting * 100).toFixed(0)}% ` +
      `collapse=${(row.collapse * 100).toFixed(0)}% crisisMed=${row.crisisMed} ` +
      `prospMed=${row.prospMed}  [${row.breakdown}]`);
  }

  // write full results
  const path = `sim2/out/monte-${args.scenario}.json`;
  writeFileSync(path, JSON.stringify({ scenario: scenario.name, runs: args.runs, table }, null, 2));
  console.log(`\nwrote ${path}`);

  // headline
  const best = [...table].sort((a, b) => b.interesting - a.interesting)[0];
  console.log(`\nBest grid point: "${best.point}" — ${(best.interesting * 100).toFixed(0)}% interesting runs`);
}

main();
