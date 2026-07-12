import { WIN, TERRAIN_INFO } from '../config.js';
import { logEvent, emit } from './events.js';
import { territorySize } from './territory.js';
import { currentYear } from './sim.js';

export const CROWN_NAMES = {
  dominion: 'Crown of Dominion',
  plenty: 'Crown of Plenty',
  people: 'Crown of the People',
};

export function getProgress(state) {
  if (state._claimable === undefined) {
    let n = 0;
    for (let i = 0; i < state.terrain.length; i++) {
      if (TERRAIN_INFO[state.terrain[i]].claim > 0) n++;
    }
    state._claimable = n;
  }
  return {
    dominion: { cur: territorySize(state), goal: Math.ceil(state._claimable * WIN.territoryFrac) },
    plenty: { cur: Math.floor(state.res.gold), goal: WIN.gold },
    people: { cur: state.pop, goal: WIN.pop },
  };
}

// Crowns are high-water marks: once earned, never lost.
export function winTick(state) {
  if (state.won) return;
  const p = getProgress(state);
  for (const key of Object.keys(CROWN_NAMES)) {
    if (!state.crowns[key] && p[key].cur >= p[key].goal) {
      state.crowns[key] = true;
      logEvent(state, `👑 The ${CROWN_NAMES[key]} is yours!`, 'good');
      emit('crown', key);
    }
  }
  if (state.crowns.dominion && state.crowns.plenty && state.crowns.people) {
    state.won = true;
    logEvent(state, `All three crowns are won — ${state.name} reigns supreme!`, 'good');
    emit('victory', {
      year: currentYear(state),
      pop: state.pop,
      territory: territorySize(state),
      waves: state.raid.wave,
    });
  }
}
