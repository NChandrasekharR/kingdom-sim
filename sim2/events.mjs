// Scenario events — scripted or probabilistic shocks injected into a run.
// An event is { name, when(world)->bool, apply(world), once? }.
// Scenarios compose these; the Monte Carlo harness can also fire random ones.

export const EVENTS = {
  drought: {
    name: 'Drought',
    apply(w) {
      // farms produce nothing for ~half a year: model as food stock hit + flag
      const loss = w.res.food * 0.4;
      w.res.food -= loss;
      w._droughtUntil = w.tick + 240;
      w.log.push({ tick: w.tick, kind: 'bad', text: `Drought — lost ${loss.toFixed(0)} food` });
    },
  },
  harshWinter: {
    name: 'Harsh winter',
    apply(w) {
      // extra food drain + HP hit to all buildings (cold damage)
      w.res.food *= 0.6;
      for (const b of w.buildings) if (b.type !== 'keep') b.hp = Math.max(1, b.hp - b.maxHp * 0.1);
      w.log.push({ tick: w.tick, kind: 'bad', text: 'Harsh winter — buildings damaged' });
    },
  },
  plague: {
    name: 'Plague',
    apply(w) {
      // kills ~20% of population at random — including possibly masters
      const alive = w.villagers.filter((v) => v.alive);
      const n = Math.floor(alive.length * 0.2);
      for (let i = 0; i < n; i++) {
        const v = w.rng.pick(alive.filter((x) => x.alive));
        if (v) { v.alive = false; w.stats.villagersLost++; if (w.skillOf(v) > 0.6) w.stats.mastersLost++; }
      }
      w.log.push({ tick: w.tick, kind: 'bad', text: `Plague — ${n} died` });
    },
  },
  masterSmith: {
    name: 'Wandering master arrives',
    apply(w) {
      // a pre-skilled villager joins (tests specialist value)
      const v = w.addVillager('idle');
      v.skills.smelter = 0.9; v.skills.builder = 0.5;
      w.log.push({ tick: w.tick, kind: 'good', text: 'A master smith joins your realm' });
    },
  },
  goodHarvest: {
    name: 'Bountiful harvest',
    apply(w) {
      w.res.food += 60;
      w.log.push({ tick: w.tick, kind: 'good', text: 'Bountiful harvest — +60 food' });
    },
  },
  supplyRaid: {
    name: 'Supply line severed',
    apply(w) {
      // simulate a road cut: halve hauler capacity for a while by killing haulers' skill temporarily
      w._haulPenaltyUntil = w.tick + 200;
      w.log.push({ tick: w.tick, kind: 'bad', text: 'Supply lines disrupted' });
    },
  },
};

// Turn a scenario's event schedule into a per-tick hook.
export function makeEventRunner(scenario) {
  const scheduled = (scenario.events || []).map((e) => ({
    ...e, fired: false,
    atTick: e.atYear !== undefined ? Math.round(e.atYear * (scenario.params?.ticksPerYear || 480)) : e.atTick,
  }));
  return function runEvents(w) {
    for (const e of scheduled) {
      if (e.fired) continue;
      const due = (e.atTick !== undefined && w.tick >= e.atTick) ||
        (e.when && e.when(w));
      if (due) {
        EVENTS[e.event].apply(w);
        if (e.once !== false) e.fired = true;
      }
    }
    // random background events, if the scenario enables them
    if (scenario.randomEvents) {
      for (const re of scenario.randomEvents) {
        if (w.rng.chance(re.perTickChance)) EVENTS[re.event].apply(w);
      }
    }
  };
}
