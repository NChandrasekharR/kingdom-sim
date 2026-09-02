# Defect-fix playbook (Phase 0.1 + 0.2)

*Written 2026-09-02 for execution by a smaller model, one task at a time.
Source of the findings: `docs/REVIEW-SESSION-10.md` §2a–2b. Line numbers are
from `main` at `6313a25`; re-check them with `grep` before editing, they drift.*

*Validation note: every test in this document was run against the UNFIXED
tree on 2026-09-02 with the `__test` exports added. All 12 bug tests fail for
the stated reason (e.g. S2 "warlord hp 170 should not regenerate", S5 "got
0", S3 "loaded 0") and the two control tests pass. The fixtures work; if a
test crashes on a fixture line rather than an assertion, something drifted.*

---

## How to work this document

1. Do the tasks **in order**. Task 0 builds the test harness every later task
   uses. Tasks S1–S6 are sim fixes (each one changes headless numbers, so each
   ends with a sweep). Tasks U1–U7 are browser fixes (no sweep; each ends with
   a manual check). Task G records the golden hashes **last**.
2. One task = one commit. Commit message format is given per task. Never
   bundle two tasks in one commit.
3. Before every commit run the full gate:
   ```bash
   npm test && node model/polish-unit-checks.mjs && npm run build
   ```
   All three must pass. If `npm test` fails on a test you did not write, stop
   and report; do not edit the failing test to make it pass.
4. **Never** delete, skip, or weaken an existing check in
   `model/polish-unit-checks.mjs`. Never change a number in `src/config.js`
   except where a task says so explicitly.
5. When a task says "assert approximately", use
   `assert.ok(Math.abs(a - b) < 1e-6)`. Resources are floats.
6. If something in the code does not match what this document says, stop,
   `grep` for the function name, read the surrounding 30 lines, and continue
   only if the intent is clearly the same. Otherwise report the mismatch.
7. Do not refactor anything the task does not name. Do not "tidy" comments.

Conventions you need to know:
- ES modules, no TypeScript, no bundler in tests. Node 22.
- `state` is one mutable plain object; every core function takes it first.
- `rand` is a `() => number in [0,1)` closure; in tests pass `() => 0.5`.
- Chronicle lines are written by `logEvent(state, text, kind)` in
  `src/core/events.js` and land in `state.log` (array of `{text, kind, ...}`).
- The keep is `state.buildings.find(b => b.type === 'keep')`. It shoots
  arrows (range 8). Place test raiders **at least 10 tiles from the keep** or
  the keep will interfere.
- Map is 128×128 (`MAP.size`). Tile index is `y * 128 + x` (`idx(x, y)` in
  `state.js`).

---

## Task 0 — the test harness

**Goal:** `npm test` runs the files in `test/`, tests import the real core,
and private functions are reachable through a `__test` export.

### 0.1 `package.json`

Add to `"scripts"`:
```json
"test": "node --test 'test/*.test.mjs'",
"check": "node model/polish-unit-checks.mjs"
```
Node 22.22 treats a bare directory argument as a file and fails with
"Could not find"; the quoted glob is expanded by Node itself and works on
macOS, Linux, and CI.

A note on noise: a bare `createState` with no scripted player starves by
year 1, so tests that tick 1,000+ times print a "run summary" collapse dump
to stderr. That is expected; it is not a failure. Redirect with
`npm test 2>/dev/null` when you only want verdicts.
Add at top level:
```json
"engines": { "node": ">=22" }
```

### 0.2 `test/_harness.mjs` (new file)

```js
// Shared setup for node --test. Import this FIRST in every test file.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

export { store as localStore };
export const { createState, saveGame, loadGame, place, canPlace, demolish, idx } =
  await import('../src/core/state.js');
export const { makeSim } = await import('../src/core/sim.js');
export const raids = await import('../src/core/raids.js');
export const camp = await import('../src/core/camp.js');
export const villagers = await import('../src/core/villagers.js');
export const economy = await import('../src/core/economy.js');
export const config = await import('../src/config.js');

export const fixedRand = () => 0.5;

export function tickN(sim, n) { for (let i = 0; i < n; i++) sim.tick(); }

export function keepOf(state) { return state.buildings.find((b) => b.type === 'keep'); }

// A point ~20 tiles from the keep, inside the map, on the far side from the edge.
export function farFromKeep(state, d = 20) {
  const k = keepOf(state);
  const N = config.MAP.size;
  const x = k.x < N / 2 ? Math.min(N - 3, k.x + d) : Math.max(2, k.x - d);
  return { x, y: k.y };
}

// A manned watchtower dropped straight into the building list (placement rules
// are not under test). `skill` is the watchman's tower skill 0..1.
export function addTower(state, x, y, skill = 0) {
  const b = {
    id: state.nextId++, type: 'tower', x, y, hp: 60, maxHp: 60,
    assigned: 1, sacked: false, workers: [{ name: `Watch ${x},${y}`, skills: { tower: skill } }],
  };
  state.buildings.push(b);
  return b;
}

export function addRaider(state, { x, y, hp = 30, name = 'Ulf Test', mode = 'march' } = {}) {
  const rd = {
    x, y, px: x, py: y, hp, loot: 0, lootBag: {}, name, path: [], pathI: 0, mode,
    targetId: null, spawn: { x: 0, y: 0 },
  };
  state.raid.raiders.push(rd);
  return rd;
}

export function freshTally(state) {
  state.raid.tally = { killed: 0, soldiersLost: 0, mercsLost: 0, hunted: 0, loot: 0, recovered: 0, walls: 0 };
  return state.raid.tally;
}

export function chronicleLines(state, re) {
  return state.log.filter((e) => re.test(e.text));
}

// Stable hash of the parts of state that matter for determinism.
export function hashState(state) {
  const pick = {
    tick: state.tick, pop: state.pop, res: state.res, stats: state.stats,
    buildings: state.buildings.map((b) => [b.id, b.type, b.x, b.y, Math.round(b.hp * 100)]),
    villagers: state.villagers.map((v) => [v.id, v.job, Math.round(v.x * 10), Math.round(v.y * 10)]),
    raid: { phase: state.raid.phase, timer: state.raid.timer, wave: state.raid.wave },
    camp: state.camp ? [state.camp.x, state.camp.y, state.camp.garrison.length] : null,
  };
  const s = JSON.stringify(pick);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
```

Note: `state.nextId`, `state.raid.raiders`, `state.log` exist on every state
from `createState`. The `workers` array is normally rebuilt each tick by
`economyTick`; in tests that call `updateTowers` directly it is whatever you
set.

### 0.3 `__test` exports

Append to the **end** of `src/core/raids.js`:
```js
// Test-only handles for module-private functions. Not part of the game API.
export const __test = { updateTowers, cullRaiders, endRaid, spawnRaid };
```
Append to the **end** of `src/core/camp.js`:
```js
export const __test = { battleTick, campLife, timers, liveDefenders, expeditionTick };
```
Confirm each named function exists with `grep -n "^function NAME" src/core/raids.js`.

### 0.4 Smoke test: `test/smoke.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, makeSim, tickN } from './_harness.mjs';

test('a fresh realm ticks 500 times without throwing', () => {
  const s = createState(42);
  const sim = makeSim(s);
  tickN(sim, 500);
  assert.ok(s.tick === 500);
  assert.ok(s.villagers.length > 0);
});
```

### 0.5 CI: `.github/workflows/ci.yml`

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run check
      - run: npm run build
```

### 0.6 Verify and commit

```bash
npm test                      # expect: smoke passes
node model/polish-unit-checks.mjs   # expect: ALL PASS: 39 passed, 0 failed
npm run build                 # expect: ✓ built
```
Commit: `Test harness: node --test, __test handles, CI workflow`

---

## Task S1 — towers double-count kills and shoot corpses

**File:** `src/core/raids.js`, function `updateTowers` (starts ~line 571).

**Current code** (the target scan, ~line 583):
```js
    let nearest = null, nd = def.range;
    for (const rd of state.raid.raiders) {
      const d = Math.hypot(rd.x - b.x, rd.y - b.y);
      if (d < nd) { nd = d; nearest = rd; }
    }
```
**Root cause:** dead raiders (`hp <= 0`) remain in `state.raid.raiders` until
`cullRaiders` runs at the end of `updateRaiders`. Two shooters in one
`updateTowers` pass (two towers, or a tower and the keep) can both pick the
same raider: the second one decrements a corpse and enters the kill branch
again.

**Change:** add one line inside the loop:
```js
    for (const rd of state.raid.raiders) {
      if (rd.hp <= 0) continue;   // a corpse is not a target (S1: double-counted kills)
      const d = Math.hypot(rd.x - b.x, rd.y - b.y);
      if (d < nd) { nd = d; nearest = rd; }
    }
```

**Test:** `test/towers.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, raids, addTower, addRaider, freshTally, farFromKeep, chronicleLines } from './_harness.mjs';

test('S1: two towers in range of one 1-hp raider score exactly one kill', () => {
  const s = createState(42);
  const p = farFromKeep(s);
  addTower(s, p.x - 2, p.y);
  addTower(s, p.x + 2, p.y);
  addRaider(s, { x: p.x, y: p.y, hp: 1, name: 'Ulf Test' });
  const t = freshTally(s);
  const before = s.stats.raidersKilled;
  raids.__test.updateTowers(s);
  assert.equal(s.stats.raidersKilled - before, 1);
  assert.equal(t.killed, 1);
  assert.equal(chronicleLines(s, /Ulf Test falls to/).length, 1);
});

test('S1: the second tower shoots the live raider, not the corpse', () => {
  const s = createState(42);
  const p = farFromKeep(s);
  addTower(s, p.x - 2, p.y);
  addTower(s, p.x + 2, p.y);
  const dead = addRaider(s, { x: p.x, y: p.y, hp: 1, name: 'Dead Soon' });
  const live = addRaider(s, { x: p.x + 4, y: p.y, hp: 30, name: 'Still Up' });
  freshTally(s);
  raids.__test.updateTowers(s);
  assert.ok(dead.hp <= 0);
  assert.ok(live.hp < 30, 'second tower must have hit the live raider');
});
```
Tower range is 7 and arrow damage 3 (`config.js:87`); a 1-hp raider dies to
the first tower, so the second must retarget.

**Sweep** (record numbers in the commit body):
```bash
for seed in 42 7 99 123; do node model/simulate.mjs 25 $seed | tail -1; done
```
Run this **before** the change and **after**. Expect `raidsSeen` unchanged and
the K/D in the run summary (printed to stderr by `simulate.mjs`) to fall.

Commit: `Towers no longer shoot corpses: one kill, one line, one heriot`
Body: the before/after last-line CSV for the four seeds.

---

## Task S2 — the `choice` phase is not an occupation

**File:** `src/core/camp.js`. Three edits.

**Root cause:** `battleTick` (~line 695) sets `exp.phase = 'choice'` when the
defenders are gone, but `c.leaderless` is only set inside `resolveCampChoice`
(~line 866). Between those two moments `campLife` (~line 376) heals the
warlord, `warlordAvailable` (~line 252) returns true, and `timers` may seat a
successor. In the browser the UI pauses the game so the gap is a few ticks; in
headless runs, on a save reloaded mid-choice, or if the host starves during
`choice`, the gap is unbounded.

### S2.1 A predicate

Add near `warlordAvailable` (~line 250):
```js
// The host stands at the tents: from first contact until it turns for home,
// the camp is OCCUPIED — no healing, no marching, no new chief.
export function campOccupied(state) {
  const p = state.expedition?.phase;
  return p === 'battle' || p === 'choice' || p === 'massacre';
}
```

### S2.2 Use it in three gates

`warlordAvailable` — add one line before the final `return`:
```js
  if (campOccupied(state)) return false;   // the host is at his tents (S2)
```
`campLife` — the warlord heal (~line 376), change the condition:
```js
  if (w.home && !c.leaderless && !campOccupied(state)) {
```
`timers` — the successor (~line 407), add `&& !campOccupied(state)`:
```js
  if (c.leaderless && state.tick >= c.successorAt && !c.gone && !campOccupied(state)) {
```

### S2.3 Set `leaderless` at the moment of victory

In `battleTick`, inside the `if (!defenders.length) {` branch, immediately
after `exp.phase = 'choice';`:
```js
    // the warlord fell in the assault: his camp is leaderless NOW, not when
    // the sovereign finishes deciding (S2)
    if (exp.warlordSlain && !c.leaderless) {
      c.leaderless = true;
      c.successorAt = state.tick + CAMP.successorTicks;
    }
```
In `resolveCampChoice` (~line 866) guard the existing block so it does not
push `successorAt` later a second time:
```js
  if (exp.warlordSlain && !c.leaderless) {
    c.leaderless = true;
    c.successorAt = state.tick + CAMP.successorTicks;
  }
```
`CAMP` is already imported in `camp.js`; confirm with `grep -n "CAMP" src/core/camp.js | head -3`.

**Test:** `test/camp-choice.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, makeSim, camp, fixedRand, tickN, keepOf } from './_harness.mjs';

// Found a real camp, then hand-build the "camp just taken" moment.
function takenCamp() {
  const s = createState(42);
  const sim = makeSim(s);
  tickN(sim, 50);                           // let the realm settle
  const c = camp.ensureCamp(s, fixedRand);  // founds a warlord camp
  assert.ok(c, 'ensureCamp must found a camp on seed 42');
  c.garrison = []; c.massers = []; c.massing = []; c.massingCount = 0;
  c.warlord.hp = -5;                        // slain in the assault
  const k = keepOf(s);
  s.soldiers = [{ id: s.nextId++, villagerId: s.villagers[0].id, hp: 60, x: c.x, y: c.y, px: c.x, py: c.y, exp: true }];
  s.expedition = { phase: 'battle', path: [], startCount: 1, lost: 0, slain: 3, warlordSlain: true, startTick: s.tick, battleLogged: true, warlordWasHome: true };
  return { s, c };
}

test('S2: victory marks the camp leaderless immediately', () => {
  const { s, c } = takenCamp();
  camp.__test.battleTick(s, fixedRand);     // no defenders → phase 'choice'
  assert.equal(s.expedition.phase, 'choice');
  assert.equal(c.leaderless, true);
  assert.ok(c.successorAt > s.tick);
});

test('S2: during choice the warlord does not heal and cannot march', () => {
  const { s, c } = takenCamp();
  camp.__test.battleTick(s, fixedRand);
  for (let i = 0; i < 700; i++) { s.tick++; camp.campTick(s, fixedRand); }
  assert.ok(c.warlord.hp <= 0, `warlord hp ${c.warlord.hp} should not regenerate`);
  assert.equal(c.leaderless, true, 'no successor while the host stands at the tents');
  assert.equal(camp.warlordAvailable(s), false);
  assert.equal(s.expedition.phase, 'choice');
});

test('S2: campOccupied is true for battle, choice, massacre and false otherwise', () => {
  const s = createState(42);
  for (const p of ['battle', 'choice', 'massacre']) { s.expedition = { phase: p }; assert.equal(camp.campOccupied(s), true); }
  for (const p of ['march', 'return']) { s.expedition = { phase: p }; assert.equal(camp.campOccupied(s), false); }
  s.expedition = null; assert.equal(camp.campOccupied(s), false);
});
```
If `ensureCamp` returns null on seed 42 at tick 50 (it should not: the map
has wilds), try seed 7 and report which seed you used.

**Sweep:** same four-seed command as S1. Expect byte-identical CSV to the
post-S1 run on seeds where the scripted player never marches (it does not
march today; confirm with `grep -n marchOnCamp model/simulate.mjs`, expect no
hit). If identical, say so in the commit body.

Commit: `The taken camp is an occupation: no healing, no marching, leaderless at once`

---

## Task S3 — ghost deposit tiles from autosave rounding

**File:** `src/core/state.js`, `saveGame` (~line 300).

**Current code:**
```js
    forestWood: Array.from(state.forestWood, (v) => Math.round(v)),
    stoneStock: Array.from(state.stoneStock, (v) => (Number.isFinite(v) ? Math.round(v) : -1)),
    oreStock: Array.from(state.oreStock, (v) => (Number.isFinite(v) ? Math.round(v) : -1)),
```
**Root cause:** a tile with `0 < stock < 0.5` saves as 0. `findDeposit`
(`economy.js:~71`) skips `stock <= 0`, and the terrain transform only happens
inside a draw that empties the tile (`economy.js:~123`). So the tile is never
worked again and never becomes plains/hills.

**Change:** add a helper above `saveGame` and use it in all three lines:
```js
// Round a reserve for JSON — but never round a live tile down to nothing:
// a 0.4-wood forest tile that saved as 0 would stand forever, unworkable
// and untransformed (S3: ghost deposits). Infinity → -1 sentinel.
function packStock(v) {
  if (!Number.isFinite(v)) return -1;
  if (v > 0 && v < 1) return 1;
  return Math.round(v);
}
```
```js
    forestWood: Array.from(state.forestWood, packStock),
    stoneStock: Array.from(state.stoneStock, packStock),
    oreStock: Array.from(state.oreStock, packStock),
```
`forestWood` never holds Infinity, so `packStock` is safe for it.

**Test:** `test/save-stock.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, saveGame, loadGame, config } from './_harness.mjs';

function firstTileWhere(arr, pred) { for (let i = 0; i < arr.length; i++) if (pred(arr[i])) return i; return -1; }

test('S3: a fractional forest tile survives save/load as workable stock', () => {
  const s = createState(42);
  const i = firstTileWhere(s.forestWood, (v) => v > 1);
  assert.ok(i >= 0);
  s.forestWood[i] = 0.4;
  saveGame(s);
  const l = loadGame();
  assert.ok(l.forestWood[i] > 0, `loaded ${l.forestWood[i]}`);
  assert.equal(l.terrain[i], s.terrain[i]);
});

test('S3: fractional stone and ore survive, Infinity sentinel still round-trips', () => {
  const s = createState(42);
  const si = firstTileWhere(s.stoneStock, (v) => Number.isFinite(v) && v > 1);
  const oi = firstTileWhere(s.oreStock, (v) => Number.isFinite(v) && v > 1);
  const inf = firstTileWhere(s.stoneStock, (v) => v === Infinity);
  s.stoneStock[si] = 0.3; s.oreStock[oi] = 0.2;
  saveGame(s);
  const l = loadGame();
  assert.ok(l.stoneStock[si] > 0);
  assert.ok(l.oreStock[oi] > 0);
  if (inf >= 0) assert.equal(l.stoneStock[inf], Infinity);
});
```
If no tile has `Infinity` stone on seed 42 the third assertion is skipped by
the `if`; that is fine.

**Sweep:** headless runs never save, so the CSV is unchanged. Say so.

Commit: `Save never rounds a live deposit tile to nothing`

---

## Task S4 — tutorial mutates sim timing from localStorage

**Files:** `src/config.js` (~line 381), `src/core/state.js` (~line 111),
`src/core/tutorial.js` (~line 166).

**Current code:**
- `config.js:381`: `firstAfter: 300, warningTicks: 40, minGapTicks: 250,`
  (`firstAfter` is never read anywhere: `grep -rn firstAfter src/` → only config).
- `state.js:111`: `raid: { phase: 'quiet', timer: 300, raiders: [], wave: 0 },`
- `tutorial.js:166-171`:
  ```js
  if (!retired) {
    state.raid.timer += 100;
    state.tutorial.graceGiven = true;
  }
  ```
  where `retired = ladderDoneBefore()` reads `localStorage`.

**Root cause:** the first raid lands at tick 400 for a first-time browser, 300
for a returning one, and always 400 headless (no localStorage). Same seed,
different game. Every sim sweep ever run measured the 400 case.

**Change:** make 400 the rule everywhere.
- `config.js`: `firstAfter: 400,` and extend the comment:
  `// first raid at tick 400 (300 + the 100-tick counsel grace, now unconditional — S4: the seed must decide the run)`
- `state.js:111`: `raid: { phase: 'quiet', timer: RAID.firstAfter, raiders: [], wave: 0 },`
  Confirm `RAID` is imported in `state.js` (`grep -n "RAID" src/core/state.js | head -2`); if not, add it to the existing `../config.js` import.
- `tutorial.js`: delete the three-line `if (!retired) {...}` block. Leave
  `graceGiven: false` in the object literal (old saves carry the field).

**Test:** `test/determinism.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, makeSim, tickN, hashState, localStore, config } from './_harness.mjs';

test('S4: the first raid timer does not depend on the tutorial flag', () => {
  localStore.clear();
  const fresh = createState(42);
  localStore.set('kingdom-sim-tutorial-done-v1', '1');
  const returning = createState(42);
  localStore.clear();
  assert.equal(fresh.raid.timer, returning.raid.timer);
  assert.equal(fresh.raid.timer, config.RAID.firstAfter);
});

test('S4: same seed, same 1500 ticks', () => {
  const a = createState(7), b = createState(7);
  tickN(makeSim(a), 1500); tickN(makeSim(b), 1500);
  assert.equal(hashState(a), hashState(b));
});
```

**Sweep:** headless already ran at 400, so expect the four-seed CSV to be
byte-identical to the post-S3 run. Confirm and say so.

Commit: `The seed decides the run: first-raid grace is unconditional`

---

## Task S5 — heriot quantization

**File:** `src/core/raids.js`. Two edits: `endRaid` (~line 957) and
`updateTowers` (the kill branch, ~line 598).

**Current code** in `endRaid`:
```js
  let ironBack = 0;
  if (!raid.routed && (t.soldiersLost || 0) > 0) {
    ironBack += t.soldiersLost * (SOLDIER.cost.iron || 0) * HERIOT.ownFrac;
  }
  ironBack += (t.killed || 0) * HERIOT.raiderIron;
  ironBack = Math.floor(ironBack);
  if (ironBack > 0) {
    state.res.iron += ironBack;
    state.stats.ironGathered = (state.stats.ironGathered || 0) + ironBack;
  }
```
and later: `if (ironBack > 0) parts.push(\`${ironBack} iron gathered from the field\`);`

**Root cause:** `Math.floor` discards fractions instead of accruing them, so
a raid with fewer than 7 kills and no own dead pays nothing. Separately,
parting-shot kills (towers firing after `endRaid`, via the
`raid.phase !== 'active' && raid.raiders.length` branch in `raidTick`) bump
`tally.killed` after the heriot was already paid.

**Change 1** — accrue, don't floor. Resources are floats everywhere else
(farms add 0.5 per tick). Replace the block with:
```js
  let ironBack = 0;
  if (!raid.routed && (t.soldiersLost || 0) > 0) {
    ironBack += t.soldiersLost * (SOLDIER.cost.iron || 0) * HERIOT.ownFrac;
  }
  ironBack += (t.killed || 0) * HERIOT.raiderIron;
  payHeriot(state, ironBack);
```
and the reckoning line: `if (ironBack >= 0.5) parts.push(\`${Math.round(ironBack)} iron gathered from the field\`);`

Add above `endRaid`:
```js
// Iron off a held field, accrued as a fraction (S5: floor() used to throw away
// every raid under seven corpses).
function payHeriot(state, iron) {
  if (!(iron > 0)) return;
  state.res.iron += iron;
  state.stats.ironGathered = (state.stats.ironGathered || 0) + iron;
}
```

**Change 2** — parting shots pay. In `updateTowers`, inside
`if (nearest.hp <= 0) {`, after the `tally.killed++` line add:
```js
        // a straggler shot in the back after the reckoning still leaves his gear
        if (state.raid.phase !== 'active') payHeriot(state, HERIOT.raiderIron);
```
Confirm `HERIOT` is imported in `raids.js` (`grep -n "HERIOT" src/core/raids.js | head -1`).

**Test:** `test/heriot.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, raids, addTower, addRaider, freshTally, farFromKeep, fixedRand, config } from './_harness.mjs';

test('S5: three raider corpses pay 0.45 iron, not zero', () => {
  const s = createState(42);
  const t = freshTally(s); t.killed = 3;
  s.raid.phase = 'active'; s.raid.routed = false;
  const before = s.res.iron;
  raids.__test.endRaid(s, fixedRand, false);
  assert.ok(Math.abs((s.res.iron - before) - 3 * config.HERIOT.raiderIron) < 1e-6, `got ${s.res.iron - before}`);
});

test('S5: a routed line cedes its own dead but corpses still pay', () => {
  const s = createState(42);
  const t = freshTally(s); t.killed = 2; t.soldiersLost = 1;
  s.raid.phase = 'active'; s.raid.routed = true;
  const before = s.res.iron;
  raids.__test.endRaid(s, fixedRand, false);
  assert.ok(Math.abs((s.res.iron - before) - 2 * config.HERIOT.raiderIron) < 1e-6);
});

test('S5: a parting-shot kill after the raid ended pays its iron', () => {
  const s = createState(42);
  const p = farFromKeep(s);
  addTower(s, p.x, p.y);
  addRaider(s, { x: p.x + 1, y: p.y, hp: 1, mode: 'flee' });
  freshTally(s);
  s.raid.phase = 'quiet';               // the reckoning already happened
  const before = s.res.iron;
  raids.__test.updateTowers(s);
  assert.ok(Math.abs((s.res.iron - before) - config.HERIOT.raiderIron) < 1e-6);
});
```
Check `endRaid` does not require `raid.routed` to be defined; it reads
`!raid.routed`, so `undefined` is fine.

**Sweep:** four seeds. Expect `iron` in the final CSV line to rise slightly on
every seed. Record before/after.

Commit: `The heriot accrues: every corpse pays, stragglers included`

---

## Task S6 — expedition blind to a starved soldier

**File:** `src/core/villagers.js`, `killVillager` (~line 235).

**Current code:**
```js
export function killVillager(state, villager) {
  const i = state.villagers.indexOf(villager);
  if (i >= 0) state.villagers.splice(i, 1);
  // a soldier's body falls with its owner
  state.soldiers = state.soldiers.filter((s) => s.villagerId !== villager.id);
  return isMaster(villager);
}
```
**Root cause:** starvation (`population.js:~67`) kills a villager who may be
a soldier on the march. The body leaves `state.soldiers` but
`state.expedition.lost` is not incremented, so the rout check in `battleTick`
(`exp.lost >= ceil(startCount × routFrac)`) undercounts.

**Change:**
```js
export function killVillager(state, villager) {
  const i = state.villagers.indexOf(villager);
  if (i >= 0) state.villagers.splice(i, 1);
  // a soldier's body falls with its owner — and if that body was on the
  // march, the host counts him among its lost (S6: the rout check was blind
  // to hunger)
  for (const s of state.soldiers) {
    if (s.villagerId === villager.id && s.exp && state.expedition) state.expedition.lost++;
  }
  state.soldiers = state.soldiers.filter((s) => s.villagerId !== villager.id);
  return isMaster(villager);
}
```
Caution: `camp.js` (~line 793) also calls `killVillager` for soldiers who fell
in battle, **after** doing `exp.lost++` itself and **after** splicing the
soldier out of `state.soldiers`. Because the splice happens first, the loop
above finds no matching soldier and does not double count. Verify by reading
those lines; if the order differs, report before changing anything.

**Test:** `test/expedition-loss.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, villagers } from './_harness.mjs';

test('S6: a starved soldier on the march counts as lost to the expedition', () => {
  const s = createState(42);
  const v = s.villagers[0];
  s.soldiers = [{ id: s.nextId++, villagerId: v.id, hp: 60, x: 5, y: 5, exp: true }];
  s.expedition = { phase: 'march', startCount: 1, lost: 0, slain: 0, warlordSlain: false };
  villagers.killVillager(s, v);
  assert.equal(s.expedition.lost, 1);
  assert.equal(s.soldiers.length, 0);
});

test('S6: a soldier at home does not touch the expedition', () => {
  const s = createState(42);
  const v = s.villagers[0];
  s.soldiers = [{ id: s.nextId++, villagerId: v.id, hp: 60, x: 5, y: 5, exp: false }];
  s.expedition = { phase: 'march', startCount: 3, lost: 0 };
  villagers.killVillager(s, v);
  assert.equal(s.expedition.lost, 0);
});
```

**Sweep:** four seeds; expect identical CSV (the scripted player never marches).

Commit: `A starved soldier on the march is a loss the host can feel`

---

## Task U1 — victory "Found a new kingdom" reloads the same kingdom

**File:** `src/ui/ui.js`.

**Current code** (~line 548 and ~line 829):
```js
    anew.onclick = () => { clearSave(); location.reload(); };
...
  window.addEventListener('beforeunload', () => saveGame(state));
```
**Root cause:** `location.reload()` fires `beforeunload`, which saves the
old state again after `clearSave()` removed it.

**Change:** near the top of `buildUI` (after `const state = ctx.state;` or
equivalent, ~line 21) add `let skipSaveOnUnload = false;`. Then:
```js
    anew.onclick = () => { skipSaveOnUnload = true; clearSave(); location.reload(); };
...
  window.addEventListener('beforeunload', () => { if (!skipSaveOnUnload) saveGame(state); });
```

**Manual check:** `npm run dev`, open the game, in the console run
`kingdom.state.won = true; kingdom.state.crowns.dominion = kingdom.state.crowns.plenty = kingdom.state.crowns.people = true;`
then trigger the victory card (if it does not appear, grep `ui.js` for
`victory.classList.remove('hidden')` and call the surrounding function from
the console, or temporarily set `state.won = false` and let `winTick` fire).
Click "Found a new kingdom". After reload:
`localStorage.getItem('kingdom-sim-save-v1')` must be `null` at the moment of
reload and the realm name must differ from the one you had.

Commit: `Victory card: founding anew no longer resurrects the old realm`

---

## Task U2 — the horn goes silent after six raids

**File:** `src/ui/ui.js`, the `on('raid-warning', ...)` handler (~line 614).

**Change:** one shared context, resumed on use:
```js
  let hornCtx = null;
  function horn() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!hornCtx) hornCtx = new AC();
    if (hornCtx.state === 'suspended') hornCtx.resume();
    return hornCtx;
  }
  on('raid-warning', () => {
    try {
      const ac = horn();
      if (!ac) return;
      const now = ac.currentTime;
      // ... the existing oscillator block, unchanged ...
    } catch { /* audio blocked until user gesture — fine */ }
  });
```
Keep the oscillator body exactly as it is.

**Manual check:** in the console run
`for (let i = 0; i < 8; i++) kingdom.emit ? kingdom.emit('raid-warning') : null;`
If `kingdom.emit` is not exposed, import path: `grep -n "window.kingdom" src/main.js`
and use whatever is exposed, or set `kingdom.state.raid.timer = 1` eight times
across eight raids at 3× speed. The eighth horn must sound.

Commit: `One horn, many raids: the AudioContext is reused`

---

## Task U3 — raid countdown ignores game speed

**File:** `src/ui/ui.js` (~line 754).

**Current:**
```js
        return `Next raid threat in ~${Math.ceil(r.timer * TICK_MS / 1000)}s`;
```
**Change:**
```js
        if (!(state.speed > 0)) return `Next raid threat in ~${Math.ceil(r.timer * TICK_MS / 1000)}s (paused)`;
        return `Next raid threat in ~${Math.ceil(r.timer * TICK_MS / 1000 / state.speed)}s`;
```

**Manual check:** at 3× the number must be a third of the 1× number for the
same `timer`.

Commit: `The raid countdown tells the truth at every speed`

---

## Task U4 — stale UI and a leaked terrain image after New Kingdom

**Files:** `src/ui/ui.js`, `src/game/scene.js`.

### U4.1 Chronicle list

In `ui.js` the chronicle (~line 333) is filled once from `state.log`. Add,
right after that loop:
```js
  on('new-game', () => {
    logList.replaceChildren();
    for (const e of state.log) logList.prepend(el('div', `log-line ${e.kind}`, e.text));
  });
```

### U4.2 Speed highlight

In the `newBtn.onclick` handler (~line 61), after `state.speed = 1;` add
`refreshSpeed();`. `refreshSpeed` is declared later in the same function
scope (~line 83) with `function`, so it is hoisted; this is safe.

### U4.3 Stance button

After the `stanceBtn.onclick = ...` block (~line 266) add:
```js
  on('new-game', () => { stanceBtn.textContent = stanceLabel(); });
```

### U4.4 Terrain image

In `scene.js` `paintTerrain` (~line 130) the last line is
`this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(0);`. Change to:
```js
    if (!this.terrainImage) this.terrainImage = this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(0);
```
The canvas texture is already reused by key (`this.textures.exists('terrain')`),
so a repaint plus `tex.refresh()` is enough; the image object must not be
recreated.

**Manual check:** set 3× speed, toggle stance to Sally, click New Kingdom,
confirm: speed highlight on 1×, stance button reads "Hold the line", the
Chronicle tab shows only the new realm's lines. In the console
`kingdom.scene?.children?.list?.filter(o => o.texture?.key === 'terrain').length`
(adapt to however the scene is exposed; if it is not, skip this one check)
must stay 1 after three New Kingdoms.

Commit: `New Kingdom resets the chronicle, speed, stance, and reuses the terrain image`

---

## Task U5 — tribute banner empty after a reload mid-demand

**File:** `src/ui/ui.js`.

**Current:** the text is set only in `on('tribute-demand', ...)` (~line 110);
visibility is derived from state in `render()` (~line 812).

**Change:** in `render()`, right after
`const demanding = !!state.raid.demand && state.raid.phase === 'warning';` add:
```js
    if (demanding) {
      const d = state.raid.demand;
      tributeText.innerHTML = `☠ ${d.name} demands <b>${d.gold} gold</b> — pay, or he marches. `;
    }
```
Leave the event listener in place (harmless) or delete it; either is fine.

**Manual check:** wait for a rider (or in the console set
`kingdom.state.raid.demand = { gold: 120, name: 'Test Camp' }; kingdom.state.raid.phase = 'warning'; kingdom.state.raid.timer = 90;`),
reload the page during the window, confirm the banner shows name and amount.

Commit: `The rider's demand survives a reload`

---

## Task U6 — per-tick DOM churn while selected; paint-drag runs the full render

**Files:** `src/ui/ui.js`, `src/game/scene.js`.

### U6.1 Cache icon data URLs

Near the top of `buildUI` add `const iconCache = new Map();` and a helper:
```js
  function cachedIcon(fn, key) {
    const k = `${fn.name}:${key}`;
    if (!iconCache.has(k)) iconCache.set(k, fn(key));
    return iconCache.get(k);
  }
```
Then replace every `buildingIconURL(X)` in `ui.js` with
`cachedIcon(buildingIconURL, X)` and every `iconDataURL(X)` with
`cachedIcon(iconDataURL, X)`. Find them with `grep -n "IconURL\|iconDataURL" src/ui/ui.js`.
Keep the original import.

### U6.2 Only rebuild the selection panel when its content changes

In `renderSelection()` (~line 380–420), compute a signature before touching
the DOM and return early if unchanged. Put `let selSig = null;` beside
`iconCache`. At the top of the building branch (after `def` is known):
```js
    const sig = `${selected.id}|${Math.ceil(selected.hp)}|${selected.assigned || 0}|${selected.sacked ? 1 : 0}|${Math.round((selected.progress || 0) * 100)}|${JSON.stringify(selected.staged || {})}`;
    if (sig === selSig) return;
    selSig = sig;
```
And whenever selection is cleared (`selected = null` paths and `on('select', ...)`),
set `selSig = null;`. Do the same pattern for `renderUnit()` if it rebuilds
`innerHTML` (signature: unit id, hp, job).

### U6.3 Throttle the paint-drag render

In `scene.js` (~line 336) the paint loop ends with `emit('tick', this.ctx.state);`.
Change to:
```js
        const now = this.time.now;
        if (!this.lastPaintEmit || now - this.lastPaintEmit > 120) {
          this.lastPaintEmit = now;
          emit('tick', this.ctx.state);
        }
```

**Manual check:** select a farm at 3× speed, hover the Demolish button; it
must keep its hover state (it used to flicker). Paint a long wall; the sidebar
must still update but the drag must feel smoother.

Commit: `Selection panel and paint-drag stop rebuilding the sidebar every tick`

---

## Task U7 — corrupt save silently discarded

**File:** `src/core/state.js`, `loadGame` (~line 421).

**Current:** `} catch { return null; }`

**Change:**
```js
  } catch (e) {
    // keep the broken save for forensics instead of overwriting it on the
    // next unload (U7); the console line is the only surface we have here
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) localStorage.setItem(`${SAVE_KEY}-corrupt`, raw);
    } catch { /* storage full or blocked — nothing more to do */ }
    // eslint-disable-next-line no-console
    console.warn('Kingdom: the saved realm could not be read; founding anew.', e);
    return null;
  }
```
Add a test to `test/save-stock.test.mjs`:
```js
test('U7: a corrupt save is stashed, not lost', () => {
  localStore.clear();
  localStore.set('kingdom-sim-save-v1', '{not json');
  const l = loadGame();
  assert.equal(l, null);
  assert.equal(localStore.get('kingdom-sim-save-v1-corrupt'), '{not json');
});
```
(import `localStore` from the harness in that file).

Commit: `A corrupt save is kept for forensics, not overwritten`

---

## Task G — golden hashes (do this LAST)

**Why last:** every S-task changes headless numbers deliberately. The golden
test guards *future* refactors (the performance work in Phase 3), so it is
recorded once all behaviour changes are in.

**What to hash:** not a bare state (it starves by year 1 with nobody
placing farms) but the CSV that `model/simulate.mjs` prints, because that
run drives the real scripted player through farms, towers, trade, and the
Great Works ladder. Five years is enough to include the first raids.

**File:** `test/golden.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Recorded after Phase 0.1 (S1–S6). Re-record ONLY with a deliberate behaviour
// change and say so in the commit message. Print fresh values with:
//   GOLDEN_PRINT=1 npm test
const GOLDEN = {
  42: 'REPLACE_ME',
  7: 'REPLACE_ME',
  99: 'REPLACE_ME',
};
const YEARS = 5;

function csvHash(seed) {
  const out = execFileSync('node', ['model/simulate.mjs', String(YEARS), String(seed)],
    { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 });
  return createHash('sha256').update(out).digest('hex').slice(0, 16);
}

for (const [seed, want] of Object.entries(GOLDEN)) {
  test(`golden: simulate.mjs ${YEARS} years, seed ${seed}`, () => {
    const got = csvHash(seed);
    if (process.env.GOLDEN_PRINT) console.log(`seed ${seed}: '${got}'`);
    assert.equal(got, want);
  });
}
```
Steps: run `GOLDEN_PRINT=1 npm test 2>/dev/null | grep "seed "`, copy the
three printed hashes into `GOLDEN`, run `npm test`, confirm green, commit.
Each seed takes a few seconds; that is acceptable.

Commit: `Golden hashes: three seeds, five years, so refactors prove themselves`

---

## Final gate for the whole batch

```bash
npm test
node model/polish-unit-checks.mjs
npm run build
for seed in 42 7 99 123; do node model/simulate.mjs 25 $seed | tail -1; done
```
Paste the four CSV lines into `docs/SIMULATIONS.md` as **Campaign 15 —
Phase 0.1 defect batch**, with the pre-batch lines beside them (you recorded
those in the S1 commit). Then update `docs/STATUS.md` (created in Phase 0.3)
"Open bugs" to empty and list the commits.

## What NOT to do

- Do not touch `sim2/`. It is retired.
- Do not change `RAID.warlordHpMult`, `HERIOT.*`, tower `range`/`arrowDmg`,
  or any other balance constant. The only config change in this batch is
  `RAID.firstAfter: 400` (S4).
- Do not "fix" the `Math.random` seed fallback in `state.js:75`; it is the
  intended default for a browser new game.
- Do not add a build step, TypeScript, or a test framework beyond `node:test`.
