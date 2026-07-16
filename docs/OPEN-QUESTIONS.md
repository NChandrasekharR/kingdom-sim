# Open questions register

Every unresolved question and pending decision across the project, consolidated
in one place. Grouped by area. Status key:
**OPEN** (needs a decision) · **EXPERIMENT** (answerable by running the sim) ·
**DEFERRED** (parked for later) · **RESOLVED** (settled — moved to `DECISIONS.md`).

Last updated: 2026-07-12.

---

## A. Redesign direction (for Fable's review)

These are design calls, not computations. Source: `design/QUESTIONS.md`.

**ALL RESOLVED 2026-07-12** — Fable reviewed, Chandra ratified. Full answers in
`DECISIONS.md` ("Redesign direction — Fable's review").

| # | Question | Status | Resolution |
|---|----------|--------|--------------|
| A1 | **How punishing should the game be?** | RESOLVED | Tense-but-fair, ~60% "interesting," soft failure. |
| A2 | **Should collapse be recoverable?** | RESOLVED | Recoverable but expensive — a "dark age," not a reset. |
| A3 | **How much should the player micromanage?** | RESOLVED | Fully automatic; ~3 global policy dials + per-building pin. |
| A4 | **How mortal should specialist knowledge be?** | RESOLVED | Gut-punch, not catastrophe. Guild floor ~0.3–0.4. |
| A5 | **Which pillar to build first?** | RESOLVED | Foundation (villagers + HP-as-output) first, then C → B → A. |
| A6 | **Is HP-as-output the right core?** | RESOLVED | Yes — full coupling with `outputFloor=0.4` as the softener. |

## B. Simulator experiments (answerable by running sim2)

Source: `design/FINDINGS.md` "recommended next experiments." Each is a small
`params.mjs`/`world.mjs` change + a `monte.mjs` run (~30s).

| # | Experiment | Status | Why it matters |
|---|-----------|--------|----------------|
| B1 | **Smarter player policy.** Does a competent player turn 52% collapse into ~20%? | **RESOLVED 2026-07-13** | Built: `player.iq` 0/1/2 tiers (see `sim2/README.md`). Answer: competence pushes toward *too-easy*, not away from collapse — the caveat was backwards. See FINDINGS Findings 6–8. |
| B2 | **Rubber-band raid tuning.** Find the setting that yields >60% interesting, <15% collapse, <15% too-easy. | **RESOLVED 2026-07-13** | `raiderDmgPerTick=2.5` meets the target for every tier in baseline, gauntlet, and specialists (≤3% collapse, 75–100% interesting). Not yet promoted to `params.mjs` default. |
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
| D1 | **Bakery rework** (0.25→0.4 bread output). | **SHIPPED 2026-07-14** | In `src/config.js`. |
| D2 | **Soldier food upkeep** (3× a citizen, not gold). | **SHIPPED 2026-07-14** | Soldiers cost 5 iron once, then eat 3×. Recruit pulls a real villager. |
| D3 | **Building upkeep in materials.** | SUPERSEDED | HP decay + repair materials (shipped) replaces this. |
| D4 | **Merchant buy-cap** to stop infinite liquidation. | DEFERRED | Trade is manual in the game; revisit if players grind the merchant. |

## E. Product / housekeeping

| # | Item | Status | Notes |
|---|------|--------|-------|
| E1 | **The shipped game still snowballs.** | **RESOLVED 2026-07-14** | The foundation is implemented in `src/`: villager agents, HP-as-output, maintenance, sack-based raids, rubber-band + warlords. Headless 12-year run: pop equilibrium ~66 (was 186 runaway). NOTE: the live Vercel deploy is still the old build — redeploy pending playtest. |
| E2 | **Save-format migration.** | **RESOLVED 2026-07-14** | `loadGame()` synthesizes villagers from the old integer pop and gives old soldiers bodies. Verified round-trip. |
| E3 | **Vercel auto-deploy.** Currently manual `npx vercel --prod`. GitHub integration would auto-deploy on push. | DEFERRED | Offered in Turn 5; Chandra chose manual for now. |

---

## Session 3 (2026-07-15) — what shipped and what's open now

*(This is the pickup point for the next chat. Branch `phase1-defense-and-keep`,
not merged to `main`, Vercel not redeployed. Full record: `CHANGELOG.md`,
`CHATLOG.md` Turns 12-13, `DECISIONS.md` Session 3, `SIMULATIONS.md` Campaigns
6-8.)*

**SHIPPED this session:** walls breach (not shatter); click-to-inspect units;
Keep auto-defends + besieged alarm + recoverable dark-age; sim2 spatial-hunt
proxy (validated, NOT ported to game); `kingdom.summary()` telemetry;
probabilistic combat (crits/veterans/force-ratio/home-ground/tower-cover);
soldiers hold territory; veterans survive attrition; mercenaries (gold-upkeep
sink, purple, own card); **population booms on food surplus** (fixed the stall).

**OPEN — the recommended next direction (Claude's honest take, ratified as a
"recorded direction, not yet chosen"):** the late game is *hollow* — economy
solved by ~yr5, then you hoard. The biggest lever for making it INTERESTING is
**give the late game something to want**: an ambition/prestige sink (wonders/
monuments that cost huge resources, a rival kingdom to contend with, costly
expansion). Not more combat tuning — combat is now the strong layer.

**OPEN — concrete leftovers:**
1. **Late-game "something to want"** (above) — the highest-value new work.
2. **Walls don't hold the perimeter** — 38 breaches in a 22-yr playtest; raiders
   pour through to soldiers. Make walls tougher / breaches rarer / raiders path
   around, so towers thin them OUTSIDE the line.
3. **Gold still pools** (~24k+; mercenary upkeep helps but a dedicated sink may
   still be wanted). Long-standing.
4. **Bread still does nothing in the game** — spoilage/bread-as-reserve is
   sim-validated (Campaign 7, balance-neutral) but NOT ported to `src/`.
   You had 12k food and 0 bread.
5. **Phase 3 — spatial villager layer** (villagers as bodies, eject-and-hunt
   combat ported from the validated 2a proxy, watchman towers) — the big build,
   de-risked by Campaign 6 but not started.
6. **Raids are big** (avg 31, peak 40, three warlords in a long run) — a
   one-number `RAID` dial if they feel punishing rather than epic.

**Watch (may not be problems):** population is housing-gated again by design
(food fuels it) — intentional. The army ending a snapshot at 0 soldiers after
winning 11.5:1 and reigning 22 years may be *fine*, not a bug — don't chase it.
