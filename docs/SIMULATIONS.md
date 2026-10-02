# Simulation register

Every simulation campaign run on this project, in order, with the question it
answered, the command to reproduce it, and the numbers it produced. Aggregate
outputs live in `sim2/out/*.json` (latest run per scenario overwrites).

Legend: **INT** = INTERESTING (survived, 5–55% of ticks in crisis, didn't
trivialize) · **TE** = TOO-EASY · **COL** = COLLAPSE. Verdict definitions in
`sim2/run.mjs`.

---

## Campaign 0 — Diagnose the shipped game (Turn 6, 2026-07-09, `model/`)

**Question:** Does the live game's economy snowball?
**Method:** `node model/simulate.mjs` — the REAL `src/core/` code run headless
for 12 years with a greedy scripted player; results charted in
`model/kingdom-economy-model.xlsx`.

**Result:** Yes, catastrophically. Gold 10 → **29,102**; pop → **186**;
**0 buildings lost** across 15 raids. Also quantified the bakery trap
(+0.02 net food-eq/tick vs a farm's +0.345).

## Campaign 1 — Validate the redesign's core (Turn 7, 2026-07-11, `sim2/`)

**Question:** Does HP-as-output + villager agents work at all, and where's the
survivable region?

1. First runs: **collapse in year 1** — farms filled local stockpiles but no
   hauler existed to move food (Finding 1) → fixed with the free "town core."
2. Grid sweep (`--runs 30 --sweep hp.outputFloor=0.15,0.4,0.6
   hp.repairPerBuilderTick=0.6,1.5 raid.raiderDmgPerTick=1.2,2.5`):
   every cell at dmg 2.5 → 100% COL; best cell **outputFloor=0.4,
   repair=1.5, dmg=1.2 → 40% INT** (Findings 2–3).
3. At those defaults, 120 runs: baseline **23% INT / 26% TE / 52% COL**
   (bimodal — Finding 4); gauntlet and specialists **100% COL**, dying early
   (Finding 5: pressure must ramp, not front-load).

## Campaign 2 — Fix the collapses (Turn 7 update, 2026-07-11)

**Question:** Do the knowledge floor, rubber-band raids, and size-gated
pressure stop the death spirals?
**Method:** 120 runs × 4 scenarios at the new defaults.

| Scenario | Before | After |
|---|---|---|
| baseline | 52% COL | **0% COL**, 83% TE (17% INT) |
| gauntlet | 100% COL | **0% COL**, 97% TE |
| gauntlet-ramped | (new) | 0% COL, 100% TE |
| specialists | 100% COL | **0% COL**, 98% TE |

**Result:** Collapse solved; over-softened into too-easy. Blocker identified:
the passive scripted player can't be tuned against (→ B1).

## Campaign 3 — B1: tiered players + the dial (Turn 9, 2026-07-12/13)

**Question:** How much does player competence change the picture, and where
does the difficulty dial belong?

**Development traces** (single-run, `player.iq=1`): four failure rounds, each
a smart-seeming policy that collapsed FASTER than the passive bot —
1. Surge repair stripped the farms (13/19 villagers hammering, starvation).
2. Muster-from-zero militia: green, late, small; wood economy starved.
3. Standing army fed the 15%/tick attrition grinder; pop bled out.
4. Extra lumber camps stole the labor that should have staffed quarries → no
   stone → no towers → eternal siege.
These produced Finding 8's three degenerate strategies.

**Tier check** (`monte.mjs baseline --runs 120 --sweep player.iq=0,1,2`, dmg
1.2): iq0 **17% INT / 83% TE** (byte-identical to Campaign 2 — legacy
preserved); iq1 and iq2 **100% TE** (prospMed ~11.3k). Competence pushes
toward too-easy, not away from collapse (Finding 7 — the old caveat was
backwards).

**Dial sweep** (120 runs/cell, `player.iq=0,1,2 ×
raid.raiderDmgPerTick=1.2,1.8,2.5,3.5`), % INT (% COL):

| baseline | iq0 | iq1 | iq2 |
|---|---|---|---|
| 1.2 | 17 (0) | 0 — all TE | 0 — all TE |
| 1.8 | **100** (0) | 44 (0) | 14 (0) |
| 2.5 | **100** (0) | **100** (0) | **96** (1) |
| 3.5 | 100 (0) | 97 (3) | 99 (1) |

| gauntlet | iq0 | iq1 | iq2 |
|---|---|---|---|
| 1.2 | 3 (0) | 1 (0) | 2 (0) |
| 1.8 | **100** (0) | 3 (0) | 6 (0) |
| 2.5 | **97** (3) | **90** (1) | 75 (0; 25 TE) |
| 3.5 | 97 (3) | 94 (6) | 95 (5) |

**Specialists verification** (`--runs 120 --sweep player.iq=0,1,2
raid.raiderDmgPerTick=2.5`): 98% INT / ≤2% COL at every tier.

**Result (Finding 6):** dmg=2.5 met the B2 target (>60% INT, <15% COL,
<15% TE) everywhere. B1 and B2 marked RESOLVED.

## Campaign 4 — Re-validate after the anti-degenerate mechanics (Turn 10, 2026-07-13/14)

**Question:** Force-ratio combat, once-per-raid sack deaths, and raider
satiation change the balance — where does the dial land now?
**Method:** 60 runs/cell, `player.iq=0,1 × raid.raiderDmgPerTick=2.5,3,3.5`,
then a 4.5 probe; baseline + gauntlet.

| dmg | baseline iq0 | baseline iq1 | gauntlet iq0 | gauntlet iq1 |
|---|---|---|---|---|
| 2.5 | 100% INT (0) | 5% INT, 95% TE | 100% INT (0) | 3% INT, 97% TE |
| 3.0 | 100% INT (0) | 10% INT, 90% TE | 100% INT (0) | 12% INT, 88% TE |
| 3.5 | 100% INT (0) | 62% INT, 38% TE | 100% INT (0) | 47% INT, 53% TE |
| **4.5** | **100% INT (0)** | **95% INT (0)** | **100% INT (0)** | **98% INT (0)** |

**Result:** the mechanics re-opened the whole range (satiation ends raids,
soldiers stopped being a trap); **4.5 promoted to the `params.mjs` default**
and transplanted to the game as `RAID.lootDmg`. Zero collapse anywhere —
soft-failure contract (A1/A2) intact.

## Campaign 5 — Verify the real game (Turn 10, 2026-07-14, `src/`)

**Question:** Does the implemented foundation behave like the sim promised?

1. **Headless 12-year run** (`node model/simulate.mjs`, now running the NEW
   core): pop reaches a tense equilibrium **~66** (old snowball: 186), food
   oscillates 177–984 seasonally, gold 24,730 (sink gap noted), 12 raids,
   **0 buildings destroyed** (sack-not-raze working). Crowns: Plenty only.
   *[Corrected 2026-07-15 (Turn 12): the "~66 equilibrium" was ONE low seed
   eyeballed as emergent — pop is housing-gated, a smooth 48→175 ramp across
   seeds. There was no population-bounding mechanism; see the Turn-12
   diagnosis and the Session-3 growth decisions.]*
2. **Controlled raid test** (scratch harness, 3 forced waves against an
   8-building town): 1–2 sackings/wave with named log lines, mercy gap
   scaling 196 → 299 ticks with damage, sacked buildings repaired past 50%
   between waves. First version showed raiders wasting the withdrawal budget
   marching (Finding 9) → clock moved to arrival, re-test passed.
3. **Browser run**: zero console errors, save round-trips (Year-5 kingdom with
   20 named villagers, 14 masters), UI shows workforce breakdown / masters /
   sack states; raid banner, withdrawal, and recruit/dismiss exercised live.

## Campaign 6 — Spatial-combat proxy (2026-07-15, `sim2/`)

**Question:** Does "raiders hunt individual villagers who fight back weakly"
(replacing the 0.12 sack-death roll with a unified eject-and-hunt rule) stay
tense-not-toothless — no collapse regression, healthy population, defense still
protects people?
**Method:** new `resolveHunt()` in `world.mjs` (runs last in the raid tick);
sacked/destroyed buildings EJECT workers into an exposed pool; a `raidCivDeathModel:
sack|hunt` switch keeps the old model runnable as the A/B control. New metrics:
`villagersHunted`, `huntFrac`, plus `peakPopMed`/`finalPopMed` surfaced in `monte`.

**Finding 10 — hunt must not fire every tick.** First build ran the hunt every
raid tick → toll scaled with raid DURATION (~200 ticks) not severity → pop
cratered (iq1 pop 7, 10% collapse, 28 too-punishing). Fix: `huntCadenceTicks`
(a chase is occasional; raiders mostly loot). Cadence sweep (baseline, 80
seeds, iq0/1 × cadence 8/12/20):

| cadence | iq0 pop | iq1 pop | iq1 INT | iq1 COL | iq1 huntFrac |
|---|---|---|---|---|---|
| 8 | 40 | 24 | 93% | 0% | 0.55 |
| 12 | 46 | 30 | 96% | 0% | 0.44 |
| **20** | **50** | **36** | **96%** | **0%** | **0.29** |

**Result — `huntCadenceTicks=20` promoted to default.** At 20, the unified hunt
model is balance-equivalent to the old sack model on every axis that matters,
across baseline AND gauntlet (100 seeds each, sack vs hunt):

| | iq0 sack | iq0 hunt | iq1 sack | iq1 hunt |
|---|---|---|---|---|
| baseline INT (COL) | 100 (0) | 100 (0) | 99 (0) | 97 (0) |
| baseline pop | 49 | 50 | 34 | 36 |
| gauntlet INT (COL) | 100 (0) | 100 (0) | 99 (0) | 95 (0) |
| gauntlet pop | 48 | 49 | 34 | 35 |

Zero collapse everywhere; `huntFrac` 0.23–0.48 (in the 0.15–0.45 target band —
raids now cost *named people caught in the open*, ~a third of deaths, without
swamping the model). The small-kingdom-spiral risk (Finding 5) did NOT recur.
Also added: villager-staffed watchtowers (a watchman per tower competes for
civilian labor; unstaffed towers are inert) — verified assigning correctly,
non-destabilizing.

## Campaign 7 — Probabilistic combat rework (2026-07-15, `sim2/` + game feel-tests)

**Question:** Replacing flat combat (`soldier takes fixed damage / flat death
chance`) with per-exchange dice (crit / wound / kill scaling with conditions,
veterans, force-ratio) — is it balance-safe, and does it fix the "army ground to
nothing" the playtest showed?
**Method:** `combat.model=flat|probabilistic` A/B in sim2 (baseline + gauntlet,
iq0-2, dials 4.5-9, ~100 seeds/cell), plus direct combat feel-tests in the game.

**Result — balance-safe, army survives.** Across all cells: 0% collapse, higher
surviving population under probabilistic (e.g. baseline iq1 pop 36 vs flat's
stall; gauntlet iq1 pop 35 vs 34), near-identical interesting%. High dial (dmg 9,
iq1) probabilistic = 43% interesting / pop 55 / 0% collapse — high pressure
becomes *survivable-and-interesting* rather than fatal.

**Game feel-tests (isolated combat, tuned once from too-strong):**
- 4 veterans (skill 0.9) vs 12 raiders: **41% open, 98% home ground** (by the keep).
- 4 GREEN vs 12: **1% open, 65% home**. 6 vets + tower vs 14 = 100%, survivors 1-6.
- Even fights (6-8 vs 6-8): near-bloodless; outnumbering the raiders = a rout.

**Key learning:** *stacked-tile micro-tests are a poor benchmark* — piling all
fighters+raiders on one tile makes localGang pressure hit everyone equally, so
mercenaries add bodies but don't SHIELD veterans (no formation concept). Real
spatial defense (chokepoints, breaches, positioning) isn't captured; trust the
playtest for feel. Also validated in this campaign: **food spoilage**
(bread-as-reserve) is balance-NEUTRAL — `food.spoilEnabled=true` caps the absurd
14k food hoard to ~340 with zero change to interesting%/pop/collapse (the
excess it removes was pure dead-weight). Sim-only; game side not yet built.

## Campaign 8 — Playtest telemetry + the population diagnosis (2026-07-15, real game)

**Question (from Chandra's live playtests):** does the reworked army hold, and
why do resources pile up while pop stalls?
**Method:** `kingdom.summary()` telemetry from two full playthroughs, plus a
headless-model check of the growth-rate fix.

**Ravensholt Y21.9 summary:** army wins **11.5:1** (2,604 raiders killed), reigns
22 years, two crowns — BUT recruited 226 / fell 226 (72 veterans), army ends at
0; 38 wall breaches; 12,413 food / 7,441 stone unused; pop stalled at 65 (cap 95).

**Diagnosis (Chandra spotted it):** births ~13/yr ≈ war deaths ~10/yr → net
+2.7/yr, so pop crawls and stalls far below cap. The army-bleed, stalled-pop, and
wasted-resources are ALL ONE PROBLEM: growth too slow vs attrition → people are
the permanent bottleneck, everything else surplus. Growth was FLAT (surplus food
did nothing).

**Fix + headless verification** (`node model/simulate.mjs 12 <seed>` with
surplus-fuelled growth): seed 42 pop **47→132**, seeds 7/123 **~170→~266**, all
reach the People crown; food stops hoarding (pop eats it, stays ~300-500), pop
tracks the housing cap, no collapse, 0 buildings lost. Live: 3000 food + housing
→ pop 6→50 (cap) in ~1.25 years.

---

## ⚠ Caveat on Campaigns 1–8: warlord-free (discovered 2026-07-16)

While validating tribute (Campaign 9), a latent bug surfaced: sim2's warlord
cadence computed `wavesPerWarlord` from `P.ticksPerYear` with `P = params.raid`
— but `ticksPerYear` lives at the params TOP level, so the expression was NaN
and **cadence-warlords never spawned in any prior campaign**. (Gauntlet's
pressure came from its scripted events, which is why it still differentiated.)
The fix moved baseline iq1 from 98% too-easy to **50% interesting** — warlords
carry a large share of the difficulty design. Campaigns 1–8 numbers stand as
*warlord-free baselines*; Campaigns 9+ are the post-fix reference.

---

## Campaign 9 — Tribute (Danegeld) A/B (2026-07-16, `sim2/`)

**Question:** is paying warlords off SAFE (no collapse spiral), and does it
actually sink gold? Stress the appetite spiral with a pay-always policy.
**Method:** `node sim2/monte.mjs baseline --runs 100 --sweep
player.tributePolicy=never,auto,always player.iq=0,1` (+ same on `gauntlet`).
`tributePolicy`: never / auto (pay only when the wave outmatches the shield) /
always (the danegeld habit).

| Scenario, tier | policy | interesting | collapse | tribute sunk (med) | final gold (med) |
|---|---|---|---|---|---|
| baseline iq1 | never | **50%** | 0% | 0 | 1,798 |
| baseline iq1 | auto/always | 1%/0% (too-easy) | 0% | **3,867** | 2,905 |
| gauntlet iq1 | never | **77%** | 1% | 0 | 1,584 |
| gauntlet iq1 | auto | 5% (too-easy) | 0% | **2,276** | 1,854 |
| iq0 (never pays) | — | 100% | 0% | 0 | 7–8k |

**Findings:** (1) paying is SAFE — no collapse/spiral anywhere, pop stable;
(2) the sink is REAL — median tribute paid exceeds the final treasury;
(3) paying trades tension for safety (the bot that buys off every dangerous
warlord goes too-easy) — in the game this is the PLAYER's choice, priced by the
appetite spiral; (4) the warlord-cadence bug (caveat above) was found here.

---

## Campaign 10 — The die-en-masse diagnosis + the line fixes (2026-07-16, game harnesses)

**Question (Chandra's playtest observation):** why does one raider falling
precede soldiers dying en masse?
**Method:** scratch harnesses driving the REAL game core: 30-trial controlled
fights (8v12, 10v20 keep defense; 6v22 field battle for the rout).

**Diagnosis:** all soldiers target the nearest raider → the army enters melee
on the SAME tick → wounds accrue in parallel → deaths land on the same tick
(death-span 0; 11/30 trials with ≥3 deaths inside 30 ticks at 10v20). A
synchronized cascade, not bad luck.

**A/B after coverage-spread targeting (+2.5 effective distance per ally on a
raider, mercs pick first):** death clusters 11→5 of 30, avg local gang
0.61→0.52, losses 2.03→1.97, **win rate unchanged 63%** — balance-neutral by
design.

**Rout check (6 v 22 field battle, `routFrac=0.4`):** 18/30 routs, **0 total
wipes** (avg 3.4/6 survivors). Keep-besieged fights excluded (to the death).

---

## Campaign 11 — Eat-order flip + master retune (2026-07-16, `sim2/` + game)

**Question:** with raw-food-first eating, does bread actually accumulate — and
do the skill retunes (gain 0.0004, masterAt 0.8) keep the balance?
**Method:** `node sim2/monte.mjs baseline|gauntlet --runs 100 --sweep
player.iq=0,1` with new defaults; new `breadMed`/`mastersFracMed` columns;
game check via `node model/simulate.mjs 12 42`.

| Scenario, tier | collapse | bread (med) | masters frac (med) |
|---|---|---|---|
| baseline iq0 | 0% | **2,581** | 0.52 (was ~0.85+) |
| baseline iq1 | 0% | 0 (bot liquidates + pays tribute) | 0.54 |
| gauntlet iq0 | 0% | **2,185** | 0.40 |
| gauntlet iq1 | 0% | 0 | 0.12 |

**Game headless (seed 42):** 3,139 loaves banked by yr 12, food holds near the
buffer. **Side effect:** pop 153→375 — the ex-rot becomes bread becomes people
(growth reads total stock); housing still gates. WATCH in the next playtest.
Also caught + fixed a null-guard crash in soldier targeting (spread change +
mid-tick corpses).

---

## Playtest 3 — Duncastle, year 19 (2026-07-16, real game, post-Session-4 build)

`kingdom.summary()`: pop 245/245 (peak 245), 0 starved, 343 born; army 51
standing / 156 recruited / 101 fallen (27 veterans), K/D 6.26, 632 raiders
killed; 21 raids (avg 27.1, max 40), 3 warlords, 6 sacked, **0 wall breaches,
0 keep falls, 3 hunted**; crowns plenty+people; gold 9,078, iron 1,440;
**foodSpoiled 47,690, bread 0; 201/245 masters; tribute 0 paid**.

**Read:** the war layer WORKS in human hands (vs Ravensholt's 226/226 army
wipe); civilians are protected (3 hunted in 19 years — the design bar).
The economy told on itself: 47.7k rot + bread 0 (eat-order flaw), 82% masters
(Pillar B toothless), tribute unpaid (strong players rightly refuse), iron the
new gold. Drove the Campaign-11 fixes; the surviving conclusion is the
late-game WANT problem.

---

## Campaign 13 — The depletion polish batch (Session 8, 2026-08-17, `model/`)

**Question:** Four questions in one batch. (1) What woodBase actually delivers
the 4–6 year lumber-site lifetime the FOREST comment has always claimed?
(2) Does per-vein richness variance produce runs that play differently?
(3) Where should the merchant's per-visit buy cap sit? (4) Does auto-demolishing
spent camps recover the measured ghost-repair soak?

**Method:** `sh model/wood-sweep.sh` and `sh model/polish-batch.sh <tag> 25`
(both drive `model/depletion-polish-run.mjs` — the real `src/core/` with the
scripted player from `simulate.mjs`, plus instrumentation for site lifetime,
ghost repair, and vein fortune). Targeted behavior in
`node model/polish-unit-checks.mjs` (39 assertions). Vein lottery surveyed with
`node model/vein-probe.mjs`.

**Site lifetime = concurrent sites × years ÷ sites raised** (the campaign's
method: the bot holds 3 live lumber camps, so 3 × 25 ÷ camps-built).

### 1. Wood retune — 25-year runs, seeds 42/7/123

| woodBase | s42 | s7 | s123 | mean | year-3 wood | verdict |
|---|---|---|---|---|---|---|
| 90 (was) | 1.34 | 1.04 | 1.34 | **1.24** | 63–121 | 5× too fast — a chore |
| **250** | 5.00 | 4.41 | 3.57 | **4.33** | 85–101 | **chosen — the band, no seed running long** |
| 300 | 7.50 | 5.36 | 4.41 | 5.66 | 89–109 | seed 42 overshoots |
| 350 | 6.82 | 5.00 | 5.00 | 5.61 | 91–106 | one seed over |
| 450 | 7.50 | 7.50 | 5.77 | 6.92 | 87–98 | a camp outlives the interest |

**Result:** the old comment's "~4-6 years per site" was aspirational — the
shipped value delivered 1.0–1.8. **woodBase 250 / woodVar 125** lands 3.6–5.0
across four seeds (mean 4.23 in the after-batch run). Year-3 wood and pop are
flat across every candidate, so nothing starves the early game: the retune only
stops the late-game churn.

### 2. The Potosí — per-vein richness

Each of the 11 veins draws a fortune from the map seed: ordinary 0.8–1.3×, and
`1.5/11` of them a **deep vein at 3–6×**. Over 300 seeds: mean **1.56** deep
veins per map, and 52/300 maps have none at all — the bonanza is a place you
might not get.

Sample (`model/vein-probe.mjs`): seed 42 → `[0.83…1.11, 4.31, 5.31, 5.55]`,
deep share 67% of map ore · seed 7 → `[0.83…1.28]`, no deep vein · seed 123 →
three deep veins, 51% share · seeds 99, 777 → none.

**Does it shape a run?** 25-year runs, deep-struck vs not:

| seed | struck a deep vein | final ore | final iron |
|---|---|---|---|
| 11 | **yes** | **2,282** | **81** |
| 42 | no | 73 | 10 |
| 5 / 7 / 99 / 777 | no | 0 | 0–3 |

**Result:** a run that mines a Potosí banks ~30× the ore and ~8× the iron of the
best run that doesn't. The vein is a run-defining event, as intended.

### 3. Merchant buy cap

Set at `capBase 20 + 15/dock + 5/market` (`TRADE_CAP`, `src/config.js`).
Bare gates = 20/visit; a two-dock, one-market harbor = 55. Selling stays
uncapped. Verified by assertion rather than long-run economics: the scripted
player only sells, so the cap is exercised in `polish-unit-checks.mjs` (§1–3).

### 4. Ghost repair — before vs after auto-demolish

Share of all HP healed that went into already-depleted producer buildings:

| seed | before | after | mean building HP frac, year 20+ |
|---|---|---|---|
| 42 | 25.7% | **0.0%** | 0.044 → **0.739** |
| 7 | 18.8% | **0.0%** | 0.739 → 0.734 |
| 123 | 22.7% | **0.0%** | 0.134 → **0.733** |
| 99 | 24.1% | **0.0%** | 0.018 → **0.695** |

**Result:** the 25–30% soak the Session-8 decision was written against is gone
entirely. The knock-on is larger than the soak itself: on three of four seeds
mean late-game building HP went from near-total collapse (0.02–0.13) to healthy
(0.70+), because repair wood now reaches buildings that can use it.

### Batch validation — 25-year runs, before vs after the whole batch

| seed | pop | gold | iron | hillsFlat | veinsSpent | lumber life | keepFalls |
|---|---|---|---|---|---|---|---|
| 42 | 480 → **775** | 22.8k → 67.2k | 1 → **10** | 18 → 23 | 9 → 8 | 1.34 → **4.41** | 1 → **0** |
| 7 | 830 → 866 | 69.4k → 74.0k | 0 → 0 | 22 → 24 | 0 → 0 | 1.04 → **3.95** | 0 → 0 |
| 123 | 590 → **832** | 25.6k → 69.8k | 0 → 0 | 21 → 25 | 0 → 0 | 1.34 → **3.57** | 1 → **0** |
| 99 | **1 → 700** | 10.3k → 60.4k | 2 → 1 | 11 → 22 | 12 → 9 | 1.83 → **5.00** | 1 → **0** |

**Read:** no death spirals, no crashes, `npx vite build` clean. Seed 99 was a
baseline COLLAPSE (pop 1, "FALLEN" at year 15.7, 334 starved) and now finishes
at pop 700 — the fix was never a difficulty change, it was ending the ghost-repair
drain that was eating the wood those kingdoms needed to maintain themselves.
**Every keep fall across the four seeds is gone.** Depletion still bites (hills
flattened went UP, 11–22 → 22–25, because live quarries actually get worked
now); what stopped is the churn.

---

## Campaign 14 — Depletion: the wood treadmill and the deposit sweep (Session 8, 2026-08-17, `model/`)

The follow-through promised since Session 5. Two halves: the WOOD campaign
(does the repair treadmill kill a kingdom, and can trade save it?) and the
STONE/ORE deposit sweep (where do finite mining reserves belong?). The wood
half ran BEFORE the polish batch retuned `woodBase` — its numbers are the
diagnosis that motivated the retune, not a measurement of the shipped game.

### A. The wood campaign — the repair treadmill

**Question:** with finite forests at `woodBase 90`, does the repair treadmill
bleed a kingdom slowly, or does it end it? And do the wood-deadlocked seeds
8/37 get rescued by trade, or merely die later?

**Method:** `model/out/depletion-campaign/run-all.sh` — the real `src/core/`
with the scripted player, 25 years (seed 7 also at 30), instrumented with
`liveLumber`, `depletedLumber`, `campsBuilt`, `forestCleared`, and
`meanHpFrac` (the treadmill gauge — mean building HP fraction). A `TRADE=1`
rescue rule buys 20 wood from the caravan when wood < 10 and the treasury can
bear it, exactly as a human would click. **Instrumentation and rescue rule are
UNMERGED**, in worktree `agent-a7a5292f7f24eb425` (`5ff626c`, `8b50f30`,
`87d8d72`) — see OPEN-QUESTIONS for the merge decision.

**Finding 1 — the treadmill is a CLIFF, not a slope.** A kingdom does not
decline as timber tightens. It runs healthy for two decades and then falls off
the edge the year the last border-reachable forest dies:

| seed | last live camp | meanHpFrac before → after | pop at the cliff | pop at end |
|---|---|---|---|---|
| 42 | **y19** | 0.71 (y17) → 0.18 (y19) → **0.018** (y21+) | 510 | 510 (frozen) |
| 123 | **y24** | 0.74 (y23) → 0.45 (y24) → **0.099** (y26) | 810 | 810 (frozen) |
| 7 (30y) | **y29** | 0.67 (y28) → 0.43 (y29) → **0.067** (y31) | 985 | 985 (frozen) |

Within roughly two years of the last camp dying, mean building HP goes from
~0.7 to **0.02–0.07** and population **freezes** — it never falls. This is the
**"rich slum" endstate**: seed 42 finishes with 28.7k gold, 510 souls, and
every building in the realm at 2% health. Nobody starves; nothing can be
repaired; the kingdom is a museum of collapsing sheds with a full treasury.

**Finding 2 — lumber sites lasted 1.0–1.2 years at `woodBase 90`.** 54–72
camps built over 25 years, one relocation short of that each time. The FOREST
comment's "4–6 years" was off by 4–5×. This is the measurement that drove the
polish batch's retune to 250 (Campaign 13).

**Finding 3 — one trade purchase RESCUES a deadlocked seed.** Seeds 8 and 37
both open wood-deadlocked: no reachable timber, `meanHpFrac` at 0.019 by year
4, pop pinned at 15 for the whole run. The `TRADE=1` rule — a single 20-wood
purchase when the stores run dry — breaks it outright:

| seed | baseline (25y) | TRADE=1 (25y) | lift-off | total import cost |
|---|---|---|---|---|
| 8 | pop **15**, gold 52, hp 0.019, no crowns | pop **493**, gold 29,914, hp 0.691, plenty+people | **y11** | 280 wood / **840 gold** |
| 37 | pop **15**, gold 42, hp 0.019, no crowns | pop **347**, gold 14,703, hp 0.775, plenty+people | **y17** | 160 wood / **428 gold** |

A dead run becomes a 493-soul kingdom for 840 gold of imported timber.

**Finding 4 — structural imports are cheap.** 840g and 428g are **12–25% of
late-game gold income**: trade can absolutely bear structural imports, which is
what made the D4 buy cap necessary rather than optional. The rescue rule bought
in 20-wood units, which is the data behind the **~20–25 wood/visit** threshold
the shipped cap sits at (`capBase 20`, Campaign 13 §3).

**Finding 5 — ghost camps soaked 25–30% of all repair wood.** Depleted lumber
camps stayed in the worst-first repair queue forever, taking maintenance they
could never repay. This is the measurement the auto-demolish decision was
written against; Campaign 13 §4 records it going to 0.0%.

### B. The deposit sweep — where finite stone and ore belong

**Question:** at what reserve size does the ground giving out become
punctuation rather than a treadmill — for stone, and for ore?

**Method:** `sh model/deposit-sweep.sh` — **5 scenarios × 5 seeds × 25 years**
via `model/deposit-sweep-run.mjs`, with `KSIM_STONE_BASE` / `KSIM_ORE_BASE`
driving the config. Scenarios: `low` 60/40, `mid` 90/90, `high` 150/150,
`rec` 250/150, `control` inf/inf. Seeds 8/42/7/123/99. Raw trajectories and
`summaries.jsonl` committed under `model/out/deposit-sweep/` (`e7b240b`,
merged `c92d692`).

**Stone.** 60, 90, and 150 all die in **year 2–3** — the first quarry site
exhausts before the player has finished the opening build-out, which is a chore
by any reading. **250 pushes first depletion to year 4–5**, with 5–9 quarries
raised over a run instead of 14–29. That is the era-not-chore band, and it is
what shipped.

| stoneBase | first quarry depleted | quarries raised over 25y (s42/s7/s123) |
|---|---|---|
| 60 | y2 | 29 / 19 / 14 |
| 90 | y2 | 19 / 11 / 8 |
| 150 | y3 | 11 / 5 / 9 |
| **250** | **y4–5** | **7 / 8 / 7** |

**Ore.** At 90 the iron chain **starves by year 7** (seed 42's last iron gain:
y7). At 150 it **holds to year 17–19** across the mining seeds, with **3–5
forced relocations** and only **20–30% of the map's ore consumed** — the vein
you are standing on runs out, the map does not. 150 shipped.

| oreBase | last iron gain (s42) | mine relocations | ore fraction consumed |
|---|---|---|---|
| 40 | y4 | 0–2 | 15–32% |
| 90 | y7 | 2–3 | 15–30% |
| 150 | **y17** | 3–5 | 19–30% |
| 150 (`rec`) | **y19** | 4–5 | 21–30% |

**The cascade fires.** A spent vein falling back to quarryable hills yielded
**155–567 cascade stone** in the mining runs (`high` s99: 567; `rec` s99: 232;
`low` s42: 277) — zero before `244e524`, which is how the bug was caught: the
conversion had been leaving the fallen tile's `stoneStock` at 0.

**Controls are clean.** Every `control` run (inf/inf) is **tick-identical to
its scenario sibling up to the first exhaustion event** — the depletion code
adds nothing until a reserve actually runs out. Seed 8 is byte-identical across
all five scenarios (pop 15, gold 52) because it never builds a quarry at all:
the wood deadlock kills it first.

**No depletion death spirals.** Hills flattened rise as reserves shrink
(0–86 across scenarios) and populations move within their normal seed range
(330–914); no scenario collapsed a kingdom that the control kept alive.

---

## Campaign 15 — Homeostasis: the raid curve, lean food, charcoal (2026-10-02, `model/`)

**Question:** after the Thornmere playthrough (pop pinned at 300 for 14 years,
55k gold idle, 20 raids of exactly 40), which levers bring back late-game
pressure without breaking the opening?

**Method:** `sh model/homeostasis-batch.sh 30` → `node model/homeostasis-table.mjs`.
8 variants × 5 seeds × 30 years against the real core. The bot is shaped like
Thornmere: it stops housing at 300, keeps 35% under arms, buys iron, and never
sells iron. The raid curve is switched with the new default-off knob
`RAID.sizeCurve` (`raidSizeF`, `raids.js`). The live game is byte-identical:
`simulate.mjs 12 42` matches before and after.

**Findings** (full tables in `design/HOMEOSTASIS.md` §10):
- **The shipped cap pins raids at 40 from Year 10.** The formula's own wish
  reaches a median of 298 by Year 20.
- **The √ curve at `6√p` is too harsh:** the army collapses to 8 and masters
  lost nearly triple. **`4√p + 0.15·soldiers` holds:** raids grow from 42 to
  60, armies past critical mass keep 105, losses are about 8 a raid.
- **Halving farm and dock yield flat is a poverty trap:** 5/5 seeds stuck at
  10 people. **Tapering to half by 200 people works:** 53–81% of people on the
  land, spoilage halved, gold at Year 30 down 64%, stone exports down 67%, and
  homeostasis moves from Year 13 to Year 17. One seed never reaches it.
- **Charcoal ×3 alone has no measurable effect**, because direct iron imports
  bypass the smelter.
- **Armies are bistable** in every variant: around 105 with near-zero losses,
  or 0–15 bleeding about 10 a raid with 25–70k gold they can't spend.

---

## Cumulative totals

~8,300 Monte Carlo runs across eleven `sim2` campaigns, plus the two Session-8
depletion campaigns against the real core (Campaign 13's wood sweep and polish
batch; Campaign 14's 8 wood runs and 25-run deposit sweep), many headless
12-year runs of the real game, ~240 controlled harness trials against the real
game core (combat, rout, tribute), and three full human playtests with
`kingdom.summary()` telemetry. Every number is reproducible from the commands
listed; `sim2/README.md` documents the harness. Two standing lessons: (1) for
spatial combat *feel*, the human playtest is the ground truth — synthetic
stacked-tile tests mislead; (2) Campaigns 1–8 ran warlord-free (see the caveat
above) — treat pre-2026-07-16 difficulty numbers as lower-pressure baselines.
