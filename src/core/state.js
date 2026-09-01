import { MAP, T, BUILDINGS, TERRAIN_INFO, FOREST, DEPOSITS } from '../config.js';
import { generateMap } from './mapgen.js';
import { logEvent } from './events.js';
import { makeVillager } from './villagers.js';
import { initTutorial, seedTutorialForLoadedSave } from './tutorial.js';

const KINGDOM_NAMES = [
  'Aldermere', 'Thornwick', 'Caer Bryn', 'Ravensholt', 'Duncastle',
  'Elmsworth', 'Greyfen', 'Harrowgate', 'Wolfsden', 'Ashbourne',
  'Briarholm', 'Coldmere', 'Dunhollow', 'Eastwold', 'Fenwick',
  'Glasmoor', 'Hartcliffe', 'Ivorden', 'Kingsmere', 'Lindenwold',
  'Marchfield', 'Northolt', 'Oakenholt', 'Pennyford', 'Redmarch',
  'Silverstrand', 'Thornmere', 'Underfell', 'Valebridge', 'Westmarch',
  'Yarrowdale', 'Ashcombe', 'Blackmere', 'Caer Fyrn', 'Darrowfield',
  'Elderstone', 'Foxhollow', 'Gorsebank', 'Hollowmere', 'Wrenfall',
];

const SAVE_KEY = 'kingdom-sim-save-v1';

// Every forest tile holds a finite stock of wood, seeded deterministically
// from its coordinates (old growth vs scrub). Cut it all and the tile opens
// into farmable plains — the economy eats the map.
export function seedForestWood(terrain) {
  const N = MAP.size;
  const stock = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (terrain[i] !== T.FOREST) continue;
    const x = i % N, y = (i / N) | 0;
    const h = ((x * 7349 + y * 9151) * 2654435761 >>> 0) / 4294967296;
    stock[i] = Math.max(20, FOREST.woodBase + (h * 2 - 1) * FOREST.woodVar);
  }
  return stock;
}

// Every HILLS tile holds a finite stock of stone; every ORE tile a stock of
// ore. Seeded deterministically from coordinates (rich seams vs thin), just
// like the forest. Mining draws these down; an exhausted hill flattens to
// plains, an exhausted vein falls back to plain hills. Base can be 0/Infinity
// (control): a bottomless reserve is sentinelled with Infinity so draw-down is
// a no-op and the tile never transforms.
// stone a single HILLS tile holds, deterministic from coordinates (rich seam
// vs thin). Also used when a spent ORE vein falls back to hills: the dead
// vein leaves quarryable rock behind (the deliberate cascade).
export function stoneTileStock(x, y) {
  if (!Number.isFinite(DEPOSITS.stoneBase) || DEPOSITS.stoneBase <= 0) return Infinity;
  // distinct hash constants from forest/ore so the three reserves decorrelate
  const h = ((x * 6151 + y * 8161) * 2654435761 >>> 0) / 4294967296;
  return Math.max(15, DEPOSITS.stoneBase + (h * 2 - 1) * DEPOSITS.stoneVar);
}

// `veinRichness` (tile index → multiplier) comes from mapgen: per-VEIN fortune,
// most seams ordinary and about one Potosí per map. Absent (old saves, callers
// that only have terrain) every vein reads as an ordinary 1×.
export function seedStoneOre(terrain, veinRichness = null) {
  const N = MAP.size;
  const stone = new Float32Array(N * N);
  const ore = new Float32Array(N * N);
  const oreInf = !Number.isFinite(DEPOSITS.oreBase) || DEPOSITS.oreBase <= 0;
  for (let i = 0; i < N * N; i++) {
    const t = terrain[i];
    if (t === T.HILLS) {
      stone[i] = stoneTileStock(i % N, (i / N) | 0);
    } else if (t === T.ORE) {
      if (oreInf) { ore[i] = Infinity; continue; }
      const x = i % N, y = (i / N) | 0;
      const h = ((x * 9973 + y * 7717) * 2654435761 >>> 0) / 4294967296;
      const base = Math.max(10, DEPOSITS.oreBase + (h * 2 - 1) * DEPOSITS.oreVar);
      // the vein's fortune multiplies the tile's own thin-or-rich roll
      ore[i] = base * (veinRichness?.get(i) ?? 1);
    }
  }
  return { stone, ore };
}

