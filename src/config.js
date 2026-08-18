// ── World ──────────────────────────────────────────────────────────
export const MAP = { size: 128, tile: 8 };          // 128×128 tiles, 8 world-px each
export const TICK_MS = 600;                          // one sim tick at 1× speed

export const T = { WATER: 0, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 4, ORE: 5 };

export const TERRAIN_INFO = {
  [T.WATER]:    { name: 'Water',    claim: 0,    move: Infinity },
  [T.PLAINS]:   { name: 'Plains',   claim: 1,    move: 1 },
  [T.FOREST]:   { name: 'Forest',   claim: 0.45, move: 1.8 },
  [T.HILLS]:    { name: 'Hills',    claim: 0.28, move: 2.2 },
  [T.MOUNTAIN]: { name: 'Mountain', claim: 0.07, move: 9 },
  [T.ORE]:      { name: 'Ore vein', claim: 0.28, move: 2.2 },
};

export const RESOURCES = ['food', 'wood', 'stone', 'ore', 'iron', 'bread', 'gold'];

export const RES_INFO = {
  food:  { name: 'Food',  base: 1.0 },
  wood:  { name: 'Wood',  base: 2.0 },
  stone: { name: 'Stone', base: 3.0 },
  ore:   { name: 'Ore',   base: 4.0 },
  iron:  { name: 'Iron',  base: 8.0 },
  bread: { name: 'Bread', base: 3.0 },
  gold:  { name: 'Gold',  base: 1.0 },
};

// ── Buildings ──────────────────────────────────────────────────────
// place: { on: terrain } tile must be that terrain; { near: terrain } within 1 tile.
// prod: flat output per tick fully staffed. conv: inputs→outputs per tick fully staffed.
export const BUILDINGS = {
  keep: {
    name: 'Keep', desc: 'Seat of your rule. Its guard looses arrows on raiders — but if the keep is stormed, a dark age falls.',
    cost: {}, hp: 300, workers: 0, influence: 11, popCap: 10, unique: true, unbuildable: true,
    range: 8, arrowDmg: 5,   // the keep's own guard: stronger than a watchtower, needs no garrison
  },
  house: {
    name: 'House', desc: 'Shelter for 5 more subjects.',
    cost: { wood: 20 }, hp: 60, workers: 0, popCap: 5, influence: 3,
  },
  farm: {
    name: 'Farm', desc: 'Grows food on plains. Slows in winter.',
    cost: { wood: 15 }, hp: 50, workers: 2, place: { on: T.PLAINS }, influence: 2,
    prod: { food: 0.5 },
  },
  dock: {
    name: 'Fishing Dock', desc: 'Nets fish from the shallows. Fishes through winter.',
    cost: { wood: 25 }, hp: 50, workers: 2, place: { near: T.WATER }, influence: 2,
    prod: { food: 0.4 },
  },
  lumber: {
    name: 'Lumber Camp', desc: 'Fells timber from nearby forest — until the wood is spent and the land lies open for farming.',
    cost: { wood: 10 }, hp: 50, workers: 2, place: { near: T.FOREST }, influence: 3,
    prod: { wood: 0.35 },
  },
  quarry: {
    name: 'Quarry', desc: 'Cuts stone. Must border hills.',
    cost: { wood: 20 }, hp: 60, workers: 3, place: { near: T.HILLS }, influence: 2,
    prod: { stone: 0.3 },
  },
  mine: {
    name: 'Mine', desc: 'Digs ore. Must sit on an ore vein.',
    cost: { wood: 25, stone: 10 }, hp: 60, workers: 3, place: { on: T.ORE }, influence: 2,
    prod: { ore: 0.25 },
  },
  smelter: {
    name: 'Smelter', desc: 'Burns ore and wood into iron.',
    cost: { stone: 25, wood: 10 }, hp: 70, workers: 2, influence: 2,
    conv: { in: { ore: 0.3, wood: 0.15 }, out: { iron: 0.15 } },
  },
  bakery: {
    name: 'Bakery', desc: 'Bakes bread — each loaf feeds two, and bread never spoils.',
    cost: { wood: 20, stone: 10 }, hp: 50, workers: 2, influence: 2,
    conv: { in: { food: 0.4 }, out: { bread: 0.4 } }, // reworked 0.25→0.4: a real "feed more per worker" upgrade
  },
  market: {
    name: 'Market', desc: 'Collects taxes and draws the merchant caravan.',
    cost: { wood: 30, stone: 15 }, hp: 60, workers: 1, unique: true, influence: 4,
  },
  church: {
    name: 'Church', desc: 'Lifts morale and spreads influence.',
    cost: { wood: 25, stone: 30, gold: 25 }, hp: 80, workers: 0, influence: 8,
  },
  tower: {
    name: 'Watchtower', desc: 'Shoots raiders and extends the border — but only while a watchman is posted.',
    cost: { wood: 15, stone: 25 }, hp: 90, workers: 1, influence: 7,
    range: 7, arrowDmg: 3,
  },
  wall: {
    name: 'Wall', desc: 'Stone rampart. Raiders must batter through.',
    cost: { stone: 4 }, hp: 120, workers: 0,
  },
  road: {
    name: 'Road', desc: 'Armies march the roads — yours, and theirs. Faster movement, more merchant visits, and the border follows the road. Laid over water it becomes a bridge (wood + stone).',
    cost: { stone: 2 }, hp: 40, workers: 0, influence: 2,
  },
  bridge: {
    name: 'Bridge', desc: 'Planks over the water. The border and the roads cross with it — and so can raiders.',
    cost: { wood: 6, stone: 4 }, hp: 60, workers: 0, influence: 2, unbuildable: true,
  },
  barracks: {
    name: 'Barracks', desc: 'Trains soldiers (4 per barracks).',
    cost: { wood: 30, stone: 20, iron: 8 }, hp: 90, workers: 0, influence: 3,
  },
};

