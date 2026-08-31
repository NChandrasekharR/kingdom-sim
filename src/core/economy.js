import { BUILDINGS, WORK_PRIORITY, WINTER_FARM_MULT, HP, SKILL, FOREST, DEPOSITS, T, MAP, GREAT_WORK } from '../config.js';
import { idx, stoneTileStock, demolish } from './state.js';
import { currentSeason } from './sim.js';
import { logEvent, emit } from './events.js';
import { bestSkill, isMaster } from './villagers.js';

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

// Total stock still in reach of a camp/quarry/mine — what the inspector shows
// as "timber/stone/ore in reach ~N". Returns null for non-extractor buildings,
// Infinity when the reserve is bottomless (the control case: show no number).
export function depositInReach(state, b) {
  const spec = DEPOSIT_SPECS[b.type];
  if (!spec || !state[spec.stockKey]) return null;
  const N = MAP.size;
  const R = Math.ceil(DEPOSITS.harvestRadius);
  const stock = state[spec.stockKey];
  let sum = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      if (Math.hypot(dx, dy) > DEPOSITS.harvestRadius) continue;
      const i = y * N + x;
      if (state.terrain[i] === spec.src && stock[i] > 0) sum += stock[i];
    }
  }
  return sum;
}

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
    // THE POTOSÍ: the first bite of a deep vein is a moment in the chronicle.
    // Announced on the first DRAW rather than at placement — the miners learn
    // what they are standing on by digging into it, not by looking at it.
    if (spec.src === T.ORE && !state.deepVeinFound && state.deepVeinTiles?.length &&
        (state._deepSet ||= new Set(state.deepVeinTiles)).has(i)) {
      state.deepVeinFound = true;
      state.stats.deepVeinStruck = 1;
      logEvent(state, `The miners strike a vein that runs deeper than any man of ${state.name} has known.`, 'good');
    }
    // Infinity stock (bottomless control): take freely, never transform
    if (!Number.isFinite(stock[i])) { got = amt; break; }
    const take = Math.min(amt - got, stock[i]);
    const before = stock[i];
    stock[i] -= take;
    got += take;
    // instrumentation: stone actually quarried out of a spent vein's hill
    // (did the ORE→HILLS cascade ever matter?)
    if (spec.src === T.HILLS && state._veinHills instanceof Set && state._veinHills.has(i)) {
      state.stats.cascadeStone = (state.stats.cascadeStone || 0) + take;
    }
    // visible thinning: repaint on density-band crossings
    if (stock[i] > 0 && spec.band &&
        Math.floor(before / spec.band) !== Math.floor(stock[i] / spec.band)) {
      emit('terrain-changed', { x: i % MAP.size, y: (i / MAP.size) | 0 });
    }
    if (stock[i] <= 0) {
      // the tile is worked out: it transforms
      if (spec.into != null) state.terrain[i] = spec.into;
      stock[i] = 0;
      // the cascade: a spent vein falls back to hills WITH stone in them —
      // the vein is gone but the rock remains, quarryable ground
      if (spec.into === T.HILLS) {
        state.stoneStock[i] = stoneTileStock(i % MAP.size, (i / MAP.size) | 0);
        if (!(state._veinHills instanceof Set)) state._veinHills = new Set();
        state._veinHills.add(i);
      }
      b.depositI = null;
      state.stats[spec.stat] = (state.stats[spec.stat] || 0) + 1;
      emit('terrain-changed', { x: i % MAP.size, y: (i / MAP.size) | 0 });
    }
  }
  return got;
}

// ── Spent camps strike themselves (Session 8, ratified in DECISIONS.md) ──
// A depleted camp/quarry/mine employs nobody and produces nothing, but it still
// sat in the worst-first repair queue — the depletion campaign measured dead
// sites soaking 25-30% of ALL repair wood as ghost maintenance, and a keeper had
// to hand-demolish each husk to stop it. So the site strikes itself, with the
// standard condition-scaled refund (the existing demolish path — no new refund
// math): the timbers come home and the queue is clean.
//
// Runs as its own pass rather than inside drawDeposit so that a husk carried in
// on a LOADED SAVE is caught too — it never draws again, so it would otherwise
// sit forever. The sticky `sawDepletedSite` flag is what the steward's 'depleted'
// counsel keys on: the building is gone by the time tutorialTick runs, so the
// LESSON has to outlive the building.
const DEPLETABLE = new Set(['lumber', 'quarry', 'mine']);

