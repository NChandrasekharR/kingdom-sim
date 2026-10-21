# The plan: Phases 0–3

*2026-09-02. The execution plan behind `REVIEW-SESSION-10.md` §4. Each phase
lists its goal, its tasks with owner and size, its exit criterion, and what
it deliberately does not touch. Sizes: S = under an hour, M = a half-day,
L = a session, XL = a design session plus a build session.*

*Owner key: **small** = a smaller model can execute from a playbook without
design judgement; **large** = needs a capable model reading the whole
system; **Chandra** = a human decision or a playtest.*

---

## Phase 0 — clear the ground

**Goal.** A tree where a change can be trusted: the verified bugs gone, a
test suite that runs on push, one status page, no fossils. No design calls
anywhere in this phase.

**Exit criterion.** `npm test`, `npm run check`, and `npm run build` are
green on CI; `docs/STATUS.md` exists and is the only place that says what
is on `main` and what is deployed; the four-seed 25-year sweep is recorded
as Campaign 15 with before/after numbers.

### 0.1 Fix the verified defects — small — L

Executed from `docs/PLAN-DEFECT-FIXES.md`, tasks S1–S6 and U1–U7, one
commit each, in that order. The playbook has the exact code, the test, the
sweep, and the commit message for every task. The two that change reign
numbers are S1 (tower double-kills; expect K/D and watchman kill counts to
fall) and S5 (heriot accrual; expect iron to rise slightly on every seed).

### 0.2 The test suite — small — M

Task 0 and Task G of the playbook: `test/_harness.mjs`, `__test` export
namespaces in `raids.js` and `camp.js`, `npm test` via `node --test`,
`.github/workflows/ci.yml`, and a golden hash of the scripted player's
five-year CSV on three seeds so later refactors prove themselves.

Afterwards, port the 39 checks in `model/polish-unit-checks.mjs` into
`test/polish.test.mjs` **without deleting the original** until the port is
green twice on CI. Then delete the original and point `npm run check` at
nothing (remove the script).

### 0.3 One status page — large — M

Create `docs/STATUS.md`, one screen, dated, with these sections and nothing
else: *On main* (last commit, one line per shipped system since the last
deploy), *Deployed* (SHA, date, URL), *Open bugs* (from the review, struck
through as they close), *Next playtest* (who, which style, which build),
*Summit agenda* (the one question and its six sub-decisions, see Phase 2).

Then the sediment:
- `docs/OPEN-QUESTIONS.md`: replace the five "pickup point" sections (S4,
  S5, S7, S8, S9) with one paragraph pointing at `STATUS.md`. Keep the
  topical tables A–E but fix B2 (dmg 4.5 has been the default since July)
  and E1/E3 (deploy status). Mark "the long playtest" DONE (Wolfsden,
  Eastwold) and "massacre never chosen by a human" DONE (five times).
- `docs/CHANGELOG.md`: write the missing **Session 9** section from the
  five commits `c8f0feb`, `66652f9`, `2f17e9f`, `7401de1`, `1a5a3f7`, and a
  **Session 10** section for this batch.
- `docs/README.md`: fix "16 turns" (26), the deploy line, and the state
  paragraph (replace it with a pointer to `STATUS.md`).
- `design/ENDGAME.md`, `design/REDESIGN.md`, `design/FINDINGS.md`: fix the
  status headers (ladder shipped S9; redesign shipped 2026-07-14; the ~66
  equilibrium was retracted in SIMULATIONS Campaign 5).
- `config.js:400`: the TRIBUTE comment cites a 25-year run that was 12.
- Move `docs/SESSION-8.md`, `docs/CHATLOG-SESSION-9.md`, `design/QUESTIONS.md`
  to `docs/archive/`. Update every link with `grep -rn "SESSION-8\|CHATLOG-SESSION-9\|QUESTIONS.md" docs design README.md`.
- `sim2/README.md` and `docs/README.md`: add a "RETIRED 2026-07-16" banner:
  shares no code with `src/`, models nothing shipped after Session 4,
  reproduces its own outputs byte-for-byte, kept as the record of July's
  design. Nothing new is to be run against it.
- `docs/SIMULATIONS.md`: mark Campaign 14A unreproducible (script directory
  and worktree gone); add Campaign 15.

### 0.4 Hygiene — small — S