// watchmen are posted before the fields are filled (sim2: unstaffed towers are
// inert, and a tower is worth more than one farmhand) — defense competes for labor
export const WORK_PRIORITY = ['tower', 'farm', 'dock', 'lumber', 'quarry', 'mine', 'smelter', 'bakery', 'market'];

// ── Victory: the Three Crowns ──────────────────────────────────────
export const WIN = {
  territoryFrac: 0.30,  // Crown of Dominion: claim this share of all claimable land
  gold: 800,            // Crown of Plenty: gold banked at once
  pop: 80,              // Crown of the People: subjects housed and fed
};
export const ROAD_SPEED_MULT = 1.7;
export const ROAD_MERCHANT_FACTOR = 0.004; // per road tile, capped at 40% faster returns

// ── Reserve knobs, sweepable without code edits ────────────────────
// The finite-ground bases (forest wood, hill stone, vein ore) are overridable
// via env vars read once at module load (harness only — undefined in the
// browser, where the literals stand):
//   KSIM_WOOD_BASE, KSIM_WOOD_VAR, KSIM_STONE_BASE, KSIM_STONE_VAR,
//   KSIM_ORE_BASE, KSIM_ORE_VAR
// A value of 0 or "inf"/"infinite" makes that reserve effectively bottomless
// (the control case: the prototype changes nothing when reserves are infinite).
const _envNum = (name, fallback) => {
  const raw = (typeof process !== 'undefined' && process.env && process.env[name]) || '';
  if (raw === '') return fallback;
  if (/^inf/i.test(raw)) return Infinity;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

// ── The forest is finite (Session 5c; retuned Session 8) ──────────
// Every forest tile holds a stock of wood. Lumber camps cut the nearest
// standing timber; a spent tile becomes PLAINS — farmable, buildable, open.
// The economy EATS the map: the wood-line recedes, camps go quiet, and the
// kingdom must push outward or buy its timber.
//
// MEASURED CADENCE (harness, 25-yr runs, seeds 42/7/123/99 — the number the
// old comment claimed but never had). At woodBase 90 a lumber site lasted
// only 1.0-1.8 years: a chore, five times faster than the design intent.
// Sweep at 250/300/350/450 (see docs/SIMULATIONS.md, wood retune):
//   250 → 3.6-5.0 yr/site   ← chosen: the 4-6 band, no seed running long
//   300 → 4.4-7.5 yr/site      (seed 42 overshoots)
//   350 → 5.0-6.8 yr/site
//   450 → 5.8-7.5 yr/site      (a camp outlives the interest)
// At 250 a camp is an ERA rather than a tick-box, the forest visibly recedes
// across a reign, and year-3 wood/pop are unchanged from the old value —
// the early game never starves, only the late game stops churning.
export const FOREST = {
  woodBase: _envNum('KSIM_WOOD_BASE', 250),  // typical wood in a fresh forest tile
  woodVar: _envNum('KSIM_WOOD_VAR', 125),    // ± mapgen richness (old growth vs scrub)
  harvestRadius: 2.2,          // a camp cuts standing timber this far out
};

// ── The ground itself gives out (Prototype: finite stone & ore) ────
// Mirror of FOREST for the two mining chains. Every HILLS tile holds a
// stock of stone; every ORE tile holds a stock of ore. A quarry cuts the
// nearest live hill within reach, a mine the nearest live vein. Exhaust a
// hill and it flattens to PLAINS ("the quarry ground becomes a plain");
// exhaust a vein and the ORE tile falls back to HILLS — the vein is spent
// but the hill remains, quarryable ground (a deliberate cascade).
// Bases are env-sweepable — see the _envNum block above the FOREST config.
export const DEPOSITS = {
  harvestRadius: 2.2,          // a quarry/mine works ground this far out (shared with FOREST cadence)
  stoneBase: _envNum('KSIM_STONE_BASE', 250),  // sweep-calibrated: first quarry site dies ~year 4-5, era not chore
  stoneVar:  _envNum('KSIM_STONE_VAR', 90),    // ± mapgen richness
  oreBase:   _envNum('KSIM_ORE_BASE', 150),    // sweep-calibrated: iron flows to ~year 17-19 with 3-5 forced relocations
  oreVar:    _envNum('KSIM_ORE_VAR', 60),      // ± vein richness
};

// ── Population & morale ────────────────────────────────────────────
export const EAT_PER_POP = 0.04;        // food-equivalents per tick per person
export const SOLDIER_EAT_MULT = 3;      // a soldier eats 3× a citizen (the army's real cost)

// Food spoilage (sim2-validated): raw food above a per-capita buffer rots; bread
// keeps. This is what makes the bakery matter — a fat surplus is exactly when you
// should be baking it into bread for winter and sieges. A struggling hamlet whose
// stores fit inside the buffer is never nagged.
export const FOOD = {
  spoilFreeTicks: 60,          // food covering this many ticks of eating never spoils
  spoilRate: 0.01,             // fraction of the EXCESS raw food lost per tick
};
export const GROWTH_FLOOR = 1.5;        // need stock > pop*this to grow
export const STARVE_DEATH_HUNGER = 60;  // ticks-worth of accumulated hunger before death

// Population growth SCALES WITH FOOD ABUNDANCE: a kingdom drowning in food booms,
// one scraping by crawls. Before, growth was flat (~13/yr) regardless of surplus,
// so a huge granary did nothing and war attrition (~10/yr) stalled pop far below
// its housing cap. Now surplus food is the fuel that lets a realm actually grow.
export const GROWTH = {
  base: 0.03,             // baseline growth per tick when barely fed (faster than old 0.018)
  moraleBonus: 5000,      // + morale/this (a happy realm breeds)
  // food-abundance multiplier: growth × (1 + min(surplusCap, surplusScale × (foodPerCapita/target − 1)))
  surplusTarget: 6,       // food-eq per person considered "comfortable" (~150 ticks' eating)
  surplusScale: 0.6,      // how strongly abundance accelerates growth
  surplusCap: 4,          // growth can go at most this× faster from abundance
};

// ── HP is production capacity (the redesign core) ──────────────────
// A building's output scales with its HP; HP decays without maintenance;
// raiders grind HP down; builders restore it for labor + materials.
// Numbers validated in sim2/ (480+ Monte Carlo runs — see design/FINDINGS.md).
export const HP = {
  decayPerTick: 0.04,          // HP lost per tick with zero maintenance (keep exempt)
  outputFloor: 0.4,            // a gutted building still runs at 40% — it can fund its own repair
  repairPerBuilderTick: 1.5,   // HP restored per builder per tick (× skill)
  repairWoodPerHp: 0.05,       // materials burned per HP repaired
  repairStonePerHp: 0.03,
  maintenanceThreshold: 0.6,   // auto-assign builders to anything below this HP fraction
};

// ── Skills (villagers learn by doing; knowledge is mortal) ─────────
// RETUNED 2026-07-16 (Duncastle log: 201 masters of 245 pop — mastery was the
// default state of a human being, so losing one meant nothing). A master is
// now YEARS of devoted work (~4+ years at the same craft), and the bar is
// higher — Pillar B only has teeth if masters are precious.
export const SKILL = {
  gainPerTick: 0.0004,         // proficiency per tick worked (halved)
  max: 1.0,                    // output multiplier = 1 + skill (a true master doubles output)
  decayPerTickIdle: 0.0003,    // unused skills fade (now bites harder relative to gain)
  masterAt: 0.8,               // at this skill you count as a master (was 0.6)
  apprenticeFloor: 0.35,       // juniors working beside a living master hold at least this
  guildFloor: 0.3,             // a craft once mastered here never drops below this baseline
};

// ── Soldiers ───────────────────────────────────────────────────────
// Iron arms them once; from then on they eat 3× (food, not gold, limits armies).
export const SOLDIER = { cost: { iron: 5 }, hp: 60, dmg: 8, speed: 1.1, perBarracks: 4 };

// ── Combat: probabilistic per-exchange model (sim2-validated) ──────
// Each soldier↔raider exchange is a ROLL, not flat damage. Veterans crit more
// and get hit less; outnumbering raiders is near-bloodless (force-ratio); fighting
// on home ground and under tower cover is safer. Wounds accumulate — only a badly
// wounded soldier can be killed, and the kill-odds SCALE WITH CONDITIONS (good
// ground → wounds heal; bad → lethal). Rookies beside a veteran season fast.
// Numbers tuned in sim2 (design/FINDINGS.md, army rework 2026-07-15).
export const COMBAT = {
  baseCrit: 0.05,              // crit chance at zero soldier skill
  critSkillScale: 0.35,        // + this × skill (a master crits ~40% of swings)
  critMult: 2.2,               // crit damage multiplier
  woundBase: 0.30,             // wound chance at even odds, green, in the wilds
  woundSkillReduce: 0.4,       // × skill lowers wound chance (veterans get hit less)
  homeGroundReduce: 0.25,      // fighting inside your claimed territory: − this
  towerCoverReduce: 0.3,       // within a watchtower/keep's range: − this (covering fire)
  woundHp: 22,                 // HP a wound costs
  killWoundedFrac: 0.5,        // only a soldier below this HP fraction can be killed
  killChanceGood: 0.08,        // kill-roll on a wounded soldier in GOOD conditions
  killChanceBad: 0.7,          // …and in BAD conditions (outnumbered, exposed)
  seasonRookieBonus: 4,        // green soldiers near a veteran gain skill this × faster
  veteranSkill: 0.6,           // skill at which a soldier counts as a veteran
  // veterans survive the war of attrition: experience makes a wounded veteran
  // harder to finish off, and a badly-hurt veteran RETREATS to heal rather than
  // dying in the line (a rookie lacks the sense to pull back in time).
  veteranKillResist: 0.7,      // × skill lowers the kill-roll on a wounded soldier
  retreatBelowFrac: 0.5,       // a soldier below this HP fraction falls back to mend…
  retreatSkillGate: 0.4,       // …but only if skilled enough to disengage cleanly
  // the army fights as a LINE, not a mob (die-en-masse fix, 2026-07-16):
  // harness showed all soldiers dogpiling one raider, entering melee on the
  // same tick, and crossing the death threshold together — synchronized wipes.
  coverPenalty: 2.5,           // effective distance added per ally already on a raider
  routFrac: 0.4,               // lose this share of the army in one raid → the line breaks
};

// ── Mercenaries ────────────────────────────────────────────────────
// Hired outsiders you pay in GOLD (not a subject under arms). They fight like
// seasoned soldiers but cost steep per-tick upkeep and WALK if you can't pay —
// an emergency valve to absorb a big raid without bleeding your veterans, and a
// gold sink that can't quietly become a cheap standing army. They aren't your
// people: no seasoning, no home, and their death costs you no villager.
export const MERCENARY = {
  companySize: 3,            // fighters hired per contract
  hireCost: { gold: 120 },   // up-front gold to hire a company
  upkeepPerTick: 0.12,       // gold per merc per tick — steep; unpaid → they leave
  // no hard cap on companies — the market itself is the cap: every extra
  // company under contract raises EVERY sword's price (captains talk). Four
  // companies pay double per merc; a huge merc host is a fortune per season.
  upkeepEscalation: 0.35,    // + this × (companies−1) to the per-merc rate
  skill: 0.55,               // pre-trained: just shy of veteran (0.6)
  hp: 60,
};

// ── Villagers as bodies on the map (the spatial layer) ────────────
// Villagers are rendered agents: they walk between home and work, panic when
// raiders come near, and flee toward the keep. Positions are presentation +
// the substrate the hunt runs on — production itself stays non-spatial.
export const VILLAGER = {
  walkSpeed: 0.5,              // tiles/tick (slower than a raider's 0.85 — running is dangerous)
  panicRadius: 3,              // a raider this close sends a civilian fleeing for the keep
  keepShelterRadius: 2.5,      // huddled this close to the keep, you're under its guard
  houseShelterRadius: 1.0,     // this close to an intact house, you duck inside
  towerInsideRadius: 1.3,      // a watchman this close to his tower is INSIDE it (flag up, body hidden)
};

// ── The hunt: how civilians die in a raid (sim2-validated, Campaign 6) ──
// ONE death channel: caught in the open. Sacked buildings eject their crews;
// raiders that get past the towers and soldiers run down exposed villagers,
// who swing back weakly before the kill roll. Numbers ported from sim2
// (huntCadenceTicks is the load-bearing knob — a chase is occasional, not a
// per-tick grind, or the toll scales with raid DURATION and craters the pop).
export const HUNT = {
  cadenceTicks: 20,            // a chase resolves only every N ticks
  reach: 2.5,                  // an unpinned raider catches an exposed villager this close
  pinRadius: 1.6,              // a soldier this close ties the raider up (can't hunt)
  killChance: 0.35,            // a cornered villager usually dies (the drama)
  villagerDmg: 1.5,            // the hoe-swing a villager lands first (vs soldier 8, raider hp 30)
};

// ── Raiders ────────────────────────────────────────────────────────
// Raiders SACK buildings (grind HP to the abandon floor), they rarely raze.
// A raid is an economic wound measured in lost output-days, not lost tiles.
export const RAIDER = { hp: 30, dmg: 4, speed: 0.85, lootCap: 12 };
export const RAID = {
  firstAfter: 300, warningTicks: 40, minGapTicks: 250,
  lootDmg: 4.5,                // building HP lost per raider per looting tick — THE difficulty dial (sim2-validated; first playtest knob)
  abandonHpFrac: 0.15,         // below this fraction a building is sacked: raiders move on, it survives gutted
  // (the old sackDeathChance die-at-your-post roll is gone — a sacked building
  // EJECTS its crew, and the only way a civilian dies is caught in the open: HUNT)
  sizeBase: 2, prosperityDivisor: 350, militaryPressure: 0.4, sizeCap: 40,
  easeAfterSack: 0.04,         // rubber-band: each building sacked last raid shrinks the next wave...
  minSizeMult: 0.5,
  mercyPerSack: 4,             // ...and buys this many extra quiet ticks to recover
  maxRaidTicks: 200,           // raiders don't winter over — they withdraw when the season's looting is done
  warlordEveryWaves: 6,        // ≈ every 4 years at typical gaps
  warlordMinPop: 25,           // warlords only bother once the kingdom is worth it
  warlordSizeMult: 2.5, warlordHpMult: 1.5,
};

// ── Tribute (Danegeld) — sim2-validated 2026-07-16 ─────────────────
// A warlord would as soon take gold as blood: before he marches, a rider
// demands a share of your TREASURY. Paying skips the wave — and whets the
// appetite (next demand ×appetiteMult). Facing him, win or bleed, resets it.
// The intended arc: pay while weak, build an army, eventually refuse. This is
// the gold sink: sim median 3,867 gold paid over a 25-year run, 0% collapse.
export const TRIBUTE = {
  enabled: true,
  demandFrac: 0.25,          // share of the treasury a fresh demand asks
  demandMin: 40,             // a warlord doesn't march for pennies
  appetiteMult: 1.6,         // each payment multiplies the next demand
  decideTicks: 90,           // how long the rider waits for an answer
};

// ── The warlord's camp & the counter-raid (Session 5) ─────────────
// The warlord gets an ADDRESS: a camp in the far wilds — a stat block with
// tents and people, never a rival economy. His raids march FROM it (visible
// telegraphing); tribute and carried-off loot pile up in its ledger; and you
// can MARCH on it. Victory poses the moral choice: take back what's yours
// (punish — quiet years, spared folk may drift to your gates), or leave
// nothing standing (massacre — his line ends, but one survivor always
// escapes and returns as an avenger who cannot be bought, and the men who
// did it come home marked).
export const CAMP = {
  folk: 9,                     // souls who live in the camp (not fighters)
  garrisonBase: 6,             // swords guarding the camp at its founding
  garrisonPerPlunder: 0.015,   // wealth attracts swords: +1 per ~67 plunder
  garrisonMax: 20,
  warlordHp: 170,              // the warlord himself — worth ~6 raiders
  warlordBatterMult: 3,        // he brings a ram: walls fall faster before him
  swornMen: 4,                 // the oath-bound retinue who march at the warlord's shoulder
  warlordArrowMult: 0.4,       // his shield-bearers catch the shafts: arrows bite him this much while any sworn man stands
  // even a broke camp is worth the taking: arm-rings, stores, weapons off the dead
  spoils: { gold: 25, food: 20, wood: 15, ironPerSword: 0.4 },
  battleRadius: 7,             // the host engages inside this ring of the camp
  alertRadius: 9,              // garrison rushes out when the host gets this close
  provisionFood: 6,            // food-eq per soldier to provision the march
  provisionGold: 15,           // carts, boots, bribes for guides
  routFrac: 0.5,               // lose half the host afield → survivors turn home
  brokenTicks: 1900,           // punitive burning buys ~4 years of quiet
  successorTicks: 2400,        // warlord slain in open battle → a successor rises
  avengerTicks: 1400,          // massacre → the survivor returns SOONER (~3 yrs)
  avengerSizeMult: 1.35,       // and his dread waves hit harder
  markedKillResist: 0.5,       // marked men are harder to finish (nothing frightens them now)
  settlerMax: 4,               // spared camp folk who drift to your gates, over years
  settlerGapTicks: 320,
  settlerSkillChance: 0.35,    // sometimes a craftsman is among them
  // the camp as the SOURCE of raids (Session 5b): the nest is founded at the
  // first raid, a warlord claims it later, and most raids march from it —
  // opportunist bands still slip in from the map edges to keep you honest
  nestGarrison: 3,             // swords at the freshly-founded brigand nest
  raidFromCampChance: 0.7,     // share of common raids that march from the camp
  massingAtTicks: 150,         // timer threshold: "raiders are massing" (bodies gather)
  stirAtTicks: 60,             // timer threshold: "they may march soon"
  shadowRadius: 9,             // the warlord's shadow: no claim takes root this close
};

// ── The Keep as the kingdom's heart ────────────────────────────────
// The keep defends itself (see BUILDINGS.keep range/arrowDmg — no garrison).
// If raiders sack it anyway, a "dark age" falls: a one-time catastrophe you
// climb back out of — NOT a game-over. The keep survives at its floor and the
// realm rebuilds from it (design A2: collapse is recoverable, not a reset).
export const KEEP = {
  darkAge: {
    lootFrac: 0.6,          // this share of every stockpile is carried off
    moraleFloor: 12,        // morale is gutted to this
    buildingsGutted: 5,     // this many other buildings are knocked to their sack floor
    deaths: 3,              // up to this many subjects are lost in the storming
  },
  rallyOnBesiege: true,     // when the keep is attacked, all soldiers rush to defend it
};

// ── Seasons ────────────────────────────────────────────────────────
export const SEASON_TICKS = 120;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const WINTER_FARM_MULT = 0.4;

// ── Trade ──────────────────────────────────────────────────────────
export const MERCHANT = { awayMin: 140, awayMax: 240, stay: 80, markup: 1.35 };

// The caravan's carts are FINITE (Session 8 — resolves the long-open D4).
// Selling is uncapped: the merchant will always take what you have. BUYING is
// capped per visit, because before this the caravan was a bottomless import
// pipe and a keeper could simply buy his way out of depletion — the finite
// ground stopped meaning anything once gold flowed.
//
// The cap SCALES WITH COMMERCE, and that is the whole design: a harbor kingdom
// with docks and a market imports its way through a spent hinterland, and a
// landlocked one cannot. Depletion therefore hits different maps differently,
// which is the point. Sweep-calibrated at ~20-25/visit baseline: structural
// imports (a smelter fed through a dead vein) stay possible, trivializing
// depletion does not.
export const TRADE_CAP = {
  capBase: 20,        // goods the carts hold on a bare-gates visit
  perDock: 15,        // every fishing dock is a quay the caravan can unload at
  perMarket: 5,       // a market means porters, scales, and somewhere to pile it
};
