// Warlord saga run (design/FATES.md §10, Campaign 17): the REAL game core on
// the shipped config, the Thornmere-shaped economy bot from
// model/homeostasis-run.mjs, and one named war DOCTRINE that decides when the
// host marches on the camp, what it does at the moment of victory, and how it
// answers the tribute rider. Instrumented to follow every named warlord and
// every survivor from their first Chronicle line to their last, and to say
// how each story ended — or that it never did.
// Usage: node model/warlord-saga-run.mjs <doctrine> <years> <seed>
// Prints one JSON summary line to stdout.

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { createState, canPlace, place } = await import('../src/core/state.js');
const { makeSim } = await import('../src/core/sim.js');
const { recruitSoldier, garrisonPost, payTribute, refuseTribute } = await import('../src/core/raids.js');
const { marchOnCamp, resolveCampChoice } = await import('../src/core/camp.js');
const { on } = await import('../src/core/events.js');
const { sell, buy } = await import('../src/core/trade.js');
const { territorySize } = await import('../src/core/territory.js');
const { MAP, SEASON_TICKS, BUILDINGS, EAT_PER_POP, SOLDIER_EAT_MULT, WINTER_FARM_MULT } =
  await import('../src/config.js');

const DOCTRINE = process.argv[2] || 'butcher';
const YEARS = Number(process.argv[3] || 40);
const SEED = Number(process.argv[4] || 42);
const N = MAP.size;
const YEAR_TICKS = SEASON_TICKS * 4;

// ── The doctrines ──────────────────────────────────────────────────
// march: 'ready' = whenever the host outnumbers the camp; 'away' = only while
// the warlord is at your walls (strike the empty hall); 'never'.
// choice at victory: 'massacre' | 'punish' | 'coin'. tribute: 'pay' | 'refuse' | 'coin'.
const DOCTRINES = {
  butcher:     { march: 'ready', choice: 'massacre', tribute: 'refuse' },
  merciful:    { march: 'ready', choice: 'punish',   tribute: 'refuse' },
  opportunist: { march: 'away',  choice: 'massacre', tribute: 'refuse' },
  mixed:       { march: 'ready', choice: 'coin',     tribute: 'coin' },
  payer:       { march: 'never', choice: 'punish',   tribute: 'pay' },
  turtle:      { march: 'never', choice: 'punish',   tribute: 'refuse' },
};
const D = DOCTRINES[DOCTRINE];
if (!D) throw new Error(`unknown doctrine ${DOCTRINE}`);

// the doctrine's own coin, seeded apart from the world's so the game's
// stream is untouched by the bot's dice
let coinState = (SEED * 2654435761) >>> 0;
const coin = () => {
  coinState = (coinState + 0x6D2B79F5) >>> 0;
  let t = coinState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 < 0.5;
};

const state = createState(SEED);
const sim = makeSim(state);

// ── Economy bot (homeostasis-run.mjs, shipped config) ─────────────
const count = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0).length;
const live = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0 && !b.depleted).length;
const foodEq = () => state.res.food + state.res.bread * 2;
const eatPerTick = () => {
  let n = 0;
  for (const v of state.villagers) n += EAT_PER_POP * (v.job === 'soldier' ? SOLDIER_EAT_MULT : 1);
  return n;
};
function findSpot(type) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  for (let r = 1; r < N; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = keep.x + dx, y = keep.y + dy;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        if (canPlace(state, type, x, y).ok) return { x, y };
      }
    }
    if (r > 40) break;
  }
  return null;
}
const tryBuild = (type) => { const s = findSpot(type); return !!s && place(state, type, s.x, s.y).ok; };

