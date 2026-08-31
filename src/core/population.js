import { BUILDINGS, EAT_PER_POP, SOLDIER_EAT_MULT, GROWTH_FLOOR, STARVE_DEATH_HUNGER, GROWTH, FOOD } from '../config.js';
import { idx } from './state.js';
import { logEvent, journal } from './events.js';
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

  // eat: RAW FOOD first (it rots anyway), bread only when the fields fall
  // short — so bread ACCUMULATES as the winter/siege reserve instead of being
  // devoured the tick it's baked (Duncastle log: 47k food rotted, bread stuck
  // at 0 under the old bread-first order). 1 bread = 2 food-equivalents.
  // Soldiers eat 3× — the army's true cost is farmland, not gold.
  let need = 0;
  for (const v of state.villagers) {
    need += EAT_PER_POP * (v.job === 'soldier' ? SOLDIER_EAT_MULT : 1);
  }
  const totalNeed = need;
  state.ateBread = false;
  const fromFood = Math.min(state.res.food, need);
  state.res.food -= fromFood;
  state.delta.food -= fromFood;
  need -= fromFood;
  const fromBread = Math.min(state.res.bread * 2, need);
  if (fromBread > 0.001) {
    state.res.bread -= fromBread / 2;
    state.delta.bread -= fromBread / 2;
    need -= fromBread;
    state.ateBread = true;   // drawing on the reserve (winter, siege, shortfall)
  }

  // spoilage: raw food above the buffer rots (bread keeps) — convert surplus or lose it
  const freeFood = totalNeed * FOOD.spoilFreeTicks;
  const excess = state.res.food - freeFood;
  const spoiling = excess > 0;
  if (spoiling) {
    const spoiled = excess * FOOD.spoilRate;
    state.res.food -= spoiled;
    state.delta.food -= spoiled;
    state.stats.foodSpoiled = (state.stats.foodSpoiled || 0) + spoiled;
  }
  if (spoiling && !state.spoiling) {
    logEvent(state, 'Grain rots in the overflowing stores. Bake it into bread — bread keeps.', 'bad');
  }
  state.spoiling = spoiling;

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
        state.stats.villagersStarved++;
        if (wasM) state.stats.mastersLost++;
        logEvent(state, wasM
          ? `${v.name}, a master of the craft, has starved. The knowledge dies too.`
          : `${v.name} has died of hunger.`, 'bad');
      }
    }
  } else {
    for (const v of state.villagers) v.hunger = Math.max(0, v.hunger - 2);
    const stock = state.res.food + state.res.bread * 2;
    if (stock > state.pop * GROWTH_FLOOR && state.pop < state.popCap) {
      // abundance is the fuel: the more spare food per head, the faster the realm
      // grows (capped), so a full granary actually builds a population.
      const foodPerCap = stock / Math.max(1, state.pop);
      const abundance = 1 + Math.min(GROWTH.surplusCap,
        Math.max(0, GROWTH.surplusScale * (foodPerCap / GROWTH.surplusTarget - 1)));
      state.growthAcc += (GROWTH.base + state.morale / GROWTH.moraleBonus) * abundance;
      if (state.growthAcc >= 1) {
        state.growthAcc -= 1;   // carry the overflow — boom-times shouldn't drop it
        const v = makeVillager(state);
        state.villagers.push(v);
        state.stats.villagersBorn++;
        // every birth goes in the journal; the chronicle only marks milestones
        journal(state, `${v.name} is born — ${state.villagers.length} souls now.`, 'people');
        if (state.villagers.length % 5 === 0) {
          logEvent(state, `The kingdom grows — ${state.villagers.length} souls now call it home.`, 'good');
        }
      }
    }
  }
  state.pop = state.villagers.length;

  // skills rise with use, fade in idleness; guild memory holds the floor
  skillsTick(state);

  // morale drifts toward a target set by conditions. A stocked bread larder is
  // comfort (the reserve, not the meal — bread is eaten only when fields fall
  // short, so the old ate-bread bonus would never fire in good times).
  let target = 50;
  if (state.ateBread || state.res.bread * 2 >= state.pop) target += 8;
  const churches = state.buildings.filter((b) => b.type === 'church' && b.hp > 0).length;
  target += Math.min(churches * 6, 18);
  // the Great Temple lifts the realm's heart while it stands unsacked
  if (state.buildings.some((b) => b.type === 'temple' && b.greatWorkDone && b.hp > 0 && !b.sacked)) {
    target += BUILDINGS.temple.greatWork.moraleBonus;
  }
  const stock = state.res.food + state.res.bread * 2;
  if (stock > state.pop * 3) target += 5;
  if (state.starving) target -= 28;
  target -= state.raidShock;
  state.raidShock = Math.max(0, state.raidShock - 0.06);
  state.morale += (target - state.morale) * 0.02;
  state.morale = Math.max(5, Math.min(100, state.morale));
}