- `.gitignore`: add `model/out/**/*.err`, `sim2/out/*.csv`.
- Delete `model/run.csv`, `model/run.log`, `model/sweep-wait.sh`,
  `model/wood-one.sh`. Move `model/kingdom-economy-model.xlsx` and
  `model/build_workbook.py` to `model/archive/campaign-0/` with a two-line
  README saying they are the 2026-07-09 pre-redesign exhibit.
- Add `model/out/README.md`: "produced at `<sha>`; not reproducible from HEAD
  after 2026-08-18". Fill in the SHA from `git log -1 --format=%h -- model/out`.
- `.claude/launch.json`: remove the absolute `cwd` lines; set port 5174 to
  match `vite.config.js`.
- `public/favicon.svg`: a 32×32 of the keep sprite matrix from `sprites.js`
  rendered as SVG rects (it is generated art; keep it in code style). Link
  it from `index.html` and `landing.html`.
- `package.json`: `"engines": { "node": ">=22" }`.
- Measure Phaser's custom build: try `import Phaser from 'phaser/dist/phaser-arcade-physics.min.js'`
  or the `phaser/src` entry with only `Scene`, `Game`, `Image`, `Layer`,
  `Textures`, `Input` — record the gzip size before and after in the commit.
  Ship it only if the game still renders identically; otherwise record the
  number and move on.

### What Phase 0 does not touch

Balance constants (except `RAID.firstAfter: 400`, which aligns the browser
with what every sweep already measured), `sim2/`, the design docs' content,
anything in Phase 1.

---

## Phase 1 — legibility from data the sim already has

**Goal.** Surface what the reigns proved the player cannot see. Every item
answers a named finding from Wolfsden, Aldermere, or Eastwold. No new
mechanics, no balance changes, no design session needed.

