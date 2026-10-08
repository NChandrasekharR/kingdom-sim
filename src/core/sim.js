import { SEASON_TICKS, SEASONS, BUILDINGS } from '../config.js';
import { mulberry32 } from './rng.js';
import { economyTick, maintenanceTick, autoDemolishSpentTick, greatWorksTick } from './economy.js';
import { populationTick } from './population.js';
import { tradeTick } from './trade.js';
import { raidTick, mercenaryUpkeepTick } from './raids.js';
import { campTick } from './camp.js';
import { claimTick, recedeTick, claimEnclaves, territorySize } from './territory.js';
import { winTick } from './win.js';
import { saveGame } from './state.js';
import { logEvent, emit, journal } from './events.js';
import { countMasters, villagersMoveTick } from './villagers.js';
import { tutorialTick } from './tutorial.js';

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
        if (s === 'Spring') {
          logEvent(state, `Spring returns — Year ${currentYear(state)} of ${state.name}.`, 'good');
          // the yearly census, journal-only: the time series every post-reign
          // analysis wished it had (pop/masters/army/morale/stores/land)
          journal(state, `Census: ${state.pop} souls (${countMasters(state)} masters), `
            + `${state.soldiers.length} under arms (${state.soldiers.filter((so) => so.merc).length} sellswords), `
            + `morale ${Math.round(state.morale)}, food-eq ${Math.round(state.res.food + state.res.bread * 2)}, `
            + `gold ${Math.round(state.res.gold)}, iron ${Math.round(state.res.iron)}, `
            + `territory ${territorySize(state)} tiles.`);
          // a standing Great Temple keeps the festival calendar: the fears of
          // the old year are sung away with the first thaw
          if (state.buildings.some((b) => b.type === 'temple' && b.greatWorkDone && b.hp > 0 && !b.sacked)) {
            state.raidShock = 0;
            logEvent(state, 'A festival fills the Great Temple — the fears of the old year are sung away.', 'good');
          }
        }
      }

      economyTick(state);
      greatWorksTick(state);   // the scaffold draws its draught while the crews stand posted
      // spent sites strike themselves BEFORE the repair queue is drawn up, so a
      // husk never takes a last mouthful of repair wood on its way out
      autoDemolishSpentTick(state);
      maintenanceTick(state);
      populationTick(state);
      villagersMoveTick(state);   // bodies walk (and panic) before the raid resolves
      tradeTick(state, rand);
      raidTick(state, rand);
      campTick(state, rand);      // camp life + the expedition, after the raid resolves
      mercenaryUpkeepTick(state);

      if (state.tick % 2 === 0) {
        if (state.starving) recedeTick(state);
        else claimTick(state, rand);
      }
      // pockets of wilds fully surrounded by the realm fold in on their own
      if (state.tick % 32 === 0 && !state.starving) claimEnclaves(state);

      winTick(state);
      tutorialTick(state);   // the steward watches, and speaks once per lesson

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

// ── The full chronicle as a text file — kingdom.export() ──────────
// Every journal entry of the reign, grouped by year and season, with the run
// summary appended. Returns the text; main.js wraps it in a browser download.
export function exportChronicle(state) {
  const years = (state.tick / (SEASON_TICKS * 4)).toFixed(1);
  const outcome = state.pop <= 1 ? 'FALLEN' : state.won ? 'VICTORIOUS' : 'reigning';
  const lines = [
    `⚜ THE CHRONICLE OF ${state.name.toUpperCase()}`,
    `seed ${state.seed} · ${years} years reigned · ${outcome} · ${state.pop} souls · tick ${state.tick}`,
  ];
  if (state._journalLost) {
    lines.push(`(the earliest pages are lost — the journal keeps the most recent entries only)`);
  } else if (state._journalThinned) {
    lines.push(`(the oldest births, trades and skirmish blows are thinned — every major event is kept)`);
  }
  let head = '';
  for (const e of state.journal || []) {
    const h = `Year ${1 + Math.floor(e.tick / (SEASON_TICKS * 4))} · ${SEASONS[Math.floor(e.tick / SEASON_TICKS) % 4]}`;
    if (h !== head) {
      head = h;
      lines.push('', `── ${h} ${'─'.repeat(Math.max(1, 42 - h.length))}`);
    }
    const tag = (e.kind === 'info' || e.kind === 'detail') ? '' : `[${e.kind}]`;
    lines.push(`  t${String(e.tick).padStart(6)}  ${tag.padEnd(9)} ${e.text}`);
  }
  lines.push('', `── THE RECKONING ${'─'.repeat(26)}`, JSON.stringify(runSummary(state), null, 2), '');
  return lines.join('\n');
}

// Console dump of the run so far — the playtest telemetry. Call kingdom.summary()
// from the console (wired in main.js), or it fires automatically on collapse.
export function dumpStats(state) {
  const summary = runSummary(state);
  // eslint-disable-next-line no-console
  console.log('%c⚜ ' + state.name + ' — run summary', 'font-weight:bold;font-size:14px', summary);
  return summary;
}

// the summary object itself, pure — shared by dumpStats and exportChronicle
export function runSummary(state) {
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
      raids: s.raids, warlords: s.warlords, warlordsSlain: s.warlordsSlain || 0,
      avgRaidSize: +avgRaid, biggestRaid: maxRaid,
      raidersKilled: s.raidersKilled,
      buildingsSacked: s.buildingsSacked, wallsBreached: s.wallsBreached, keepFalls: s.keepFalls,
      lootRecovered: s.lootRecovered || 0, ironGathered: s.ironGathered || 0,
      expeditions: s.expeditions || 0, campsBroken: s.campsBroken || 0,
      massacres: s.massacres || 0, campFolkSlain: s.folkSlain || 0,
    },
    camp: state.camp ? {
      name: state.camp.name, warlord: state.camp.warlord.name,
      garrison: state.camp.garrison.length,
      hoard: Math.round(state.camp.ledger.gold + state.camp.ledger.plunder),
      state: state.camp.gone ? 'ashes' : state.camp.broken ? 'broken'
        : state.camp.leaderless ? 'leaderless' : state.camp.avenger ? 'AVENGER' : 'festering',
    } : null,
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
    greatWorks: state.buildings
      .filter((b) => BUILDINGS[b.type].greatWork && b.greatWorkDone)
      .map((b) => BUILDINGS[b.type].name),
    worksSacked: s.worksSacked || 0,
    foodSpoiled: Math.round(s.foodSpoiled || 0),
    forestCleared: s.forestCleared || 0,
    hillsFlattened: s.hillsFlattened || 0,
    veinsSpent: s.veinsSpent || 0,
    cascadeStone: Math.round(s.cascadeStone || 0),
    tribute: { paid: s.tributesPaid || 0, gold: Math.round(s.tributeGold || 0), appetite: state.tributeAppetite || 0 },
  };
  return summary;
}