export function createState(seed = (Math.random() * 1e9) | 0) {
  const { terrain, start, veinRichness, deepVeins } = generateMap(seed);
  const N = MAP.size;
  const { stone: stoneStock, ore: oreStock } = seedStoneOre(terrain, veinRichness);
  // tiles belonging to a DEEP vein — the Potosí. Kept as a plain array of tile
  // indices so it survives JSON save/load (a Set would serialize to `{}`); the
  // reserves themselves are already in oreStock, this is only for the chronicle.
  const deepVeinTiles = [];
  for (const v of deepVeins || []) for (const i of v.tiles) deepVeinTiles.push(i);
  const state = {
    seed, tick: 0, speed: 1,
    name: KINGDOM_NAMES[seed % KINGDOM_NAMES.length],
    terrain,
    forestWood: seedForestWood(terrain),
    stoneStock,   // finite stone per HILLS tile (Infinity = bottomless control)
    oreStock,     // finite ore per ORE tile (Infinity = bottomless control)
    deepVeinTiles,   // the Potosí: ORE tiles of a 3-6× vein (chronicle only)
    deepVeinFound: false,   // has a mine of ours struck the deep vein yet?
    sawDepletedSite: null,  // type of the last spent site to strike itself (the steward's cue)
    claimed: new Uint8Array(N * N),
    influence: new Float32Array(N * N),
    buildings: [],
    nextId: 1,
    res: { food: 40, wood: 50, stone: 20, ore: 0, iron: 0, bread: 0, gold: 10 },
    delta: { food: 0, wood: 0, stone: 0, ore: 0, iron: 0, bread: 0, gold: 0 },
    pop: 6, popCap: 0,
    villagers: [],       // discrete agents — see villagers.js
    guilds: [],          // crafts ever mastered here (knowledge floor)
    morale: 55, raidShock: 0,
    starving: false, spoiling: false, growthAcc: 0, starveAcc: 0, expandAcc: 0,
    tributeAppetite: 0,   // warlord demands paid in a row — each whets the next
    stance: 'hold',       // 'hold' = fight on claimed land only; 'sally' = pursue anywhere
    ateBread: false,
    soldiers: [],
    crowns: { dominion: false, plenty: false, people: false, ages: false },
    won: false,
    raid: { phase: 'quiet', timer: 300, raiders: [], wave: 0 },
    camp: null,          // the warlord's camp — founded when he first shows himself
    expedition: null,    // the counter-raid, while the host is afield
    // `bought` = goods bought THIS visit, against the caravan's cart capacity
    merchant: { status: 'away', timer: 160, prices: {}, visits: 0, bought: 0 },
    log: [],
    journal: [],   // the full-run record behind kingdom.export() — see events.js
    // lifetime run stats — for the end-of-run summary (dumpStats)
    stats: {
      peakPop: 6, peakTerritory: 0,
      raids: 0, warlords: 0, warlordsSlain: 0, raidersKilled: 0, raidSizes: [],
      buildingsSacked: 0, wallsBreached: 0, keepFalls: 0, lootRecovered: 0,
      villagersBorn: 0, villagersStarved: 0, villagersHunted: 0,
      soldiersRecruited: 0, soldiersFallen: 0, veteransFallen: 0,
      mastersLost: 0, foodSpoiled: 0, tributeGold: 0, tributesPaid: 0,
      forestCleared: 0, hillsFlattened: 0, veinsSpent: 0, deepVeinStruck: 0,
      goodsBought: 0, buysBlocked: 0, worksSacked: 0, ironGathered: 0,
    },
    // render dirty flags
    territoryDirty: true, buildingsDirty: true, campDirty: true,
  };

  for (let i = 0; i < state.pop; i++) state.villagers.push(makeVillager(state));

  // Found the keep and claim a starting blob around it
  addBuilding(state, 'keep', start.x, start.y);
  const R = 5;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = start.x + dx, y = start.y + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      if (dx * dx + dy * dy > R * R) continue;
      if (terrain[y * N + x] === T.WATER) continue;
      state.claimed[y * N + x] = 1;
    }
  }
  logEvent(state, `The kingdom of ${state.name} is founded.`, 'good');
  initTutorial(state);   // the Steward's Counsel — retired at once for keepers who've ruled before
  return state;
}

