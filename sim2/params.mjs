// ── The tunable design knobs ────────────────────────────────────────
// Every number the redesign needs to pin down lives here. Scenarios override
// any subset. This is the object the Monte Carlo sweeps over.

export const DEFAULTS = {
  // — time —
  ticksPerYear: 480,
  years: 12,
  startPop: 6,          // founding villagers
  startFood: 40,

  // — §2 HP-as-output core —
  // Tuned 2026-07-11 via Monte Carlo (sim2/monte.mjs): the survivable region is
  // gentle output falloff + brisk repair. See design/FINDINGS.md.
  hp: {
    decayPerTick: 0.04,          // HP lost/tick with zero maintenance
    outputFloor: 0.4,            // a gutted building still makes 40% (was 0.15) — lets it fund its own repair
    // output multiplier = floor + (1-floor) * (hp/maxHp)^curve
    outputCurve: 1.0,            // >1 punishes low HP harder
    repairPerBuilderTick: 1.5,   // brisk repair so recovery outpaces raid damage (was 0.6)
    repairWoodPerHp: 0.05,       // materials burned per HP repaired
    repairStonePerHp: 0.03,
  },

  // — villagers (§3) —
  villager: {
    eatPerTick: 0.04,
    soldierEatMult: 3.0,         // Chandra: food-not-gold army sink
    starveDeathTicks: 60,        // ticks of starvation before death
    walkSpeed: 1.0,              // tiles/tick off-road
    roadSpeedMult: 1.7,
    retrainTicks: 240,           // half a year to change jobs
  },

  // — skills (Pillar B) —
  skill: {
    gainPerTick: 0.0008,         // proficiency gained per tick worked
    max: 1.0,                    // 0..max; output mult = 1 + skill (so master = 2x at 1.0)
    decayPerTickIdle: 0.0003,    // unused skills fade
    apprenticeFloor: 0.35,       // juniors near a master hold ≥this (raised 0.15→0.35: knowledge floor, Finding 5)
    masterTrainsRadius: 1,       // a master lifts nearby juniors' floor
    // a master's presence seeds the whole building-type's baseline, so losing
    // one veteran doesn't wipe the craft — survivors retain a working floor.
    guildFloorFromMaster: 0.3,
  },

  // — logistics (Pillar A) —
  logistics: {
    stockpileCap: 20,            // per-building local storage
    haulerCarry: 5,              // units per trip
    haulerPerBuildings: 4,       // target: 1 hauler per N peripheral buildings
    starveIfBelow: 2,            // building output starves if input stock < this
    cutoffDecayMult: 2.0,        // decay accelerates when supply-cut
    // The town CORE around the keep auto-distributes for free (no hauler needed).
    // Only buildings beyond it require haulers → logistics is a SCALING concern,
    // not a startup tax. This is the fix the sim surfaced on 2026-07-09.
    coreBuildings: 6,            // first N buildings are "in the core"
  },

  // — economy (production rates, from config.js, per fully-staffed tick) —
  prod: {
    farm:   { out: { food: 0.5 },  workers: 2, winterMult: 0.4 },
    dock:   { out: { food: 0.4 },  workers: 2, winterMult: 1.0 },
    lumber: { out: { wood: 0.35 }, workers: 2 },
    quarry: { out: { stone: 0.3 }, workers: 3 },
    mine:   { out: { ore: 0.25 },  workers: 3 },
    smelter:{ in: { ore: 0.3, wood: 0.15 }, out: { iron: 0.15 }, workers: 2 },
    bakery: { in: { food: 0.4 }, out: { bread: 0.4 }, workers: 2 }, // REWORKED: 0.25→0.4 bread
    market: { workers: 1 },
    house:  { popCap: 5 },
  },
  breadFoodEq: 2,

  // — pressure (Pillar C) —
  raid: {
    firstYear: 1.0,
    baseGapTicks: 260,
    gapJitter: 200,
    // wave size = base + prosperity^expo/divisor + military pressure
    sizeBase: 2,
    prosperityExpo: 1.0,
    prosperityDivisor: 350,
    militaryPressure: 0.4,       // +this raiders per your soldier (they bring more)
    sizeCap: 40,                 // raised from 14
    fronts: 1,                   // spawn points; scenario can raise
    targeting: 'value',          // 'random' | 'value' | 'weakHp' | 'chokepoint'
    raiderHp: 30,
    raiderDmgPerTick: 1.2,       // HP damage while looting — the master switch (2.5→1.2 = recoverable, see FINDINGS)
    lootPerTick: 2,
    abandonHpFrac: 0.15,         // below this HP a building is "sacked" — raiders move on, it survives at low HP
    towerRange: 7, towerDmg: 3,  // watchtower arrows per tick
    warlordEveryYears: 4,        // 0 = never
    warlordSizeMult: 2.5,
    // rubber-band: after a raid that hurt (sacked buildings), the next raid is
    // gentler and further off; when the kingdom is fat and unscathed, harsher.
    rubberBand: true,
    easeAfterSack: 0.04,         // per building sacked last raid: -this to next size mult
    minSizeMult: 0.5,
    // size-gated escalation: warlords & multi-front only past a threshold, so
    // pressure ramps WITH the kingdom instead of front-loading (Finding 5).
    warlordMinPop: 25,
    frontsMinPop: 30,
  },

  // — winter (Pillar C) —
  winter: {
    fuelWoodPerHousePerTick: 0.0, // 0 = off; scenario tests fuel demand
    biggerColderExpo: 0.0,        // extra winter severity per pop (0 = off)
  },

  // — the scripted "player" policy —
  player: {
    maintenanceThreshold: 0.6,   // repair buildings below this HP fraction
    foodMarginTarget: 1.6,       // build food capacity to pop*eat*this
    haulersAuto: true,
    soldierTarget: 6,            // standing army size
    towerPerBuildings: 6,        // 1 watchtower per N buildings
    readyByYear: 0.85,          // wants defense (barracks + 2 soldiers) before first raid
    sellSurplusAbove: 80,
    merchantBuyCap: 40,          // caps liquidation (a §4 sink)
  },
};

// deep-merge a scenario's overrides onto DEFAULTS
export function withOverrides(base, over) {
  if (over === undefined || over === null) return base;
  if (typeof base !== 'object' || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = (k in base) ? withOverrides(base[k], over[k]) : over[k];
  }
  return out;
}
