# Decisions log

Choices already made, with rationale, so they don't get relitigated. Newest
first within each section. For still-open questions see `OPEN-QUESTIONS.md`.

---

## Session 3 — playtest-driven decisions (2026-07-15)

Made during the defense/combat/population session (branch
`phase1-defense-and-keep`). Several were live calls Chandra made mid-build.

- **Food-margin population gating: REJECTED.** Prototyped and validated in a
  headless A/B (median pop 75→36, real equilibrium), but Chandra rejected it:
  gating growth on production *flow* punishes prudent play (stockpiling food for
  winter should still let pop grow). Food stays as-is; pop scales by building
  housing. The unbounded-pop diagnosis stands as a finding; the fix is
  intentionally not pursued.

- **Population growth scales with food ABUNDANCE (shipped).** The *actual* pop
  fix. Root cause Chandra spotted: births (~13/yr) barely beat war attrition
  (~10/yr), so pop stalled at 65 despite 12k food + empty housing — the
  army-bleed / stalled-pop / wasted-resources were one problem. Growth now
  scales with food-surplus-per-capita (`GROWTH` config). Surplus food finally
  builds a population; pop tracks the housing cap and consumes the surplus.

- **Walls breach, they don't shatter.** A battered wall becomes passable rubble
  at 1 HP, repairable in place — the last exception to "sack, don't raze" is
  gone. Walls are now durable investments, not coin-flips over rubble.

- **Keep-fall = catastrophic but RECOVERABLE dark age, NOT a game-over.** Chandra
  weighed a true hard-fail lose condition and explicitly chose the recoverable
  dark age (keep survives at floor, huge losses, run continues). This *extends*
  A2 and does not reverse the Turn-2 "sandbox, no hard fail" stance. The keep
  auto-defends (watchtower-grade, no garrison) so only an overwhelming force can
  sack it.

- **Villager death is unified: "caught in the open" (sim design; game port
  pending).** When a building is sacked/destroyed it EJECTS its workers, who flee
  and can be hunted down; there is one civilian death channel, not two. This
  *replaces* the old sack-death dice roll (cleaner than the two-channel model
  first proposed). Watchtowers are staffed by a villager watchman who flees/dies
  like anyone. Validated in sim2; the game still uses the old sack roll until
  Phase 3 ports the spatial layer.

- **Combat is probabilistic, not flat (shipped).** Each soldier↔raider exchange
  is a dice roll (crit / wound / kill-when-badly-wounded) whose severity scales
  with conditions. Veterans tilt every die (more crits, harder to wound, harder
  to finish off, retreat when hurt) and season nearby rookies. **Where you fight
  decides the battle** — home ground (claimed tiles) and tower cover cut wound
  odds; being locally swarmed is deadly. This ports the sim's force-ratio fix
  that had never made it into the game. Chandra's design instincts (crits,
  veterans, territory/tower bonuses, rookies-age-near-veterans) drove it.

- **Soldiers HOLD territory, they don't sortie.** The army only engages raiders
  on/near claimed land and holds at the keep otherwise — so it fights where the
  home-ground bonus applies instead of chasing raiders into the wilds (~98% vs
  ~41% win). Chosen over patrol-routes for simplicity/readability.

- **Mercenaries: hired swords on gold upkeep (shipped).** Hire a company with a
  gold lump; steep per-tick gold **upkeep**; they **desert if unpaid**. They
  fight but aren't your people (no seasoning, no villager dies) — an emergency
  valve that absorbs a big raid so veterans don't have to, and a **gold sink**.
  Deliberately can't become a cheap permanent army (the loop the redesign killed).
  Cap raised to 24 with top-up-after-losses.

- **"Model before building" reaffirmed for combat.** The probabilistic combat
  and the spatial-hunt model both went through sim2 *first* (they change the war
  balance the 4,900 runs rest on) before any game code. But a **key learning**
  landed: stacked-tile micro-tests are a bad benchmark (all fighters pile on one
  tile, so mercs add bodies but don't shield veterans — no formation concept).
  The true read is Chandra's playtest; don't over-tune against synthetic tests.

- **Honest project assessment (Claude, on request):** combat is now the *strong*
  layer (over-invested this session); the *hollow* part is the late-game economy
  (solved by ~yr5, then hoard). The novel/good things: HP-as-output core,
  model-before-building discipline, named mortal villagers. The biggest untapped
  lever for making it *interesting* (not just balanced) is giving the late game
  **something to want** — an ambition/prestige sink (wonders, a rival kingdom,
  costly expansion) — not more combat tuning. Recorded as a direction, not yet
  chosen.

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
  - **Implemented 2026-07-15 as the Keep-fall dark age** (`src/`, `KEEP.darkAge`
    in config, `keepDarkAge()` in `raids.js`). The keep now auto-defends
    (watchtower-grade arrows, no garrison) so only an overwhelming warlord force
    can sack it; when it falls, a one-time catastrophe fires (60% of every
    stockpile looted, morale gutted to floor, 5 buildings knocked to their sack
    floor, up to 3 subjects lost) but the keep survives at its HP floor and the
    run continues. This is the concrete expression of A2 — a severe *recoverable*
    setback, **explicitly NOT a hard game-over** (Chandra reaffirmed this choice
    over a true lose-condition, 2026-07-15). It does not reverse the Turn-2
    "sandbox, no hard fail" decision.
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
