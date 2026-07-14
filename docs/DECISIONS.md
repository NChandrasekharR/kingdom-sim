# Decisions log

Choices already made, with rationale, so they don't get relitigated. Newest
first within each section. For still-open questions see `OPEN-QUESTIONS.md`.

---

## Product & scope

- **Real-time ticks, not turn-based** (Turn 1). Pause / 1× / 3× speed. Wanted the
  "ant farm you tend" feel.
- **Raids & defense included from v1** (Turn 1). Chose the version with stakes —
  bandits attack, you build walls/towers/garrison — over peaceful-solo or
  passive AI-border options.
- **Production chains, not simple stockpiles** (Turn 1). ~7 resources with
  refinement steps (ore→iron, food→bread), worker assignment, drifting trade
  prices.
- **Three Crowns victory** (Turn 4). Dominion (30% land) + Plenty (800 gold) +
  People (80 pop). Crowns are high-water marks (never lost once earned). Winning
  is optional — you can keep reigning. Chose this over no-win-condition to give
  the sandbox a spine.
- **Sandbox, no hard fail by default** (Turn 2). Survival pressure, not a lose
  screen — though the redesign reopens this (see OPEN-QUESTIONS A2).

## Technical

- **Stack: Vite + Phaser 3, vanilla JS** (Turn 1). Chose the batteries-included
  engine over plain-canvas or single-file, anticipating the game would grow.
- **All pixel art generated in code** (Turn 3). No asset packs — sprite matrices
  → canvas textures. Keeps the repo self-contained and the AoE-minimap look
  consistent.
- **State autosaves to localStorage** (`kingdom-sim-save-v1`), every ~100 ticks
  and on unload (Turn 3). `loadGame()` tolerates missing fields for
  forward-compat.
- **Deployed to Vercel, manual redeploy** (Turn 5). `npx vercel --prod` from the
  project dir. Live at https://kingdom-sim-fawn.vercel.app. Chose manual over
  GitHub-auto-deploy for now (revisit as OPEN-QUESTIONS E3).
- **Preview via the `kingdom-sim` entry in `tabby/.claude/launch.json`**, port
  5174 (Turn 3). `vite.config.js` reads `process.env.PORT`.

## Redesign direction — Fable's review, ratified by Chandra (2026-07-12)

The six questions in `design/QUESTIONS.md` / `OPEN-QUESTIONS.md` §A were
answered by Fable and ratified by Chandra:

- **A1 — Tense-but-fair, soft failure.** Target ~60% "interesting" runs. Follows
  from already-settled identity decisions ("ant farm you tend", sandbox-no-hard-fail,
  crowns as high-water marks). Late-game gauntlet-style pressure is where veterans
  find their pain — not run-ending permadeath.
- **A2 — Collapse is recoverable, but expensive.** Keep unrazable, refugees
  trickle back — but the fall costs real accumulated value (masters die, HP
  gutted, stockpiles looted). A "dark age" you climb out of, not a reset.
- **A3 — Automatic assignment with few, global levers.** ~3 policy dials
  (repair / build / produce priority) plus a per-building "prioritize" pin. No
  hand-assigning villagers, ever.
- **A4 — Knowledge mortality: gut-punch, not catastrophe.** Guild floor high
  (~0.3–0.4): a master's death costs years of output, never the craft itself.
- **A5 — Build order: foundation first, then C → B → A.** Villager agents +
  HP-as-output are "pillar zero" (everything sits on them), then Pressure,
  then Specialists, then Logistics as endgame texture.
- **A6 — HP-as-output confirmed as the spine.** Full coupling with
  `outputFloor=0.4` — the floor *is* the gentler coupling, already validated.

**Agreed next step:** B1 (tiered smarter player policies in sim2) before any
further tuning or game code — tuning against the passive bot just moves the
pendulum wall-to-wall (proven twice).

## Implementation decisions (Turns 9–10, 2026-07-13/14)

Choices made while building B1 and the `src/` foundation. Rationale documented
because several reverse first instincts.

- **Difficulty numbers are tuned against the SMART tiers' too-easy rate, not
  the passive bot's collapse rate.** B1's headline (Finding 7): rubber-banding
  keeps a sloppy player in the tense band automatically; it's the competent
  player who escapes into too-easy. The old caveat was exactly backwards.
- **The three degenerate strategies became game MECHANICS, not policy
  workarounds** (Finding 8). Force-ratio combat losses (outnumber raiders →
  nearly bloodless), sack deaths roll once per building per raid, raider
  satiation/withdrawal (`lootSatiation`, `maxRaidTicks`). If only the sim's
  player avoided these traps, every real player would still fall into them.
- **`raiderDmgPerTick`/`lootDmg` = 4.5** (was 1.2 in sim defaults, 3 in the old
  game). The anti-degenerate mechanics re-opened the whole dial range; 4.5 is
  the highest tested value with 0% collapse at every tier (iq0 100%
  interesting, iq1 95–98%, baseline + gauntlet, 2026-07-13 sweeps).
