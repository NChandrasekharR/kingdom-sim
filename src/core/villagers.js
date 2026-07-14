import { SKILL } from '../config.js';

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
  };
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