export function autoDemolishSpentTick(state) {
  let struck = null;
  for (const b of state.buildings) {
    if (!b.depleted || !DEPLETABLE.has(b.type) || b.hp <= 0) continue;
    struck = b;
    break;   // one per tick: demolish() mutates state.buildings
  }
  if (!struck) return;
  // the steward must still be able to teach the lesson after the husk is gone
  state.sawDepletedSite = struck.type;
  const def = BUILDINGS[struck.type];
  demolish(state, struck.id, { silent: true });
  logEvent(state, `The ${def.name.toLowerCase()} at the spent ground is struck — its timbers come home.`, 'info');
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
  const fillType = (type) => {
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
  };
  // the watch is posted first (defense competes for labor — the sim2 rule)…
  fillType('tower');
  // …then a rising Great Work claims the realm's finest hands: masters fill
  // its slots before any workshop gets them — the economy VISIBLY dips while
  // the Work rises (ENDGAME §4) — and journeymen fill what's left at half pace
  for (const b of state.buildings) {
    if (!pool.length) break;
    const gw = BUILDINGS[b.type].greatWork;
    if (!gw || b.greatWorkDone || b.sacked || !active(b)) continue;
    for (let i = 0; i < gw.masterSlots && pool.length; i++) {
      let bestI = 0, bestSk = -1;
      for (let j = 0; j < pool.length; j++) {
        const sk = bestSkill(pool[j]);
        if (sk > bestSk) { bestSk = sk; bestI = j; }
      }
      const v = pool.splice(bestI, 1)[0];
      v.job = 'producer'; v.workplaceId = b.id; v.workType = b.type;
      b.workers.push(v);
      b.assigned++;
    }
  }
  for (const type of WORK_PRIORITY) {
    if (type === 'tower') continue;   // already posted above
    fillType(type);
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

// ── The Great Works rise (design/ENDGAME.md §4) ────────────────────
// Materials are hauled from the stockpile and STAGED on site — real wealth in
// the open, lootable: the provocation is the point. The crew builds staged
// materials in: a master works at full pace, a journeyman at half, and the
// scarcest staged material throttles the whole scaffold. A sacked scaffold
// stands silent until repaired past half. Completion is forever.
export function greatWorksTick(state) {
  for (const b of state.buildings) {
    const gw = BUILDINGS[b.type].greatWork;
    if (!gw || b.hp <= 0 || b.greatWorkDone) continue;
    b.progress ||= 0; b.staged ||= {}; b.stagedIn ||= {};
    if (b.sacked || !state.claimed[idx(b.x, b.y)]) continue;

    // haul: stream the draught to the site, running ahead of the burn rate.
    // A hungry realm does not feed its stones: nothing is hauled while the
    // people starve, and the LARDER is staged only past a comfort floor —
    // famine stalls the Work, the Work never deepens the famine (ENDGAME §6).
    const larder = state.res.food + state.res.bread * 2;
    const larderFloor = state.pop * GREAT_WORK.larderFloorPerPop;
    for (const [r, total] of Object.entries(gw.stage)) {
      if (state.starving) break;
      if ((r === 'food' || r === 'bread') && larder <= larderFloor) continue;
      const remaining = total - (b.stagedIn[r] || 0);
      if (remaining <= 0) continue;
      const haul = Math.min((total / gw.workTicks) * GREAT_WORK.stageLead, remaining, state.res[r]);
      if (haul <= 0) continue;
      state.res[r] -= haul;
      state.delta[r] -= haul;
      b.stagedIn[r] = (b.stagedIn[r] || 0) + haul;
      b.staged[r] = (b.staged[r] || 0) + haul;
    }

    const crew = b.workers || [];
    if (!crew.length) continue;
    let rate = crew.reduce((s, v) => s + (isMaster(v) ? 1 : GREAT_WORK.journeymanRate), 0) / gw.masterSlots;
    rate = Math.min(1, rate) * outputMult(b);
    for (const [r, total] of Object.entries(gw.stage)) {
      const perTick = total / gw.workTicks;
      if (perTick > 0) rate = Math.min(rate, (b.staged[r] || 0) / perTick);
    }
    // the master's ache: a scaffold with no master is a visible stall, said once
    const masters = crew.reduce((n, v) => n + (isMaster(v) ? 1 : 0), 0);
    if (!masters && !b.noMasterLogged) {
      b.noMasterLogged = true;
      logEvent(state, `No master stands on the scaffold of the ${BUILDINGS[b.type].name} — the journeymen carry on at half pace.`, 'info');
    } else if (masters) b.noMasterLogged = false;
    if (rate <= 0.001) continue;

    for (const [r, total] of Object.entries(gw.stage)) {
      b.staged[r] = Math.max(0, (b.staged[r] || 0) - (total / gw.workTicks) * rate);
    }
    b.progress += rate;

    // half-a-tick tolerance: the staged draught totals EXACTLY the build's
    // consumption, so demanding the full count makes the last crumb of
    // progress chase the last crumb of material below the work cutoff — an
    // asymptote, never an arrival
    if (b.progress >= gw.workTicks - 0.5) {
      b.greatWorkDone = true;
      // whatever still lies staged was over-hauled — it comes back to the stores
      for (const [r, amt] of Object.entries(b.staged)) state.res[r] += amt;
      b.staged = {};
      state.buildingsDirty = true;   // the scaffold tint comes off
      logEvent(state, gw.completeLog, 'good');
      emit('great-work', { type: b.type, tier: gw.tier });
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
  // a Great Work is wealth made visible: the staged draught and the risen
  // stone draw hungrier waves — the provocation is the design (ENDGAME §3)
  for (const b of state.buildings) {
    const gw = BUILDINGS[b.type].greatWork;
    if (!gw || b.hp <= 0) continue;
    for (const amt of Object.values(b.staged || {})) v += amt;
    v += gw.menace * (b.greatWorkDone ? 1 : (b.progress || 0) / gw.workTicks);
  }
  return v;
}
