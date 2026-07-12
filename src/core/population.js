import { BUILDINGS, EAT_PER_POP, SOLDIER_EAT, GROWTH_FLOOR } from '../config.js';
import { idx } from './state.js';
import { logEvent } from './events.js';

export function populationTick(state) {
  // housing cap from buildings inside territory
  let cap = 0;
  for (const b of state.buildings) {
    if (b.hp <= 0 || !state.claimed[idx(b.x, b.y)]) continue;
    cap += BUILDINGS[b.type].popCap || 0;
  }
  state.popCap = cap;

  // eat: bread first (1 bread = 2 food-equivalents), then raw food
  let need = state.pop * EAT_PER_POP + state.soldiers.length * SOLDIER_EAT;
  state.ateBread = false;
  const fromBread = Math.min(state.res.bread * 2, need);
  if (fromBread > 0.001) {
    state.res.bread -= fromBread / 2;
    state.delta.bread -= fromBread / 2;
    need -= fromBread;
    state.ateBread = true;
  }
  const fromFood = Math.min(state.res.food, need);
  state.res.food -= fromFood;
  state.delta.food -= fromFood;
  need -= fromFood;

  const wasStarving = state.starving;
  state.starving = need > 0.001;
  if (state.starving && !wasStarving) {
    logEvent(state, 'The granaries are empty. Your people starve!', 'bad');
  }

  if (state.starving) {
    state.starveAcc += need;
    if (state.starveAcc >= 1 && state.pop > 1) {
      state.starveAcc = 0;
      state.pop--;
      logEvent(state, 'A subject has died of hunger.', 'bad');
    }
  } else {
    state.starveAcc = Math.max(0, state.starveAcc - 0.05);
    const stock = state.res.food + state.res.bread * 2;
    if (stock > state.pop * GROWTH_FLOOR && state.pop < state.popCap) {
      state.growthAcc += 0.018 + state.morale / 5000;
      if (state.growthAcc >= 1) {
        state.growthAcc = 0;
        state.pop++;
        if (state.pop % 5 === 0) {
          logEvent(state, `The kingdom grows — ${state.pop} souls now call it home.`, 'good');
        }
      }
    }
  }

  // morale drifts toward a target set by conditions
  let target = 50;
  if (state.ateBread) target += 8;
  const churches = state.buildings.filter((b) => b.type === 'church' && b.hp > 0).length;
  target += Math.min(churches * 6, 18);
  const stock = state.res.food + state.res.bread * 2;
  if (stock > state.pop * 3) target += 5;
  if (state.starving) target -= 28;
  target -= state.raidShock;
  state.raidShock = Math.max(0, state.raidShock - 0.06);
  state.morale += (target - state.morale) * 0.02;
  state.morale = Math.max(5, Math.min(100, state.morale));
}
