# sim2 — agent-based Monte Carlo for the redesign

A headless simulator that models the **proposed** kingdom mechanics (HP-as-output,
villager agents, logistics, specialists, ramping pressure) independently of the
game code, so we can test the design before building it. Pure Node, no deps.

## Why it exists
The current game's economy was proven to snowball (`../model/`). The redesign
(`../design/REDESIGN.md`) is a big change — villager units, HP-coupled output,
supply lines. This lets us find the failure modes and the survivable parameter
region *before* writing game code. It already caught three design flaws and
found the tuning region (`../design/FINDINGS.md`).

## Files
- `params.mjs` — every tunable knob, with comments. The thing sweeps vary.
- `world.mjs` — the agent model: villagers with jobs/skills/needs, buildings
  with HP+stockpiles, logistics, maintenance, raids. One `step()` = one tick.
- `events.mjs` — injectable shocks (drought, plague, harsh winter, master
  arrives, supply cut).
- `scenarios/*.mjs` — named setups: `baseline`, `gauntlet` (hard),
  `gauntlet-ramped` (hard but late), `specialists` (Pillar B stress).
- `run.mjs` — trace ONE run with yearly output + a verdict.
- `monte.mjs` — run MANY seeds, optionally sweeping a parameter grid; aggregates
  the "interestingness" distribution.
- `out/` — JSON/CSV results.

## Usage
```bash
# trace a single run (yearly table + verdict)
node sim2/run.mjs baseline
node sim2/run.mjs gauntlet 12345 --csv        # + write out/gauntlet.csv

# Monte Carlo: 120 seeds
node sim2/monte.mjs baseline --runs 120

# sweep a parameter grid (cartesian product), find the best region
node sim2/monte.mjs baseline --runs 30 \
  --sweep hp.outputFloor=0.15,0.4,0.6 hp.repairPerBuilderTick=0.6,1.5 raid.raiderDmgPerTick=1.2,2.5
```

## The "interestingness" verdict
Each run is labelled (see `run.mjs verdict()`):
- **INTERESTING** — survived, spent 5-55% of ticks in crisis, didn't trivialize.
- **TOO-EASY** — snowballed, barely any crisis.
- **COLLAPSE** — population hit zero.
- **DEATH-SPIRAL** — a shock it never recovered from.
- **TOO-PUNISHING** — survived but in crisis >55% of the time.
- **RUNAWAY** — prosperity blew past the trivialization ceiling.

The goal of tuning is to maximize INTERESTING while keeping COLLAPSE and
TOO-EASY both low.

## Known limitation
The scripted "player" is deliberately simple and passive. It does NOT position
defenses, pre-empt raids, or micromanage repairs. Difficulty numbers tuned
against it are therefore *pessimistic on collapse* and *optimistic on too-easy*.
A smarter player policy is the top-priority next experiment (see FINDINGS).

## Note
This is a DESIGN TOOL, not game code. It shares no modules with `../src/`. It's
abstract where the game is spatial (e.g. logistics uses a "town core" abstraction
instead of real coordinates). Numbers that prove out here become the starting
point for the real implementation, not a drop-in.
