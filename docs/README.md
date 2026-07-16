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
| [`CHATLOG.md`](CHATLOG.md) | Full annotated transcript of all working sessions (16 turns: build → redesign → review → implementation → playtest-driven combat/pop rework → merge/ports/21-idea run). |
| [`DECISIONS.md`](DECISIONS.md) | Every choice made, with rationale, so nothing gets relitigated. |
| [`CHANGELOG.md`](CHANGELOG.md) | Commit-level record of what shipped, per session. |
| [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) | Consolidated register of unresolved questions — **start here to pick up the work** (Session 4 section). |
| [`SIMULATIONS.md`](SIMULATIONS.md) | Register of every simulation campaign — question, command, numbers (~8,300 Monte Carlo runs + harness trials + 3 playtests). |
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

The Vite + Phaser game, now carrying the FULL redesign (everything through
Session 4 is on `main`). ⚠ The live deploy at
https://kingdom-sim-fawn.vercel.app still runs the OLD pre-redesign build —
redeploy is manual (`npx vercel --prod`) and pending Chandra's playtest of
current `main`.

---

## The one-paragraph state of things (2026-07-16)

**Everything is merged and on `main`.** The arc: `model/` proved the launch
economy snowballed → HP-as-output + mortal villagers were designed and
`sim2/`-validated (~8,300 Monte Carlo runs to date) → `src/` implements it all.
As of Session 4 the game has: villagers as **bodies on the map** (walk to work,
panic near raiders, flee to the keep; one death rule — caught in the open);
watchman-staffed towers; walls that breach; a Keep whose fall is a recoverable
dark age; **probabilistic line combat** (crits, veterans, home-ground/tower
cover, coverage-spread targeting, rout at 40% losses, hold/sally stance);
**mercenaries** priced by an escalating market; **tribute/Danegeld** with an
appetite spiral (the sim-validated gold sink); **militia** (re-muster free);
food **spoilage with bread as the accumulating reserve**; masters that take
years to make; named raiders, per-raid reckonings, and `kingdom.summary()`
telemetry. Three human playtests drove the tuning; the Duncastle log (yr 19)
says the war layer *works* and the economy is solved-then-hoarded — so the one
big open thing is **giving the late game something to want** (wonders / a
rival / costly expansion; see `OPEN-QUESTIONS.md` Session 4). Known caveat:
sim2 campaigns 1–8 ran warlord-free (cadence bug, fixed 2026-07-16).
