// Targeted checks for the depletion-polish batch that the 25-year economy runs
// can't reach: the merchant buy cap (the scripted player never buys), the deep
// vein chronicle line, and save/load migration of an old depleted-husk save.
// Usage: node model/polish-unit-checks.mjs

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createState, saveGame, loadGame, place, demolish } = await import('../src/core/state.js');
const { makeSim } = await import('../src/core/sim.js');
const { buy, sell, buyCapacity, buyRemaining } = await import('../src/core/trade.js');
const { autoDemolishSpentTick } = await import('../src/core/economy.js');
const { TRADE_CAP, MAP, T } = await import('../src/config.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}${extra ? ` — ${extra}` : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
};

// ── 1. buy cap: capacity scales with commerce ──────────────────────
console.log('\n[1] merchant buy cap, commerce-scaled');
{
  const s = createState(42);
  ok('bare gates = capBase', buyCapacity(s) === TRADE_CAP.capBase, `${buyCapacity(s)}`);

  // fake a dock and a market straight into the building list (placement rules
  // are not what's under test here — the capacity formula is)
  s.buildings.push({ id: 9001, type: 'dock', x: 1, y: 1, hp: 50, maxHp: 50 });
  ok('one dock', buyCapacity(s) === TRADE_CAP.capBase + TRADE_CAP.perDock, `${buyCapacity(s)}`);
  s.buildings.push({ id: 9002, type: 'market', x: 2, y: 2, hp: 60, maxHp: 60 });
  ok('dock + market', buyCapacity(s) === TRADE_CAP.capBase + TRADE_CAP.perDock + TRADE_CAP.perMarket,
    `${buyCapacity(s)}`);
  s.buildings.push({ id: 9003, type: 'dock', x: 3, y: 3, hp: 50, maxHp: 50 });
  ok('two docks + market = 55', buyCapacity(s) === 55, `${buyCapacity(s)}`);
  // a ruined dock is no quay
  s.buildings[s.buildings.length - 1].hp = 0;
  ok('a dead dock does not count', buyCapacity(s) === 40, `${buyCapacity(s)}`);
}

// ── 2. buy cap: enforcement, reset, and the reason string ──────────
console.log('\n[2] buy cap enforcement');
{
  const s = createState(42);
  s.merchant.status = 'here';
  s.merchant.bought = 0;
  s.merchant.prices = { wood: 2, stone: 3, ore: 4, iron: 8, food: 1, bread: 3 };
  s.res.gold = 1e6;

  const cap = buyCapacity(s);   // 20, bare gates
  ok('starts with full carts', buyRemaining(s) === cap, `${buyRemaining(s)}/${cap}`);

  let bought = 0;
  for (let i = 0; i < 30; i++) if (buy(s, 'wood', 1) === true) bought++;
  ok('buys stop exactly at the cap', bought === cap, `bought ${bought}, cap ${cap}`);
  ok('carts read empty', buyRemaining(s) === 0);

  const refused = buy(s, 'wood', 1);
  ok('refusal is a UI-visible reason string', typeof refused === 'string', JSON.stringify(refused));
  ok('reason names the carts and the harbor remedy',
    /carts are full/.test(refused) && /harbor/.test(refused));
  ok('blocked buys are counted', s.stats.buysBlocked > 0, `${s.stats.buysBlocked}`);

  // selling stays uncapped even with the carts full
  s.res.wood = 500;
  const goldBefore = s.res.gold;
  ok('selling is uncapped', sell(s, 'wood', 100) === true && s.res.gold > goldBefore);

  // an oversized single order is refused whole, not partially filled
  s.merchant.bought = cap - 3;
  const woodBefore = s.res.wood;
  const partial = buy(s, 'wood', 10);
  ok('no silent partial fill', typeof partial === 'string' && s.res.wood === woodBefore);

  // the allowance resets when a fresh caravan arrives
  s.merchant.bought = cap;
  s.merchant.status = 'away';
  s.merchant.timer = 1;
  const sim = makeSim(s);
  for (let i = 0; i < 4 && s.merchant.status !== 'here'; i++) sim.tick();
  ok('a fresh caravan brings fresh carts',
    s.merchant.status === 'here' && s.merchant.bought === 0, `bought ${s.merchant.bought}`);
}

