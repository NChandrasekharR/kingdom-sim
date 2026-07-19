import { BUILDINGS, WORK_PRIORITY, WINTER_FARM_MULT, HP, SKILL, FOREST, T, MAP } from '../config.js';
import { idx } from './state.js';
import { currentSeason } from './sim.js';
import { logEvent, emit } from './events.js';

// ── The forest is finite ───────────────────────────────────────────
// A lumber camp cuts the nearest standing timber within reach. Each cut
// draws down that tile's stock; a spent tile opens into PLAINS (farmable).
// When nothing in reach still stands, the camp goes quiet for good.

// the tile this camp is currently cutting (cached; rescan when it's spent)
function findTimber(state, b) {
  const N = MAP.size;
  const R = Math.ceil(FOREST.harvestRadius);
  let best = -1, bd = Infinity;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const d = Math.hypot(dx, dy);
      if (d > FOREST.harvestRadius) continue;
      const i = y * N + x;
      if (state.terrain[i] !== T.FOREST || state.forestWood[i] <= 0) continue;
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}

// harvest `amt` wood for camp b; returns what was actually cut
function cutTimber(state, b, amt) {
  let cut = 0;
  while (cut < amt - 0.0001) {
    if (b.timberI == null || state.forestWood[b.timberI] <= 0 ||
        state.terrain[b.timberI] !== T.FOREST) {
      b.timberI = findTimber(state, b);
      if (b.timberI < 0) {
        // the wood within reach is spent — the camp falls quiet for good
        b.timberI = null;
        if (!b.depleted) {
          b.depleted = true;
          logEvent(state, 'The axes fall silent at a lumber camp — the wood nearby is spent. The cleared land lies open.', 'info');
        }
        break;
      }
    }
    const i = b.timberI;
    const take = Math.min(amt - cut, state.forestWood[i]);
    const before = state.forestWood[i];
    state.forestWood[i] -= take;
    cut += take;
    // the forest visibly THINS as it's cut (repaint on density-band crossings)
    if (state.forestWood[i] > 0 &&
        Math.floor(before / 30) !== Math.floor(state.forestWood[i] / 30)) {
      emit('terrain-changed', { x: i % MAP.size, y: (i / MAP.size) | 0 });
    }
    if (state.forestWood[i] <= 0) {
      // clear-cut: the forest gives way to open field
      state.terrain[i] = T.PLAINS;
      state.forestWood[i] = 0;
      b.timberI = null;
      state.stats.forestCleared = (state.stats.forestCleared || 0) + 1;
      emit('terrain-changed', { x: i % MAP.size, y: (i / MAP.size) | 0 });
    }
  }
  return cut;
}

// The redesign core: a building's output scales with its HP. Raiders grind HP
// down, decay nibbles it, and builders restore it — competing for the same
// scarce hands as production. Numbers validated in sim2/ (design/FINDINGS.md).
export function outputMult(b) {
  const frac = Math.max(0, b.hp / b.maxHp);
  return HP.outputFloor + (1 - HP.outputFloor) * frac;
}

