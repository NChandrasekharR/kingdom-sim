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

---

## Cumulative totals

~4,900 Monte Carlo runs (~28M simulated ticks) across five campaigns, plus
two 12-year headless runs of the real game and four traced policy-debug
rounds. Every number above is reproducible from the commands listed;
`sim2/README.md` documents the harness.
