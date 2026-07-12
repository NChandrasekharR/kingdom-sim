# Kingdom-sim redesign: the living kingdom

**Status:** proposal for review · **Date:** 2026-07-09
**Author:** drafted with Claude, for Fable's review
**Companion:** `sim2/` — an agent-based Monte Carlo simulator that models these
mechanics independently of the game code, so we can test the design before
building it. See `sim2/README.md`.

---

## 1. The problem we're solving

The current game is a set of **uncapped positive feedback loops with no
drains** (proven in `model/kingdom-economy-model.xlsx`: gold compounds 10 →
29,102 over 12 years, 0 buildings ever lost to raids). But "add sinks" only
makes it *balanced*, not *interesting*. Balance is necessary, not sufficient.

The deeper problem: **buildings are fire-and-forget nodes and population is a
single integer.** Nothing in the game demands an ongoing decision. You place a
farm and never think about it again. Raids are a binary (lose the building or
don't — usually don't). The economy game and the war game barely talk to each
other.

## 2. The core idea: HP is production capacity

One structural change reframes everything (Chandra's insight):

> **A building's output scales with its HP. HP decays without maintenance.
> Raiders damage HP (not just destroy). Maintenance costs workers + materials
> and competes with everything else for them.**

Consequences that fall out of this, for free:

- Buildings become **ongoing relationships**, not purchases.
- HP becomes a **shared currency between economy and war** — the number
  raiders attack IS the number that makes your economy run IS the number
  maintenance restores. The three games finally couple.
- A raid is now an **economic event measured in lost output-days**, not a
  coin-flip over rubble. Raiders that knock 5 buildings to 40% and flee have
  hurt you badly without destroying anything.
- The interesting decision isn't "keep HP topped up" (that's a chore). It's
  **"maintenance competes for the same scarce hands and materials as
  production and construction."** Every tick implicitly asks: fix the smelter,
  staff the farm, or build the wall? *Scarcity converts the chore into a
  decision.*

## 3. Why this forces villager units

If maintenance and production compete for workers, and some workers are better
than others (specialists), then **population can no longer be a single
integer.** You need discrete agents. This is the big architectural change and
the main thing the simulator exists to de-risk.

A **villager** is an agent with:
- a **home** (a house tile) and a **workplace** (a building tile),
- a **location** and the ability to **walk** between them (paths, roads),
- a **job** (farmer, hauler, builder, soldier, idle),
- a **skill vector** — proficiency per job that **rises with use** and is
  **lost when they die**,
- **needs** (food; later warmth, faith) that, unmet, drop their output and
  eventually kill them.

Population becomes a *collection of these*. "15 pop" becomes 15 little lives
with histories. That's where human stakes, morale-as-personal, and
irreplaceable investment all come from — and it's what makes a raid death
*mean* something.

## 4. The three pillars (all build on §2–3)

### Pillar A — Logistics & supply lines (the circulatory system)

Production and maintenance need **materials in the right place**, not just in a
global pool.

- Every building has a small **local stockpile**.
- **Haulers** (a villager job) move goods between buildings along paths; roads
  make them faster (finally a deep reason roads matter).
- A building **cut off** from supply — no hauler reaching it, or its inputs
  undelivered — **decays and its output starves**, regardless of global
  resource totals.
- **Raiders target the network**, not just buildings: sever a road or sack a
  granary and a whole district withers downstream.

This turns the flat territory map into a system with **flow, bottlenecks, and
chokepoints**. The map's *shape* starts to matter strategically: a long thin
kingdom is fragile; a compact one is robust but land-poor.

**Consequences to test:** hauler count vs. building count scaling; does the
player drown in hauler micromanagement (BAD — must be automatic); do supply
cuts create satisfying cascade failures or unrecoverable death spirals (need
the difference to be player-legible and preventable).

### Pillar B — Specialists & a living population (the human layer)

Villagers are **not interchangeable**.

- Skill **levels up with use**: a farmer who farms for years becomes a master
  farmer (e.g. +50–100% output). A fresh recruit is mediocre.
- **Knowledge is mortal**: a master smith killed in a raid takes his
  productivity to the grave. You can train a replacement, but it costs *years*.