const POP_STOP = 300;
const ARMY_SHARE = 0.35;
function economyPolicy() {
  const pop = state.pop;
  if (state.soldiers.length >= 8) {
    if (!count('guildhall') && state.res.gold > 1500 && tryBuild('guildhall')) return;
    if (!count('temple') && state.res.gold > 6000 && tryBuild('temple')) return;
    if (!count('highseat') && state.res.gold > 12000 && tryBuild('highseat')) return;
  }
  const farmYield = BUILDINGS.farm.prod.food * (0.75 + 0.25 * WINTER_FARM_MULT);
  const supply = count('farm') * farmYield + count('dock') * BUILDINGS.dock.prod.food;
  if (supply < eatPerTick() * 1.3 + 0.3) {
    const dockFirst = count('dock') < Math.min(4, Math.floor(count('farm') / 3));
    if (dockFirst ? (tryBuild('dock') || tryBuild('farm')) : (tryBuild('farm') || tryBuild('dock'))) return;
  }
  if (state.pop >= state.popCap - 1 && state.popCap < POP_STOP && foodEq() > pop * 2) {
    if (tryBuild('house')) return;
  }
  const big = pop > 120;
  if (live('lumber') < (big ? 5 : 3) && tryBuild('lumber')) return;
  if (live('quarry') < (big ? 3 : 2) && state.res.wood > 40 && tryBuild('quarry')) return;
  if (live('mine') < (big ? 4 : 2) && state.res.wood > 50 && tryBuild('mine')) return;
  if (count('smelter') < (big ? 2 : 1) && state.res.ore > 15 && tryBuild('smelter')) return;
  if (count('bakery') < 2 && state.res.food > 80 && tryBuild('bakery')) return;
  if (count('market') < 1 && state.res.wood > 60 && tryBuild('market')) return;
  const terr = territorySize(state);
  if (count('tower') < Math.floor(terr / 120) && tryBuild('tower')) return;
  const armyTarget = Math.max(8, Math.round(pop * ARMY_SHARE));
  if (state.soldiers.length < armyTarget) {
    const r = recruitSoldier(state);
    if (!r.ok && r.reason === 'Barracks are full' && state.res.iron >= 8 && tryBuild('barracks')) return;
    if (!r.ok && /barracks first/i.test(r.reason || '') && state.res.iron >= 8 && tryBuild('barracks')) return;
  }
  if (count('church') < 2 && state.res.gold > 40 && state.res.stone > 40 && tryBuild('church')) return;
}
function tradePolicy() {
  if (state.merchant.status !== 'here') return;
  for (const r of ['wood', 'stone', 'food']) {
    const keep = r === 'food' ? state.pop * 3 : 80;
    const surplus = Math.floor(state.res[r] - keep);
    if (surplus > 10) sell(state, r, Math.min(surplus, 50));
  }
  if (state.res.iron < 150 && state.res.gold > 800) {
    for (const r of ['iron', 'ore']) if (buy(state, r, 10) === true) break;
  }
}

// ── War bot: the doctrine ──────────────────────────────────────────
const warlordAtWalls = () => state.raid.phase === 'active' &&
  state.raid.raiders.some((r) => r.warlord && r.hp > 0);
let marchCooldownUntil = 0;
const tally = { marches: 0, repulsed: 0, massacres: 0, punishes: 0, paid: 0, paidGold: 0, refused: 0, refusals: {} };

function warPolicy() {
  const raid = state.raid;
  // the rider waits: pay, refuse, or toss the doctrine's coin
  if (raid.phase === 'warning' && raid.demand) {
    const pay = D.tribute === 'pay' || (D.tribute === 'coin' && coin());
    const gold = raid.demand.gold;
    if (pay && payTribute(state).ok) { tally.paid++; tally.paidGold += gold; } else if (refuseTribute(state).ok) tally.refused++;
  }
  // standing in the taken camp: the choice is the doctrine's
  const exp = state.expedition;
  if (exp?.phase === 'choice') {
    const m = D.choice === 'massacre' || (D.choice === 'coin' && coin());
    if (resolveCampChoice(state, m ? 'massacre' : 'punish').ok) tally[m ? 'massacres' : 'punishes']++;
    return;
  }
  if (D.march === 'never' || exp || state.tick < marchCooldownUntil) return;
  const c = state.camp;
  if (!c || c.gone || c.broken || raid.keepBesieged) return;
  // a warlord's camp under the 'away' doctrine is struck only while he is at
  // your walls; a nest or a leaderless camp has no hall to empty, so any time
  const hasLord = !c.unclaimed && !c.leaderless && c.warlord?.name;
  if (D.march === 'away' && hasLord && !warlordAtWalls()) return;
  const host = state.soldiers.filter((s) => s.hp > 0 && !s.exp && !garrisonPost(state, s));
  const massing = raid.stage >= 1 && raid.nextFromCamp ? (c.massingCount || 0) : 0;
  const defenders = c.garrison.length + massing + (hasLord && c.warlord.home ? 10 : 0);
  if (host.length < Math.max(12, Math.ceil(defenders * 2.2))) return;
  const res = marchOnCamp(state);
  if (res.ok) tally.marches++;
  else tally.refusals[res.reason] = (tally.refusals[res.reason] || 0) + 1;
}