**Exit criterion.** Each item ships with a screenshot in the commit body and
a line in `STATUS.md`; the Fyrd Purist reign (Phase 1's playtest) can be
played by reading the UI alone, without the console.

**Order matters:** 1.1 must land after S1, or the leaderboard ships with
double-counted kills on day one.

### 1.1 Heroes of the realm — large — M

The data: kill attribution is already in the chronicle text
("falls to watchman Nella's arrow", "Godwin fells Ulf Redknife") but no
counter exists on the villager. Add `v.kills` (soldier kills) and
`v.arrowKills` (watchman kills), incremented at the three kill sites
(`updateTowers` kill branch, `updateSoldiers` melee kill, the hunt's
"turns with a hoe" kill). Save-safe: old villagers load with 0.

The surface: a "Heroes" block at the top of the Kingdom tab, top three
soldiers and top three watchmen by kills with their current job and
whether they live; the fallen keep their line with a † for the reign. On
the victory card, an honours list of the top five. `kingdom.export()`
appends a "Roll of honour" section. Chronicle a line when a hero passes
ten kills ("Nella Fairhair's tenth arrow finds its mark") and when a hero
dies.

### 1.2 The raid banner tells the truth — large — M

Three changes to the Kingdom-tab raid line and the banner:
- Countdown × speed (playbook U3, already done in Phase 0).
- The size drivers, as one line under the countdown, computed from the same
  formula `spawnRaid` uses: "Next wave ~14: your wealth +6 · your army +4 ·
  warlord ×1.5 · avenger". Read the formula from `raids.js` `spawnRaid`
  (`base + prosperity/350 + soldiers×0.4`, warlord and avenger multipliers,
  the cap); do not reimplement it, extract it into
  `export function raidSizeBreakdown(state)` and call that from both.
- A steward JIT line the first time the standing army tops 10: "Sire, the
  wilds count our swords. A greater host draws a greater wave — the levy,
  mustered only at the horn, draws none." This is the Fyrd Purist's
  discovery, stated once. Add it to the JIT table in `tutorial.js` with a
  `when` of `state.soldiers.length >= 10`. (The formula in `spawnRaid`
  counts every standing soldier, mercenaries included; the "militia" that
  does not count is the armed reserve, `armedReserve(state)`: subjects who
  have stood down and keep their iron.)

### 1.3 Tribute is legible — large — S

On the rider's banner: the demand, the appetite ("his third demand; each
paid one grows the next by ×1.6"), and the raid the refusal brings ("refuse
and ~22 march now"). `TRIBUTE` in `config.js` has the numbers; `raid.demand`
and `state.tributeAppetite` have the state. Also the reload fix (playbook
U5, Phase 0).

### 1.4 Masters and food as numbers — large — S

Kingdom tab: masters by craft ("12 farmers · 4 smiths · 9 watchmen · 3
builders"), computed by one pass over villagers with `isMaster`. Food chip
tooltip: the spoilage rate per tick and the spoil-free buffer, from
`population.js` (grep `spoil`). Bread chip tooltip: "bread keeps; grain
past N rots".

### 1.5 Feedback where there is none — large — S

- Toast queue: replace the single overwriting slot in `ui.js` `showToast`
  with a three-deep stack that expires per message (keep the 2.2 s life).
- Roads and walls painted on invalid tiles: one quiet toast per drag with
  the first reason (`canPlace` returns reasons already; surface the first).
- Steward JIT lines no longer suppressed while a ladder step is active
  (`ui.js:~139`, `renderSteward`): show the JIT above the ladder card for
  its 9 s, then restore the ladder card.

### 1.6 Console API parity — small — S

`kingdom.summary()` gains `heroes` and `raidSizeBreakdown`; `kingdom.export()`
gains the roll of honour. Document both in `README.md` "Under the hood".

### What Phase 1 does not touch

Any number in `config.js`. Any raid, tower, or army behaviour. The
question of whether the army→raid-size loop *should* be visible is a
Phase 2 decision; Phase 1 states it once through the steward and stops.

---

## Phase 2 — the summit

**Goal.** One design session, at the whiteboard, with the reign data on the
table, that answers one question and the six decisions hanging from it.
Then one build session.

**The question.** *What is the counter to the tower line, and what does the
army do that towers cannot?*

**Why this is the question, not eight items.** Eastwold's telemetry:
64 towers, 0 buildings sacked in 22 years, watchman Edmund the Gray 46
kills against the best soldier's 11. Arrow damage is
`arrowDmg × (1 + watchSkill)` (`raids.js:595`); the Guildhall aura took
masters from 20 to 52 in a year and to 75% of the realm; so every tower
shoots at ~1.8×. Tribute demands 25% of treasury and is rational only when
the wave would cost more; with zero sacks it never can, so tribute is dead
across three reigns. The Great Works provocation (menace 150/450/1000,
scaffold target value 6) never landed a hit across two ladders for the same
reason. And the army fights in the open even on hold, so the rational player
builds towers instead of soldiers. Five agenda items, one mechanism.

### 2.0 Pre-work — large — M (before the session)

All headless, all four seeds, 25 years, using `model/simulate.mjs`. Add
three env overrides to `src/config.js` with the existing `_envNum` helper
(the deposit sizes already use `KSIM_STONE_BASE` and friends; follow that
pattern, defaulting to today's values so the game is unchanged), then sweep:
- `KSIM_TOWER_SKILL_MULT=0`: arrows ignore watchman skill. How much of the
  ceiling is the master-watchman coupling?
- `KSIM_AURA_COMBAT=0`: the Guildhall aura excludes `tower` and `soldier`
  skills. Does masters-as-precious survive?
- `KSIM_TOWER_RANGE=5`: shorter reach. Do sacks reappear?
- From the two exports: sack rate versus tower density per year, on one
  chart, both reigns. Use the census lines and the sack coordinates.
Bring the four CSV tails and the one chart. Nothing else.

### 2.1 The decisions, in order — Chandra — XL

Each constrains the next; do not take them out of order.

1. **Tower versus army.** Candidates, cheapest first: (a) raid composition:
   a shield-bearer element that halves arrows for raiders within 1 tile of
   it, so towers thin a wave but cannot stop one; (b) watchman fatigue:
   arrows slow after N shots per raid until relieved; (c) arrow damage scales
   with the *tower's* HP, not the watchman's skill, so the aura stops
   feeding it; (d) decouple the aura from combat crafts entirely. And the
   soldier side: battlements (a wound reduction beside an intact wall,
   mirroring tower cover), and hold-behind-wall positioning. Decide the
   pair together: the tower nerf and the soldier buff must sum to
   tense-but-fair (A1), not a swing to collapse.
2. **The rally banner** as the one army-control primitive: plant it, the
   army holds there; split is not offered (A3 stands). Where it interacts
   with battlements, it is the positioning verb.
3. **The Last Muster**: the great-host threshold that provokes the climax.
   Shape from DECISIONS Session 5. Decide the threshold and what "the
   climax" is (the warlord's whole strength marching at once, with the
   avenger if any).
4. **Whether the raid-size-follows-army loop stays hidden.** Phase 1 states
   it once. Decide whether the banner shows the number permanently.
5. **Tribute**: redesign the demand against *exposed* wealth (staged
   draughts plus buildings outside tower cover plus the treasury share), or
   retire it. If redesigned, the Danegeld King reign is its kill gate.
6. **The truce market's place**, priced against REAVING infamy: the
   trader's answer to the tower line. Decide whether it enters the build
   session or waits for REAVING.

Write the outcomes into `DECISIONS.md` Session 11 during the session, not
after.

### 2.2 The build — large — L

Only what 2.1 decided. Sim first for anything that touches raid size or
tower damage (four seeds, 25 years, collapse and too-easy rates against
the A1 target of ~60% interesting), then the game. Tests for every new
rule in `test/`. Golden hashes re-recorded with the commit saying why.

### 2.3 Kill gates — Chandra

- The **onboarding stranger** on the build that ships from 2.2 (and,
  independently, on current main before the summit; that one gates
  nothing, it calibrates the summit).
- The **Danegeld King** reign, Chandra playing, if tribute was redesigned.
- The **Tall Cathedral-State** reign for provocation at small prosperity.

### What Phase 2 does not touch

REAVING's content (its §11 questions wait on decision 1). The small raid.
Mobile.

---

## Phase 3 — gated on the summit

Nothing here starts until 2.1 is written into `DECISIONS.md`.

### 3.1 REAVING — Chandra then large — XL

Answer §11 Q1 (does it ship, and after the tower answer), Q2 (slavery in
this game, the values call), Q4 (the guard ratio), Q9 (thralls to the
merchant). Then the build, sim-first as in 2.2.

### 3.2 The small raid — large — L

The middle verb between nothing and the all-in march: a handful of men
slip out to steal from the ledger, risking capture. Couples with REAVING's
named prisoners. Build only after 3.1's Q1.

### 3.3 Typed camp hoard — small — S

The warlord's ledger holds typed goods the way raiders' bags do. Can ride
along with any camp work; no design call needed beyond Chandra's standing
"pushed" note in OPEN-QUESTIONS Session 8.

### 3.4 Performance — large — M

Only when a playtest or a mobile target needs it. Targets from the review:
`fillType` rescans (index workers by skill once per tick), `claimTick`
full-map scan (frontier set instead), the two inlined `territorySize`
scans per tick (cache per tick), `isInsideTower` `find` (use `byId`),
path-burst budgets in `spawnRaid`, `startFlee`-for-all on warlord death,
and `findCampSite`'s fallback floods. `saveGame` off the main thread or
at a longer cadence. The golden hashes from Phase 0 are the safety net:
every refactor must leave them unchanged.

### 3.5 Mobile — large — M

Pinch zoom, a touch cancel for placement, one media query that stacks the
sidebar below the map under 700 px, `aria-label`s on the speed buttons and
tabs, `prefers-reduced-motion` on the raid banner. Not before the game's
shape is settled by Phase 2.

### 3.6 Code health — small — M

From the review §2d, each a separate commit with the golden hashes green:
extract the duplicated soldier↔enemy exchange (`raids.js` and `camp.js`)
into one function; one `foodEq(state)` helper for the six `food + bread*2`
sites; delete `destroyBuilding`, `KEEP.rallyOnBesiege`,
`FOREST.harvestRadius` (point the scene at `DEPOSITS.harvestRadius`);
initialise every `stats` counter in `createState` and the load fallback
from one shared literal; move the magic numbers the review lists into
`config.js` under their owning block.

---

## The playtest programme

| Reign | Tests | Build | Phase |
|---|---|---|---|
| Onboarding stranger | Calibration of every number to one player | current main | now |
| Danegeld King | Tribute: system or corpse | after Phase 0 | 0 |
| Fyrd Purist | The hidden army loop; heriot as sole armoury | after Phase 1 | 1 |
| Tall Cathedral-State | Provocation at small prosperity | after 2.2 | 2 |
| Merciful Shepherd | Mercy-settlers as an economy | any | any |
| Wrecker Kingdom | The heriot economy at scale | after 2.2 | 2 |

Every reign ends with `kingdom.export()` and a post-mortem in the Session-9
style: reckoning, story beats, then the data. Findings go to `STATUS.md`
first, `DECISIONS.md` when decided.

## Sequencing, in one line

Phase 0 (a week of small-model work plus a half-day of doc consolidation)
→ the stranger plays → Phase 1 (one session) → the Danegeld King plays →
Phase 2 pre-work → the summit → the build → the Cathedral-State plays →
Phase 3 as decided.
