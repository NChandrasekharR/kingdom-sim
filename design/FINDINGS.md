# Simulator findings — what the model taught us

**Date:** 2026-07-11 · **Source:** `sim2/` agent-based Monte Carlo (120 runs ×
3 scenarios, plus parameter sweeps). Numbers reproducible via the commands in
each section.

These are findings to inform the design decision, not final tuning. Several are
design *choices* (how punishing should the game be?) that need a human call.

---

## Finding 1 — Naive logistics starves small villages (FIXED in model)

The first thing the sim did was **collapse in year 1**: farms produced food into
their *local* stockpiles, but a 6-person village has no spare hands for a
dedicated hauler, so food never reached the global pool and everyone starved at
full production.

**Implication for the game:** logistics (Pillar A) must NOT be a startup tax. We
modeled the fix as a **free-distribution "town core"** around the keep — the
first ~6 buildings auto-distribute; only the sprawling periphery needs haulers.
This makes logistics a *scaling* concern (bites when you're big and spread out),
which is exactly where we want the interesting decisions. Roads/haulers matter
for the empire, not the hamlet.

## Finding 2 — HP-as-output works, but the danger is the RECOVERY rate, not the loss

Chandra's core idea (output ∝ HP, raiders damage HP, maintenance restores it) is
sound and produces the intended coupling. But the sim exposed the real failure
mode with precision:

> Raiders don't need to **destroy** anything. In a typical raid they **sack ~14
> buildings** down to ~15% HP each. Across 16 raids that's **223 sackings**. If
> repair can't outpace that, output craters → food fails → population dies. The
> death spiral lives in how fast you *recover*, not in what you *lose*.

A run at the original knobs: peak pop 48 in year ~4, then bled to zero by year
9-10 — 100 villagers dead, 18 masters lost, **8,884 cumulative output lost to HP
degradation.**

## Finding 3 — Three knobs control the survivable region (SWEEP RESULT)

`node sim2/monte.mjs baseline --runs 30 --sweep hp.outputFloor=0.15,0.4,0.6
hp.repairPerBuilderTick=0.6,1.5 raid.raiderDmgPerTick=1.2,2.5`

| Knob | Effect | Sweet spot |
|---|---|---|
| **raiderDmgPerTick** | THE master switch. Every cell at 2.5 → 100% collapse; every survivable cell is at 1.2. Controls sackings-per-raid. | ~1.2 |
| **repairPerBuilderTick** | The recovery lever. 0.6→1.5 moved 10%→40% interesting. Recovery must outpace damage. | ~1.5 |
| **outputFloor** | A gutted building at 40% output can fund its own repair (breaks the spiral). At 0.6 the game goes *too easy* — HP damage stops mattering. | ~0.4 |

Best single grid point: **outputFloor=0.4, repairPerBuilderTick=1.5,
raiderDmgPerTick=1.2 → 40% interesting** (at n=30). These are now the model
defaults in `params.mjs`.

**Design translation:** soften all three, moderately. Low HP should sting, not
strangle — a sacked building still limps at ~40%, repairs are brisk, raiders
grind HP down gradually enough that a *defended* town recovers between waves.

## Finding 4 — The design is HIGH-VARIANCE (the honest problem)

At the tuned defaults, 120 baseline runs split **three ways**:

- 23% INTERESTING (survived, spent real time in crisis, didn't trivialize)
- 26% TOO-EASY (snowballed to safety)
- 52% COLLAPSE (died, usually late-game spiral)

`prospMed=1646` but the distribution is bimodal: runs tend to *either* run away
*or* die, with a narrower "interesting" band between. Small differences in raid
timing and targeting swing a run between the two.

**Implication:** this is the single most important thing to fix before shipping.
A game that's 50/50 "trivial or fatal" depending on luck isn't tense, it's
swingy. Options (a design call):
- **Rubber-banding** — raids ease off after they hurt you, intensify when you're
  fat. (Compresses both tails toward "interesting".)
- **Softer failure** — collapse should be recoverable (refugees return, a
  neighboring lord bails you out) so a bad raid isn't run-ending.
- **Player skill headroom** — our scripted "player" is dumb (never micromanages
  defense positioning, repairs reactively). A real player closes much of the
  collapse gap. We may be pessimistic. *Worth testing a smarter policy.*

## Finding 5 — Compounding early pressure is fatal (Pillars C + events)

Gauntlet (multi-front smart raids + scheduled drought/plague/harsh-winters) and
Specialists (fast skill + plagues that target masters) are **100% collapse** —
but they die *early* (`crisisMed` 0.32-0.34, `prospMed` stuck at 220, economy
never establishes). Stacked shocks in years 2-4 re-trigger the first-raid
collapse before the kingdom is robust.

**Implications:**
- **Pillar C (pressure) must ramp, not front-load.** Warlords, multi-front
  raids, and disasters should escalate *with* the kingdom, gated behind a
  minimum size/age. A drought that's survivable at pop 40 is fatal at pop 12.
- **Pillar B (specialists) adds brittleness that needs a floor.** Losing masters
  to plague/raids compounds hard. The apprentice-floor mechanic (masters passively
  train juniors) exists in the model but needs to be *stronger* — knowledge
  shouldn't fully die with one person, or every bad raid is unrecoverable.

## What this means for the three pillars

| Pillar | Verdict from the sim |
|---|---|
| **A — Logistics** | Viable IF core-distribution keeps it off the early game. It's a late-game scaling texture, not a core loop. Lower priority to build first. |
| **B — Specialists** | The richest for *stakes* but the biggest brittleness risk. Needs a strong knowledge-preservation floor or it makes collapse permanent. Build carefully. |
| **C — Pressure** | The heart of "interesting," but MUST ramp with kingdom size. Front-loaded pressure just resets the game. The rubber-band question (Finding 4) is really a Pillar-C question. |

## Recommended next experiments (before writing game code)

1. **Smarter player policy** — does a competent player turn 52% collapse into
   ~20%? If so we're over-pessimistic and the design is closer than it looks.
2. **Rubber-band raids** — add `raidEaseAfterLoss` and re-sweep; target
   >60% interesting, <15% collapse, <15% too-easy.
3. **Knowledge floor** — make masters train 2-3 apprentices to ~0.5 skill; see
   if specialists stops being 100% collapse.
4. **Size-gated pressure** — gate warlords/disasters behind pop≥N; see if
   gauntlet becomes survivable.

Each is a one-line change to `params.mjs` or a small `world.mjs` edit, then a
`monte.mjs` run. The harness is built for exactly this loop.

---

## UPDATE (2026-07-11): experiments 2-4 run — collapse SOLVED, new problem is "too easy"

I implemented three of the recommended fixes and re-ran 120×4 scenarios:
- **Knowledge floor** (guild memory: a once-mastered craft keeps a 0.3 baseline
  so one death can't wipe it) — `skill.guildFloorFromMaster`.
- **Rubber-band raids** (a raid that hurt buys recovery time; size eases) —
  `raid.rubberBand`.
- **Survivable start + size-gated warlords** applied to the hard scenarios.

Result — **collapse went to 0% in EVERY scenario**, including gauntlet and
specialists which were 100% collapse before:

| Scenario | Before | After | Now reads |
|---|---|---|---|
| baseline | 52% collapse | **0% collapse**, 83% too-easy | TOO EASY |
| gauntlet | 100% collapse | **0% collapse**, 97% too-easy | TOO EASY |
| gauntlet-ramped | (new) | 0% collapse, 100% too-easy | TOO EASY |
| specialists | 100% collapse | **0% collapse**, 98% too-easy | TOO EASY |

**This confirms Finding 5 decisively:** gauntlet/specialists were dying from
*early-game fragility* (missing start conditions + no knowledge floor), NOT from
their disasters. Once the economy establishes, drought/plague/warlords are all
survivable. The "pressure must ramp, not front-load" hypothesis holds.

**The pendulum has swung fully the other way.** Every scenario is now too easy
(prosperity medians ~7,000-8,000). We over-softened. The good news: difficulty is
now essentially a **single global dial** (raid frequency × damage × rubber-band
mercy) and the whole distribution moves together — tighten it and everything
slides back toward the interesting band. The bad news: I can't nail the exact
setting, because —

## The real blocker: the scripted player is too dumb to tune against

Every number above was produced by a **passive scripted player** that never
positions defense, repairs only reactively, and can't read a raid coming. To
keep *that* player alive, the game has to be soft enough to be trivial for the
numbers. **Finding 4's experiment #1 (a competent player policy) is now the
critical path** — until we know how much a real player closes the gap, we're
tuning against a strawman. Recommend building a smarter `player` policy (or
hooking the sim to a human/Claude-driven controller) before locking any
difficulty numbers.

**Net for the design decision:** the three-pillar redesign is *structurally
sound* — every failure mode we hit was fixable with a small, sensible mechanic,
and none required abandoning the core idea. The open question is no longer "does
it work" but "where's the difficulty set," and that needs a real player to
answer.

---

## UPDATE (2026-07-13): B1 run — tiered players built, the difficulty dial is answered

The smarter-player experiment is done. `player.iq` now selects a competence
tier (0 = the passive legacy bot, byte-identical numbers; 1 = competent;
2 = sharp), sweepable like any knob: `--sweep player.iq=0,1,2`. See
`sim2/README.md` for what each tier does.

### The headline table (120 seeds per cell, `raid.raiderDmgPerTick` sweep)

**baseline** — % INTERESTING (% collapse):

| dmg/tick | iq0 passive | iq1 competent | iq2 sharp |
|---|---|---|---|
| 1.2 (old default) | 17% (0%) | 0% — all too-easy | 0% — all too-easy |
| 1.8 | **100%** (0%) | 44% (0%) | 14% (0%) |
| **2.5** | **100%** (0%) | **100%** (0%) | **96%** (1%) |
| 3.5 | 100% (0%) | 97% (3%) | 99% (1%) |

**gauntlet** (multi-front + scheduled disasters):

| dmg/tick | iq0 passive | iq1 competent | iq2 sharp |
|---|---|---|---|
| 1.2 | 3% (0%) | 1% (0%) | 2% (0%) |
| 1.8 | **100%** (0%) | 3% (0%) | 6% (0%) |
| **2.5** | **97%** (3%) | **90%** (1%) | **75%** (0%, 25% too-easy) |
| 3.5 | 97% (3%) | 94% (6%) | 95% (5%) |

### Finding 6 — `raiderDmgPerTick = 2.5` is the setting

The value that was **100% collapse** before the rubber-band/knowledge-floor/
output-floor fixes is now the sweet spot: every tier, both scenarios, lands
60–100% interesting with ≤3% collapse. The B2 target (>60% interesting, <15%
collapse, <15% too-easy) is met at 2.5 for iq0 and iq1 everywhere; iq2 skews
25% too-easy only in gauntlet, acceptable for the optimizer ceiling. The
softening mechanics didn't make the game easy — they made it *tunable*: the
whole difficulty range 1.8–3.5 is playable, with 1.2 (the old "safe" value)
now clearly TOO SOFT for everyone.

### Finding 7 — the B1 caveat was BACKWARDS

We assumed the passive bot made collapse numbers pessimistic and too-easy
numbers optimistic. After the rubber-band, it's the opposite: **the passive
player's sloppiness keeps it in the interesting band** (it takes damage, so
rubber-band mercy and crisis time engage), while **competence pushes toward
too-easy** (a player who prevents damage never triggers the tension). The
design implication is important: rubber-banding rewards *struggling* players
with mercy and punishes *thriving* ones with pressure — which is exactly the
A1 "tense-but-fair" contract. But it means difficulty must be tuned against
the SMART tiers (iq1/iq2 too-easy rates), not against collapse.

### Finding 8 — what "competent" actually means here (design-relevant)

Building the competent tier surfaced degenerate strategies the real game must
design around; each was found because the naive "smart" version *collapsed
faster than the passive bot*:

1. **Towers strictly dominate soldiers.** Combat attrition is a flat 15%
   death chance per soldier per tick fought — soldiers are ablative meat, while
   towers kill without dying or eating. A small kingdom that fields a militia
   feeds its producers into a grinder and spirals. The competent tier caps its
   army at pop/8 and leans on towers. *For the game: soldier combat needs to
   scale losses with force ratio (outnumbering raiders should be nearly
   bloodless), or soldiers will be a trap and towers the only answer.*
2. **Repairing mid-raid is a meat grinder.** Healing a sacked building past
   50% HP re-flags it sackable; each re-sack rolls 12% death per worker. The
   competent tier never repairs while raiders are inside the walls. *For the
   game: either repair-during-combat should be impossible/slowed, or re-sacking
   shouldn't re-roll worker deaths — otherwise the intuitive "fix it now!"
   response is a death sentence the player can't see coming.*
3. **An undefended raid never ends.** Raids end when all raiders die; with no
   towers and no army they besiege forever, looting every tick. *For the game:
   raiders need a satiation/withdraw condition (loot cap, season change) so a
   defenseless town is set back hard but not besieged eternally.*
4. **Labor beats infrastructure.** Building more lumber camps without hands to
   staff them just adds decay surface and raid targets. The binding resource is
   villagers, always. (This is the redesign working as intended — §2's "scarce
   hands" is doing its job.)

### What's still open

- The `verdict()` thresholds are unchanged (C3); crisisMed at dmg 2.5 sits at
  0.06–0.23 across scenarios, toward the lower half of the 5–55% "interesting"
  band — the band is met but the tension is mild in baseline. If A1's "tense"
  wants more, push toward 3.0–3.5 (collapse stays ≤6%).
- `specialists` at dmg 2.5 confirms: 98% interesting, ≤2% collapse at every
  tier (iq0 98/1%, iq1 98/2%, iq2 98/1%). All three scenario families agree.
- `raiderDmgPerTick=2.5` is validated but **not yet promoted** to the
  `params.mjs` default — do that alongside the C3 threshold decision.
- The abstract-vs-spatial gaps (C2, B5) and winter knobs (B6) are untouched.