export function idx(x, y) { return y * MAP.size + x; }
export function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP.size && y < MAP.size; }

export function buildingAt(state, x, y) {
  return state.buildings.find((b) => b.x === x && b.y === y && b.hp > 0);
}

export function canPlace(state, type, x, y) {
  // the road tool lays BRIDGES over water: buildable on unclaimed water if it
  // extends from claimed ground or from another bridge (chain across the river)
  if (type === 'road' && inBounds(x, y) && state.terrain[idx(x, y)] === T.WATER) {
    if (buildingAt(state, x, y)) return { ok: false, reason: 'Tile occupied' };
    let touches = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = x + dx, py = y + dy;
      if (!inBounds(px, py)) continue;
      if (state.claimed[idx(px, py)]) { touches = true; break; }
      const nb = buildingAt(state, px, py);
      if (nb && nb.type === 'bridge') { touches = true; break; }
    }
    if (!touches) return { ok: false, reason: 'A bridge must extend from your shore' };
    for (const [r, amt] of Object.entries(BUILDINGS.bridge.cost)) {
      if (state.res[r] < amt) return { ok: false, reason: `Not enough ${r}` };
    }
    return { ok: true, bridge: true };
  }
  const def = BUILDINGS[type];
  if (!def || def.unbuildable) return { ok: false, reason: 'Cannot build that' };
  if (!inBounds(x, y)) return { ok: false, reason: 'Out of bounds' };
  const t = state.terrain[idx(x, y)];
  if (!state.claimed[idx(x, y)]) return { ok: false, reason: 'Outside your territory' };
  if (buildingAt(state, x, y)) return { ok: false, reason: 'Tile occupied' };
  if (def.place?.on !== undefined) {
    if (t !== def.place.on) return { ok: false, reason: `Must be built on ${TERRAIN_INFO[def.place.on].name.toLowerCase()}` };
  } else {
    if (t === T.WATER) return { ok: false, reason: 'Cannot build on water' };
    if (t === T.MOUNTAIN) return { ok: false, reason: 'Cannot build on mountains' };
  }
  if (def.place?.near !== undefined) {
    let found = false;
    for (let dy = -1; dy <= 1 && !found; dy++)
      for (let dx = -1; dx <= 1 && !found; dx++) {
        const px = x + dx, py = y + dy;
        if (inBounds(px, py) && state.terrain[idx(px, py)] === def.place.near) found = true;
      }
    if (!found) return { ok: false, reason: `Must border ${TERRAIN_INFO[def.place.near].name.toLowerCase()}` };
  }
  // the Ladder of Great Works rises one tier at a time
  if (def.greatWork?.requires &&
      !state.buildings.some((b) => b.type === def.greatWork.requires && b.greatWorkDone)) {
    return { ok: false, reason: `The ladder rises one Work at a time — complete the ${BUILDINGS[def.greatWork.requires].name} first` };
  }
  if (def.unique && state.buildings.some((b) => b.type === type && b.hp > 0)) {
    return { ok: false, reason: 'Already built' };
  }
  for (const [r, amt] of Object.entries(def.cost)) {
    if (state.res[r] < amt) return { ok: false, reason: `Not enough ${r}` };
  }
  return { ok: true };
}

export function place(state, type, x, y) {
  const check = canPlace(state, type, x, y);
  if (!check.ok) return check;
  if (check.bridge) type = 'bridge';   // the road tool crossed the water
  const def = BUILDINGS[type];
  for (const [r, amt] of Object.entries(def.cost)) state.res[r] -= amt;
  addBuilding(state, type, x, y);
  // a bridge carries the realm with it: the tile beneath is claimed, so the
  // border can march across the water and take the far shore
  if (type === 'bridge') {
    state.claimed[idx(x, y)] = 1;
    state.territoryDirty = true;
  }
  logEvent(state, def.greatWork
    ? `The foundations of the ${def.name} are laid — the masters gather their tools.`
    : `${def.name} raised at (${x}, ${y}).`);
  return { ok: true };
}

