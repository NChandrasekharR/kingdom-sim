// Controlled probe for the §3 slice (design/HOMEOSTASIS.md): grow a realm with
// the homeostasis bot, snapshot it, then replay the SAME stretch of years many
// times on copies — paired trials, one with the defence feature on and one
// with it off, each pair sharing a sim seed. The bot does not play during the
// trials: the realm defends itself as it stands.
// Usage: node model/defence-probe.mjs <refuges|garrisons> <seed> [snapYear] [trials] [years]
// Prints one JSON line.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const MODE = process.argv[2] || 'refuges';
const SEED = Number(process.argv[3] || 7);
const SNAP_YEAR = Number(process.argv[4] || 15);
const TRIALS = Number(process.argv[5] || 20);
const YEARS = Number(process.argv[6] || 3);

const dir = new URL('./out/defence-probe/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const snap = `${dir}snap-${MODE}-${SEED}-y${SNAP_YEAR}.json`;
// refuges are probed on the shipped realm; garrisons on the bot that posts them
execFileSync('node', [new URL('./homeostasis-run.mjs', import.meta.url).pathname,
  MODE === 'garrisons' ? 'garrisons' : 'shipped', String(SNAP_YEAR), String(SEED)],
{ env: { ...process.env, KSIM_SNAPSHOT: snap }, stdio: ['ignore', 'ignore', 'inherit'] });
const raw = readFileSync(snap, 'utf8');
globalThis.localStorage = { getItem: () => raw, setItem: () => {}, removeItem: () => {} };

const { loadGame } = await import('../src/core/state.js');
const { makeSim } = await import('../src/core/sim.js');
const { SEASON_TICKS, REFUGE } = await import('../src/config.js');
const CAP0 = { ...REFUGE.capacity };

function trial(on, i) {
  REFUGE.capacity = MODE === 'refuges' && !on ? {} : { ...CAP0 };
  const state = loadGame();
  state.seed = SEED * 1000 + i;            // the pair shares this stream
  if (MODE === 'garrisons' && !on) {
    for (const b of state.buildings) if (b.type === 'barracks') b.garrison = false;
    for (const s of state.soldiers) s.postId = null;
  }
  const s0 = { ...state.stats };
  const sim = makeSim(state);
  const ticks = YEARS * SEASON_TICKS * 4;
  for (let t = 0; t < ticks; t++) sim.tick();
  const d = (k) => (state.stats[k] || 0) - (s0[k] || 0);
  return {
    raids: d('raids'), hunted: d('villagersHunted'),
    craftMastersLost: d('mastersLost') - d('veteransFallen'),
    soldiersFallen: d('soldiersFallen'), veteransFallen: d('veteransFallen'),
    sacked: d('buildingsSacked'), keepFalls: d('keepFalls'),
  };
}

const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);
const off = [], on = [];
for (let i = 0; i < TRIALS; i++) { off.push(trial(false, i)); on.push(trial(true, i)); }
const keys = ['raids', 'hunted', 'craftMastersLost', 'soldiersFallen', 'veteransFallen', 'sacked', 'keepFalls'];
const tot = (rows) => Object.fromEntries(keys.map((k) => [k, sum(rows, k)]));
let better = 0, worse = 0;
for (let i = 0; i < TRIALS; i++) {
  const k = MODE === 'refuges' ? 'hunted' : 'soldiersFallen';
  if (on[i][k] < off[i][k]) better++; else if (on[i][k] > off[i][k]) worse++;
}
console.log(JSON.stringify({ mode: MODE, seed: SEED, snapYear: SNAP_YEAR, trials: TRIALS, years: YEARS,
  off: tot(off), on: tot(on), pairs: { better, worse, same: TRIALS - better - worse } }));
