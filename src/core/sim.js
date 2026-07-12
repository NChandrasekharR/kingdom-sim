import { SEASON_TICKS, SEASONS } from '../config.js';
import { mulberry32 } from './rng.js';
import { economyTick } from './economy.js';
import { populationTick } from './population.js';
import { tradeTick } from './trade.js';
import { raidTick } from './raids.js';
import { claimTick, recedeTick } from './territory.js';
import { winTick } from './win.js';
import { saveGame } from './state.js';
import { logEvent, emit } from './events.js';

export function currentSeason(state) {
  return SEASONS[Math.floor(state.tick / SEASON_TICKS) % 4];
}

export function currentYear(state) {
  return 1 + Math.floor(state.tick / (SEASON_TICKS * 4));
}

export function makeSim(state) {
  const rand = mulberry32((state.seed ^ 0x9e3779b9) + state.tick);
  return {
    state,
    tick() {
      state.tick++;
      for (const r of Object.keys(state.delta)) state.delta[r] = 0;

      if (state.tick % SEASON_TICKS === 0) {
        const s = currentSeason(state);
        if (s === 'Winter') logEvent(state, 'Winter sets in. The fields lie fallow.', 'bad');
        if (s === 'Spring') logEvent(state, `Spring returns — Year ${currentYear(state)} of ${state.name}.`, 'good');
      }

      economyTick(state);
      populationTick(state);
      tradeTick(state, rand);
      raidTick(state, rand);

      if (state.tick % 2 === 0) {
        if (state.starving) recedeTick(state);
        else claimTick(state, rand);
      }

      winTick(state);

      if (state.tick % 100 === 0) saveGame(state);
      emit('tick', state);
    },
  };
}
