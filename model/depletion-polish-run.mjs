// One depletion-polish measurement run: real sim, the same scripted player as
// model/simulate.mjs, plus the instrumentation this batch needs:
//   • per-chain SITE LIFETIME (sites built ÷ years elapsed, the campaign's method)
//   • GHOST REPAIR (repair wood spent on depleted producer buildings)
//   • vein richness multipliers and deep-vein mining
//   • the merchant buy cap (goods bought, buys blocked by the cap)
// Usage: node model/depletion-polish-run.mjs <years> <seed>
// Prints one JSON summary line to stdout.

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { createState, canPlace, place } = await import('../src/core/state.js');
const { makeSim } = await import('../src/core/sim.js');
const { recruitSoldier } = await import('../src/core/raids.js');
const { sell } = await import('../src/core/trade.js');
const { territorySize } = await import('../src/core/territory.js');
const { MAP, SEASON_TICKS, FOREST, T } = await import('../src/config.js');

const YEARS = Number(process.argv[2] || 25);
const SEED = Number(process.argv[3] || 42);
const N = MAP.size;

const state = createState(SEED);
const sim = makeSim(state);

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
const built = { lumber: 0, quarry: 0, mine: 0 };
function tryBuild(type) {
  const spot = findSpot(type);
  if (!spot) return false;
  const ok = place(state, type, spot.x, spot.y).ok;
  if (ok && built[type] != null) built[type]++;
  return ok;
}

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
const TICKS = YEARS * SEASON_TICKS * 4;

// ghost repair: wood delta attributable to buildings that are already depleted.
// maintenanceTick repairs worst-first out of a shared labor/materials pool, so
// the honest proxy is "HP healed on depleted buildings × repairWoodPerHp".
// We snapshot HP of depleted producers before/after each tick.
let ghostHpHealed = 0, totalHpHealed = 0;
let year3 = null, yearSnaps = {};
let hpSum20 = 0, hpN20 = 0;    // mean building HP fraction, year 20+
let minPop = state.pop;
let deepMined = false;

const isProducer = (b) => b.type === 'lumber' || b.type === 'quarry' || b.type === 'mine';

for (let t = 0; t < TICKS; t++) {
  const before = new Map();
  for (const b of state.buildings) before.set(b.id, { hp: b.hp, dep: !!b.depleted });

  sim.tick();
  if (t % 10 === 0) playerPolicy();
  tradePolicy();

  for (const b of state.buildings) {
    const pre = before.get(b.id);
    if (!pre) continue;
    const healed = b.hp - pre.hp;
    if (healed > 0) {
      totalHpHealed += healed;
      if (pre.dep && isProducer(b)) ghostHpHealed += healed;
    }
  }

  if (state.res.ore > 0 && (state._deepVeinStruck || state.deepVeinStruck)) deepMined = true;
  if (state.pop < minPop) minPop = state.pop;

  const y = yearOf(state.tick);
  if (y >= 20) {
    let s = 0, n = 0;
    for (const b of state.buildings) { if (b.type === 'keep') continue; s += b.hp / b.maxHp; n++; }
    if (n) { hpSum20 += s / n; hpN20++; }
  }
  if (state.tick % (SEASON_TICKS * 4) === 0) {
    yearSnaps[y] = { pop: state.pop, wood: Math.round(state.res.wood), gold: Math.round(state.res.gold),
      iron: Math.round(state.res.iron), buildings: state.buildings.length };
    if (y === 3) year3 = yearSnaps[y];
  }
}

// site lifetime: sites raised over the run vs the years they had to cover.
// The campaign's method: a chain running continuously with `k` concurrent sites
// for Y years and `built` sites raised implies mean lifetime ≈ k·Y / built.
const lifetime = (type, concurrent) =>
  built[type] > 0 ? +((concurrent * YEARS) / built[type]).toFixed(2) : null;

const veinMults = state._veinRichness ? Object.values(state._veinRichness) : null;

console.log(JSON.stringify({
  seed: SEED, years: YEARS, woodBase: FOREST.woodBase, woodVar: FOREST.woodVar,
  built,
  lifetime: { lumber: lifetime('lumber', 3), quarry: lifetime('quarry', 2), mine: lifetime('mine', 2) },
  year3,
  ghost: {
    ghostHpHealed: Math.round(ghostHpHealed), totalHpHealed: Math.round(totalHpHealed),
    ghostFrac: totalHpHealed > 0 ? +(ghostHpHealed / totalHpHealed).toFixed(3) : null,
  },
  meanHpFrac20: hpN20 ? +(hpSum20 / hpN20).toFixed(3) : null,
  veinMults: veinMults ? veinMults.map((v) => +v.toFixed(2)) : null,
  deepVeinStruck: !!state.stats?.deepVeinStruck || deepMined,
  merchant: {
    bought: Math.round(state.stats?.goodsBought || 0),
    blocked: state.stats?.buysBlocked || 0,
    visits: state.merchant.visits,
  },
  final: {
    pop: state.pop, minPop, gold: Math.round(state.res.gold),
    wood: Math.round(state.res.wood), stone: Math.round(state.res.stone),
    ore: Math.round(state.res.ore), iron: Math.round(state.res.iron),
    soldiers: state.soldiers.length, territory: territorySize(state),
    lumber: count('lumber'), lumberDepleted: countDepleted('lumber'),
    quarries: count('quarry'), quarriesDepleted: countDepleted('quarry'),
    mines: count('mine'), minesDepleted: countDepleted('mine'),
    forestCleared: state.stats.forestCleared || 0,
    hillsFlattened: state.stats.hillsFlattened || 0,
    veinsSpent: state.stats.veinsSpent || 0,
    keepFalls: state.stats.keepFalls || 0,
    crowns: state.crowns,
  },
}));
