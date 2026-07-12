import { BUILDINGS, WORK_PRIORITY, WINTER_FARM_MULT } from '../config.js';
import { idx } from './state.js';
import { currentSeason } from './sim.js';

// Auto-assign the workforce down the priority list, then run production.
export function economyTick(state) {
  let free = state.pop;
  const active = (b) =>
    b.hp > 0 && state.claimed[idx(b.x, b.y)];

  for (const b of state.buildings) b.assigned = 0;

  for (const type of WORK_PRIORITY) {
    for (const b of state.buildings) {
      if (b.type !== type || !active(b)) continue;
      const need = BUILDINGS[type].workers;
      const got = Math.min(need, free);
      b.assigned = got;
      free -= got;
      if (free <= 0) break;
    }
    if (free <= 0) break;
  }
  state.idleWorkers = free;

  const winter = currentSeason(state) === 'Winter';

  for (const b of state.buildings) {
    if (!active(b)) continue;
    const def = BUILDINGS[b.type];
    const staffing = def.workers ? b.assigned / def.workers : 1;
    if (staffing <= 0) continue;

    if (def.prod) {
      for (const [r, rate] of Object.entries(def.prod)) {
        let amt = rate * staffing;
        if (b.type === 'farm' && winter) amt *= WINTER_FARM_MULT;
        state.res[r] += amt;
        state.delta[r] += amt;
      }
    }
    if (def.conv) {
      // scale by the scarcest input
      let scale = staffing;
      for (const [r, rate] of Object.entries(def.conv.in)) {
        scale = Math.min(scale, state.res[r] / rate);
      }
      if (scale > 0.001) {
        for (const [r, rate] of Object.entries(def.conv.in)) {
          state.res[r] -= rate * scale;
          state.delta[r] -= rate * scale;
        }
        for (const [r, rate] of Object.entries(def.conv.out)) {
          state.res[r] += rate * scale;
          state.delta[r] += rate * scale;
        }
      }
    }
    if (b.type === 'market' && b.assigned > 0) {
      const tax = state.pop * 0.012 * (state.morale / 50);
      state.res.gold += tax;
      state.delta.gold += tax;
    }
  }
}

export function prosperity(state) {
  let v = 0;
  for (const [r, amt] of Object.entries(state.res)) {
    v += amt * (r === 'gold' ? 1.5 : 1);
  }
  v += state.buildings.length * 20 + state.pop * 5;
  return v;
}
