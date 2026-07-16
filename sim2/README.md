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

## Player tiers (B1)
The scripted player has three competence tiers, set by `player.iq` (sweepable:
`--sweep player.iq=0,1,2`):
- **0 — passive** (default): the original bot. Reactive repair below 60% HP,
  fixed standing army, no raid awareness. Reproduces all pre-B1 numbers exactly.
- **1 — competent**: reads the raid telegraph (`raid.timer`), surges repair
  before and after raids (never during — mid-raid repair re-exposes sacked
  buildings and gets workers killed), keeps a threat-scaled standing army
  capped by population depth, builds towers to meet the expected wave before
  comfort buildings, stages one lumber camp + one quarry before filling extras,
  and holds a wood/stone reserve sized to the current repair backlog.
- **2 — sharp**: competent plus combat micro (higher soldier damage, lower
  losses) and a high peacetime HP floor that denies `weakHp` raid targeting.

Tuning philosophy: difficulty numbers should be set against **iq 1**, with iq 0
as the floor (a beginner must survive) and iq 2 as the ceiling (an optimizer
must not trivialize).

**Tribute stance** (`player.tributePolicy`, sweepable `never,auto,always`):
how the bot answers a warlord's Danegeld demand. `auto` (default) pays only
when the wave outmatches the shield; `always` stress-tests the appetite spiral;
`never` always fights. iq 0 never pays regardless. See Campaign 9.

## ⚠ Warlord-cadence bug (fixed 2026-07-16)

Every campaign before 2026-07-16 ran with **zero cadence-warlords** — the
cadence math read `ticksPerYear` off the wrong params block (NaN). Gauntlet
still pressured via its scripted events, but treat all pre-fix numbers as
lower-pressure baselines; the fix alone moved baseline iq1 from 98% too-easy
to 50% interesting. `skill.masterAt` (default 0.8, was a hardcoded 0.6) and the
`breadMed`/`mastersFracMed`/`goldMed`/`tributeMed` monte columns also landed
that day.

## Note
This is a DESIGN TOOL, not game code. It shares no modules with `../src/`. It's
abstract where the game is spatial (e.g. logistics uses a "town core" abstraction
instead of real coordinates). Numbers that prove out here become the starting
point for the real implementation, not a drop-in.