// ── 3. buy cap survives save/load ──────────────────────────────────
console.log('\n[3] buy cap through save/load');
{
  const s = createState(7);
  s.merchant.status = 'here';
  s.merchant.bought = 13;
  saveGame(s);
  const l = loadGame();
  ok('mid-visit tally round-trips', l.merchant.bought === 13, `${l.merchant.bought}`);

  // a save from before the cap has no `bought` field at all
  const raw = JSON.parse(store.get('kingdom-sim-save-v1'));
  delete raw.merchant.bought;
  delete raw.stats.goodsBought;
  delete raw.stats.buysBlocked;
  store.set('kingdom-sim-save-v1', JSON.stringify(raw));
  const old = loadGame();
  ok('pre-cap save migrates to fresh carts', old.merchant.bought === 0);
  ok('pre-cap save gets the new stat counters',
    old.stats.goodsBought === 0 && old.stats.buysBlocked === 0);
}

// ── 4. the Potosí: deep vein reserves and the chronicle line ───────
console.log('\n[4] deep vein (Potosí)');
{
  // seed 42 has deep veins; seed 7 has none (see model/vein-probe.mjs)
  const rich = createState(42), plain = createState(7);
  ok('seed 42 map carries a deep vein', rich.deepVeinTiles.length > 0, `${rich.deepVeinTiles.length} tiles`);
  ok('seed 7 map carries none', plain.deepVeinTiles.length === 0);

  // deep-vein tiles hold multiples of what an ordinary vein tile holds
  const N = MAP.size;
  const deep = new Set(rich.deepVeinTiles);
  let deepSum = 0, deepN = 0, plainSum = 0, plainN = 0;
  for (let i = 0; i < N * N; i++) {
    if (rich.terrain[i] !== T.ORE) continue;
    if (deep.has(i)) { deepSum += rich.oreStock[i]; deepN++; }
    else { plainSum += rich.oreStock[i]; plainN++; }
  }
  const ratio = (deepSum / deepN) / (plainSum / plainN);
  ok('deep tiles are 3-6× an ordinary tile', ratio >= 2.8 && ratio <= 6.2, `${ratio.toFixed(2)}×`);

  // the chronicle line fires on the first DRAW, once, in the house voice
  const mineTile = rich.deepVeinTiles[0];
  const b = { id: 4242, type: 'mine', x: mineTile % N, y: (mineTile / N) | 0, hp: 60, maxHp: 60, assigned: 3, workers: [] };
  rich.buildings.push(b);
  rich.claimed[mineTile] = 1;
  const before = rich.log.length;
  const { economyTick } = await import('../src/core/economy.js');
  economyTick(rich);
  const line = rich.log.slice(before).find((e) => /runs deeper/.test(e.text));
  ok('striking the vein writes one chronicle line', !!line, line?.text);
  ok('the line is in the house voice', !!line && line.text.includes(rich.name));
  ok('the strike is flagged once', rich.deepVeinFound === true && rich.stats.deepVeinStruck === 1);
  const after = rich.log.length;
  economyTick(rich);
  ok('it never fires twice',
    !rich.log.slice(after).some((e) => /runs deeper/.test(e.text)));

  // determinism: the same seed lays the same lottery
  const again = createState(42);
  ok('the lottery is deterministic in the seed',
    JSON.stringify(again.deepVeinTiles) === JSON.stringify(rich.deepVeinTiles));

  // reserves survive save/load (they serialize as the arrays always did)
  const sum = (a) => { let t = 0; for (const v of a) if (Number.isFinite(v)) t += v; return t; };
  const pre = sum(again.oreStock);
  saveGame(again);
  const loaded = loadGame();
  ok('deep-vein ore survives save/load', Math.abs(sum(loaded.oreStock) - pre) < pre * 0.01,
    `${Math.round(pre)} → ${Math.round(sum(loaded.oreStock))}`);
  ok('deep-vein tiles survive save/load',
    JSON.stringify(loaded.deepVeinTiles) === JSON.stringify(again.deepVeinTiles));
}

