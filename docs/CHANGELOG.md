# Changelog

Commit-level record of what shipped, newest session first. For the narrative see
[`CHATLOG.md`](CHATLOG.md); for the *why* see [`DECISIONS.md`](DECISIONS.md); for
the sim numbers see [`SIMULATIONS.md`](SIMULATIONS.md).

Branch: `phase1-defense-and-keep` (not yet merged to `main`; Vercel deploy is
manual and still runs the pre-this-session build).

---

## Session 3 — Playtest-driven build (2026-07-15)

Eleven commits on `phase1-defense-and-keep`, from `938e8cd` (prior session tip).
A design→playtest→build loop: defense/keep mechanics, then a full combat rework
driven by `kingdom.summary()` telemetry, then the population-growth fix Chandra
diagnosed. All changes verified headless + browser; production build clean.

### Defense & the Keep (Phase 1)

**`82916ae` — Phase 1: wall breaches, unit inspector, keep-as-heart**
- **Walls breach, don't shatter.** A wall battered to 0 HP becomes passable
  rubble at 1 HP (`breached=true`), repairable in place, never removed.
  `raids.js` `wallSet()`/batter branch; `economy.js` clears `breached` past 50%
  HP; `scene.js` dark-tints a breach.
- **Click-to-inspect units.** Hit-test soldiers/raiders (0.7-tile radius) before
  buildings in `scene.js` pointerup → `select-unit` event; `ui.js` inspector
  shows soldier's villager name/HP/skills or raider hp/loot/mode. Added
  soldier/raider DOM icons. `main.js` exposes `window.kingdom.game`/`.emit` as a
  debug/test handle.
- **The Keep as the kingdom's heart.** Auto-defends (config `range:8, arrowDmg:5`;
  `updateTowers` fires for any building with range+arrowDmg — no garrison).
  Besieged alarm + auto-rally soldiers when stormed. On sacking: a one-time
  **dark-age** payload (`KEEP.darkAge`: loot 60% of stockpiles, gut morale to
  floor, knock 5 buildings to their sack floor, up to 3 deaths) — but the keep
  survives at its floor and the **run continues** (extends A2, NOT a game-over).

**`316b4a7` — Phase 2a: sim2 spatial-combat proxy (raiders hunt villagers)**
- Sim-only (model-before-building). `resolveHunt()` in `world.mjs` runs LAST in
  the raid tick; sacked/destroyed buildings EJECT workers (flee→idle) into an
  exposed pool raiders run down; villagers fight back weakly. Unified death rule:
  caught in the open, replacing the 0.12 sack-death roll. `raidCivDeathModel:
  sack|hunt` switch kept as the A/B control. Villager-staffed watchtowers.
- **`huntCadenceTicks=20`** — the load-bearing knob (Finding 10: per-tick hunting
  scaled the toll with raid *duration* and cratered pop; a chase is occasional).
- Validated equivalent to the old sack model across baseline+gauntlet+specialists,
  iq0-2, ~100 seeds, 0% collapse (Campaign 6). **Not yet ported to the game.**

**`93f5501` — Fix New Kingdom (reset in place)**
- The button relied on `location.reload()`, a no-op in the preview environment.
  Now overwrites the current state object with a fresh `createState()` + emits a
  `new-game` scene event (repaint terrain, drop stale sprites, recenter).
  Robust regardless of reload.

### The combat rework (playtest-driven)

**`fddbb5c` — Run-summary telemetry (`kingdom.summary()`)**
- Lifetime stats on `state.stats` (pop peaks, raids + avg/biggest size, raiders
  killed, buildings sacked, walls breached, keep falls, born/starved, soldiers
  recruited/fallen, veterans fallen, kill/death ratio, masters). `dumpStats()`
  prints a console summary; call `kingdom.summary()` anytime, auto-fires on
  collapse. Old saves migrate. Became the feedback loop for the rest.