- **Soldiers are villagers under arms**, not purchased units. Recruit converts
  a real subject (5 iron once, eats 3×, skills scale damage, death removes the
  villager); a Dismiss button sends them back to the fields. Kills the
  gold-army loop and makes the army cost land.
- **Sacked ≠ destroyed.** Raids grind buildings to a 15% HP floor and move on;
  only walls can still be battered to rubble. Decay likewise floors at 1 HP —
  neglect guts a building but never silently erases it. (A raid is an economic
  wound in output-days, and A2's "recoverable" needs things left standing.)
- **The withdrawal clock starts at ARRIVAL, not spawn** (Finding 9, "the march
  tax"). The abstract sim has no travel time; the real map eats 100+ ticks of
  marching. Clocking from spawn made raids toothless. 3× backstop from spawn
  covers stuck pathing.
- **Old saves migrate, they don't reset** (E2). `loadGame()` synthesizes
  villagers from the old integer pop and gives old soldiers `villagerId`
  bodies. Worker crews are live object references — stripped on save,
  recomputed every tick.
- **Villagers have names** ("Berta Stoutheart"), deterministic from id. The
  chronicle reports deaths by name — Pillar B's stakes are people, and this
  was nearly free.
- **iq 0 stays byte-identical to the legacy bot.** Every pre-B1 number
  reproduces exactly, so old and new results stay comparable forever.
- **Fresh git history** (Chandra's call, Turn 9). The directory carried an
  unrelated project's history; kingdom-sim now has its own repo from
  `d0d947b`. `node_modules`/`dist`/`.DS_Store` ignored.

## Design philosophy (the redesign)

- **Model before building** (Turn 6). Chandra's call: "Can we create a system
  simulation of feedback loop first." Every subsequent balance claim is backed by
  a run, not a guess.
- **"Balanced" ≠ "interesting"** (Turn 7). Adding sinks fixes the snowball but
  doesn't make the game compelling. The redesign targets *interesting decisions*,
  not just bounded numbers.
- **HP-as-output is the core** (Turn 7, Chandra's idea). Building output ∝ HP;
  raiders damage HP; maintenance restores it. Accepted as the spine because it
  couples the economy and war games and turns buildings into ongoing
  relationships. (Whether it's *too* punishing a coupling is still open — A6.)
- **Villager units are required** (Turn 7, Chandra's insight). If maintenance
  competes with production for labor and specialists exist, population can't be a
  single integer. This is the big architectural commitment.
- **All three pillars in scope** (Turn 7). Logistics + Specialists + Pressure,
  all built on the HP core. Sequencing still open (A5).

## Balance levers — resolved *within the simulator* (starting points, not final)

These are the sim's tuned defaults. They're the *starting point* for the real
implementation, validated across 480+ runs — not drop-in game constants, and
subject to re-tuning once a smarter test-player exists (B1).

- **Per-tick gold upkeep rejected** (Turn 6, Chandra). Escalates badly with army
  size and punishes the player for the thing we want raids to encourage. Use
  **soldier food upkeep (3×)** instead — self-limiting via farmable land.
- **`raiderDmgPerTick` is the master difficulty switch** (Turn 7 sweep). Every
  tested value of 2.5 → 100% collapse; every survivable region sits at ~1.2. This
  is the single highest-leverage number.
- **`outputFloor = 0.4`** (was 0.15). A gutted building still makes 40% output so
  it can fund its own repair — this breaks the death spiral. At 0.6 the game goes
  too easy.
- **`repairPerBuilderTick = 1.5`** (was 0.6). Recovery must outpace raid damage.
- **Free-distribution "town core"** (Turn 7). The first ~6 buildings
  auto-distribute goods; only the periphery needs haulers. Logistics is thus a
  late-game scaling concern, not a startup tax. (This was the fix for the sim's
  first bug — villages starving with full granaries.)
- **Knowledge floor / guild memory** (Turn 7). Once a craft has been mastered, it
  retains a ~0.3 baseline so one master's death can't wipe the knowledge. Softens
  the specialist brittleness; exact strength still to be swept (B3).
- **Pressure must ramp** (Turn 7). Warlords/disasters gated behind a minimum pop.
  Front-loaded pressure just resets the game; the same disaster is trivial at
  pop 40 and fatal at pop 12.
- **Bakery rework: bread output 0.25 → 0.4** (Turn 6/7). Fixes the +0.02-net
  bakery trap so a bakery is a real "feed more per worker" upgrade.

## Process notes

- **Transparent about test side-effects** (Turn 4). When force-testing the
  victory screen corrupted the autosave, Claude disclosed it and repaired the
  save rather than hiding it.
- **Nothing in `src/` changed during the redesign** (Turn 7–8). The shipped game
  is untouched; all redesign work is in `model/`, `sim2/`, and `design/`, pending
  the go/no-go decision.
