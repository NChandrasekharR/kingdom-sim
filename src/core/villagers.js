import { SKILL, VILLAGER } from '../config.js';
import { roadTiles, marchOrStep, clearRoute } from './pathing.js';

// Villagers are discrete agents: a job, a skill per craft, a stomach.
// "15 pop" is 15 little lives — which is what makes losing one mean something.

const FIRST = [
  'Aldric', 'Berta', 'Cedric', 'Doria', 'Edmund', 'Freya', 'Godwin', 'Hilda',
  'Ivo', 'Jorunn', 'Kell', 'Lisbet', 'Magnus', 'Nella', 'Osric', 'Petra',
  'Quentin', 'Rowena', 'Sten', 'Thora', 'Ulric', 'Vera', 'Wystan', 'Ysolde',
];
const EPITHET = [
  'the Younger', 'the Elder', 'of the Mill', 'Longstride', 'the Quiet',
  'Redhand', 'of the Vale', 'Stoutheart', 'the Gray', 'Swiftfoot',
  'of the Ford', 'Ironbrow', 'the Steady', 'Fairhair', 'of the Glen',
];

export function makeVillager(state, job = 'idle') {
  const id = state.nextId++;
  return {
    id,
    name: `${FIRST[id % FIRST.length]} ${EPITHET[(id * 7) % EPITHET.length]}`,
    job,                 // 'idle' | 'producer' | 'builder' | 'soldier'
    workplaceId: null,   // building id while producing
    skills: {},          // craft (building type, 'builder', 'soldier') → 0..1
    hunger: 0,
    // a body on the map: born at the keep (lazily placed on the first move tick),
    // walks to work, panics from raiders, flees for the keep. px/py = previous
    // position, for render interpolation (same contract as soldiers/raiders).
    x: null, y: null, px: null, py: null,
    fleeing: false,      // running for the keep; holed up until the raid ends
    // cached road commute: tile indices + cursor + which posting it's for.
    // Plain arrays/numbers, so they save and load with the rest of the record;
    // an older save simply arrives without them and gets one on demand.
    route: null, routeI: 0, routeGoal: null, routeKey: null,
  };
}

// at most this many fresh A* routes per tick across the whole population —
// with hundreds of bodies a labor reshuffle would otherwise path them all at
// once. Routes are cached, so steady state costs nothing.
const VILLAGER_PATH_BUDGET = 8;

// a small deterministic per-villager offset so crews don't stack on one pixel
function offset(v, salt) {
  return (((v.id * salt) % 5) - 2) * 0.3;
}

// Walk every civilian body one step: to work, to the keep plaza, or — if
// raiders are near — AWAY, fleeing for the keep's shelter. Runs every tick;
// production stays non-spatial (positions are presentation + hunt substrate).
export function villagersMoveTick(state) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  if (!keep) return;
  // the commute takes the road: a villager walking to a STABLE target (their
  // workplace, or the keep plaza) gets an A* route cached on them and walks it
  // at road speed where the road runs. Fresh routes are budgeted — after a
  // labor reshuffle the crews trickle onto the network over a few seconds
  // rather than all pathing on one tick.
  const roads = roadTiles(state);
  const pathBudget = [VILLAGER_PATH_BUDGET];
  const raidActive = state.raid.phase === 'active';
  const raiders = raidActive ? state.raid.raiders.filter((r) => r.hp > 0 && r.mode !== 'flee' && r.mode !== 'gone') : [];
  const byId = new Map(state.buildings.map((b) => [b.id, b]));
  // builders head for the most damaged building (worst-first, like their repairs)
  let worst = null, worstFrac = 1;
  for (const b of state.buildings) {
    if (b.hp <= 0 || b.hp >= b.maxHp) continue;
    const f = b.hp / b.maxHp;
    if (f < worstFrac) { worstFrac = f; worst = b; }
  }

  for (const v of state.villagers) {
    if (v.job === 'soldier') continue;      // the soldier body is its own unit
    if (v.x == null) {                      // first breath: at the keep's gate
      v.x = keep.x + offset(v, 37); v.y = keep.y + 1.5 + Math.abs(offset(v, 53));
      v.px = v.x; v.py = v.y;
    }
    v.px = v.x; v.py = v.y;

    // panic: a raider bearing down sends a civilian running for the keep —
    // but a watchman inside his tower holds: stone between him and the blades
    if (raidActive && !v.fleeing && !isInsideTower(state, v)) {
      for (const rd of raiders) {
        if (Math.hypot(rd.x - v.x, rd.y - v.y) < VILLAGER.panicRadius) {
          v.fleeing = true;
          v.job = 'idle'; v.workplaceId = null; v.workType = null;
          break;
        }
      }
    }

    // pick where this body is headed — and whether the walk is a COMMUTE
    // (a fixed destination worth routing) or a scramble (beeline)
    let tx, ty, commute = false, key = null;
    if (v.fleeing) {
      // terror does not follow roads: a fleeing civilian runs the shortest line
      tx = keep.x + offset(v, 37); ty = keep.y + 1.5 + Math.abs(offset(v, 53));
    } else if (v.job === 'producer' && byId.get(v.workplaceId)) {
      const b = byId.get(v.workplaceId);
      tx = b.x + offset(v, 37); ty = b.y + 0.8 + offset(v, 53) * 0.5;
      commute = true; key = v.workplaceId;
    } else if (v.job === 'builder' && worst) {
      // a builder's target is the worst-damaged building, which changes every
      // few ticks — routing it would thrash. Straight line.
      tx = worst.x + offset(v, 37); ty = worst.y + 0.8;
    } else {
      // idle folk mill about the keep plaza
      tx = keep.x + offset(v, 37) * 2; ty = keep.y + 2 + Math.abs(offset(v, 53)) * 2;
      commute = true; key = 'keep';
    }

    if (commute) {
      // a new posting throws away the old road
      if (v.routeKey !== key) { clearRoute(v); v.routeKey = key; }
      marchOrStep(state, v, tx, ty, VILLAGER.walkSpeed, roads, pathBudget, 0.4);
      continue;
    }
    if (v.routeKey != null) { clearRoute(v); v.routeKey = null; }
    const dx = tx - v.x, dy = ty - v.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.4) {
      const step = Math.min(VILLAGER.walkSpeed, d);
      v.x += (dx / d) * step; v.y += (dy / d) * step;
    }
  }
}

