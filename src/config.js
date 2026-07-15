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
    cost: { wood: 20 }, hp: 60, workers: 0, popCap: 5,
  },
  farm: {
    name: 'Farm', desc: 'Grows food on plains. Slows in winter.',
    cost: { wood: 15 }, hp: 50, workers: 2, place: { on: T.PLAINS },
    prod: { food: 0.5 },
  },
  dock: {
    name: 'Fishing Dock', desc: 'Nets fish from the shallows. Fishes through winter.',
    cost: { wood: 25 }, hp: 50, workers: 2, place: { near: T.WATER },
    prod: { food: 0.4 },
  },
  lumber: {
    name: 'Lumber Camp', desc: 'Fells timber. Must border a forest.',
    cost: { wood: 10 }, hp: 50, workers: 2, place: { near: T.FOREST },
    prod: { wood: 0.35 },
  },
  quarry: {
    name: 'Quarry', desc: 'Cuts stone. Must border hills.',
    cost: { wood: 20 }, hp: 60, workers: 3, place: { near: T.HILLS },
    prod: { stone: 0.3 },
  },
  mine: {
    name: 'Mine', desc: 'Digs ore. Must sit on an ore vein.',
    cost: { wood: 25, stone: 10 }, hp: 60, workers: 3, place: { on: T.ORE },
    prod: { ore: 0.25 },
  },
  smelter: {
    name: 'Smelter', desc: 'Burns ore and wood into iron.',
    cost: { stone: 25, wood: 10 }, hp: 70, workers: 2,
    conv: { in: { ore: 0.3, wood: 0.15 }, out: { iron: 0.15 } },
  },
  bakery: {
    name: 'Bakery', desc: 'Bakes bread — each loaf feeds two.',
    cost: { wood: 20, stone: 10 }, hp: 50, workers: 2,
    conv: { in: { food: 0.4 }, out: { bread: 0.4 } }, // reworked 0.25→0.4: a real "feed more per worker" upgrade
  },
  market: {
    name: 'Market', desc: 'Collects taxes and draws the merchant caravan.',
    cost: { wood: 30, stone: 15 }, hp: 60, workers: 1, unique: true,
  },
  church: {
    name: 'Church', desc: 'Lifts morale and spreads influence.',
    cost: { wood: 25, stone: 30, gold: 25 }, hp: 80, workers: 0, influence: 8,
  },
  tower: {
    name: 'Watchtower', desc: 'Shoots raiders and extends the border.',
    cost: { wood: 15, stone: 25 }, hp: 90, workers: 0, influence: 7,
    range: 7, arrowDmg: 3,
  },
  wall: {
    name: 'Wall', desc: 'Stone rampart. Raiders must batter through.',
    cost: { stone: 4 }, hp: 120, workers: 0,
  },
  road: {
    name: 'Road', desc: 'Soldiers march faster; the merchant visits more often.',
    cost: { stone: 2 }, hp: 40, workers: 0,
  },
  barracks: {
    name: 'Barracks', desc: 'Trains soldiers (4 per barracks).',
    cost: { wood: 30, stone: 20, iron: 8 }, hp: 90, workers: 0,
  },
};

export const WORK_PRIORITY = ['farm', 'dock', 'lumber', 'quarry', 'mine', 'smelter', 'bakery', 'market'];

// ── Victory: the Three Crowns ──────────────────────────────────────
export const WIN = {
  territoryFrac: 0.30,  // Crown of Dominion: claim this share of all claimable land
  gold: 800,            // Crown of Plenty: gold banked at once
  pop: 80,              // Crown of the People: subjects housed and fed
};
export const ROAD_SPEED_MULT = 1.7;
export const ROAD_MERCHANT_FACTOR = 0.004; // per road tile, capped at 40% faster returns

// ── Population & morale ────────────────────────────────────────────
export const EAT_PER_POP = 0.04;        // food-equivalents per tick per person
export const SOLDIER_EAT_MULT = 3;      // a soldier eats 3× a citizen (the army's real cost)
export const GROWTH_FLOOR = 1.5;        // need stock > pop*this to grow
export const STARVE_DEATH_HUNGER = 60;  // ticks-worth of accumulated hunger before death

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
export const SKILL = {
  gainPerTick: 0.0008,         // proficiency per tick worked (master in ~1.5 years)
  max: 1.0,                    // output multiplier = 1 + skill (a true master doubles output)
  decayPerTickIdle: 0.0003,    // unused skills fade
  masterAt: 0.6,               // at this skill you count as a master
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
};

// ── Raiders ────────────────────────────────────────────────────────
// Raiders SACK buildings (grind HP to the abandon floor), they rarely raze.
// A raid is an economic wound measured in lost output-days, not lost tiles.
export const RAIDER = { hp: 30, dmg: 4, speed: 0.85, lootCap: 12 };
export const RAID = {
  firstAfter: 300, warningTicks: 40, minGapTicks: 250,
  lootDmg: 4.5,                // building HP lost per raider per looting tick — THE difficulty dial (sim2-validated; first playtest knob)
  abandonHpFrac: 0.15,         // below this fraction a building is sacked: raiders move on, it survives gutted
  sackDeathChance: 0.12,       // each worker in a building may die when it's sacked (once per raid)
  sizeBase: 2, prosperityDivisor: 350, militaryPressure: 0.4, sizeCap: 40,
  easeAfterSack: 0.04,         // rubber-band: each building sacked last raid shrinks the next wave...
  minSizeMult: 0.5,
  mercyPerSack: 4,             // ...and buys this many extra quiet ticks to recover
  maxRaidTicks: 200,           // raiders don't winter over — they withdraw when the season's looting is done
  warlordEveryWaves: 6,        // ≈ every 4 years at typical gaps
  warlordMinPop: 25,           // warlords only bother once the kingdom is worth it
  warlordSizeMult: 2.5, warlordHpMult: 1.5,
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
