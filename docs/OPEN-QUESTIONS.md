# Open questions register

Every unresolved question and pending decision across the project, consolidated
in one place. Grouped by area. Status key:
**OPEN** (needs a decision) · **EXPERIMENT** (answerable by running the sim) ·
**DEFERRED** (parked for later) · **RESOLVED** (settled — moved to `DECISIONS.md`).

Last updated: 2026-07-16 (Session 4 — see the pickup section at the bottom).

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

## Session 4 (2026-07-16) — what shipped and what's open now

*(This is the pickup point for the next chat. Everything is merged to `main`
(7 commits, `60bec47`→`a33b8d5`); the Vercel deploy is STILL the pre-Session-3
build. Full record: `CHANGELOG.md` Session 4, `CHATLOG.md` Turns 14-16,
`DECISIONS.md` Session 4, `SIMULATIONS.md` Campaigns 9-11 + Playtest 3.)*

**SHIPPED this session:** the Session-3 branch merged; food spoilage ported
(and then the **eat-order flip** — bread finally accumulates as the reserve,
moldy-chip indicator); the **Phase 3 spatial layer** ported (villager bodies,
eject-and-hunt with real pin/shelter checks, watchman towers); the legibility
batch (flee-ends-raid, named raiders + kill attribution, per-raid reckoning,
merchant toast, rally button, tabular numbers); **tribute/Danegeld**
(sim-validated gold sink with the appetite spiral) + the uncapped escalating
merc market; the **army-line rework** (spread targeting, merc first contact,
rout at 40%, hold/sally stance); **militia** (free re-muster); **masters made
precious** (gain halved, bar 0.8). Plus two bug finds: sim2's warlords NEVER
spawned before today (all prior campaigns were warlord-free — see the
SIMULATIONS caveat), and a null-guard crash in the new soldier targeting.

**Resolved from the Session-3 leftovers list:** #4 bread (ported + eat-order
fixed), #5 Phase 3 (ported), #3 gold *partially* (tribute + merc upkeep sink it
for weak/merc-reliant players — but Duncastle showed a strong player never pays:
the rich player's gold pool is really the want-problem below).

**OPEN — the next session (unchanged in direction, sharpened by Duncastle):**
1. **Late-game "something to want"** — Duncastle yr 19: two crowns, every
   threat handled, five hoards (gold 9k, iron 1.4k…), nothing to buy. Ambition/
   prestige sinks: wonders, a rival kingdom, costly expansion. A design session
   at the whiteboard with Chandra, not a patch. **The sim can't help here.**
2. **Walls don't hold the perimeter** — 38 breaches in Ravensholt (Duncastle
   had 0 — possibly fixed by the army/tower changes, possibly just a stronger
   player position; confirm in the next playtest before building anything).
3. **Raid size dial** — avg 27, max 40 (cap) in Duncastle; felt epic-not-unfair
   there, but it's the first knob if the next playtest disagrees. Tune against
   the per-raid reckoning telemetry now available.

**WATCH in the next playtest (may not be problems):**
- **Population booms harder post-eat-order-fix** (headless seed 42: 153→375;
  ex-rot becomes bread becomes people). Housing still gates; Chandra's
  no-pop-limiter decision stands — but see how it feels.
- **Masters fraction in real play** — sim says 0.40-0.54 (from 0.85+); if a
  human run still mints too many, the next knob is idle decay, not the bar.
- **Tribute in human hands** — does the pay/refuse choice ever tempt? If it
  never fires for a competent player, that's fine (drama for hard times), but
  check an early-game or post-dark-age moment.

**Deploy:** the live Vercel build predates ALL of Sessions 3-4 — redeploy
(`npx vercel --prod`) once Chandra has playtested the current main.
