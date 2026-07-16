import { SEASON_TICKS, SEASONS } from '../config.js';
import { mulberry32 } from './rng.js';
import { economyTick, maintenanceTick } from './economy.js';
import { populationTick } from './population.js';
import { tradeTick } from './trade.js';
import { raidTick, mercenaryUpkeepTick } from './raids.js';
import { claimTick, recedeTick, territorySize } from './territory.js';
import { winTick } from './win.js';
import { saveGame } from './state.js';
import { logEvent, emit } from './events.js';
import { countMasters, villagersMoveTick } from './villagers.js';

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
      maintenanceTick(state);
      populationTick(state);
      villagersMoveTick(state);   // bodies walk (and panic) before the raid resolves
      tradeTick(state, rand);
      raidTick(state, rand);
      mercenaryUpkeepTick(state);

      if (state.tick % 2 === 0) {
        if (state.starving) recedeTick(state);
        else claimTick(state, rand);
      }

      winTick(state);

      // lifetime peaks for the run summary
      if (state.pop > state.stats.peakPop) state.stats.peakPop = state.pop;
      const terr = territorySize(state);
      if (terr > state.stats.peakTerritory) state.stats.peakTerritory = terr;

      // auto-dump the run summary the moment the kingdom falls (once)
      if (state.pop <= 1 && !state._summaryDumped) {
        state._summaryDumped = true;
        dumpStats(state);
        emit('kingdom-fallen', state);
      }

      if (state.tick % 100 === 0) saveGame(state);
      emit('tick', state);
    },
  };
}

// Console dump of the run so far — the playtest telemetry. Call kingdom.summary()
// from the console (wired in main.js), or it fires automatically on collapse.
export function dumpStats(state) {
  const s = state.stats;
  const years = (state.tick / (SEASON_TICKS * 4)).toFixed(1);
  const sizes = s.raidSizes;
  const avgRaid = sizes.length ? (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1) : 0;
  const maxRaid = sizes.length ? Math.max(...sizes) : 0;
  const kd = s.soldiersFallen ? (s.raidersKilled / s.soldiersFallen).toFixed(2) : s.raidersKilled;
  const crowns = Object.entries(state.crowns).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none';
  const summary = {
    kingdom: state.name,
    yearsReigned: +years,
    outcome: state.pop <= 1 ? 'FALLEN' : state.won ? 'VICTORIOUS' : 'reigning',
    crowns,
    population: { now: state.pop, peak: s.peakPop, cap: state.popCap },
    territory: { now: territorySize(state), peak: s.peakTerritory },
    resources: Object.fromEntries(Object.entries(state.res).map(([k, v]) => [k, Math.round(v)])),
    war: {
      raids: s.raids, warlords: s.warlords,
      avgRaidSize: +avgRaid, biggestRaid: maxRaid,
      raidersKilled: s.raidersKilled,
      buildingsSacked: s.buildingsSacked, wallsBreached: s.wallsBreached, keepFalls: s.keepFalls,
    },
    army: {
      soldiersNow: state.soldiers.length,
      recruited: s.soldiersRecruited, fallen: s.soldiersFallen, veteransFallen: s.veteransFallen,
      killDeathRatio: +kd,
    },
    people: {
      born: s.villagersBorn, starved: s.villagersStarved,
      huntedInRaids: s.villagersHunted || 0,
      mastersNow: countMasters(state), mastersLost: s.mastersLost,
    },
    foodSpoiled: Math.round(s.foodSpoiled || 0),
  };
  // eslint-disable-next-line no-console
  console.log('%c⚜ ' + state.name + ' — run summary', 'font-weight:bold;font-size:14px', summary);
  return summary;
}
