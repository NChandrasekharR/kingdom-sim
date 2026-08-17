import { BUILDINGS, WORK_PRIORITY, WINTER_FARM_MULT, HP, SKILL, FOREST, DEPOSITS, T, MAP } from '../config.js';
import { idx } from './state.js';
import { currentSeason } from './sim.js';
import { logEvent, emit } from './events.js';

// ── The ground is finite ───────────────────────────────────────────
// The same draw-down engine feeds three chains: a LUMBER camp cuts the
// nearest standing timber (FOREST → PLAINS), a QUARRY cuts the nearest live
// hill (HILLS → PLAINS, "the quarry ground becomes a plain"), a MINE works
// the nearest live vein (ORE → HILLS, a spent vein leaves quarryable ground
// — a deliberate cascade). Each producer draws the nearest live tile within
// reach; a spent tile transforms; when nothing in reach is left, the
// building falls quiet for good (b.depleted) and employs nobody.

// A deposit spec describes one chain. `stockKey` is the Float32Array on
// state; `src` the terrain a live tile shows; `into` what it becomes when
// spent (null = leave terrain unchanged); `stat` the run-stat counter to
// bump per tile exhausted; `spentLog` the chronicle line when a site's reach
// runs dry; `band` the density band for the "thinning" repaint (forest only).
const DEPOSIT_SPECS = {
  lumber: {
    stockKey: 'forestWood', src: T.FOREST, into: T.PLAINS, stat: 'forestCleared', band: 30,
    spentLog: 'The axes fall silent at a lumber camp — the wood nearby is spent. The cleared land lies open.',
  },
  quarry: {
    stockKey: 'stoneStock', src: T.HILLS, into: T.PLAINS, stat: 'hillsFlattened', band: 30,
    spentLog: 'A quarry falls quiet — the last stone nearby is cut, and the quarry ground becomes a plain.',
  },
  mine: {
    stockKey: 'oreStock', src: T.ORE, into: T.HILLS, stat: 'veinsSpent', band: 30,
    spentLog: 'A mine is worked out — the vein is spent, and only bare hills remain where it ran.',
  },
};

// nearest live source tile within reach of building b, given its spec
function findDeposit(state, b, spec) {
  const N = MAP.size;
  const R = Math.ceil(DEPOSITS.harvestRadius);
  const stock = state[spec.stockKey];
  let best = -1, bd = Infinity;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const d = Math.hypot(dx, dy);
      if (d > DEPOSITS.harvestRadius) continue;
      const i = y * N + x;
      if (state.terrain[i] !== spec.src || stock[i] <= 0) continue;
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}

// draw `amt` of a finite deposit for building b; returns what was extracted.
// Mirrors the old cutTimber exactly, generalized over the deposit spec.
function drawDeposit(state, b, amt, spec) {
  const stock = state[spec.stockKey];
  let got = 0;
  while (got < amt - 0.0001) {
    if (b.depositI == null || stock[b.depositI] <= 0 ||
        state.terrain[b.depositI] !== spec.src) {
      b.depositI = findDeposit(state, b, spec);
      if (b.depositI < 0) {
        // nothing in reach still bears — the site falls quiet for good
        b.depositI = null;
        if (!b.depleted) {
          b.depleted = true;
          logEvent(state, spec.spentLog, 'info');
        }
        break;
      }
    }
    const i = b.depositI;
    // Infinity stock (bottomless control): take freely, never transform
    if (!Number.isFinite(stock[i])) { got = amt; break; }
    const take = Math.min(amt - got, stock[i]);
    const before = stock[i];
    stock[i] -= take;
    got += take;
    // visible thinning: repaint on density-band crossings
    if (stock[i] > 0 && spec.band &&
        Math.floor(before / spec.band) !== Math.floor(stock[i] / spec.band)) {
      emit('terrain-changed', { x: i % MAP.size, y: (i / MAP.size) | 0 });
    }
    if (stock[i] <= 0) {
      // the tile is worked out: it transforms
      if (spec.into != null) state.terrain[i] = spec.into;
      stock[i] = 0;
      b.depositI = null;
      state.stats[spec.stat] = (state.stats[spec.stat] || 0) + 1;
      emit('terrain-changed', { x: i % MAP.size, y: (i / MAP.size) | 0 });
    }
  }
  return got;
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
      // a camp/quarry/mine with no live deposit in reach employs no one
      if ((type === 'lumber' || type === 'quarry' || type === 'mine') && b.depleted) continue;
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
        // raw materials are DRAWN from real tiles, not conjured — the ground
        // draws down: wood from forest, stone from hills, ore from veins
        if (b.type === 'lumber' && r === 'wood') amt = drawDeposit(state, b, amt, DEPOSIT_SPECS.lumber);
        else if (b.type === 'quarry' && r === 'stone') amt = drawDeposit(state, b, amt, DEPOSIT_SPECS.quarry);
        else if (b.type === 'mine' && r === 'ore') amt = drawDeposit(state, b, amt, DEPOSIT_SPECS.mine);
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