// Eject a worker from a sacked/falling building: they drop everything and run.
// Nobody dies at their post — death happens only in the open (the hunt).
export function ejectVillager(v) {
  if (v.job === 'soldier') return;
  v.fleeing = true;
  v.job = 'idle'; v.workplaceId = null; v.workType = null;
}

// A watchman AT HIS POST is inside the tower — behind stone, off the streets.
// He doesn't panic and can't be hunted; he comes out only when the tower is
// battered down (the sack ejects him into the open like anyone else).
export function isInsideTower(state, v) {
  if (v.job !== 'producer' || v.workType !== 'tower' || v.x == null) return false;
  const t = state.buildings.find((b) => b.id === v.workplaceId);
  return !!t && t.hp > 0 && !t.sacked &&
    Math.hypot(t.x - v.x, t.y - v.y) <= VILLAGER.towerInsideRadius;
}

// Is this villager under shelter right now? (near the keep's guard, close
// enough to an intact house to duck inside — or inside their watchtower)
export function isSheltered(state, v) {
  if (v.x == null) return true;
  if (isInsideTower(state, v)) return true;
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    if (b.type === 'keep') {
      if (Math.hypot(b.x - v.x, b.y - v.y) <= VILLAGER.keepShelterRadius) return true;
    } else if (b.type === 'house' && !b.sacked) {
      if (Math.hypot(b.x - v.x, b.y - v.y) <= VILLAGER.houseShelterRadius) return true;
    }
  }
  return false;
}

// skill key: producers skill by the building type they work; others by job
export function skillKey(v) {
  return v.job === 'producer' && v.workType ? v.workType : v.job;
}

export function bestSkill(v) {
  let best = 0;
  for (const s of Object.values(v.skills)) if (s > best) best = s;
  return best;
}

export function isMaster(v) { return bestSkill(v) >= SKILL.masterAt; }

// Skills rise with use and fade when idle; masters lift apprentices, and a
// craft once mastered leaves guild memory so one death can't wipe it.
export function skillsTick(state) {
  state.guilds ||= [];
  // who is a living master of which craft this tick?
  const masterTypes = new Set();
  for (const v of state.villagers) {
    if (v.job !== 'producer' || !v.workType) continue;
    if ((v.skills[v.workType] || 0) >= SKILL.masterAt) {
      masterTypes.add(v.workType);
      if (!state.guilds.includes(v.workType)) {
        state.guilds.push(v.workType);
      }
    }
  }
  for (const v of state.villagers) {
    if (v.job === 'idle') {
      for (const k of Object.keys(v.skills)) {
        v.skills[k] = Math.max(0, v.skills[k] - SKILL.decayPerTickIdle);
      }
      continue;
    }
    const k = skillKey(v);
    v.skills[k] = v.skills[k] || 0;
    if (v.job === 'producer' && v.workType) {
      if (masterTypes.has(v.workType)) v.skills[k] = Math.max(v.skills[k], SKILL.apprenticeFloor);
      else if (state.guilds.includes(v.workType)) v.skills[k] = Math.max(v.skills[k], SKILL.guildFloor);
    }
    v.skills[k] = Math.min(SKILL.max, v.skills[k] + SKILL.gainPerTick);
  }
}

// Remove a villager (death). Returns whether the realm lost a master.
export function killVillager(state, villager) {
  const i = state.villagers.indexOf(villager);
  if (i >= 0) state.villagers.splice(i, 1);
  // a soldier's body falls with its owner
  state.soldiers = state.soldiers.filter((s) => s.villagerId !== villager.id);
  return isMaster(villager);
}

export function countMasters(state) {
  let n = 0;
  for (const v of state.villagers) if (isMaster(v)) n++;
  return n;
}
