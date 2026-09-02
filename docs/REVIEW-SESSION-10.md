# Session 10 — the first-principles review, and the plan of action

*2026-09-02. A fresh read of `main` at `6313a25` (post-Eastwold), the docs, and
the roadmap, by three parallel reviewers (core sim, presentation layer, models
and docs) plus direct verification of every headline claim. Nothing here is
ratified; this is the agenda for the next working session. Numbers and
file:line references are from this tree.*

---

## 0. Verdict in one paragraph

The design thesis has been proven by play: two complete human reigns
(Wolfsden, Eastwold) reached the Crown of Ages, the ladder generated pull, the
journal telemetry is now the project's best instrument, and the core is
deterministic, headless-runnable, and honestly documented. The problems are
downstream of that success. **(1)** The engineering has real but shallow debt:
six verified sim bugs (two of them affect the numbers the reigns were judged
by), a handful of UI defects, a 39-assertion harness that nobody wired to
`npm test`, and no CI. **(2)** The measurement layer has split: `model/` is
live, `sim2/` froze on 2026-07-16 and has been quietly retired without a
label. **(3)** The docs have sedimented into five stacked "pickup points" with
no single status page, and three of them disagree about what is deployed.
**(4)** The design's next problem is sharper than the roadmap states it:
Eastwold's zero sacks, zero tribute, and 75% masters are *one* problem
(tower dominance, amplified by the Guildhall aura), not four items on a summit
agenda. The plan below is ordered so the mechanical work clears in days, the
legibility work ships from data the sim already has, and the summit meets
with the right question.

---

## 1. What's working