// ── 5. auto-demolish, including an old save's husks ────────────────
console.log('\n[5] auto-demolish of spent sites');
{
  const s = createState(42);
  const keep = s.buildings.find((b) => b.type === 'keep');
  // a battered, depleted lumber camp: refund must be condition-scaled
  const camp = { id: 7001, type: 'lumber', x: keep.x + 1, y: keep.y, hp: 25, maxHp: 50, assigned: 0, depleted: true };
  s.buildings.push(camp);
  s.res.wood = 0;
  autoDemolishSpentTick(s);
  ok('the spent camp is gone', !s.buildings.some((b) => b.id === 7001));
  // lumber costs 10 wood, at 25/50 condition → floor(10 × 0.5) = 5
  ok('refund is condition-scaled by the standard path', s.res.wood === 5, `wood ${s.res.wood}`);
  ok('it announces itself in-voice',
    s.log.some((e) => /spent ground is struck/.test(e.text) && /timbers come home/.test(e.text)));
  ok('the steward keeps his cue after the husk is gone', s.sawDepletedSite === 'lumber');

  // a LIVE camp is never struck
  const live = { id: 7002, type: 'lumber', x: keep.x + 2, y: keep.y, hp: 50, maxHp: 50, assigned: 2 };
  s.buildings.push(live);
  autoDemolishSpentTick(s);
  ok('a live camp is left alone', s.buildings.some((b) => b.id === 7002));

  // quarries and mines too (the ratified extension)
  for (const type of ['quarry', 'mine']) {
    const b = { id: 7100 + type.length, type, x: keep.x, y: keep.y + 2, hp: 60, maxHp: 60, assigned: 0, depleted: true };
    s.buildings.push(b);
    autoDemolishSpentTick(s);
    ok(`a spent ${type} strikes itself`, !s.buildings.includes(b));
  }
}

// ── 6. old-save migration: husks carried in are swept on the next tick ──
console.log('\n[6] loaded save carrying depleted husks');
{
  const s = createState(123);
  const keep = s.buildings.find((b) => b.type === 'keep');
  for (let i = 0; i < 3; i++) {
    s.buildings.push({ id: 8000 + i, type: 'lumber', x: keep.x + 1 + i, y: keep.y + 1,
      hp: 50, maxHp: 50, assigned: 0, depleted: true });
  }
  // strip the batch's new fields so this reads as a genuinely OLD save
  const s2 = JSON.parse(JSON.stringify({
    ...s,
    terrain: Array.from(s.terrain),
    forestWood: Array.from(s.forestWood),
    stoneStock: Array.from(s.stoneStock),
    oreStock: Array.from(s.oreStock),
    claimed: Array.from(s.claimed),
    buildings: s.buildings.map((b) => ({ ...b, workers: undefined })),
    influence: undefined, delta: undefined, _deepSet: undefined, _veinHills: undefined,
  }));
  delete s2.deepVeinTiles; delete s2.deepVeinFound; delete s2.sawDepletedSite;
  delete s2.merchant.bought;
  store.set('kingdom-sim-save-v1', JSON.stringify(s2));

  const l = loadGame();
  ok('the old save loads at all', !!l);
  ok('its husks are still there on load', l.buildings.filter((b) => b.depleted).length === 3);
  ok('migration fields are backfilled',
    Array.isArray(l.deepVeinTiles) && l.deepVeinFound === false && l.merchant.bought === 0);

  const woodBefore = l.res.wood;
  const sim = makeSim(l);
  for (let i = 0; i < 5; i++) sim.tick();
  ok('every husk is swept within a few ticks',
    l.buildings.filter((b) => b.depleted && b.type === 'lumber').length === 0,
    `${l.buildings.filter((b) => b.depleted).length} left`);
  ok('their timbers were refunded', l.res.wood > woodBefore, `${woodBefore} → ${Math.round(l.res.wood)}`);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