**`b87f2e2` — Army rework: probabilistic combat (sim2-validated + ported)**
- Replaces flat `s.hp -= 4`/tick with per-exchange **rolls**: skill-scaled CRIT
  (veterans burst), WOUND, and KILL-only-when-badly-wounded with severity that
  scales with conditions. `COMBAT` config block (both `src/config.js` and sim2
  `combat`). `combat.model='flat'` is the A/B control.
- **Game gets real spatial checks** the sim couldn't: home-ground = claimed-tile
  check, tower-cover = within tower/keep arrow range, and a **local-gang** wound
  scale (raiders within 1.6 tiles of THIS soldier, capped 3×) — being swarmed is
  deadly, holding a line is safe. Ports the missing force-ratio fix.
- Rookies beside a veteran season faster. Wounded mend 0.2→0.4/tick between raids.
- Verified: 6 vets+tower vs 14 on home ground = 100% win, survivors 1-6 (real
  variance); open = 41%; green swarmed = 1%.

**`d6eb6a3` — Soldiers hold territory (don't chase into the wilds)**
- `updateSoldiers` only engages raiders on/within ~2 tiles of claimed land;
  ignores wilds raiders; holds/mends at the keep when the border's clear.
  Keep-besieged overrides. Makes the home-ground bonus usable (fight where ~98%,
  not ~41%).

**`fdd2ae7` — Veterans survive attrition (kill-resist + wounded-retreat)**
- `veteranKillResist × skill` lowers the kill-roll on a wounded soldier; a
  badly-wounded skilled soldier RETREATS toward the keep to mend rather than
  dying in the line (green soldiers / keep-besieged excepted). `COMBAT` knobs.

**`74f2531` — Mercenaries: hire with gold, steep upkeep, desert if unpaid**
- `MERCENARY` config; `hireMercenaries`/`dismissMercenaries`/`mercenaryUpkeepTick`/
  `mercCount` + `soldierSkill()` helper (mercs carry `merc:true` + own skill).
  Hire a company for gold; steep per-tick gold upkeep (the **gold sink**); DESERT
  if unpaid. Fight via the same combat but aren't your people — no seasoning, no
  villager dies. `sim.js` runs upkeep; `ui.js` Hire/Release buttons.

**`919e068` — Fix mercenary hire cap**
- Old cap was `ceil(mercCount/size) >= maxCompanies` — over-counted once any merc
  died and wrongly refused hires. Now a total-headcount cap that lets you top up
  after losses; raised `maxCompanies` 4→8 (up to 24 mercs).

**`71ae221` — Mercenary visuals**
- Purple `u-merc` map sprite (+ palette `p`/`P`), purple DOM icon, own inspector
  card ("Mercenary — HP · skill · deserts if coffers run dry"), and
  "N mercenaries under contract · X gold/tick upkeep" in the Kingdom menu.
  Hit-test emits `kind:'merc'`.

### Population

**`8099e8a` — Population booms on surplus food**
- Fixes the stall Chandra diagnosed (12k food + empty housing but pop frozen at
  65; births ~13/yr ≈ war deaths ~10/yr). Growth now SCALES WITH
  food-surplus-per-capita (`GROWTH` config: abundant → boom capped at
  `surplusCap`, faster baseline). `population.js` growth branch. Surplus food
  finally builds a population; pop tracks the housing cap and eats the surplus
  (seed 42 pop 47→132, food stops hoarding). Pop is housing-gated + food-fuelled.

---

## Prior sessions

See `CHATLOG.md` Turns 1–11 and the initial `git log` from `d0d947b`:
- **Sessions 1–2** (2026-07-08 → 14): built the game; diagnosed the economy
  snowball (`model/`); designed + Monte-Carlo-validated the HP-as-output redesign
  (`sim2/`, ~4,900 runs); implemented the foundation in `src/` (villager agents,
  HP-as-output, sack-not-raze raids, soldiers-as-villagers, save migration);
  Fable review ratified A1-A6.
