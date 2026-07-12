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

## The one-paragraph state of things (2026-07-12)

The game is built, deployed, and playable, but its economy snowballs (proven in
`model/`). Chandra proposed a redesign centered on **HP-as-output** (buildings'
output scales with HP; raiders damage it; maintenance restores it), which forces
**discrete villager units** and opens three pillars (logistics, specialists,
pressure). A purpose-built **agent-based Monte Carlo simulator** (`sim2/`)
pressure-tested the design across 480+ runs: the core idea is sound, three
failure modes were found and fixed (collapse driven 100%→0%), leaving everything
*too easy* against the passive scripted bot. **Fable reviewed the redesign on
2026-07-12 and Chandra ratified all six §A answers** (see `DECISIONS.md`):
tense-but-fair with soft failure, expensive-but-recoverable collapse, automatic
labor with few dials, high knowledge floor, foundation-then-C→B→A build order,
HP-as-output confirmed as the spine. **Current work: B1 — tiered smarter player
policies in sim2**, then re-tune the difficulty dial (B2), then implement the
foundation in `src/`.
