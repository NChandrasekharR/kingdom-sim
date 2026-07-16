# kingdom-sim documentation

The complete written record of the project: the conversation, the decisions, the
open questions, and pointers to the design docs and models.

## Start here

- **New to the project?** Read [`CHATLOG.md`](CHATLOG.md) — the full session
  transcript from brief to redesign.
- **Reviewing the redesign (Fable)?** Read [`../design/REDESIGN.md`](../design/REDESIGN.md)
  then [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) section A.
- **Picking up the work?** Read [`DECISIONS.md`](DECISIONS.md) (what's settled)
  and [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) (what's not).

## This folder (`docs/`) — the session record

| File | What it is |
|------|-----------|
| [`CHATLOG.md`](CHATLOG.md) | Full annotated transcript of all working sessions (13 turns: build → redesign → review → implementation → playtest-driven combat/pop rework). |
| [`DECISIONS.md`](DECISIONS.md) | Every choice made, with rationale, so nothing gets relitigated. |
| [`CHANGELOG.md`](CHANGELOG.md) | Commit-level record of what shipped, per session. |
| [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) | Consolidated register of unresolved questions — **start here to pick up the work** (Session 3 section). |
| [`SIMULATIONS.md`](SIMULATIONS.md) | Register of every simulation campaign — question, command, numbers (~6,500 Monte Carlo runs + playtests). |
| `README.md` | This index. |

## The design docs (`../design/`) — forward-looking

| File | What it is |
|------|-----------|
| [`REDESIGN.md`](../design/REDESIGN.md) | The redesign plan: HP-as-output core, villager units, the three pillars, unit taxonomy, risks. **The document for Fable's review.** |
| [`FINDINGS.md`](../design/FINDINGS.md) | What the Monte Carlo simulator proved: 3 flaws found & fixed, collapse 100%→0%, now-too-easy, the smarter-player blocker. |
| [`QUESTIONS.md`](../design/QUESTIONS.md) | The 6 design decisions for Fable (also folded into `OPEN-QUESTIONS.md` §A). |

## The models & simulators

| Location | What it is |
|----------|-----------|
| [`../model/`](../model/) | The **economy diagnosis** (Turn 6): headless run of the *current* game + a 5-sheet Excel workbook (`kingdom-economy-model.xlsx`) proving the gold snowball and the bakery trap. |
| [`../sim2/`](../sim2/README.md) | The **redesign simulator** (Turn 7): agent-based Monte Carlo of the *proposed* mechanics. See its own `README.md`. Run: `node sim2/monte.mjs baseline --runs 120`. |

## The game itself (`../src/`)

The shipped Vite + Phaser game. **Unchanged by the redesign** — still has the
snowball. Live at https://kingdom-sim-fawn.vercel.app. See the repo root and
project memory for structure.

---

## The one-paragraph state of things (2026-07-15)

**The redesign foundation shipped (Sessions 1-2) and Session 3 layered on a
playtest-driven combat + population overhaul.** Foundation: `model/` proved the
old economy snowballed; HP-as-output + villager units were designed, `sim2/`
Monte-Carlo-validated them (~6,500 runs total), and `src/` implemented named
mortal villagers, HP-coupled output, sack-based raids, soldiers-as-villagers,
save migration. **Session 3** (branch `phase1-defense-and-keep`) added: walls
that breach instead of shatter; click-to-inspect units; a Keep that auto-defends
and, if sacked, triggers a recoverable "dark age" (not a game-over); a
sim-validated spatial-hunt proxy (raiders hunt villagers — NOT yet ported to the
game); `kingdom.summary()` run telemetry; a **probabilistic combat rework**
(crits, veterans who tilt the dice and season rookies, force-ratio, and real
spatial home-ground/tower-cover bonuses — so *where you fight decides the
battle*); soldiers that hold territory; **mercenaries** (hire on steep gold
upkeep, a gold sink); and a **population fix** so surplus food fuels a boom
(resources finally build a kingdom). Two human playtests drove the whole loop.
**Open (see `OPEN-QUESTIONS.md` Session 3):** the late game is hollow — the
biggest lever is *giving it something to want* (wonders / a rival / costly
expansion), plus perimeter walls (38 breaches), a gold sink, bread-in-game, and
Phase 3 (spatial villagers). The live Vercel deploy still runs the pre-Session-3
build; branch not merged to `main`.