// ── Instrumentation: follow every name to its last line ────────────
const chronicle = [];
on('log', (e) => chronicle.push({ tick: e.tick, text: e.text }));

const figures = new Map();   // warlord name → story
const fig = (name) => {
  if (!figures.has(name)) figures.set(name, { name, first: state.tick, events: [], camps: new Set() });
  return figures.get(name);
};
const ev = (name, type, extra = {}) => fig(name).events.push({ tick: state.tick, year: yearOf(state.tick), type, ...extra });
const yearOf = (tick) => 1 + Math.floor(tick / YEAR_TICKS);

// avenger generations: an avenger raised from a massacred camp is one deeper
// in the feud than the camp that burned
let lastBurnedGen = 0;
let campSeq = 0;
let maxGen = 0;
on('camp-founded', (c) => {
  c._seq = ++campSeq;
  c._gen = c.avenger ? lastBurnedGen + 1 : 0;
  maxGen = Math.max(maxGen, c._gen);
});
const burns = [];
on('massacre-done', ({ camp, toll }) => {
  lastBurnedGen = camp._gen || 0;
  const w = camp.warlord;
  const lordAway = !!(w?.name && !camp.unclaimed && !camp.leaderless && !w.home);
  burns.push({ year: yearOf(state.tick), camp: camp.name, toll, gen: camp._gen || 0,
    lord: camp.unclaimed ? null : w?.name || null, lordAway, leaderless: !!camp.leaderless });
  if (w?.name && !camp.unclaimed) ev(w.name, lordAway ? 'camp-burned-while-away' : 'camp-burned', { camp: camp.name });
});

const survivors = new Map();   // first name → { full, year, came }
let inheritedGrudges = 0;
let crossingTicks = 0;         // the host afield while the warlord is at your walls
let crossings = 0, wasCrossing = false;
let maxWave = 0, maxWarlordWave = 0;
let slain0 = 0;

function scanLine(e) {
  const t = e.text;
  let m;
  if ((m = t.match(/^Scouts bring word: a warlord has made camp in the wilds — (.+), under (Warlord .+)\.$/))) ev(m[2], 'founded', { camp: m[1] });
  else if ((m = t.match(/^A warlord has claimed (.+): (Warlord .+?)\. /))) ev(m[2], 'claimed-nest', { camp: m[1] });
  else if ((m = t.match(/^A new chief claims (.+): (Warlord .+)\.$/))) {
    ev(m[2], 'successor', { camp: m[1], inherits: !!state.camp?.avenger });
    if (state.camp?.avenger) inheritedGrudges++;
  } else if ((m = t.match(/^(Warlord .+) raises (?:his|her|their) banner at (.+?)\. /))) ev(m[1], 'avenger-raised', { camp: m[2] });
  else if ((m = t.match(/^One slips through the reeds — (.+)\. Remember the name: (.+)\.$/))) {
    survivors.set(m[2], { full: m[1], year: yearOf(e.tick), came: null });
  }
  const up = t.toUpperCase();
  for (const f of figures.values()) {
    const U = f.name.toUpperCase();
    if (!up.includes(U)) continue;
    if (up.includes(`${U} IS SLAIN`)) ev(f.name, 'slain-at-walls');
    else if (up.includes(`${U} FALLS AT`)) ev(f.name, 'slain-at-hall');
    else if (t.includes('returns to what was')) ev(f.name, 'returned-to-ashes');
    else if (t.includes('quits the land')) ev(f.name, 'exile');
  }
  for (const [first, s] of survivors) {
    if (!s.came && up.includes(`${first.toUpperCase()} THE ASH-SWORN HAS COME`)) s.came = yearOf(e.tick);
  }
}

