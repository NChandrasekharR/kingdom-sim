import { BUILDINGS, EAT_PER_POP, SOLDIER_EAT_MULT, GROWTH_FLOOR, STARVE_DEATH_HUNGER } from '../config.js';
import { idx } from './state.js';
import { logEvent } from './events.js';
import { makeVillager, killVillager, skillsTick } from './villagers.js';

export function populationTick(state) {
  state.pop = state.villagers.length;

  // housing cap from buildings inside territory
  let cap = 0;
  for (const b of state.buildings) {
    if (b.hp <= 0 || !state.claimed[idx(b.x, b.y)]) continue;
    cap += BUILDINGS[b.type].popCap || 0;
  }
  state.popCap = cap;

  // eat: bread first (1 bread = 2 food-equivalents), then raw food.
  // Soldiers eat 3× — the army's true cost is farmland, not gold.
  let need = 0;
  for (const v of state.villagers) {
    need += EAT_PER_POP * (v.job === 'soldier' ? SOLDIER_EAT_MULT : 1);
  }
  const totalNeed = need;
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
    const fed = totalNeed > 0 ? 1 - need / totalNeed : 1;
    for (const v of [...state.villagers]) {
      // slight per-person constitution so deaths stagger, not massacre at once
      const grit = 0.85 + 0.3 * (((v.id * 2654435761) >>> 0) % 100) / 100;
      v.hunger += (1 - fed) * grit;
      if (v.hunger >= STARVE_DEATH_HUNGER && state.villagers.length > 1) {
        const wasM = killVillager(state, v);
        logEvent(state, wasM
          ? `${v.name}, a master of the craft, has starved. The knowledge dies too.`
          : `${v.name} has died of hunger.`, 'bad');
      }
    }
  } else {
    for (const v of state.villagers) v.hunger = Math.max(0, v.hunger - 2);
    const stock = state.res.food + state.res.bread * 2;
    if (stock > state.pop * GROWTH_FLOOR && state.pop < state.popCap) {
      state.growthAcc += 0.018 + state.morale / 5000;
      if (state.growthAcc >= 1) {
        state.growthAcc = 0;
        const v = makeVillager(state);
        state.villagers.push(v);
        if (state.villagers.length % 5 === 0) {
          logEvent(state, `The kingdom grows — ${state.villagers.length} souls now call it home.`, 'good');
        }
      }
    }
  }
  state.pop = state.villagers.length;

  // skills rise with use, fade in idleness; guild memory holds the floor
  skillsTick(state);

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
