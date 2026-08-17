// Headless economy simulation — runs the REAL game sim with a scripted player.
// Usage: node model/simulate.mjs [years] [seed] > model/run.csv

// state.js touches localStorage only inside save/load; stub it for Node.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

import { createState, canPlace, place, idx } from '../src/core/state.js';
import { makeSim } from '../src/core/sim.js';
import { recruitSoldier } from '../src/core/raids.js';
import { sell } from '../src/core/trade.js';
import { territorySize } from '../src/core/territory.js';
import { MAP, SEASON_TICKS, BUILDINGS } from '../src/config.js';

const YEARS = Number(process.argv[2] || 12);
const SEED = Number(process.argv[3] || 42);
const N = MAP.size;

const state = createState(SEED);
const sim = makeSim(state);

const count = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0).length;
const foodEq = () => state.res.food + state.res.bread * 2;

// find any claimed tile where `type` can be placed
function findSpot(type) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  // search outward from the keep so layouts stay compact
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

// ── Scripted player: greedy priorities, evaluated every 10 ticks ──
function playerPolicy() {
  const pop = state.pop;
  // 1. food first: keep enough farms+docks to feed everyone with margin
  const foodBuildings = count('farm') + count('dock');
  if (foodBuildings * 0.5 < pop * 0.04 * 1.6 + 0.3) {
    if (tryBuild('farm') || tryBuild('dock')) return;
  }
  // 2. housing when full
  if (state.pop >= state.popCap - 1 && foodEq() > pop * 2) {
    if (tryBuild('house')) return;
  }
  // 3. raw production chains — depleted sites don't count: the bot pushes
  // replacement camps/quarries/mines toward live ground as deposits give out.
  // (Spent tiles TRANSFORM — HILLS→PLAINS, ORE→HILLS — so canPlace's terrain
  // checks steer new sites to live stone/ore automatically.)
  const live = (t) => state.buildings.filter(
    (b) => b.type === t && b.hp > 0 && !b.depleted).length;
  if (live('lumber') < 3 && tryBuild('lumber')) return;
  if (live('quarry') < 2 && state.res.wood > 40 && tryBuild('quarry')) return;
  if (live('mine') < 2 && state.res.wood > 50 && tryBuild('mine')) return;
  if (count('smelter') < 1 && state.res.ore > 15 && tryBuild('smelter')) return;
  if (count('bakery') < 2 && state.res.food > 80 && tryBuild('bakery')) return;
  if (count('market') < 1 && state.res.wood > 60 && tryBuild('market')) return;
  // 4. defense: a tower per ~120 territory tiles, barracks, soldiers
  const terr = territorySize(state);
  if (count('tower') < Math.floor(terr / 120) && tryBuild('tower')) return;
  if (count('barracks') < 1 && state.res.iron >= 8 && tryBuild('barracks')) return;
  if (state.soldiers.length < 8) recruitSoldier(state);
  // 5. churches for morale/influence once comfortable
  if (count('church') < 2 && state.res.gold > 40 && state.res.stone > 40 && tryBuild('church')) return;
}

// sell surplus when the merchant is around (like a real player would)
function tradePolicy() {
  if (state.merchant.status !== 'here') return;
  for (const r of ['wood', 'stone', 'food', 'iron']) {
    const keep = r === 'food' ? state.pop * 3 : 80;
    const surplus = Math.floor(state.res[r] - keep);
    if (surplus > 10) sell(state, r, Math.min(surplus, 50));
  }
}

// ── Run ────────────────────────────────────────────────────────────
const raidDamage = { buildingsLost: 0, raidsSeen: 0 };
let lastBuildingCount = 1;

const rows = [['year', 'season', 'pop', 'popCap', 'soldiers', 'territory',
  'food', 'bread', 'foodEq', 'wood', 'stone', 'ore', 'iron', 'gold',
  'farms', 'bakeries', 'towers', 'buildings', 'morale', 'raidsSeen', 'buildingsLost']];

const TICKS = YEARS * SEASON_TICKS * 4;
for (let t = 0; t < TICKS; t++) {
  sim.tick();
  if (t % 10 === 0) playerPolicy();
  tradePolicy();

  // track raid losses
  if (state.raid.phase === 'active' && state.raid.timer !== -1) {
    if (state.raid._counted !== state.raid.wave) {
      state.raid._counted = state.raid.wave;
      raidDamage.raidsSeen++;
    }
    const bc = state.buildings.length;
    if (bc < lastBuildingCount) raidDamage.buildingsLost += lastBuildingCount - bc;
  }
  lastBuildingCount = state.buildings.length;

  if (state.tick % 60 === 0) {
    const year = 1 + Math.floor(state.tick / (SEASON_TICKS * 4));
    const season = Math.floor(state.tick / SEASON_TICKS) % 4;
    rows.push([year, season, state.pop, state.popCap, state.soldiers.length, territorySize(state),
      state.res.food.toFixed(0), state.res.bread.toFixed(0), foodEq().toFixed(0),
      state.res.wood.toFixed(0), state.res.stone.toFixed(0), state.res.ore.toFixed(0),
      state.res.iron.toFixed(0), state.res.gold.toFixed(0),
      count('farm'), count('bakery'), count('tower'), state.buildings.length,
      state.morale.toFixed(0), raidDamage.raidsSeen, raidDamage.buildingsLost]);
  }
}

console.log(rows.map((r) => r.join(',')).join('\n'));
console.error(`\nFinal: pop ${state.pop}, gold ${state.res.gold.toFixed(0)}, territory ${territorySize(state)}, ` +
  `raids ${raidDamage.raidsSeen}, buildings lost ${raidDamage.buildingsLost}, ` +
  `crowns ${JSON.stringify(state.crowns)}`);
