// One deposit-sweep run: real sim, scripted player (same policy as simulate.mjs),
// depletion instrumentation. Reserve sizes come from env (read by config.js):
//   KSIM_STONE_BASE / KSIM_ORE_BASE  (value "inf" = bottomless control)
// Usage: node model/deposit-sweep-run.mjs <years> <seed> <trajectory.csv>
// Prints a JSON summary line to stdout; writes the trajectory CSV to argv[3].

import { writeFileSync } from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { createState, canPlace, place } = await import('../src/core/state.js');
const { makeSim } = await import('../src/core/sim.js');
const { recruitSoldier } = await import('../src/core/raids.js');
const { sell } = await import('../src/core/trade.js');
const { territorySize } = await import('../src/core/territory.js');
const { MAP, SEASON_TICKS, T } = await import('../src/config.js');

const YEARS = Number(process.argv[2] || 25);
const SEED = Number(process.argv[3] || 42);
const OUT_CSV = process.argv[4] || null;
const N = MAP.size;

const state = createState(SEED);
const sim = makeSim(state);

// map-wide reserve baselines (before a single pick swings)
const countTiles = (tt) => { let n = 0; for (let i = 0; i < N * N; i++) if (state.terrain[i] === tt) n++; return n; };
const sumStock = (arr) => { let s = 0; for (let i = 0; i < N * N; i++) if (Number.isFinite(arr[i])) s += arr[i]; return s; };
const initial = {
  oreTiles: countTiles(T.ORE), hillTiles: countTiles(T.HILLS),
  oreTotal: sumStock(state.oreStock), stoneTotal: sumStock(state.stoneStock),
};
const infiniteOre = initial.oreTiles > 0 && initial.oreTotal === 0;   // Infinity stocks sum to 0 via the isFinite filter
const infiniteStone = initial.hillTiles > 0 && initial.stoneTotal === 0;

const count = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0).length;
const countDepleted = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0 && b.depleted).length;
const foodEq = () => state.res.food + state.res.bread * 2;

function findSpot(type) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  for (let r = 1; r < N; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = keep.x + dx, y = keep.y + dy;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        if (canPlace(state, type, x, y).ok) return { x, y };
      }
    }
    if (r > 40) break;
  }
  return null;
}
function tryBuild(type) {
  const spot = findSpot(type);
  if (!spot) return false;
  return place(state, type, spot.x, spot.y).ok;
}

// same scripted player as model/simulate.mjs (relocation-aware for all three chains)
function playerPolicy() {
  const pop = state.pop;
  const foodBuildings = count('farm') + count('dock');
  if (foodBuildings * 0.5 < pop * 0.04 * 1.6 + 0.3) {
    if (tryBuild('farm') || tryBuild('dock')) return;
  }
  if (state.pop >= state.popCap - 1 && foodEq() > pop * 2) {
    if (tryBuild('house')) return;
  }
  const live = (t) => state.buildings.filter(
    (b) => b.type === t && b.hp > 0 && !b.depleted).length;
  if (live('lumber') < 3 && tryBuild('lumber')) return;
  if (live('quarry') < 2 && state.res.wood > 40 && tryBuild('quarry')) return;
  if (live('mine') < 2 && state.res.wood > 50 && tryBuild('mine')) return;
  if (count('smelter') < 1 && state.res.ore > 15 && tryBuild('smelter')) return;
  if (count('bakery') < 2 && state.res.food > 80 && tryBuild('bakery')) return;
  if (count('market') < 1 && state.res.wood > 60 && tryBuild('market')) return;
  const terr = territorySize(state);
  if (count('tower') < Math.floor(terr / 120) && tryBuild('tower')) return;
  if (count('barracks') < 1 && state.res.iron >= 8 && tryBuild('barracks')) return;
  if (state.soldiers.length < 8) recruitSoldier(state);
  if (count('church') < 2 && state.res.gold > 40 && state.res.stone > 40 && tryBuild('church')) return;
}
function tradePolicy() {
  if (state.merchant.status !== 'here') return;
  for (const r of ['wood', 'stone', 'food', 'iron']) {
    const keep = r === 'food' ? state.pop * 3 : 80;
    const surplus = Math.floor(state.res[r] - keep);
    if (surplus > 10) sell(state, r, Math.min(surplus, 50));
  }
}

