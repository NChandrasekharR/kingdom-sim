import { WIN, TERRAIN_INFO, BUILDINGS } from '../config.js';
import { logEvent, emit } from './events.js';
import { territorySize } from './territory.js';
import { currentYear } from './sim.js';

export const CROWN_NAMES = {
  dominion: 'Crown of Dominion',
  plenty: 'Crown of Plenty',
  people: 'Crown of the People',
  ages: 'Crown of Ages',
};

export function getProgress(state) {
  if (state._claimable === undefined) {
    let n = 0;
    for (let i = 0; i < state.terrain.length; i++) {
      if (TERRAIN_INFO[state.terrain[i]].claim > 0) n++;
    }
    state._claimable = n;
  }
  // the Fourth Crown is the ladder's summit: the High Seat, complete
  const hs = state.buildings.find((b) => b.type === 'highseat' && b.hp > 0);
  const agesPct = !hs ? 0 : hs.greatWorkDone ? 100
    : Math.floor(((hs.progress || 0) / BUILDINGS.highseat.greatWork.workTicks) * 100);
  return {
    dominion: { cur: territorySize(state), goal: Math.ceil(state._claimable * WIN.territoryFrac) },
    plenty: { cur: Math.floor(state.res.gold), goal: WIN.gold },
    people: { cur: state.pop, goal: WIN.pop },
    ages: { cur: Math.min(100, agesPct), goal: 100 },
  };
}

// Crowns are high-water marks: once earned, never lost. Crowns keep landing
// even after victory (the Crown of Ages is usually won by a realm that already
// reigns supreme) — only the victory scroll itself fires once, on the three.
export function winTick(state) {
  const p = getProgress(state);
  for (const key of Object.keys(CROWN_NAMES)) {
    if (!state.crowns[key] && p[key].cur >= p[key].goal) {
      state.crowns[key] = true;
      logEvent(state, `👑 The ${CROWN_NAMES[key]} is yours!`, 'good');
      emit('crown', key);
    }
  }
  if (state.won) return;
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
