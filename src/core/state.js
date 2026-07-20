import { MAP, T, BUILDINGS, TERRAIN_INFO, FOREST } from '../config.js';
import { generateMap } from './mapgen.js';
import { logEvent } from './events.js';
import { makeVillager } from './villagers.js';
import { initTutorial, seedTutorialForLoadedSave } from './tutorial.js';

const KINGDOM_NAMES = [
  'Aldermere', 'Thornwick', 'Caer Bryn', 'Ravensholt', 'Duncastle',
  'Elmsworth', 'Greyfen', 'Harrowgate', 'Wolfsden', 'Ashbourne',
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

export function createState(seed = (Math.random() * 1e9) | 0) {
  const { terrain, start } = generateMap(seed);
  const N = MAP.size;
  const state = {
    seed, tick: 0, speed: 1,
    name: KINGDOM_NAMES[seed % KINGDOM_NAMES.length],
    terrain,
    forestWood: seedForestWood(terrain),
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
    crowns: { dominion: false, plenty: false, people: false },
    won: false,
    raid: { phase: 'quiet', timer: 300, raiders: [], wave: 0 },
    camp: null,          // the warlord's camp — founded when he first shows himself
    expedition: null,    // the counter-raid, while the host is afield
    merchant: { status: 'away', timer: 160, prices: {}, visits: 0 },
    log: [],
    // lifetime run stats — for the end-of-run summary (dumpStats)
    stats: {
      peakPop: 6, peakTerritory: 0,
      raids: 0, warlords: 0, raidersKilled: 0, raidSizes: [],
      buildingsSacked: 0, wallsBreached: 0, keepFalls: 0,
      villagersBorn: 0, villagersStarved: 0, villagersHunted: 0,
      soldiersRecruited: 0, soldiersFallen: 0, veteransFallen: 0,
      mastersLost: 0, foodSpoiled: 0, tributeGold: 0, tributesPaid: 0,
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
  logEvent(state, `${def.name} raised at (${x}, ${y}).`);
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

export function demolish(state, id) {
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
  logEvent(state, `${def.name} torn down — the materials are reclaimed.`);
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
    claimed: Array.from(state.claimed),
    // worker crews are live villager references, recomputed every tick
    buildings: state.buildings.map((b) => ({ ...b, workers: undefined })),
    influence: undefined, delta: undefined,
    territoryDirty: undefined, buildingsDirty: undefined, campDirty: undefined,
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
    s.influence = new Float32Array(N * N);
    s.delta = { food: 0, wood: 0, stone: 0, ore: 0, iron: 0, bread: 0, gold: 0 };
    s.territoryDirty = true;
    s.buildingsDirty = true;
    s.speed = Math.max(1, s.speed || 1);
    // saves from before the Three Crowns update
    s.crowns ||= { dominion: false, plenty: false, people: false };
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
    // saves from before the warlord's camp
    s.camp ||= null;
    s.expedition ||= null;
    if (s.camp) { s.camp.massing ||= []; s.camp.unclaimed ||= false; }
    s.campDirty = true;
    // saves from before run-stats: start tracking from now
    s.stats ||= {
      peakPop: s.pop || 6, peakTerritory: 0,
      raids: 0, warlords: 0, raidersKilled: 0, raidSizes: [],
      buildingsSacked: 0, wallsBreached: 0, keepFalls: 0,
      villagersBorn: 0, villagersStarved: 0, villagersHunted: 0,
      soldiersRecruited: 0, soldiersFallen: 0, veteransFallen: 0,
      mastersLost: 0, foodSpoiled: 0, tributeGold: 0, tributesPaid: 0,
    };
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