// ── Run ────────────────────────────────────────────────────────────
const TICKS = YEARS * YEAR_TICKS;
let scanned = 0;
for (let t = 0; t < TICKS; t++) {
  sim.tick();
  if (t % 10 === 0) economyPolicy();
  tradePolicy();
  warPolicy();

  // the current warlord is always on the roster, named or not by a line
  const c = state.camp;
  if (c?.warlord?.name && !c.unclaimed) fig(c.warlord.name).camps.add(c.name);
  while (scanned < chronicle.length) scanLine(chronicle[scanned++]);

  // a warlord killed with no line to say so (his camp already ashes)
  const slain = state.stats.warlordsSlain || 0;
  if (slain > slain0) {
    const name = c?.warlord?.name;
    const recent = chronicle.slice(-40).some((e) => e.tick >= state.tick - 1 && /IS SLAIN/.test(e.text));
    if (name && !recent) ev(name, 'slain-silently');
    slain0 = slain;
  }
  const raid = state.raid;
  if (raid.phase === 'active') {
    maxWave = Math.max(maxWave, raid.raiders.length);
    if (raid.raiders.some((r) => r.warlord)) maxWarlordWave = Math.max(maxWarlordWave, raid.raiders.length);
  }
  const crossing = !!state.expedition && warlordAtWalls();
  if (crossing) crossingTicks++;
  if (crossing && !wasCrossing) crossings++;
  wasCrossing = crossing;
  if (state.expedition?.routed && !state.expedition._counted) {
    state.expedition._counted = true; tally.repulsed++;
    marchCooldownUntil = state.tick + YEAR_TICKS;
  }
}

// ── Endings ────────────────────────────────────────────────────────
const TERMINAL = new Set(['slain-at-walls', 'slain-at-hall', 'slain-silently', 'exile']);
const cur = state.camp;
const stories = [...figures.values()].map((f) => {
  const types = f.events.map((e) => e.type);
  const last = [...f.events].reverse().find((e) => TERMINAL.has(e.type));
  const reigning = cur && !cur.gone && cur.warlord?.name === f.name && !cur.leaderless;
  let fate;
  if (last) fate = last.type;
  else if (reigning) fate = 'reigning';
  else if (types.includes('returned-to-ashes')) fate = 'broken-then-dropped';
  else fate = 'dropped';
  const origin = types.find((x) => ['founded', 'claimed-nest', 'successor', 'avenger-raised'].includes(x)) || 'unannounced';
  return { name: f.name, origin, camps: [...f.camps], fate, firstYear: yearOf(f.first),
    events: f.events.map((e) => `${e.year}:${e.type}${e.camp ? `@${e.camp}` : ''}${e.inherits ? '+grudge' : ''}`) };
});

const sagaRe = /warlord|Warlord|camp|Ash-Sworn|HAS COME|reeds|ashes|SLAIN|FALLS|claims|banner|host|marked|no more|quits the land|rider|tribute|gold\. .* turns away/;
console.log(JSON.stringify({
  doctrine: DOCTRINE, seed: SEED, years: YEARS,
  final: { pop: state.pop, soldiers: state.soldiers.length, gold: Math.round(state.res.gold),
    keepFalls: state.stats.keepFalls || 0, soldiersFallen: state.stats.soldiersFallen || 0,
    hunted: state.stats.villagersHunted || 0, folkSlain: state.stats.folkSlain || 0,
    marked: state.villagers.filter((v) => v.marked).length, territory: territorySize(state),
    fieldHost: state.soldiers.filter((s) => s.hp > 0 && !s.exp && !garrisonPost(state, s)).length,
    campGarrison: cur && !cur.gone ? cur.garrison.length : null,
    campAtEnd: cur ? { name: cur.name, gone: !!cur.gone, avenger: !!cur.avenger, gen: cur._gen || 0,
      warlord: cur.warlord?.name || null, leaderless: !!cur.leaderless } : null },
  tally, burns, inheritedGrudges, crossings, crossingTicks, maxWave, maxWarlordWave,
  maxAvengerGen: maxGen,
  survivors: [...survivors].map(([first, s]) => ({ first, ...s })),
  stories,
  saga: chronicle.filter((e) => sagaRe.test(e.text)).map((e) => `Y${yearOf(e.tick)} ${e.text}`),
}));