function addBuilding(state, type, x, y) {
  const def = BUILDINGS[type];
  state.buildings.push({
    id: state.nextId++, type, x, y,
    hp: def.hp, maxHp: def.hp, assigned: 0,
  });
  recomputeInfluence(state);
  state.buildingsDirty = true;
  state.territoryDirty = true;
}

// `opts.silent` suppresses the chronicle line so a caller can write its own
// (the auto-demolish of a spent site announces itself in the house voice).
export function demolish(state, id, opts = {}) {
  const i = state.buildings.findIndex((b) => b.id === id);
  if (i < 0) return;
  const b = state.buildings[i];
  if (b.type === 'keep') return;
  state.buildings.splice(i, 1);
  // materials come back in proportion to the building's condition — a sound
  // building relocates nearly free (depletion makes moving camps routine),
  // a battered one returns what's left of it
  const def = BUILDINGS[b.type];
  const frac = Math.max(0, Math.min(1, b.hp / b.maxHp));
  for (const [r, amt] of Object.entries(def.cost)) {
    state.res[r] += Math.floor(amt * frac);
  }
  // an unfinished Great Work returns what still lies staged on site —
  // the built-in draught and the seasons of labor are sunk (the ache is real)
  if (b.staged) {
    for (const [r, amt] of Object.entries(b.staged)) state.res[r] += Math.floor(amt);
  }
  if (!opts.silent) logEvent(state, `${def.name} torn down — the materials are reclaimed.`);
  recomputeInfluence(state);
  state.buildingsDirty = true;
  state.territoryDirty = true;
}

export function destroyBuilding(state, b) {
  b.hp = 0;
  const i = state.buildings.indexOf(b);
  if (i >= 0) state.buildings.splice(i, 1);
  recomputeInfluence(state);
  state.buildingsDirty = true;
}

export function recomputeInfluence(state) {
  const N = MAP.size;
  state.influence.fill(0);
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.influence || b.hp <= 0) continue;
    const R = def.influence;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = b.x + dx, y = b.y + dy;
        if (!inBounds(x, y)) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) continue;
        const v = 1 - d / R;
        const i = idx(x, y);
        if (v > state.influence[i]) state.influence[i] = v;
      }
    }
  }
}

