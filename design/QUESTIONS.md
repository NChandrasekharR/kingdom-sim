# Open questions for Fable

Context: `design/REDESIGN.md` (the plan), `design/FINDINGS.md` (what the
simulator proved). These are the decisions I couldn't make alone — they're
design calls, not just numbers.

## 1. How punishing should this game be? (the core tuning philosophy)
The sim shows a **narrow "interesting" band** between trivial and fatal. Where do
we want to sit? A cozy builder that occasionally scares you, or a survival game
that regularly ends runs? This single answer drives every difficulty number and
the rubber-band strength. My instinct: tense-but-fair, ~60% "interesting", with
soft failure so a bad raid rarely ends a 2-hour session — but this is Chandra's
game and Fable's call on feel.

## 2. Should collapse be recoverable? (soft vs. hard failure)
Right now collapse = population hits zero = run over. The sim's death spirals
argue for **soft failure**: refugees return after a disaster, a neighboring lord
grants emergency aid, the keep is unrazable and you rebuild from it. Do we want
the kingdom to be able to fall to near-nothing and climb back, or is permanent
loss part of the tension?

## 3. How much should the player micromanage?
The design's whole "interesting decision" is maintenance-vs-production-vs-defense
competing for scarce labor. But if the player is hand-assigning every villager,
that's tedium, not depth. Where's the line? My model auto-assigns with policy
hints. Do we expose priority sliders? Per-building worker locks? Or keep it fully
automatic and let the player influence only through *what they build and where*?

## 4. Specialists: how mortal should knowledge be?
Pillar B's stakes come from losing irreplaceable masters — but the sim showed
that's also the biggest source of unrecoverable spirals. The knowledge-floor
mechanic (guilds retain a baseline) softens it. Dial: should losing your master
smith be a gut-punch you recover from (guild floor high) or a genuine
catastrophe that can end a run (guild floor low)? Ties directly to Q2.

## 5. Which pillar do we build FIRST?
The sim's verdict on sequencing:
- **Pillar C (pressure)** is the heart of "interesting" and touches everything —
  but must ramp with kingdom size.
- **Pillar A (logistics)** is a late-game scaling texture; lower priority.
- **Pillar B (specialists)** is the richest for stakes but the trickiest to
  balance.
My recommendation: **C first** (it's where the fun is and it reframes raids),
then **B** (stakes), then **A** (depth for the endgame). Agree?

## 6. Is HP-as-output the right core, or too punishing a coupling?
Chandra's idea works and couples the systems beautifully — but it's also the
mechanism behind every death spiral (sacked buildings → no output → no
recovery). The `outputFloor=0.4` softening helps a lot. Are we confident this is
the spine, or do we want a gentler coupling (e.g. HP affects *max* output but a
building at low HP still runs at a floor, or only *some* building types are
HP-coupled)?

---

Once these are settled, the concrete number-tuning is fast — the `sim2/` harness
sweeps any parameter in ~30s. The blocker is direction, not computation. The one
technical prerequisite: a **smarter player policy** in the sim so we're tuning
against competence, not a passive bot (see FINDINGS "the real blocker").
