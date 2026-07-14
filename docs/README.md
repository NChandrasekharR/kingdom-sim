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
| [`CHATLOG.md`](CHATLOG.md) | Full annotated transcript of the working session (8 turns). |
| [`DECISIONS.md`](DECISIONS.md) | Every choice made, with rationale, so nothing gets relitigated. |
| [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) | Consolidated register of all unresolved questions & pending experiments, with status. |
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

## The one-paragraph state of things (2026-07-14)

**The redesign foundation is implemented in the game.** The path: `model/`
proved the old economy snowballed; Chandra proposed HP-as-output + villager
units; `sim2/` (a purpose-built Monte Carlo simulator, 4,000+ runs) validated
the core, found and fixed three failure modes, then — via tiered player
policies (B1) — exposed and fixed three degenerate strategies (towers-dominate-
soldiers, mid-raid-repair grinder, eternal sieges) and re-validated the
difficulty dial at `raiderDmgPerTick=4.5` (0% collapse, 95–100% interesting at
every tier). Fable reviewed and Chandra ratified all six design questions
(2026-07-12, see `DECISIONS.md`). `src/` now has: named villager agents with
mortal skills and guild memory, HP-coupled output (floor 0.4), builder
maintenance competing for labor, sack-based raids with rubber-band mercy and
warlords, soldiers as villagers (iron once, eat 3×), and save migration.
Headless 12-year run: tense equilibrium instead of snowball. **Next:
playtesting** (first knobs: `RAID.lootDmg`, `maxRaidTicks`, skill-gain rate),
then Pillar C proper, then a gold sink. The live Vercel deploy still runs the
old build — redeploy after playtest.
