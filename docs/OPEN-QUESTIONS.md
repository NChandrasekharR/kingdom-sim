# Open questions register

Every unresolved question and pending decision across the project, consolidated
in one place. Grouped by area. Status key:
**OPEN** (needs a decision) · **EXPERIMENT** (answerable by running the sim) ·
**DEFERRED** (parked for later) · **RESOLVED** (settled — moved to `DECISIONS.md`).

Last updated: 2026-08-18 (Session 8 — see the pickup section at the bottom).

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
| D4 | **Merchant buy-cap** to stop infinite liquidation. | **RESOLVED / SHIPPED 2026-08-17** | `TRADE_CAP` in `src/config.js`: per-visit BUY cap `20 + 15/dock + 5/market`, selling uncapped. Scaled by commerce so a harbor imports through depletion and a landlocked realm cannot. Threshold set from Campaign 14's rescue data (20-wood units broke both deadlocked seeds; structural imports cost only 12–25% of late-game income, so a cap was necessary rather than optional). Rationale in DECISIONS.md Session 8; numbers in SIMULATIONS.md Campaigns 13–14. |

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

---

## Session 5 (2026-07-16→19) — what shipped and what's open now

*(Pickup point for the next chat. Six commits on `main`,
`e639935`→`e4293c2`. Full record: `CHANGELOG.md` Session 5, `CHATLOG.md`
Turns 17–20 + Fable's assessment, `DECISIONS.md` Session 5,
`design/ENDGAME.md`. Playtests run on the STABLE server —
`npx vite preview --port 4173` or the `kingdom-sim-stable` launch config —
never the live dev server.)*

**SHIPPED:** the endgame design session (`design/ENDGAME.md`); the
counter-raid built ON-MAP — the warlord's camp with named folk, his ledger
hoard, the march, and the punish/massacre moral choice (survivor → avenger,
marked men, mercy-settlers); watchtower rework (real targets, watchman
inside under a flag, silent rubble when battered); Refuse-the-Danegeld;
raids-from-camp (nest at first raid, warlord claims later, 70/30 origin
split, staged massing with visible bodies, the warlord's shadow); finite
forests (thinning render, forest→plains, 4–6 yr camp sites); territory from
buildings + roads + enclave auto-fold; drag-painted roads/walls; placement
rings; condition-scaled demolish refunds; bridges over water.

**OPEN — the big three, in order:**
1. **THE LONG PLAYTEST.** No human has played Sessions 3–5 end-to-end, the
   massacre has never been chosen by a person, and six commits of tuning
   are provisional: raid pacing with long camp marches, tower target value
   (2.5), depletion rates (~90/tile, radius 2.2), influence values, bridge
   cost. Play a full reign on :4173, log against the reckoning telemetry.
   Gates the Vercel redeploy (now FIVE sessions stale).
2. **The summit design session: Great Works ladder + Crown of Ages + the
   Last Muster (army-as-victory) + rally banner.** The pull and the climax
   designed as ONE endgame. `design/ENDGAME.md` §4 + `DECISIONS.md`
   Session 5 (army deferral) hold the agreed starting shapes.
3. **Depletion follow-through:** the promised sim2 campaign (repair
   treadmill vs finite wood; do seeds 8/37 get rescued by trade or killed?),
   ore depletion (later), and whether trade can bear structural imports
   (D4 buy-cap resurfaces here).

**WATCH in the playtest (may not be problems):**
- Camp waves arrive later in the alarm cycle (long marches) — dreadful or
  draggy? Knobs: `CAMP.massingAtTicks`/`stirAtTicks`, `RAID.minGapTicks`.
- Raiders now hunt towers — does the frontier feel defensible, or does the
  banner-post need building?
- Does depletion read as story (receding wood-line) or chore (replopping)?
- Does the border-follows-roads change make Dominion too easy? (Territory
  ~314–393 in headless vs ~301 before — mild so far.)

---

## Session 7 (2026-07-20) — what shipped and what's open now

*(Pickup point. Sessions 6-7 are on `main` and DEPLOYED — the Vercel deploy
now runs current main including the onboarding and the og-card. Full record:
`CHANGELOG.md` Sessions 7, `CHATLOG.md` Turns 21-23, `DECISIONS.md` Session 7,
`design/ONBOARDING.md` status block.)*

**SHIPPED:** the Steward's Counsel (`src/core/tutorial.js` — 8-step diegetic
ladder + JIT one-shot counsel, steward card, `'counsel'` chronicle kind,
+100-tick first-raid grace, dismiss/auto-skip/never-twice rules, pre-tutorial
save migration); `public/og-card.png` + `og:`/`twitter:` meta on both pages
(links unfurl); a Remotion still per launch-thread post plus the
`still-entropy`/`still-taste` cards in Chandra's own thread voice
(`teaser/src/Stills.jsx`, asset map in `teaser/TWEET.md`).