// Auto-assign the workforce (builders first, then producers best-skilled-first),
// then run production scaled by HP × skill × staffing.
export function economyTick(state) {
  const active = (b) => b.hp > 0 && state.claimed[idx(b.x, b.y)];

  // reset non-soldier jobs; soldiers persist (recruited/lost explicitly).
  // A fleeing villager is holed up until the raid ends — no hands to give.
  for (const v of state.villagers) {
    if (v.job !== 'soldier') { v.job = 'idle'; v.workplaceId = null; v.workType = null; }
  }
  const pool = state.villagers.filter((v) => v.job !== 'soldier' && !v.fleeing);

  // 1. builders: enough hands to work through everything below the threshold
  const needRepair = state.buildings.filter(
    (b) => b.hp > 0 && b.hp < b.maxHp * HP.maintenanceThreshold);
  const buildersWanted = Math.min(pool.length, Math.ceil(needRepair.length / 2));
  const builders = pool.splice(0, buildersWanted);
  for (const v of builders) v.job = 'builder';

  // 2. producers: fill buildings down the priority list, best-skilled first
  for (const b of state.buildings) { b.assigned = 0; b.workers = []; }
  for (const type of WORK_PRIORITY) {
    for (const b of state.buildings) {
      if (b.type !== type || !active(b)) continue;
      // a tower battered to rubble has no post to man — nobody stands in the
      // wreckage; repair it past half and the watch resumes
      if (type === 'tower' && b.sacked) continue;
      // a lumber camp with no standing timber in reach employs no one
      if (type === 'lumber' && b.depleted) continue;
      const need = BUILDINGS[type].workers;
      for (let i = 0; i < need && pool.length; i++) {
        let bestI = 0, bestSk = -1;
        for (let j = 0; j < pool.length; j++) {
          const sk = pool[j].skills[type] || 0;
          if (sk > bestSk) { bestSk = sk; bestI = j; }
        }
        const v = pool.splice(bestI, 1)[0];
        v.job = 'producer'; v.workplaceId = b.id; v.workType = type;
        b.workers.push(v);
        b.assigned++;
      }
      if (!pool.length) break;
    }
    if (!pool.length) break;
  }
  state.idleWorkers = pool.length;

  const winter = currentSeason(state) === 'Winter';

  for (const b of state.buildings) {
    if (!active(b)) continue;
    const def = BUILDINGS[b.type];
    const staffing = def.workers ? b.assigned / def.workers : 1;
    if (staffing <= 0) continue;
    const hpMult = outputMult(b);
    const crew = b.workers || [];
    const skillMult = 1 + (crew.length
      ? crew.reduce((s, v) => s + (v.skills[b.type] || 0), 0) / crew.length
      : 0);

    if (def.prod) {
      for (const [r, rate] of Object.entries(def.prod)) {
        let amt = rate * staffing * hpMult * skillMult;
        if (b.type === 'farm' && winter) amt *= WINTER_FARM_MULT;
        // wood is CUT from real tiles, not conjured — the forest draws down
        if (b.type === 'lumber' && r === 'wood') amt = cutTimber(state, b, amt);
        state.res[r] += amt;
        state.delta[r] += amt;
      }
    }
    if (def.conv) {
      // scale by the scarcest input
      let scale = staffing * hpMult;
      for (const [r, rate] of Object.entries(def.conv.in)) {
        scale = Math.min(scale, state.res[r] / rate);
      }
      if (scale > 0.001) {
        for (const [r, rate] of Object.entries(def.conv.in)) {
          state.res[r] -= rate * scale;
          state.delta[r] -= rate * scale;
        }
        for (const [r, rate] of Object.entries(def.conv.out)) {
          state.res[r] += rate * scale * skillMult;
          state.delta[r] += rate * scale * skillMult;
        }
      }
    }
    if (b.type === 'market' && b.assigned > 0) {
      const tax = state.pop * 0.012 * (state.morale / 50) * hpMult;
      state.res.gold += tax;
      state.delta.gold += tax;
    }
  }
}

// Builders repair worst-first, spending wood and stone per HP; then everything
// but the keep decays. Recovery-vs-decay is where the death spiral lives.
export function maintenanceTick(state) {
  const builders = state.villagers.filter((v) => v.job === 'builder');
  if (builders.length) {
    const damaged = state.buildings
      .filter((b) => b.hp > 0 && b.hp < b.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    let labor = builders.reduce(
      (s, v) => s + HP.repairPerBuilderTick * (1 + (v.skills.builder || 0)), 0);
    for (const b of damaged) {
      if (labor <= 0) break;
      let heal = Math.min(b.maxHp - b.hp, labor,
        state.res.wood / HP.repairWoodPerHp,
        state.res.stone / HP.repairStonePerHp);
      if (heal <= 0) break;
      state.res.wood -= heal * HP.repairWoodPerHp;
      state.res.stone -= heal * HP.repairStonePerHp;
      state.delta.wood -= heal * HP.repairWoodPerHp;
      state.delta.stone -= heal * HP.repairStonePerHp;
      b.hp += heal;
      if (b.sacked && b.hp > b.maxHp * 0.5) b.sacked = false;
      // a breached wall rebuilt past half once again bars the way
      if (b.breached && b.hp > b.maxHp * 0.5) b.breached = false;
      labor -= heal;
      state.buildingsDirty = true;
    }
  }

  for (const b of state.buildings) {
    if (b.hp <= 0 || b.type === 'keep') continue;
    b.hp = Math.max(1, b.hp - HP.decayPerTick);
  }
}

export function prosperity(state) {
  let v = 0;
  for (const [r, amt] of Object.entries(state.res)) {
    v += amt * (r === 'gold' ? 1.5 : 1);
  }
  v += state.buildings.length * 20 + state.pop * 5;
  // skilled hands ARE wealth — raiders scale with it too
  for (const vl of state.villagers) {
    let best = 0;
    for (const s of Object.values(vl.skills)) if (s > best) best = s;
    v += best * 15;
  }
  return v;
}
