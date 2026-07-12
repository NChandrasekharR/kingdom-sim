# Open questions register

Every unresolved question and pending decision across the project, consolidated
in one place. Grouped by area. Status key:
**OPEN** (needs a decision) · **EXPERIMENT** (answerable by running the sim) ·
**DEFERRED** (parked for later) · **RESOLVED** (settled — moved to `DECISIONS.md`).

Last updated: 2026-07-11.

---

## A. Redesign direction (for Fable's review)

These are design calls, not computations. Source: `design/QUESTIONS.md`.

| # | Question | Status | Notes / lean |
|---|----------|--------|--------------|
| A1 | **How punishing should the game be?** Cozy-with-scares vs. survival that ends runs. This one answer drives every difficulty number. | OPEN | Lean: tense-but-fair, ~60% "interesting," soft failure. Chandra + Fable's call on feel. |
| A2 | **Should collapse be recoverable?** Soft failure (refugees return, lord bails you out, keep unrazable) vs. permanent run-end. | OPEN | Sim's death spirals argue for soft. Ties to A4. |
| A3 | **How much should the player micromanage?** Priority sliders? Per-building worker locks? Or influence only via what/where you build? | OPEN | Model auto-assigns with policy hints. Risk: micro = tedium, not depth. |
| A4 | **How mortal should specialist knowledge be?** Master death = gut-punch-you-recover-from vs. genuine catastrophe. | OPEN | Knowledge-floor mechanic exists; dial is how high. Ties to A2. |
| A5 | **Which pillar to build first?** | OPEN | Lean: Pressure (C) → Specialists (B) → Logistics (A). |
| A6 | **Is HP-as-output the right core, or too punishing a coupling?** Full coupling vs. gentler (HP caps output but floor stays high) vs. only some building types coupled. | OPEN | Sim says it works with `outputFloor=0.4`. It's also the mechanism behind every death spiral. |

## B. Simulator experiments (answerable by running sim2)

Source: `design/FINDINGS.md` "recommended next experiments." Each is a small
`params.mjs`/`world.mjs` change + a `monte.mjs` run (~30s).

| # | Experiment | Status | Why it matters |
|---|-----------|--------|----------------|
| B1 | **Smarter player policy.** Does a competent player turn 52% collapse into ~20%? | EXPERIMENT — **CRITICAL PATH** | We're currently tuning against a passive bot. Until we know how much a real player closes the gap, every difficulty number is suspect. |
| B2 | **Rubber-band raid tuning.** Find the setting that yields >60% interesting, <15% collapse, <15% too-easy. | EXPERIMENT (partly done) | Implemented; currently over-soft (too-easy). Needs re-tuning, ideally after B1. |
| B3 | **Knowledge-floor strength sweep.** How high must the guild floor be to stop specialist death spirals without making masters meaningless? | EXPERIMENT (partly done) | Floor added (0.3); not yet swept for the sweet spot. |
| B4 | **Size-gated pressure sweep.** Confirm warlords/disasters gated behind pop≥N keep gauntlet survivable without trivializing. | EXPERIMENT (partly done) | Gating added; confirmed gauntlet no longer collapses. Not yet tuned for challenge. |
| B5 | **Multi-front raid modeling.** The abstract sim doesn't yet model spatial fronts (the `fronts` param is defined but unused in the size calc). | EXPERIMENT | Pillar C wants positioning to matter; the abstract model can't test it fully. May need coordinates. |
| B6 | **Winter-fuel & bigger-colder knobs.** `winter.fuelWoodPerHousePerTick` and `biggerColderExpo` are defined but default to 0 (off). | EXPERIMENT | Untested Pillar C levers — could be the "make winter bite" mechanic. |

## C. Simulator fidelity gaps (known limitations)

| # | Gap | Status | Impact |
|---|-----|--------|--------|
| C1 | **Scripted player is passive/dumb.** No defense positioning, reactive-only repair, can't pre-empt raids. | OPEN (= B1) | Collapse numbers pessimistic; too-easy numbers optimistic. The headline caveat. |
| C2 | **Sim is abstract where the game is spatial.** Logistics uses a "town core" abstraction, not real coordinates; raids have no map geometry. | DEFERRED | Fine for economy/pressure balance; blocks Pillar A depth (chokepoints) and multi-front raids (B5). |
| C3 | **`verdict()` "interesting" thresholds are hand-picked** (5–55% crisis, 60k prosperity ceiling). | OPEN | The definition of "interesting" is itself a design choice; revisit once A1 is answered. |

## D. Economy / balance leftovers (from the pre-redesign model)

These were surfaced in Turn 6 but superseded by the redesign. Keep for reference
in case the redesign doesn't ship and we patch the current game instead.

| # | Item | Status | Notes |
|---|------|--------|-------|
| D1 | **Bakery rework** (0.25→0.4 bread output). | DEFERRED (in sim2 defaults) | The current shipped game still has the +0.02-net bakery trap. |
| D2 | **Soldier food upkeep** (3× a citizen, not gold). | DEFERRED (in sim2 defaults) | Chandra-endorsed sink; not in the shipped game. |
| D3 | **Building upkeep in materials.** | DEFERRED (superseded by HP-as-output) | The redesign's HP decay replaces this more elegantly. |
| D4 | **Merchant buy-cap** to stop infinite liquidation. | DEFERRED (in sim2 player policy) | Not in the shipped game. |

## E. Product / housekeeping

| # | Item | Status | Notes |
|---|------|--------|-------|
| E1 | **The shipped game still snowballs.** None of the redesign or sinks are in `src/`. | OPEN | Deliberate — awaiting the design decision before touching game code. |
| E2 | **Save-format migration.** The redesign changes state shape (villager agents); existing localStorage saves will need migration or a reset. | DEFERRED | Address at implementation time. `loadGame()` already tolerates missing fields. |
| E3 | **Vercel auto-deploy.** Currently manual `npx vercel --prod`. GitHub integration would auto-deploy on push. | DEFERRED | Offered in Turn 5; Chandra chose manual for now. |

---

## The three that matter most right now

1. **A1 — how punishing?** Everything downstream depends on it.
2. **A5 — which pillar first?** Determines what gets built.
3. **B1 — smarter test-player.** The technical prerequisite to trusting any
   difficulty number.

Everything else can wait on these three.
