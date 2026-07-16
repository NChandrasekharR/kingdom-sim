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

## Cumulative totals

~6,500 Monte Carlo runs across eight campaigns, plus many headless 12-year runs
of the real game, isolated in-game combat feel-tests (hundreds of trials per
matchup), and two full human playtests with `kingdom.summary()` telemetry. Every
number is reproducible from the commands listed; `sim2/README.md` documents the
harness. Note the Session-3 learning: for spatial combat *feel*, the human
playtest is the ground truth — synthetic stacked-tile tests mislead.