- Buildings you've invested in (staffed with veterans) become
  **irreplaceable** — losing the building hurts; losing the *people* hurts
  more.
- Morale becomes **personal**: a villager who's been starved, or seen their
  home burned, works worse and may flee.

**Consequences to test:** does skill progression create a "too big to lose"
brittleness that's fun (high-stakes) or miserable (one bad raid ruins a
2-hour game)? Rate of skill gain vs. training cost. Should there be a
skill *floor* from apprenticeship (masters train juniors) to soften death
spirals?

### Pillar C — Pressure & consequence (the map fights back)

Difficulty **rides the player's own success**, and boldness is rewarded.

- Raiders **scale with wealth AND military**, and target **intelligently**:
  weakest-HP buildings, supply chokepoints, the richest granary — not random.
- **Winter bites harder the bigger you are** (more mouths, more upkeep, thinner
  margins) unless you've prepared (granaries, docks that fish through winter).
- **Risk = reward geographically**: the ore you need is in the mountains, which
  is also where raiders come from and where your border is hardest to defend.
  Expanding toward what you need is expanding toward danger.
- Named **warlord sieges** as punctuation: telegraphed a season ahead, they
  bring enough force to *require* you to have prepared. A dread event.

**Consequences to test:** the shape of the difficulty curve — does it stay
tense without becoming unwinnable? Does intelligent targeting feel fair
(counterable) or cheap (unavoidable)? What's the right raid-frequency vs.
recovery-time ratio so you're pressured but not ground down?

## 5. Unit taxonomy (the "different kinds of units" you asked for)

**Villager jobs** (a villager can retrain, slowly):
| Job | Does | Skill effect | Notes |
|---|---|---|---|
| Farmer/Producer | staffs a production building | +output | skill per building-type |
| Hauler | moves goods building→building | +carry speed/capacity | the logistics backbone |
| Builder | constructs & repairs | +build/repair speed | maintenance competes here |
| Soldier | fights raiders | +combat | eats more food (Chandra's food-not-gold sink) |
| Idle | none (expansion buffer) | skills decay slowly | your slack capacity |

**Military units** (raiders + your soldiers):
| Unit | HP | Role | Threat model |
|---|---|---|---|
| Soldier (yours) | med | intercept raiders | food upkeep; skill-based combat |
| Raider (grunt) | low | loot & burn | scales in number with prosperity |
| Raider (breaker) | med | targets walls/chokepoints | forces layered defense |
| Warlord (boss) | high | siege event | telegraphed; requires preparation |

## 6. What could go wrong (risks this design must clear)

1. **Micromanagement hell.** Haulers and repairs must be *automatic by
   default* with optional priority hints. If the player is hand-assigning
   haulers, we've failed. — *Sim tests hauler auto-assignment policies.*
2. **Death spirals.** HP-output coupling + supply cuts + skill loss can
   compound into unrecoverable collapse from one bad raid. Needs floors,
   telegraphing, and comeback mechanics. — *Sim measures recovery time after
   shocks; flags runs that never recover.*
3. **Legibility.** If output depends on HP × skill × supply × morale, the
   player can't tell *why* their smelter is underperforming. Every factor must
   be inspectable and few enough to reason about. — *Design constraint, but sim
   quantifies each factor's weight so we keep only the ones that matter.*
4. **Snowball just relocated.** Master villagers + more buildings could make a
   big kingdom *more* efficient per capita — re-snowballing. — *Sim's whole
   point: does the pressure curve actually catch the growth curve now?*

## 7. What we decide from the simulator

Concrete numbers the Monte Carlo run should give us before we code:
- Skill gain rate & cap; training cost. (Pillar B brittleness knob.)
- Maintenance cost (workers × materials × time) vs. decay rate. (§2 core knob.)
- Hauler:building ratio; supply-cut cascade depth. (Pillar A.)
- Raid frequency, scaling exponent, targeting policy. (Pillar C.)
- **The headline:** across 500+ randomized runs with events, does net
  prosperity stay *bounded and tense* (good) or run away / collapse (bad)?
  What fraction of runs are "interesting" (survive but never trivialize)?

---

*Open questions for Fable in `design/QUESTIONS.md`.*