**OPEN:**
1. **The onboarding kill gate** (ONBOARDING.md): hand the game to one person
   who has never seen it, ladder on. Survive the first raid + say aloud what
   bread is for → it ships for real. Dismissed inside 60s → make it quieter.
2. **Steward Q4**: drop speed to 1× when the first raid warning fires?
   Touches player controls — Chandra's call, one line if yes.
3. **The long playtest** still pending (unchanged from Session 5) — one full
   human reign on `:4173`; massacre still never chosen by a human.
4. **Great Works summit** (unchanged): ladder + Crown of Ages + Last Muster +
   rally banner as one endgame design session.
5. **Depletion sim follow-through** (unchanged): repair treadmill vs finite
   wood, seeds 8/37, ore later.

---

## Session 8 (2026-08-17→18) — what shipped and what's open now

*(Pickup point for the next chat. Full record: `CHANGELOG.md` Session 8,
`DECISIONS.md` Session 8, `SIMULATIONS.md` Campaigns 13–14, `design/REAVING.md`.
The deploy is still the Session-7 build — none of this session's work is live.)*

**SHIPPED:** loot recovery (typed `lootBag`, escaped-raider guard, "goods won
back from the slain", `stats.lootRecovered`); the warlord's sworn men + the
camp spoils floor; finite stone and ore (`DEPOSITS`, HILLS→PLAINS, the
ORE→HILLS cascade, per-tile reserves, env-overridable); the depletion polish
batch (wood retune to 250, the Potosí, the merchant buy cap, auto-demolish);
the preemptive strike / massing fix (`7b551a9` — **built and asserted, not yet
merged to `main`**, in worktree `agent-af96065743f5723c4`);
`design/REAVING.md` (design only).

**CLOSED this session:**
- **D4 RESOLVED** — the merchant buy cap shipped, commerce-scaled. See the D
  table above and `DECISIONS.md` Session 8 for the reasoning.
- **Depletion sim follow-through DONE** — both promised campaigns ran. The
  wood treadmill and the seeds-8/37 rescue question, and the stone/ore deposit
  sweep, are answered in `SIMULATIONS.md` Campaign 14 (the polish batch's own
  measurements are Campaign 13). Headline: the treadmill is a **cliff**, not a
  slope, and its endstate is a rich slum.

**NEW candidates from this session's design talk** (none decided — each needs a
session or a call):
- **(a) The TRUCE MARKET — trade with the camp.** The third rider's answer:
  the warlord spends his hoard at your market, so his garrison shrinks as the
  hoard drains, and raids pause while the trade holds. Breaks on betrayal —
  by either side. Wants designing **next to REAVING's infamy**, so the trader
  and the reaver identities price consistently against each other rather than
  being two unrelated systems. Historical precedent to steal from: the Ming
  horse-market, where trade privileges were the pressure valve on raiding.
- **(b) The SMALL RAID — a middle verb.** Between "do nothing" and the all-in
  march there is nothing. A handful of men slip out and steal from the
  hoard-ledger, risking capture rather than annihilation. Couples directly
  with REAVING's named prisoners: capture is the interesting failure, and it
  gives the ransom layer something to hold.
- **(c) REAVING.md's nine open questions await Chandra** (§11). Especially
  **Q1** (does it ship at all, and does it ship before the Great Works
  summit — a sequencing call), **Q2** (is slavery in this game, at all — a
  values call, explicitly his), **Q4** (the guard ratio: 1:5? the single most
  load-bearing constant in the doc), and **Q9** (should thralls be sellable to
  the merchant — the one place the doc admits it flinched).
- **(d) The wood-campaign instrumentation + `TRADE=1` rescue rule are
  UNMERGED** — worktree `agent-a7a5292f7f24eb425` (`5ff626c`, `8b50f30`,
  `87d8d72`). They produced Campaign 14A's numbers but never landed on `main`.
  Merge, cherry-pick, or discard: pending. Merging costs nothing at runtime
  (the rescue rule is env-gated) and keeps the campaign reproducible.

**STANDING (carried, unchanged in substance):**
1. **THE LONG PLAYTEST** — now **more** valuable than it has ever been. Two
   sessions of combat, economy, and depletion change have landed with no human
   ever having played them: the sworn-men boss fight, the preemptive strike,
   finite stone and ore, the wood retune, auto-demolish. All of it is
   sim-validated and none of it is play-validated. The massacre still has
   never been chosen by a person.
2. **The onboarding kill gate** (ONBOARDING.md) — one person who has never
   seen the game, ladder on.
3. **The Great Works summit** — ladder + Crown of Ages + Last Muster + rally
   banner as one endgame design session. **Pushed by Chandra this session.**
4. **Steward Q4** — drop to 1× speed at the first raid warning? **Pushed by
   Chandra this session.**
5. **Typed camp hoard** — should the warlord's ledger hold typed goods the way
   raiders' bags now do, rather than an undifferentiated `plunder` number? A
   small call. **Pushed by Chandra this session.**
