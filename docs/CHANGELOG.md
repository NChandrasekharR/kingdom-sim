# Changelog

Commit-level record of what shipped, newest session first. For the narrative see
[`CHATLOG.md`](CHATLOG.md); for the *why* see [`DECISIONS.md`](DECISIONS.md); for
the sim numbers see [`SIMULATIONS.md`](SIMULATIONS.md).

Everything is on `main` (Session 4 merged the Session-3 branch). The Vercel
deploy is manual and still runs the pre-Session-3 build — redeploy pending.

---

## Session 5 — The warlord's camp & the counter-raid (2026-07-16→19)

One feature, whole session: the warlord gets an ADDRESS. Design session first
(see `design/ENDGAME.md` — reframe: the late-game problem is no PULL, not no
sink; Chandra rejected symmetric rival kingdoms as "a worse Age of Empires" and
asked for counter-raids: "warlord sends raids, I send raids back"), then the
build. Verified headless (all three resolution paths scripted end-to-end) +
in-browser (march, battle, choice modal, on-screen massacre hunt, marked-man
refusal); baseline seed-42 numbers unchanged; production build clean.

**The camp** (`src/core/camp.js`, `CAMP` config block)
- Founded in the far wilds corner the first time a warlord shows himself:
  hall + tents, ~9 named camp folk (shepherds, weavers — not fighters), a
  garrison that grows with the hoard, and the warlord himself at his hall.
- His **ledger**: every fled raider's loot and every tribute payment lands in
  the camp hoard — the counter-raid's prize is *what he took from you*.
- Warlord dread waves now **march from the camp** (visible telegraphing, watch
  the road); he rides at their head as a boss body (170 HP, 3× wall batter,
  crowned sprite). Kill him at your walls → his host breaks and scatters; the
  camp waits leaderless until a successor claims it (~5 yr).
- Common brigand raids still slip in from random map edges.

**The march**
- "March on the camp" (Kingdom tab) sends EVERY soldier — the home-guard
  decision is how many you muster first (militia is the dial). Provisions cost
  food + gold. The host walks there on the real map (pale dots on the minimap);
  home genuinely thinner while they're gone.
- The fight is on HIS ground: no home-ground, no tower cover, garrison gang
  pressure, warlord counts double in the melee — expeditions are bloody by
  construction. Lose half the host → rout, survivors limp home, he smells
  weakness (next raid sooner).

**The choice** (at the moment of victory, game paused, standing in his camp)
- **Take back what is ours** — reclaim the hoard, burn the war-tents (camp
  broken ~4 yr), spare the folk. Mercy pays: spared folk drift to your gates
  as settlers over the years, sometimes with a craft.
- **Leave nothing standing** — the camp folk scatter and your soldiers run
  them down ON SCREEN (eject-and-hunt pointed the other way), each named in
  the Chronicle. One survivor ALWAYS slips through the reeds. The camp is
  ashes forever — and ~3 yr later the survivor returns as the AVENGER: sooner,
  harder waves (×1.35), and he sends no rider — tribute is dead against him.
  The men who did it come home MARKED: kill-resistant, and they refuse to
  ever stand down ("not since the burning").
- Emergent (observed in test, no dedicated code): the warlord can be mid-raid
  while you burn his home — two armies crossing on one map. He returns to
  ashes, and his grief halves the avenger's timer.

Files: `camp.js` (new), `config.js` (`CAMP`), `raids.js` (camp-origin waves,
warlord body, ledger hooks, marked/exp-aware muster), `sim.js`/`state.js`
(wiring + save migration), `sprites.js`/`scene.js` (tents, crowned warlord,
folk, hit-tests), `ui.js`/`style.css` (camp status box, march button, choice
modal — reload-safe), stats + `kingdom.summary()` camp block.

---

## Session 4 — Merge, the two ports, and the 21-idea run (2026-07-16)

Seven commits on `main`, from the fast-forward merge of `phase1-defense-and-keep`
(`b0417ad`). Arc: first-principles review → merge + the two overdue ports →
Chandra's 21-item playtest list done in four prioritized batches → the Duncastle
playtest log → two economy fixes it demanded. All sim-validated where balance
was at stake; all verified headless + browser; production builds clean.

