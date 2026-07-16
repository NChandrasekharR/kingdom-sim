// Single-run tracer: node sim2/run.mjs <scenario> [seed] [--csv]
// Prints yearly snapshots + a verdict. With --csv writes sim2/out/<scenario>.csv
import { World } from './world.mjs';
import { DEFAULTS, withOverrides } from './params.mjs';
import { makeEventRunner } from './events.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

async function loadScenario(name) {
  const mod = await import(`./scenarios/${name}.mjs`);
  return mod.default;
}

export function runOnce(scenario, seed, { trace = false } = {}) {
  const P = withOverrides(DEFAULTS, scenario.params);
  const w = new World(P, seed);
  const runEvents = makeEventRunner(scenario);
  const rows = [];
  const TICKS = P.years * P.ticksPerYear;
  for (let t = 0; t < TICKS; t++) {
    w.step();
    runEvents(w);
    if (trace && w.tick % 60 === 0) rows.push(w.snapshot());
    if (w.pop <= 0) { w._collapsed = true; break; }
  }
  return { world: w, rows, final: w.snapshot() };
}

// ── verdict: is this run "interesting"? ────────────────────────────
export function verdict(w) {
  const s = w.stats;
  const ticks = w.tick;
  const collapsed = w.pop <= 1;
  const crisisFrac = s.ticksInCrisis / ticks;
  const recov = s.recoveryTicks.filter((x) => x < 9999);
  const neverRecovered = s.recoveryTicks.filter((x) => x >= 9999).length;
  const avgRecovery = recov.length ? recov.reduce((a, b) => a + b, 0) / recov.length : 0;
  const finalProsp = w.prosperity();

  // "interesting" = survived, spent real time under pressure, but wasn't ground
  // to dust or left to trivially snowball
  const tense = crisisFrac > 0.05 && crisisFrac < 0.55;
  const survived = !collapsed && neverRecovered === 0;
  const notRunaway = finalProsp < 60000; // arbitrary "trivialized" ceiling
  const interesting = survived && tense && notRunaway;

  let label = 'INTERESTING';
  if (collapsed) label = 'COLLAPSE';
  else if (neverRecovered > 0) label = 'DEATH-SPIRAL';
  else if (crisisFrac <= 0.05) label = 'TOO-EASY';
  else if (crisisFrac >= 0.55) label = 'TOO-PUNISHING';
  else if (!notRunaway) label = 'RUNAWAY';

  return {
    label, interesting, collapsed,
    crisisFrac: +crisisFrac.toFixed(3),
    avgRecoveryTicks: Math.round(avgRecovery),
    neverRecovered,
    finalProsperity: Math.round(finalProsp),
    raids: s.raids, warlords: s.warlords,
    buildingsLost: s.buildingsLost, villagersLost: s.villagersLost, mastersLost: s.mastersLost,
    villagersHunted: s.villagersHunted || 0,
    huntFrac: s.villagersLost ? +((s.villagersHunted || 0) / s.villagersLost).toFixed(2) : 0,
    outputLostToHp: Math.round(s.outputLostToHp),
    peakPop: s.peakPop, finalPop: w.pop,
    finalGold: Math.round(w.res.gold),
    tributeGold: Math.round(s.tributeGold || 0),
    tributesPaid: s.tributesPaid || 0,
  };
}

async function main() {
  const [name = 'baseline', seedArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const csv = process.argv.includes('--csv');
  const seed = seedArg ? Number(seedArg) : 12345;
  const scenario = await loadScenario(name);

  const { world, rows, final } = runOnce(scenario, seed, { trace: true });
  const v = verdict(world);

  console.log(`\n=== ${scenario.name}: ${scenario.description} ===`);
  console.log(`seed ${seed}\n`);
  const cols = ['year', 'pop', 'masters', 'avgSkill', 'buildings', 'avgHp', 'supplyCut',
    'food', 'wood', 'iron', 'gold', 'prosperity', 'raids', 'buildingsLost', 'fed'];
  console.log(cols.join('\t'));
  const yearly = rows.filter((r, i) => i === 0 || r.year !== rows[i - 1].year);
  for (const r of yearly) console.log(cols.map((c) => r[c]).join('\t'));

  console.log(`\n── verdict: ${v.label} ──`);
  console.log(JSON.stringify(v, null, 2));

  if (csv) {
    const header = Object.keys(rows[0]).join(',');
    const body = rows.map((r) => Object.values(r).join(',')).join('\n');
    const path = `sim2/out/${name}.csv`;
    writeFileSync(path, header + '\n' + body);
    console.log(`\nwrote ${path}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