**Design.**
- Push/pull is real. ENDGAME §1 named the disease ("every want is a survival
  want") and §4's ladder answered it; Eastwold built all three tiers unprompted
  and took the fourth crown at 22.7 years.
- The moral machinery pays off in play: five massacres bred four avengers
  across two reigns, the Ash-Sworn line landed as saga. Mercy-settlers, the
  heriot, and sack-not-raze all read as history, not mechanics.
- The journal + `kingdom.export()` turned playtests into post-mortems with
  coordinates. Every finding in OPEN-QUESTIONS Session 9 came from it.
- Two reigns produced two genuinely different states (merchant republic,
  fortress levy-state). The system space is wide enough that the six unplayed
  styles are real, not marketing.

**Engineering.**
- One RNG closure per sim, threaded explicitly; presentation stagger uses id
  hashes, not the stream. `Math.random` appears once, as the seed fallback
  (`state.js:75`). Headless and browser run the same core.
- The deposit engine as a spec table (`economy.js:21-34, 80-140`), the
  material-gated draft (`economy.js:198-204`), the gathering contract written
  down and honoured on every exit (`camp.js:205-216`), the unified death rule,
  the defensive save migration ladder.
- Pathing hygiene: shared scratch buffers, per-tick path budgets, admissible
  heuristic scaled to road cost.
- Unit pooling in the scene, dirty-tile terrain repaint, by-id building diff,
  procedural sprites shared with the landing page.
- `model/simulate.mjs` imports the real core and its scripted player climbs
  the ladder; `polish-unit-checks.mjs` passes 39/39; `npm run build` passes
  clean.

---

## 2. What's not working

### 2a. Verified sim defects (in priority order)

| # | Defect | Where | Why it matters |
|---|---|---|---|
| S1 | **Towers double-count kills and shoot corpses.** The nearest-raider scan has no `hp > 0` filter; dead raiders stay in the array until the next cull, so a second shooter in range (tower+tower, tower+keep) re-kills the corpse: `raidersKilled += 2`, two chronicle lines, heriot paid twice, a live raider unshot. | `raids.js:583-585` | Inflates K/D, the heroes leaderboard (Edmund the Gray's 46), and the heriot. Soldiers (`raids.js:790`) and the hunt (`raids.js:621`) have the guard; towers don't. |
| S2 | **The `choice` phase is not an occupation.** `battleTick` sets phase `choice` but `leaderless` is only set in `resolveCampChoice`; meanwhile `campLife` heals the warlord and `raidTick`'s hold requires phase `battle`. Headless, on a save loaded mid-choice, or if the host starves during `choice`: a slain warlord resurrects and waves march from a camp the host is standing in. Masked in normal play only by the UI pausing. | `camp.js:376-379, 696, 866-869` | A latent version of the Wyrmditch stall. |
| S3 | **Ghost deposit tiles from autosave rounding.** Stock is rounded to integers on save; a tile at 0 < stock < 0.5 loads as 0 with terrain unchanged, is never cut, never transforms, still satisfies `canPlace`. | `state.js:304-307`, `economy.js:71, 123-133` | Rare per reload, permanent once it happens; a mine on a ghost vein is instantly spent. |
| S4 | **Tutorial mutates sim timing from localStorage.** The +100-tick first-raid grace keys off a browser flag outside state, so same seed ≠ same game. `RAID.firstAfter` is a dead knob; `state.js:111` hardcodes 300. | `tutorial.js:167-171` | Breaks the determinism guarantee the harness relies on. |
| S5 | **Heriot quantization discards the raider-iron mechanic.** `floor(lost×4 + killed×0.15)`: with no own fallen, a raid under 7 kills yields 0 and the fraction is dropped, not accrued. Parting-shot kills after `endRaid` never earn it. | `raids.js:961-964, 127-130` | The ore-poor scavenger path exists on paper and mostly not in play. |
| S6 | **Starvation of an expedition soldier is invisible to the expedition.** `killVillager` removes him from `state.soldiers`; `exp.lost` and the rout check never see it. | `population.js:67`, `camp.js:710, 796` | Wrong rout math on a hungry march. |

Also noted, sound but fragile: `lootBag` and `loot` are two sources of truth
with no invariant (`raids.js:423-426, 473-476`); float underflow in
`maintenanceTick` can leave wood at −1e-17 and `employable = -1`
(`economy.js:203-213`); the migration ladder has no version number.

### 2b. Verified UI defects

| # | Defect | Where |
|---|---|---|
| U1 | **"Found a new kingdom" on the victory card does not work.** It calls `clearSave(); location.reload()`, then the `beforeunload` handler re-saves the old state before the reload lands. The sidebar "New Kingdom" avoids this by resetting in place. | `ui.js:548, 829` |
| U2 | **The raid horn goes silent after ~6 raids.** A new `AudioContext` per warning, never closed; Chrome caps at 6, the 7th throws into a swallowing catch. | `ui.js:616-627` |
| U3 | **"Next raid threat in ~Ns" ignores `state.speed`** (3× wrong at fast-forward). | `ui.js:754` |
| U4 | **New Kingdom leaves stale UI:** previous realm's chronicle lines remain; speed highlight and stance button text not refreshed; terrain image leaks one 1024² game object per new game. | `ui.js:61-80, 335-342, 264`, `scene.js:62, 130` |
| U5 | **Tribute banner is empty after a reload during the decide window** (text only set on the event, visibility derived from state). | `ui.js:110-112, 812-813` |
| U6 | Selection panel rebuilds `innerHTML` and re-encodes icon canvases to base64 every tick while anything is selected; paint-drag emits `'tick'` per pointer-move, running the 16k-tile minimap loop at pointer rate. | `ui.js:401-418, 820-821`, `scene.js:336` |
| U7 | Corrupt save is silently discarded and overwritten on next unload. | `state.js:412` |

### 2c. Performance (measured, not yet a problem)

`model/simulate.mjs 25 42`: 12,000 ticks in 44 s, ~3.7 ms/tick late-game at
pop 778 / 275 buildings. Fine at 1×; at the scene's 8-ticks-per-frame catch-up
it is ~30 ms/frame of sim. Self-time: `economyTick`+`fillType` 29% (O(B ×
workers × P) rescans plus `b.workers = []` per building per tick),
`claimTick` 12% (full 16k scan every 2 ticks with `hypot` per tile when a
camp exists), two inlined full-map `territorySize` scans per tick,
`villagersMoveTick` 11% (`buildings.find` per villager though `byId` exists),
`findPath` 9% and bursty (`spawnRaid` up to 45 searches in one tick; a
warlord death fires `startFlee` for every raider; `findCampSite`'s fallback
floods A* per candidate). `saveGame` stringifies five 16k arrays plus the
4,000-entry journal synchronously every 100 ticks. None of this blocks play;
it is the ceiling on pop and on mobile.

### 2d. Code health

- **Over 150 lines:** `updateSoldiers` (197), `updateRaiders` (168); near
  it: `economyTick`, `spawnRaid`, `battleTick`, `raidTick`.
- **Duplicated:** the soldier↔enemy exchange (`raids.js:805-853` vs
  `camp.js:758-785`); terrain-speed path stepping in three places; soldier-death
  reckoning twice; the warlord literal three times; the stats block twice
  (the fallback at `state.js:397-404` already misses 11 keys); `food + bread*2`
  in six places.
- **Dead:** `destroyBuilding`, `RAID.firstAfter`, `KEEP.rallyOnBesiege`,
  `FOREST.harvestRadius` (drawn by the scene while the sim reads
  `DEPOSITS.harvestRadius`: two knobs, one behaviour).
- **Magic numbers outside config:** dozens; the full sample is in the core
  reviewer's notes (melee 1.1, gang 1.6, rally 6/150, all `raidShock` caps,
  escape radius 13, fate 60, morale targets, trade 0.65/0.7/0.6…).
- **Missing invariants:** `state.pop` vs `villagers.length`; `b.assigned` vs
  `b.workers.length`; `rd.loot` vs Σ `lootBag`; dangling `soldier.villagerId`.
- Three import cycles (`raids`↔`camp`, `economy`→`sim`→`economy`,
  `win`→`sim`→`win`) that work only because references sit inside function
  bodies.

### 2e. Tooling and measurement

- **No `npm test`, no CI, no `.github/`.** The 39-check harness exits non-zero
  on failure and needs only Node; wiring it is two lines. Coverage is exactly
  the Session-8 polish batch: nothing on combat, raids, camp, tribute, heriot,
  Great Works, tutorial, territory, pathing, villagers, win, or the
  phantom-draft fix. The ~240 "harness trials" credited in SIMULATIONS were
  scratch scripts never committed.
- **`sim2/` is retired in all but name.** Zero shared code; last commit
  2026-07-16; nothing shipped since (camp, deposits, buy cap, Great Works,
  heriot, Crown) exists in it. `homeGroundReduce` has drifted (0.2 vs 0.25:
  `params.mjs:62`, `config.js:311`); the warlord cadence uses a different
  mechanism; the opening it models (pop 10 / food 50) is not the shipped one.
  It reproduces its own outputs byte-for-byte, so it is an honest artifact of
  July's design, and should be labelled that.
- **`model/out/` is not reproducible from HEAD** and nothing records which
  SHA produced it (six core commits since). Campaign 14A is unreproducible
  outright: its script directory and the worktree
  `agent-a7a5292f7f24eb425` do not exist on GitHub, and no branch carries
  them. `build_workbook.py` has absolute macOS paths and bakes July rates.
  `run.csv`/`run.log` are the 2026-07-09 snowball fossils.
- **Bundle:** one 1,617 kB chunk (390 kB gzip), full Phaser import. No
  favicon. `.claude/launch.json` carries an absolute macOS path and port 5173
  while `vite.config.js` says 5174.

### 2f. Documentation

- **No single source of truth for current state.** `docs/README.md`'s state
  paragraph is dated 2026-07-16 and says CHATLOG has 16 turns (it has 26);
  `CHANGELOG.md` has **no Session 9 section** despite five shipped commits;
  OPEN-QUESTIONS has five stacked "this is the pickup point" sections.
- **Three docs, three answers on what is deployed:** README says Session 7,
  CHANGELOG says Session 8, OPEN-QUESTIONS S9 says Eastwold ran on a same-day
  deploy.
- **Stale headers:** `ENDGAME.md` says the ladder is "the drafted next
  build"; `REDESIGN.md` says "proposal for review"; `FINDINGS.md` still
  carries the retracted ~66 equilibrium; OPEN-QUESTIONS B2 says dmg 2.5 "not
  yet promoted" (params default has been 4.5 since July); `config.js:400`
  cites a 25-year sim run that was 12 years.
- **The register has sedimented.** "THE LONG PLAYTEST" is listed as standing
  in S5, S7, S8 and S9, but Wolfsden and Eastwold *were* the long playtest,
  and the massacre *has* now been chosen by a human, five times. The summit
  agenda is one bullet with eight sub-items.

---

## 3. Reading the roadmap against the evidence

The roadmap's own top three, restated with what the two reigns actually
settled:

1. **The long playtest: DONE.** Twice. Both reigns won. What is *not* done is
   the **onboarding kill gate**: no one who has never seen the game has played
   it. Every tuning number in the project is calibrated to one designer's
   competence, and that designer beats the game four years faster each reign.
   This is now the single most valuable playtest, and it costs one stranger
   and an hour.

2. **The Great Works summit: the agenda is wrong-shaped.** It lists dead
   tribute, aura-vs-masters, the difficulty ceiling, battlements, the banner,
   the Last Muster, and the bakery as separate items. Eastwold's telemetry
   says the first three are one mechanism:
   - Towers do the killing. Watchman Edmund the Gray: 46 kills; the top
     soldier: 11. 64 towers, 0 buildings sacked in 22 years.
   - Arrow damage is `arrowDmg × (1 + watchSkill)` (`raids.js:595`). A master
     watchman shoots at ~1.8×. The Guildhall aura took masters from 20 to 52 in
     one year and to 75% of the realm; every tower is therefore manned by a
     master.
   - Tribute demands 25% of treasury; paying is rational only when the wave
     would cost more than that. With zero sacks it never can. Tribute is dead
     *because* towers are dominant, not because the rider is badly written.
   - The Great Works provocation (menace 150/450/1000, scaffold target value 6)
     never landed a scaffold hit across two full ladders for the same reason.
   So the summit question is not "how do we make the endgame harder" but
   **"what is the counter to the tower line?"** Candidates, cheapest first:
   raid composition (a shield-wall or a siege element that closes on towers
   under cover), a watchman fatigue or ammunition economy, the tower's own
   arrows scaling with the *building's* HP rather than the watchman's skill,
   or simply decoupling the aura from combat crafts. The banner post and
   battlements are the *soldier* side of the same problem: today the army
   fights in the open even on hold, so the rational player builds towers
   instead of an army. Design the soldier and the tower together.

3. **The bakery at scale: ANSWERED.** Aldermere rotted 24k; Eastwold ran raw
   food at zero and 5,830 loaves, rot 1,218. Same build, different player
   attention. The incentive lands once the player has seen it once. The sweep
   is not needed; a second steward line at the first big spoil might be.

Two further findings the register does not yet hold:

- **Masters-as-precious has collapsed twice** (75% both reigns) and the aura
  is the identified lever. Note the coupling above: this is the same dial as
  tower dominance.
- **Military pressure is invisible** (raid size = base + prosperity/350 +
  0.4/soldier, militia excluded). The Fyrd Purist style is a genuine strategy
  the game never states. One JIT line and one number on the raid banner fixes
  the legibility; whether the loop should *stay* hidden is a summit question.

Sequencing question the docs keep deferring: REAVING §11 Q1. My read: REAVING
should not ship before the tower question is answered, because thralls and
guard ratios are another pressure system layered on a defence that already
absorbs everything. The truce market is the exception: it is the only
candidate that gives the *rich* player something to spend on, and it prices
against infamy, so it belongs at the summit as the trader's answer to the
tower line.

---

## 4. The plan of action

Ordered by dependency, not by size. Phases 0 and 1 are mechanical and need no
design call; phase 2 is the summit; phase 3 is gated on it.

### Phase 0 — clear the ground (one session, no design calls)

**0.1 Fix the verified defects.** S1–S6 and U1–U5 above. S1 and S2 first:
they touch numbers the reigns were judged by and a stall class we have
already been bitten by. Each fix lands with a check (see 0.2) and a four-seed
25-year sweep so the tuning baseline moves consciously. Expect S1 to lower
K/D and tower kill counts across the board; record the before/after in
SIMULATIONS.

**0.2 Make the harness a test suite.** `node --test` (built into Node 22,
zero deps), `"test": "node --test model/"`, a `makeTestState(seed, overrides)`
builder, a preload that stubs `localStorage`, and a `__test` export namespace
for the module-private functions (`updateTowers`, `cullRaiders`, `endRaid`,
`findCampSite`, `battleTick`, `fillType`). Port the 39 checks; add one case
per S-bug; add a **golden-hash test per seed** (state hash after N ticks) so
the phase-1 performance refactors are provably behaviour-neutral. Fix S4 so
the golden hash is meaningful. A single GitHub Actions workflow runs `npm
test` and `npm run build` on push.

**0.3 One status page.** `docs/STATUS.md`, one screen: what is on `main`,
what is deployed (with SHA and date), the open bugs, the summit agenda, the
next playtest. Replace the five pickup sections in OPEN-QUESTIONS with a
pointer to it; mark the long playtest done and the massacre played; write the
missing CHANGELOG Session 9; correct the stale headers in ENDGAME, REDESIGN,
FINDINGS, and B2; move `SESSION-8.md`, `CHATLOG-SESSION-9.md`, and
`design/QUESTIONS.md` under `docs/archive/`. Label `sim2/` retired in its
README and in `docs/README.md`.

**0.4 Hygiene.** Gitignore `model/out/**/*.err` and `sim2/out/*.csv`; stamp
each `out/` directory with the SHA that produced it; delete `run.csv`,
`run.log`, `sweep-wait.sh`, `wood-one.sh`; mark Campaign 14A unreproducible
in SIMULATIONS; fix the launch-config port and path; add a favicon; close the
`AudioContext`; add `engines` to `package.json`. Consider Phaser's custom
build entry for a ~50% bundle cut (measure, don't assume).

### Phase 1 — legibility from data the sim already has (one session)

None of these need a design decision; all of them answer a finding from the
reigns.

- **Heroes of the realm.** Kill attribution already keeps score. A panel in
  the Kingdom tab plus end-of-reign honours: top soldiers, top watchmen, the
  fallen masters. Lands *after* S1, or the numbers are wrong on day one.
- **The raid banner tells the truth.** Timer × speed (U3); the size drivers
  (prosperity, army, warlord, avenger) as one line so "standing down shrinks
  the wave" is discoverable; a steward JIT line when the army first tops ~10.
- **Tribute appetite** and the current demand formula visible on the rider's
  banner; U5 fixed so a reload mid-demand still shows the terms.
- **Masters by craft** and food-vs-spoilage as numbers, not only the mouldy
  chip.
- **Toast queue** instead of the single overwriting slot; roads/walls painted
  on invalid tiles give one quiet reason.
- Steward JIT lines no longer suppressed while a ladder step is active
  (`ui.js:139`).

### Phase 2 — the summit (a design session, whiteboard, not a patch)

Bring one question, not eight: **what is the counter to the tower line, and
what does the army do that towers cannot?** Pre-work before the session, all
cheap:

- A four-seed headless sweep with tower arrows capped at unskilled damage, to
  size how much of the difficulty ceiling is the master-watchman coupling.
- A sweep with the aura excluded from `tower`/`soldier` skills.
- Read-outs from the export: sack rate vs tower density across the two reigns.

Then decide, in this order, because each constrains the next:
1. Tower vs army balance (the counter, and the soldiers × walls interaction:
   battlements, hold-behind-wall, or nothing).
2. The rally banner as the one army-control primitive (A3 stands).
3. The Last Muster as the climax the great-host threshold provokes.
4. Whether the raid-size-follows-army loop stays hidden.
5. Whether tribute is redesigned (demand against *exposed* wealth, e.g.
   staged draughts plus buildings outside tower cover, not treasury) or
   retired.
6. The truce market's place, priced against REAVING infamy.

Kill gate for whatever ships: the **Danegeld King** reign (the only style
that generates tribute data), played by Chandra, plus the **onboarding
stranger** on the same build.

### Phase 3 — gated on the summit

- REAVING (§11 Q1, Q2, Q4, Q9) only once the tower answer is in.
- The small raid (the middle verb) alongside REAVING's prisoners.
- Typed camp hoard (small, can ride along with any camp work).
- Performance pass (§2c) when a playtest or mobile target needs it; the
  golden-hash tests from 0.2 are the safety net.
- Mobile: pinch zoom, a touch cancel, one media query. Not before the game's
  shape is settled.

### The playtest programme

| Reign | What it tests | When |
|---|---|---|
| Onboarding stranger | Every number's calibration to a single player | Now, on current main |
| Danegeld King | Tribute as a system or a corpse | After phase 0 |
| Fyrd Purist | The hidden army loop, the heriot as sole armoury | After phase 1 |
| Tall Cathedral-State | Provocation at small prosperity | After the summit ships |
| Merciful Shepherd | Mercy-settlers as an economy | Any time |

---

## 5. What I would do first, tomorrow morning

1. Fix S1 and S2 with checks, run the four-seed sweep, commit with numbers.
2. Wire `npm test` and the golden-hash test; add the workflow.
3. Write `STATUS.md` and the missing CHANGELOG Session 9.
4. Hand the current build to one person who has never seen it.
5. Run the two tower sweeps so the summit opens with a chart, not a hunch.