### The ports

**`60bec47` — Port food spoilage to game (bread finally matters)**
- Raw food above a per-capita buffer (`FOOD.spoilFreeTicks=60` of eating) rots
  at 1%/tick; bread keeps — sim numbers verbatim. Chronicle event teaches the
  mechanic; `foodSpoiled` in stats + `kingdom.summary()`. Headless: food
  oscillates 300–1,000 instead of hoarding into the thousands.

**`1331386` — Port Phase 3 spatial layer: villager bodies, eject-and-hunt, watchman towers**
- Villagers get positions, walk home↔work, render as sprites, click-to-inspect.
- UNIFIED DEATH RULE ships: the 12% die-at-post sack roll is REMOVED; sacked
  buildings eject crews; civilians panic within `VILLAGER.panicRadius=3` of a
  raider and flee to the keep (leaving the labor pool until the raid ends); the
  hunt (`HUNT` block, Campaign-6 numbers: cadence 20, killChance 0.35, hoe-swing
  fightback) runs LAST in the raid tick with REAL spatial checks — a soldier
  within 1.6 tiles pins a raider; keep/house proximity shelters.
- Watchtowers need a villager watchman (`workers: 1`, first in `WORK_PRIORITY`,
  inert unstaffed, arrows scale with watch skill; fallen tower ejects him).

### The 21-idea batches

**`57f136a` — Legibility batch**
- Raids END when the last raider turns tail (stragglers still walk off, towers
  take parting shots); named raiders + two-way kill attribution; per-raid
  reckoning (Chronicle line + console tally, browser-only so headless CSVs stay
  clean); merchant-arrival toast; Rally-to-the-Keep button (150-tick fallback);
  tabular-monospace resource/trade numbers.

**`091abf2` — Tribute (Danegeld) + uncapped merc market — THE gold sink**
- Warlord's rider demands `TRIBUTE.demandFrac=0.25` of the treasury (min 40);
  pay → wave skipped, appetite ×1.6; face him → appetite resets. Banner UI.
- sim2 Campaign 9: safe (0-1% collapse baseline+gauntlet), real (median 3.9k
  gold sunk). **Fixed the latent sim2 warlord-cadence NaN** — warlords never
  spawned in ANY prior campaign (see SIMULATIONS.md caveat).
- Mercs: hard cap removed; escalating upkeep (+35% per extra company on every
  merc) is the market's own soft cap. `mercUpkeepRate()` drives the UI.

**`a5c9454` — Army fights as a line: spread targeting, merc first contact, rout, stance**
- Diagnosed die-en-masse (dogpile → same-tick melee entry → same-tick deaths);
  coverage-spread targeting (`coverPenalty=2.5`) halves death clusters, win
  rate unchanged; mercs pick targets first; ROUT at `routFrac=0.4` raid losses
  (keep-besieged fights to the death); hold/sally stance toggle in Kingdom tab.

**`1526633` — Mobilise/demobilise: militia**
- `v.armed` persists; stand down = militia (eats 1×, keeps skill); re-muster
  free, most-seasoned first; recruit button shows the reserve.

### The Duncastle fixes

**`a33b8d5` — Bread is the reserve + masters are precious + rot indicator**
- EAT-ORDER FLIP (game + sim2): raw food first, bread only on shortfall — bread
  accumulates (seed-42: 3,139 loaves by yr 12; Duncastle had rotted 47,690 food
  with bread at 0). Morale +8 from a stocked larder (`bread*2 >= pop`), not
  daily eating. Food chip goes moldy (`.rot`) + tooltip while surplus rots.
- MASTERS: `gainPerTick` 0.0008→0.0004, `masterAt` 0.6→0.8 (game + sim2, which
  also got its five hardcoded 0.6 bars parameterized). Duncastle had 201
  masters of 245 pop; sim now 0.40-0.54.
- Null-guard fix in soldier targeting (all raiders in reach dead mid-tick —
  introduced by the spread change, caught by headless seed 42).
- Side effect to WATCH: pop booms harder (seed 42: 153→375) — ex-rot becomes
  bread becomes people; housing still gates.

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