// ── instrumentation ────────────────────────────────────────────────
const yearOf = (tick) => 1 + Math.floor(tick / (SEASON_TICKS * 4));
const firsts = {
  quarryDepleted: null,   // a quarry's reach ran dry (relocation follows)
  quarryRelocated: null,  // a replacement quarry actually raised after a depletion
  mineDepleted: null,
  mineRelocated: null,
  veinSpent: null,        // first ORE tile exhausted (→ HILLS)
  hillFlattened: null,    // first HILLS tile exhausted (→ PLAINS)
};
let prevQuarries = 0, prevMines = 0;
let minPop = state.pop;
let prevIron = 0, lastIronGainYear = null;   // last year the smelter actually put iron in the store

const rows = [['year', 'pop', 'soldiers', 'gold', 'stone', 'ore', 'iron', 'wood',
  'quarries', 'quarriesDepleted', 'mines', 'minesDepleted', 'smelters',
  'hillsFlattened', 'veinsSpent', 'forestCleared', 'keepFalls']];

const TICKS = YEARS * SEASON_TICKS * 4;
for (let t = 0; t < TICKS; t++) {
  sim.tick();
  if (t % 10 === 0) playerPolicy();
  tradePolicy();

  const y = yearOf(state.tick);
  const qd = countDepleted('quarry'), md = countDepleted('mine');
  const q = count('quarry'), m = count('mine');
  if (qd > 0 && firsts.quarryDepleted == null) firsts.quarryDepleted = y;
  if (md > 0 && firsts.mineDepleted == null) firsts.mineDepleted = y;
  if (firsts.quarryDepleted != null && firsts.quarryRelocated == null && q > prevQuarries) firsts.quarryRelocated = y;
  if (firsts.mineDepleted != null && firsts.mineRelocated == null && m > prevMines) firsts.mineRelocated = y;
  prevQuarries = Math.max(prevQuarries, q); prevMines = Math.max(prevMines, m);
  if ((state.stats.veinsSpent || 0) > 0 && firsts.veinSpent == null) firsts.veinSpent = y;
  if ((state.stats.hillsFlattened || 0) > 0 && firsts.hillFlattened == null) firsts.hillFlattened = y;
  if (state.pop < minPop) minPop = state.pop;
  if (state.res.iron > prevIron + 0.001) lastIronGainYear = y;
  prevIron = state.res.iron;

  if (state.tick % 120 === 0) {
    rows.push([y, state.pop, state.soldiers.length, state.res.gold.toFixed(0),
      state.res.stone.toFixed(0), state.res.ore.toFixed(0), state.res.iron.toFixed(0), state.res.wood.toFixed(0),
      q, qd, m, md, count('smelter'),
      state.stats.hillsFlattened || 0, state.stats.veinsSpent || 0, state.stats.forestCleared || 0,
      state.stats.keepFalls || 0]);
  }
}

if (OUT_CSV) writeFileSync(OUT_CSV, rows.map((r) => r.join(',')).join('\n') + '\n');

const oreRemaining = sumStock(state.oreStock);
const stoneRemaining = sumStock(state.stoneStock);
const summary = {
  seed: SEED, years: YEARS,
  stoneBase: process.env.KSIM_STONE_BASE || 'default', oreBase: process.env.KSIM_ORE_BASE || 'default',
  initialOreTiles: initial.oreTiles, initialHillTiles: initial.hillTiles,
  oreFracConsumed: infiniteOre ? null : initial.oreTotal > 0 ? +((initial.oreTotal - oreRemaining) / initial.oreTotal).toFixed(3) : null,
  stoneFracConsumed: infiniteStone ? null : initial.stoneTotal > 0 ? +((initial.stoneTotal - stoneRemaining) / initial.stoneTotal).toFixed(3) : null,
  firsts,
  lastIronGainYear,
  hillsFlattened: state.stats.hillsFlattened || 0,
  veinsSpent: state.stats.veinsSpent || 0,
  cascadeStone: Math.round(state.stats.cascadeStone || 0),
  forestCleared: state.stats.forestCleared || 0,
  final: {
    pop: state.pop, minPop, gold: Math.round(state.res.gold),
    stone: Math.round(state.res.stone), ore: Math.round(state.res.ore), iron: Math.round(state.res.iron),
    soldiers: state.soldiers.length, territory: territorySize(state),
    quarries: count('quarry'), quarriesDepleted: countDepleted('quarry'),
    mines: count('mine'), minesDepleted: countDepleted('mine'),
    keepFalls: state.stats.keepFalls || 0,
    crowns: state.crowns,
  },
};
console.log(JSON.stringify(summary));
