// Homeostasis measurement run (design/HOMEOSTASIS.md §8): the REAL game core,
// a scripted player shaped like the Thornmere playthrough (a big standing army,
// housing stopped at 300 souls, ore bought when the veins run dry), and one
// named VARIANT of the tuning levers applied to the live config before the
// world is made.
// Usage: node model/homeostasis-run.mjs <variant> <years> <seed>
// Prints one JSON summary line to stdout.

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { createState, canPlace, place } = await import('../src/core/state.js');
const { makeSim } = await import('../src/core/sim.js');
const { recruitSoldier, raidSizeF } = await import('../src/core/raids.js');
const { sell, buy } = await import('../src/core/trade.js');
const { territorySize } = await import('../src/core/territory.js');
const { MAP, SEASON_TICKS, BUILDINGS, RAID, EAT_PER_POP, SOLDIER_EAT_MULT, WINTER_FARM_MULT } =
  await import('../src/config.js');

const VARIANT = process.argv[2] || 'baseline';
const YEARS = Number(process.argv[3] || 30);
const SEED = Number(process.argv[4] || 42);
const N = MAP.size;
const YEAR_TICKS = SEASON_TICKS * 4;

// ── the levers (HOMEOSTASIS.md §2, §4, §5) ─────────────────────────
const LEVERS = {
  // §2: raid size on √prosperity; the cap stays only as a performance ceiling
  sqrt: () => { RAID.sizeCurve = 'sqrt'; RAID.sizeCap = 90; },
  // §4: farming at roughly half today's yield per worker
  leanfood: () => { BUILDINGS.farm.prod.food = 0.25; BUILDINGS.dock.prod.food = 0.2; },
  // §5: iron burns charcoal — the smelter's wood draw tripled
  charcoal: () => { BUILDINGS.smelter.conv.in.wood = 0.45; },
  // §2 softened after the first batch: a gentler √ and a lighter army term
  sqrtsoft: () => { RAID.sizeCurve = 'sqrt'; RAID.sizeCap = 90; RAID.sqrtCurve = { base: 8, mult: 4, military: 0.15 }; },
  // §4 staged after the first batch: today's yield while the realm is small,
  // tapering to half by 200 souls (the best land is farmed first) — applied
  // per policy tick in the run loop below, a stand-in for per-tile fertility
  taperfood: () => { TAPER = true; },
};
let TAPER = false;
const FARM0 = BUILDINGS.farm.prod.food, DOCK0 = BUILDINGS.dock.prod.food;
function applyTaper(pop) {
  const m = Math.max(0.5, Math.min(1, 1 - 0.5 * (pop - 60) / 140));
  BUILDINGS.farm.prod.food = FARM0 * m;
  BUILDINGS.dock.prod.food = DOCK0 * m;
}
const VARIANTS = {
  baseline: [],
  sqrt: ['sqrt'],
  leanfood: ['leanfood'],
  charcoal: ['charcoal'],
  combined: ['sqrt', 'leanfood', 'charcoal'],
  sqrtsoft: ['sqrtsoft'],
  taperfood: ['taperfood'],
  combined2: ['sqrtsoft', 'taperfood', 'charcoal'],
};
if (!VARIANTS[VARIANT]) throw new Error(`unknown variant ${VARIANT}`);
for (const l of VARIANTS[VARIANT]) LEVERS[l]();

const state = createState(SEED);
const sim = makeSim(state);

const count = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0).length;
const live = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0 && !b.depleted).length;
const foodEq = () => state.res.food + state.res.bread * 2;
const eatPerTick = () => {
  let n = 0;
  for (const v of state.villagers) n += EAT_PER_POP * (v.job === 'soldier' ? SOLDIER_EAT_MULT : 1);
  return n;
};

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
const tryBuild = (type) => { const s = findSpot(type); return !!s && place(state, type, s.x, s.y).ok; };

// ── Scripted player ────────────────────────────────────────────────
const POP_STOP = 300;        // Thornmere stopped raising houses here
const ARMY_SHARE = 0.35;     // and kept roughly a third of the realm under arms

function playerPolicy() {
  const pop = state.pop;
  if (state.soldiers.length >= 8) {
    if (!count('guildhall') && state.res.gold > 1500 && tryBuild('guildhall')) return;
    if (!count('temple') && state.res.gold > 6000 && tryBuild('temple')) return;
    if (!count('highseat') && state.res.gold > 12000 && tryBuild('highseat')) return;
  }
  // food: the bot reads the LIVE yields, so a leaner farm means more farms,
  // not a starving bot (unskilled supply vs. demand with a 30% margin)
  const farmYield = BUILDINGS.farm.prod.food * (0.75 + 0.25 * WINTER_FARM_MULT);
  const supply = count('farm') * farmYield + count('dock') * BUILDINGS.dock.prod.food;
  if (supply < eatPerTick() * 1.3 + 0.3) {
    // docks too: every quay is caravan cart space, and Thornmere fished
    const dockFirst = count('dock') < Math.min(4, Math.floor(count('farm') / 3));
    if (dockFirst ? (tryBuild('dock') || tryBuild('farm')) : (tryBuild('farm') || tryBuild('dock'))) return;
  }
  if (state.pop >= state.popCap - 1 && state.popCap < POP_STOP && foodEq() > pop * 2) {
    if (tryBuild('house')) return;
  }
  // a war economy: Thornmere ran six mines and fed a 140-sword army, so the
  // bot keeps more extraction live than model/simulate.mjs's peacetime player
  const big = pop > 120;
  if (live('lumber') < (big ? 5 : 3) && tryBuild('lumber')) return;
  if (live('quarry') < (big ? 3 : 2) && state.res.wood > 40 && tryBuild('quarry')) return;
  if (live('mine') < (big ? 4 : 2) && state.res.wood > 50 && tryBuild('mine')) return;
  if (count('smelter') < (big ? 2 : 1) && state.res.ore > 15 && tryBuild('smelter')) return;
  if (count('bakery') < 2 && state.res.food > 80 && tryBuild('bakery')) return;
  if (count('market') < 1 && state.res.wood > 60 && tryBuild('market')) return;
  const terr = territorySize(state);
  if (count('tower') < Math.floor(terr / 120) && tryBuild('tower')) return;
  const armyTarget = Math.max(8, Math.round(pop * ARMY_SHARE));
  if (state.soldiers.length < armyTarget) {
    const r = recruitSoldier(state);
    if (!r.ok && r.reason === 'Barracks are full' && state.res.iron >= 8 && tryBuild('barracks')) return;
    if (!r.ok && /barracks first/i.test(r.reason || '') && state.res.iron >= 8 && tryBuild('barracks')) return;
  }
  if (count('church') < 2 && state.res.gold > 40 && state.res.stone > 40 && tryBuild('church')) return;
}