// ── Save / load ────────────────────────────────────────────────────
export function saveGame(state) {
  const s = {
    ...state,
    terrain: Array.from(state.terrain),
    forestWood: Array.from(state.forestWood, (v) => Math.round(v)),
    // Infinity (bottomless control) → -1 sentinel so it survives JSON
    stoneStock: Array.from(state.stoneStock, (v) => (Number.isFinite(v) ? Math.round(v) : -1)),
    oreStock: Array.from(state.oreStock, (v) => (Number.isFinite(v) ? Math.round(v) : -1)),
    claimed: Array.from(state.claimed),
    // worker crews are live villager references, recomputed every tick
    buildings: state.buildings.map((b) => ({ ...b, workers: undefined })),
    influence: undefined, delta: undefined,
    territoryDirty: undefined, buildingsDirty: undefined, campDirty: undefined,
    // live lookup caches: Sets/Maps JSON-serialize to `{}` and would come back
    // as a truthy-but-empty husk. _deepSet rebuilds lazily from deepVeinTiles;
    // _veinHills CANNOT be re-derived (the terrain already flipped under it),
    // so its membership rides along as a plain tile list and is rebuilt on load
    // — otherwise cascadeStone stops counting after every reload.
    _deepSet: undefined, _veinHills: undefined,
    veinHillTiles: state._veinHills instanceof Set ? Array.from(state._veinHills) : [],
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const N = MAP.size;
    s.terrain = Uint8Array.from(s.terrain);
    s.claimed = Uint8Array.from(s.claimed);
    // saves from before finite forests: seed stock fresh for standing timber
    s.forestWood = s.forestWood ? Float32Array.from(s.forestWood) : seedForestWood(s.terrain);
    // saves from before finite stone/ore: seed fresh for standing hills/veins.
    // present saves map the -1 sentinel back to Infinity (bottomless control).
    if (s.stoneStock && s.oreStock) {
      s.stoneStock = Float32Array.from(s.stoneStock, (v) => (v < 0 ? Infinity : v));
      s.oreStock = Float32Array.from(s.oreStock, (v) => (v < 0 ? Infinity : v));
    } else {
      // pre-depletion save: regenerate the map from its seed so the Potosí
      // lottery lands where it would have, then seed reserves through it
      let richness = null;
      try { richness = generateMap(s.seed).veinRichness; } catch { /* seedless save */ }
      const seeded = seedStoneOre(s.terrain, richness);
      s.stoneStock = seeded.stone;
      s.oreStock = seeded.ore;
    }
    // saves from before the vein lottery: no Potosí was ever seeded in their
    // reserves, so there is none to announce (the reserves stand as saved)
    s.deepVeinTiles ||= [];
    s.deepVeinFound ??= false;
    // the cascade instrumentation set, rebuilt from its saved tile list
    // (older saves start empty — their vein-hills are simply uncounted)
    s._veinHills = new Set(s.veinHillTiles || []);
    delete s.veinHillTiles;
    s.influence = new Float32Array(N * N);
    s.delta = { food: 0, wood: 0, stone: 0, ore: 0, iron: 0, bread: 0, gold: 0 };
    s.territoryDirty = true;
    s.buildingsDirty = true;
    s.speed = Math.max(1, s.speed || 1);
    // saves from before the Three Crowns update
    s.crowns ||= { dominion: false, plenty: false, people: false };
    s.crowns.ages ??= false;   // …and before the Fourth (the Crown of Ages)
    s.won ||= false;
    // saves from before the villager update: synthesize agents from the count
    if (!s.villagers) {
      s.villagers = [];
      s.nextId ||= 1;
      for (let i = 0; i < (s.pop || 0); i++) s.villagers.push(makeVillager(s));
      // old-save soldiers were extra people — give each a body
      for (const sol of s.soldiers || []) {
        const v = makeVillager(s, 'soldier');
        s.villagers.push(v);
        sol.villagerId = v.id;
      }
    }
    s.guilds ||= [];
    // saves from before the journal: the record starts from here
    s.journal ||= [];
    // saves from before per-body loot: a mid-raid raider carries an empty bag
    if (s.raid?.raiders) for (const rd of s.raid.raiders) rd.lootBag ??= {};
    // saves from before the warlord's camp
    s.camp ||= null;
    s.expedition ||= null;
    if (s.camp) {
      s.camp.massing ||= []; s.camp.unclaimed ||= false;
      // saves from before the gathering could be fought: infer the pending
      // wave's size from the props (capped at 18 — close enough for a save)
      s.camp.massingCount ??= s.camp.massing.length;
      s.camp.massers ||= [];
    }
    s.campDirty = true;
    // saves from before run-stats: start tracking from now
    s.stats ||= {
      peakPop: s.pop || 6, peakTerritory: 0,
      raids: 0, warlords: 0, warlordsSlain: 0, raidersKilled: 0, raidSizes: [],
      buildingsSacked: 0, wallsBreached: 0, keepFalls: 0, lootRecovered: 0,
      villagersBorn: 0, villagersStarved: 0, villagersHunted: 0,
      soldiersRecruited: 0, soldiersFallen: 0, veteransFallen: 0,
      mastersLost: 0, foodSpoiled: 0, tributeGold: 0, tributesPaid: 0,
    };
    // an older save's stats block predates loot-recovery: backfill the counter
    if (s.stats) s.stats.lootRecovered ??= 0;
    // and predates sworn-men: backfill the warlords-slain tally
    if (s.stats) s.stats.warlordsSlain ??= 0;
    // older stats predate finite stone/ore counters
    if (s.stats) { s.stats.hillsFlattened ??= 0; s.stats.veinsSpent ??= 0; s.stats.forestCleared ??= 0; }
    // …and predate the vein lottery and the caravan's cart cap
    if (s.stats) { s.stats.deepVeinStruck ??= 0; s.stats.goodsBought ??= 0; s.stats.buysBlocked ??= 0; }
    // saves from before the buy cap: the caravan on the doorstep gets fresh
    // carts rather than being retroactively charged for a bottomless past
    if (s.merchant) s.merchant.bought ??= 0;
    // saves from before the Steward's Counsel: this keeper has ruled before —
    // the ladder never shows, and in-play systems are marked already-seen
    seedTutorialForLoadedSave(s);
    recomputeInfluence(s);
    return s;
  } catch { return null; }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
