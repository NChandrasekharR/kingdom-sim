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
    name: 'Keep', desc: 'Seat of your rule. Radiates influence and houses 10 souls.',
    cost: {}, hp: 300, workers: 0, influence: 11, popCap: 10, unique: true, unbuildable: true,
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
    conv: { in: { food: 0.4 }, out: { bread: 0.25 } },
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
export const SOLDIER_EAT = 0.08;        // soldiers eat double
export const GROWTH_FLOOR = 1.5;        // need stock > pop*this to grow

// ── Soldiers ───────────────────────────────────────────────────────
export const SOLDIER = { cost: { gold: 15, iron: 5 }, hp: 60, dmg: 8, speed: 1.1, perBarracks: 4 };

// ── Raiders ────────────────────────────────────────────────────────
export const RAIDER = { hp: 30, dmg: 4, speed: 0.85, lootCap: 12 };
export const RAID = { firstAfter: 300, warningTicks: 40, minGapTicks: 250 };

// ── Seasons ────────────────────────────────────────────────────────
export const SEASON_TICKS = 120;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const WINTER_FARM_MULT = 0.4;

// ── Trade ──────────────────────────────────────────────────────────
export const MERCHANT = { awayMin: 140, awayMax: 240, stay: 80, markup: 1.35 };