const traded = { sold: {}, soldGold: {} };
function tradePolicy() {
  if (state.merchant.status !== 'here') return;
  for (const r of ['wood', 'stone', 'food']) {   // never iron: the army eats it
    const keep = r === 'food' ? state.pop * 3 : 80;
    const surplus = Math.floor(state.res[r] - keep);
    if (surplus > 10) {
      const g0 = state.res.gold, q = Math.min(surplus, 50);
      if (sell(state, r, q)) {
        traded.sold[r] = (traded.sold[r] || 0) + q;
        traded.soldGold[r] = (traded.soldGold[r] || 0) + (state.res.gold - g0);
      }
    }
  }
  // the dry-vein import: when the army is short of iron and the purse is deep,
  // buy it (iron first — the army's need — then ore for the smelters)
  if (state.res.iron < 150 && state.res.gold > 800) {
    for (const r of ['iron', 'ore']) {
      const g0 = state.res.gold;
      if (buy(state, r, 10) === true) {
        traded[r + 'Bought'] = (traded[r + 'Bought'] || 0) + 10;
        traded[r + 'Gold'] = (traded[r + 'Gold'] || 0) + (g0 - state.res.gold);
        break;
      }
    }
  }
}

// ── Run + instrumentation ──────────────────────────────────────────
const yearly = [];
const raids = [];
let curRaid = null;
let spoiledAtYear = 0;
const crownYear = {};

const TICKS = YEARS * YEAR_TICKS;
for (let t = 0; t < TICKS; t++) {
  sim.tick();
  if (t % 10 === 0) { if (TAPER) applyTaper(state.pop); playerPolicy(); }
  tradePolicy();

  const year = 1 + Math.floor(state.tick / YEAR_TICKS);
  const raid = state.raid;
  if (raid.phase === 'active' && !curRaid) {
    let want = raidSizeF(state);
    curRaid = {
      year, wave: raid.wave, size: raid.raiders.length, uncapped: Math.round(want),
      army: state.soldiers.filter((s) => !s.exp).length,
      fallen0: state.stats.soldiersFallen || 0, hunted0: state.stats.villagersHunted || 0,
      warlord: raid.raiders.some((r) => r.warlord),
    };
  } else if (raid.phase !== 'active' && curRaid) {
    curRaid.soldiersLost = (state.stats.soldiersFallen || 0) - curRaid.fallen0;
    curRaid.civiliansLost = (state.stats.villagersHunted || 0) - curRaid.hunted0;
    delete curRaid.fallen0; delete curRaid.hunted0;
    raids.push(curRaid);
    curRaid = null;
  }
  for (const k of Object.keys(state.crowns)) {
    if (state.crowns[k] && !crownYear[k]) crownYear[k] = year;
  }

  if (state.tick % YEAR_TICKS === 0) {
    const workers = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0)
      .reduce((s, b) => s + (b.assigned || 0), 0);
    const spoiled = (state.stats.foodSpoiled || 0) - spoiledAtYear;
    spoiledAtYear = state.stats.foodSpoiled || 0;
    const eat = eatPerTick();
    yearly.push({
      year: year - 1, pop: state.pop, popCap: state.popCap, soldiers: state.soldiers.length,
      foodWorkers: workers('farm') + workers('dock'), farms: count('farm'), docks: count('dock'),
      foodEq: Math.round(foodEq()), yearsOfFood: +(foodEq() / (eat * YEAR_TICKS)).toFixed(2),
      spoiled: Math.round(spoiled),
      gold: Math.round(state.res.gold), stone: Math.round(state.res.stone),
      wood: Math.round(state.res.wood), iron: Math.round(state.res.iron),
      morale: Math.round(state.morale), starved: state.stats.villagersStarved || 0,
      territory: territorySize(state),
    });
  }
}

console.log(JSON.stringify({
  variant: VARIANT, seed: SEED, years: YEARS,
  final: {
    pop: state.pop, soldiers: state.soldiers.length, gold: Math.round(state.res.gold),
    stone: Math.round(state.res.stone), wood: Math.round(state.res.wood), iron: Math.round(state.res.iron),
    bread: Math.round(state.res.bread), foodSpoiled: Math.round(state.stats.foodSpoiled || 0),
    starved: state.stats.villagersStarved || 0, soldiersFallen: state.stats.soldiersFallen || 0,
    mastersLost: state.stats.mastersLost || 0, keepFalls: state.stats.keepFalls || 0,
    won: !!state.won, crownYear,
  },
  traded, yearly, raids,
}));
