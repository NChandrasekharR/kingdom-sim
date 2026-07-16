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

  // — food spoilage (makes BREAD the preserved winter/siege reserve) ──
  // Raw food rots; bread keeps. Only food ABOVE a per-capita buffer spoils, so a
  // struggling hamlet is never nagged — spoilage bites only a fat surplus, which
  // is exactly when the player should be baking it into bread for winter/sieges.
  food: {
    spoilEnabled: true,
    spoilFreeDays: 60,           // food covering this many days of eating never spoils
    spoilRate: 0.01,             // fraction of the EXCESS raw food lost per tick
    // (bread has no spoilage — that's the whole point)
  },

  // — combat: probabilistic per-exchange model (the army rework) ───────
  // Each engaged soldier rolls an exchange vs a raider: a crit roll (offense,
  // scales with skill) and a wound/kill roll (defense, softened by force-ratio,
  // veteran skill, home-ground, and tower cover). Wounds accumulate; only an
  // already-wounded soldier can be killed — and the kill-roll's severity SCALES
  // WITH CONDITIONS (good conditions → wounds heal; bad → lethal). This replaces
  // the flat "soldier takes fixed damage / flat death chance" model.
  combat: {
    model: 'probabilistic',      // 'probabilistic' (new) | 'flat' (legacy A/B control)
    soldierBaseDmg: 8,           // × (1 + skill), × critMult on a crit
    baseCrit: 0.05,              // crit chance at zero skill
    critSkillScale: 0.35,        // + this × skill → a master crits ~40% of swings
    critMult: 2.2,               // crit damage multiplier
    // — defense: chance the raider wounds the soldier this exchange —
    woundBase: 0.30,             // base wound chance at even odds, green, in the wilds
    woundSkillReduce: 0.4,       // × skill reduces wound chance (veterans get hit less)
    homeGroundReduce: 0.2,       // fighting in claimed territory: − this fraction
    towerCoverReduce: 0.3,       // within a tower's range: − this fraction (covering fire)
    // force-ratio: outnumber the raiders → wounds/kills scale toward zero
    // (multiplier = min(1, raiders/soldiers), same shape as the old fix)
    woundHp: 22,                 // HP a wound costs (soldier hp 60 → ~2-3 wounds tolerated)
    killWoundedFrac: 0.5,        // only a soldier below this HP fraction can be KILLED
    killChanceGood: 0.08,        // kill-roll on a wounded soldier in GOOD conditions
    killChanceBad: 0.7,          // …and in BAD conditions (fully outnumbered, exposed)
    // — seasoning: rookies near a veteran learn faster under fire —
    seasonRookieBonus: 4,        // × normal skill-gain for a low-skill soldier fighting
    seasonVeteranSkill: 0.6,     // "veteran" = soldier skill ≥ this (also the master bar)
    healPerTickIdle: 0.3,        // wounded soldiers mend this much HP/tick when not fighting
  },

  // — skills (Pillar B) —
  skill: {
    gainPerTick: 0.0004,         // proficiency gained per tick worked (halved 2026-07-16:
                                 // Duncastle playtest had 201 masters of 245 pop)
    max: 1.0,                    // 0..max; output mult = 1 + skill (so master = 2x at 1.0)
    masterAt: 0.8,               // the master bar (was a hardcoded 0.6 across world.mjs)
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
    // HP damage while looting — the master difficulty switch. History: 2.5 was
    // 100% collapse pre-softening; 1.2 was the survivable region; after the
    // anti-degenerate mechanics (force-ratio combat, once-per-raid sack deaths,
    // satiation/withdrawal) the whole range re-opened and 4.5 is the tuned
    // default: iq0 100% interesting / 0% collapse, iq1 95-98% interesting,
    // baseline AND gauntlet (2026-07-13 sweeps).
    raiderDmgPerTick: 4.5,
    lootPerTick: 2,
    abandonHpFrac: 0.15,         // below this HP a building is "sacked" — raiders move on, it survives at low HP
    towerRange: 7, towerDmg: 3,  // watchtower arrows per tick
    warlordEveryYears: 4,        // 0 = never
    warlordSizeMult: 2.5,
    // — anti-degenerate mechanics (B1 Finding 8) —
    // 1. force-ratio combat: soldier losses scale with how outnumbered they
    //    are. At even odds the full death chance applies; outnumber the raiders
    //    2:1 and it halves. Without this, soldiers are ablative meat and towers
    //    strictly dominate.
    soldierDeathBase: 0.15,      // per-tick death chance at even odds (was flat)
    // 2. sack deaths roll ONCE per building per raid — repairing mid-raid no
    //    longer feeds workers back into the grinder (flag, no knob).
    // 3. raider satiation & withdrawal: a raid against a defenseless town ends
    //    anyway — raiders leave when sated or when the season's looting is done.
    lootSatiation: 25,           // a raider with this much loot goes home content
    maxRaidTicks: 200,           // raiders withdraw after this long regardless
    // rubber-band: after a raid that hurt (sacked buildings), the next raid is
    // gentler and further off; when the kingdom is fat and unscathed, harsher.
    rubberBand: true,
    easeAfterSack: 0.04,         // per building sacked last raid: -this to next size mult
    minSizeMult: 0.5,
    // size-gated escalation: warlords & multi-front only past a threshold, so
    // pressure ramps WITH the kingdom instead of front-loading (Finding 5).
    warlordMinPop: 25,
    frontsMinPop: 30,

    // ── spatial-combat proxy (Phase 2a): raiders hunt villagers ────────
    // Abstract model of raiders physically running down civilians (no coords).
    // 'hunt' = new unified rule (buildings eject workers on sack; raiders that
    //   get past the towers/soldiers hunt exposed villagers who fight back weakly).
    // 'sack' = the legacy 0.12 die-at-post roll (reproduces the shipped baseline;
    //   the A/B control). See design/FINDINGS.md and the Phase-2a plan.
    raidCivDeathModel: 'hunt',
    huntShelterFrac: 0.6,        // civilians up to popCap*this are sheltered (unhuntable)
    huntSoldierPin: 1.5,         // raiders each soldier ties up (can't peel off to hunt)
    huntReachPerRaider: 0.5,     // exposed civilians a FREE raider engages per hunt round
    huntKillChance: 0.35,        // per engagement: raider kills the cornered villager
    huntVillagerDmg: 1.5,        // kill-back a villager lands (vs soldier 8, raider hp 30)
    huntCadenceTicks: 20,        // a chase resolves only every N ticks (not per-tick),
                                 // so the toll scales with raid SEVERITY, not duration.
                                 // TUNED 2026-07-15: at 20, baseline iq0 pop=50 / iq1
                                 // pop=36, 0% collapse, huntFrac 0.29 (in the 0.15-0.45
                                 // band). Per-tick firing (cadence 1) cratered pop to 7-18.
    huntDeathsPerRaidCap: 0,     // 0 = uncapped; >0 hard-caps hunt deaths per raid
    // towers must be staffed by a watchman to fire (competes for civilian labor)
    towerNeedsWatchman: true,

    // ── tribute (Danegeld): a warlord takes gold instead of blood ──────
    // When a warlord wave is due, he first demands a share of the TREASURY
    // (the demand reads your visible wealth — this is the gold sink). Paying
    // skips the wave but WHETS THE APPETITE: the next demand is ×appetiteMult.
    // Refusing means facing him — and facing him, win or bleed, resets the
    // appetite (the legend of easy coin dies). Intended arc: pay while weak,
    // build an army, eventually refuse.
    tribute: {
      enabled: true,
      demandFrac: 0.25,          // share of the treasury a fresh demand asks
      demandMin: 40,             // a warlord doesn't march for pennies
      appetiteMult: 1.6,         // each payment multiplies the next demand
    },
  },

  // — winter (Pillar C) —
  winter: {
    fuelWoodPerHousePerTick: 0.0, // 0 = off; scenario tests fuel demand
    biggerColderExpo: 0.0,        // extra winter severity per pop (0 = off)
  },

  // — the scripted "player" policy —
  player: {
    // tribute stance: 'auto' = pay only when the warlord outmatches the shield,
    // 'always' = the danegeld habit (stress-tests the appetite spiral),
    // 'never' = always fight. Sweepable: --sweep player.tributePolicy=never,auto,always
    tributePolicy: 'auto',
    // ── tier (B1): 0 = passive legacy bot, 1 = competent, 2 = sharp ──
    // Numeric so monte.mjs can sweep it: --sweep player.iq=0,1,2
    // iq 0 reproduces the pre-B1 behavior exactly (reactive repair, fixed army).
    // iq 1 adds what any decent player does: reads the raid telegraph, surges
    //   repair before/after raids, scales the army to the expected raid size,
    //   demobilizes in peacetime (soldiers eat 3x), preps food before winter.
    // iq 2 adds micro headroom: peacetime HP kept high (denies weakHp targeting),
    //   positioning bonus in combat, will pull producers into a militia.
    iq: 0,
    maintenanceThreshold: 0.6,   // repair buildings below this HP fraction
    foodMarginTarget: 1.6,       // build food capacity to pop*eat*this
    haulersAuto: true,
    soldierTarget: 6,            // standing army size (iq 0 only)
    towerPerBuildings: 6,        // 1 watchtower per N buildings
    readyByYear: 0.85,          // wants defense (barracks + 2 soldiers) before first raid
    sellSurplusAbove: 80,
    merchantBuyCap: 40,          // caps liquidation (a §4 sink)
    // — iq >= 1 (competent) —
    raidAlertTicks: 120,         // brace when raid.timer drops below this (the telegraph)
    peacetimeSoldiers: 2,        // minimum standing army (population permitting)
    threatArmyFactor: 0.6,       // standing army per expected raider (kept at ALL times —
                                 // muster-from-zero was tried and loses: green, late, small)
    popPerSoldier: 8,            // army capped at pop/this — combat attrition is ablative,
                                 // a small kingdom fielding militia grinds up its producers
    militiaMinPop: 25,           // below this pop, never pull producers into the militia
    towerPerExpectedRaiders: 4,  // towers built per expected raiders (they kill for free)
    surgeRepairThreshold: 0.95,  // repair-to target during telegraph + post-raid surge
    postRaidSurgeTicks: 300,     // keep surging this long after a raid ends
    maxBuilderFrac: 0.35,        // never assign more than this fraction of labor to repair
    winterFoodMult: 1.5,         // autumn: raise food margin target for winter
    // — iq = 2 (sharp) —
    sharpMaintenance: 0.85,      // peacetime HP floor (denies weakHp raid targeting)
    sharpCombatMult: 1.3,        // soldier damage bonus (positioning/choke micro)
    sharpSoldierDeathChance: 0.10, // vs 0.15 base — fights from better ground
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
