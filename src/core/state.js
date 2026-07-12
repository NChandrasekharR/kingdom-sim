import { MAP, T, BUILDINGS, TERRAIN_INFO } from '../config.js';
import { generateMap } from './mapgen.js';
import { logEvent } from './events.js';

const KINGDOM_NAMES = [
  'Aldermere', 'Thornwick', 'Caer Bryn', 'Ravensholt', 'Duncastle',
  'Elmsworth', 'Greyfen', 'Harrowgate', 'Wolfsden', 'Ashbourne',
];

const SAVE_KEY = 'kingdom-sim-save-v1';

export function createState(seed = (Math.random() * 1e9) | 0) {
  const { terrain, start } = generateMap(seed);
  const N = MAP.size;
  const state = {
    seed, tick: 0, speed: 1,
    name: KINGDOM_NAMES[seed % KINGDOM_NAMES.length],
    terrain,
    claimed: new Uint8Array(N * N),
    influence: new Float32Array(N * N),
    buildings: [],
    nextId: 1,
    res: { food: 40, wood: 50, stone: 20, ore: 0, iron: 0, bread: 0, gold: 10 },
    delta: { food: 0, wood: 0, stone: 0, ore: 0, iron: 0, bread: 0, gold: 0 },
    pop: 6, popCap: 0,
    morale: 55, raidShock: 0,
    starving: false, growthAcc: 0, starveAcc: 0, expandAcc: 0,
    ateBread: false,
    soldiers: [],
    crowns: { dominion: false, plenty: false, people: false },
    won: false,
    raid: { phase: 'quiet', timer: 300, raiders: [], wave: 0 },
    merchant: { status: 'away', timer: 160, prices: {}, visits: 0 },
    log: [],
    // render dirty flags
    territoryDirty: true, buildingsDirty: true,
  };

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
  return state;
}

export function idx(x, y) { return y * MAP.size + x; }
export function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP.size && y < MAP.size; }

export function buildingAt(state, x, y) {
  return state.buildings.find((b) => b.x === x && b.y === y && b.hp > 0);
}

export function canPlace(state, type, x, y) {
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
  const def = BUILDINGS[type];
  for (const [r, amt] of Object.entries(def.cost)) state.res[r] -= amt;
  addBuilding(state, type, x, y);
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
  // refund half the wood/stone
  const def = BUILDINGS[b.type];
  for (const [r, amt] of Object.entries(def.cost)) {
    if (r === 'wood' || r === 'stone') state.res[r] += Math.floor(amt / 2);
  }
  logEvent(state, `${def.name} torn down.`);
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
    claimed: Array.from(state.claimed),
    influence: undefined, delta: undefined,
    territoryDirty: undefined, buildingsDirty: undefined,
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
    s.influence = new Float32Array(N * N);
    s.delta = { food: 0, wood: 0, stone: 0, ore: 0, iron: 0, bread: 0, gold: 0 };
    s.territoryDirty = true;
    s.buildingsDirty = true;
    s.speed = Math.max(1, s.speed || 1);
    // saves from before the Three Crowns update
    s.crowns ||= { dominion: false, plenty: false, people: false };
    s.won ||= false;
    recomputeInfluence(s);
    return s;
  } catch { return null; }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
