# First-time user experience: the Steward's Counsel

**Status: PLAN — not built.** Drafted 2026-07-20 (Session 6) for a future
session. Nothing here is code yet; the copy samples are drafts in the game's
voice. Companion problem to the landing page (which answers *"what is this?"*
— this answers *"what do I do?"*).

---

## 1. The problem

A first-time player lands in a live sandbox with six villagers, a keep, and no
direction. The game's best systems are invisible until they hurt you:

- The **first raid fires at tick 300** (~3 minutes at 1×). A player who spent
  those minutes reading tooltips meets raiders with no wall, no tower, no
  soldier — and doesn't know the defeat was avoidable.
- **HP-as-output**, the eat order, watchman towers, militia, and the
  border-follows-works rule are all load-bearing and all unexplained.
- The current teaching surface is passive: building descriptions, the hint
  paragraph in the Build tab, and reactive chronicle lines ("Grain rots in the
  overflowing stores…") that arrive only *after* the mistake.

The identity is "an ant farm you tend" — but a new keeper needs to be told,
once, which end of the ant farm is up.

## 2. Constraints (settled decisions — do not relitigate)

- **A3**: no micromanagement; the player sets policy, not tasks. Onboarding
  must not add a new interaction grammar it later takes away.
- **Sandbox, no hard fail**: the tutorial can never gate the game. It advises;
  it must never lock buildings, pause the sim, or force clicks.
- **Diegetic voice**: the game speaks through the Chronicle and named people.
  No floating arrows, no dimmed-out screen, no "Step 3 of 12" toasts.
- **Skippable in one click, and never shown twice.** Veterans and returning
  players must never see it (auto-skip on loaded saves).

## 3. The shape: a counsel, not a tutorial

Add **the Steward** — a named advisor (minted like any villager name, e.g.
"Steward Osric the Steady") who offers ONE piece of counsel at a time in a
small parchment card at the top of the sidebar (above the tabs, styled like a
crown-row). Each counsel is:

- **A suggestion with a reason**, in the game's voice — never an order.
- **Completed by the real event** (the building placed, the raid survived),
  detected through existing state/emits — no special tutorial actions.
- **Acknowledged in the Chronicle** when done ("The steward nods: the granary
  will hold."), so progress reads as story.
- **Dismissible forever** via a small "Dismiss the steward" link on the card
  (the skip-tutorial affordance). Dismissal is polite and final: *"Osric bows.
  'You have ruled before, sire.'"*

No rewards. Completion is the reward — the kingdom that results is the
payoff, and mechanical rewards would make the tutorial an optimization step
(A1 identity risk).

## 4. The ladder (first reign, first ~10 minutes)

Step → trigger to appear → completion check → copy draft:

1. **Shelter** — on new game (tick ~10).
   Done: any `house` placed.
   *"Six souls sleep under the keep's stair, sire. Raise a house — the realm
   grows only as far as its roofs."*
2. **Bread of the land** — after 1.
   Done: any `farm` placed.
   *"The granary counts 40 measures — a season, no more. Plant a farm on open
   plains."*
3. **Timber** — after 2.
   Done: any `lumber` placed.
   *"Every wall and roof to come is standing in that forest. A lumber camp —
   near the trees, while they last."*
4. **The watch** — trigger at first-raid warning minus ~120 ticks (see §7).
   Done: a `tower` placed AND staffed (assigned > 0).
   *"Riders have been seen in the wilds. A watchtower, sire — and mind it
   needs a watchman inside, or it is only stone."*
5. **The horn sounds** — trigger at the first raid warning. This step is
   COUNSEL ONLY, auto-completes when the raid ends:
   *"They come. Your folk will run for the keep — what stands is what saves
   them. Watch, and remember what they burn."*
   On completion, point at the reckoning line: *"Count the cost in the
   Chronicle. Every raid writes its bill."*
6. **Swords of our own** — after the first raid ends.
   Done: `barracks` placed + first soldier recruited.
   *"Hoes are not enough forever. A barracks, and a subject under arms — he
   will eat three men's share, but he holds the line."*
7. **The road out** — after 6.
   Done: 8+ road tiles placed.
   *"Roads carry your grain, your soldiers — and the border itself follows
   them. Push one toward the next forest."*
8. **Rule as you will** — closing card, auto-completes after ~30s:
   *"The rest is yours, sire: the crowns, the warlord, the winters. I will
   hold my tongue — mostly."* → the ladder retires; §5 counsel remains.

Eight steps, no branching. The ladder must fit BEFORE the endgame systems and
never mention them — the camp, tribute, and the march teach themselves via §5.

## 5. Just-in-time counsel (one-time lines, whole game)

Independent of the ladder — the Steward speaks ONCE, ever, on each system's
first contact, replacing today's silent-or-cryptic first encounters. Stored as
seen-flags; fires as a highlighted chronicle line + brief card flash:

- **First spoilage**: "Grain rots past what we can eat, sire. A bakery turns
  the surplus into bread — and bread keeps."
- **First tribute rider**: "Danegeld. Pay, and he leaves — and returns
  hungrier. Refuse, and he comes now. There is no third rider."
- **First camp founded**: "They have made a nest at {name}. Break it early, or
  it will find itself a master."
- **First warlord claim**: "{warlord} has claimed the nest. His raids will
  march from there — you can watch that road now."
- **First 'massing' report**: "When they mass at the tents, you have time yet.
  When the camp stirs — you do not."
- **First depleted lumber camp**: "The wood there is spent; the land lies open
  for the plough. Tear the camp down — the timbers come back — and follow the
  forest."
- **First wall breach**: "A breached wall is rubble, not ruin. Build it back
  past half and it stands again."
- **First march available** (army ≥3 while a camp lives): "You have swords
  enough to answer him at his own tents, sire — if you dare leave home thin."
- **First victory choice**: no counsel. The Steward is silent. (The moral
  choice must be the player's alone — deliberate.)

## 6. Skip rules

- **Explicit**: "Dismiss the steward" on the card → sets `tutorial.dismissed`,
  ladder and card gone forever (JIT counsel in §5 stays — it's a systems
  glossary, not a tutorial; separate toggle if it annoys).
- **Auto-skip the ladder** when: loading any pre-existing save; or the player
  places 4 different building types unprompted before step 3 completes
  (they've played before — the Steward says the dismissal line himself).
- **New Kingdom after a dismissal/completion** does NOT restart the ladder
  (flag lives in localStorage beside the save, not in `state`) — unless
  Chandra prefers per-reign; see §9.

## 7. Timing: the first raid must be survivable-if-counseled

Today `RAID.firstAfter = 300`. The ladder needs steps 1–4 doable before the
warning. Options (pick one in-session, sim the choice):
- a) Leave 300; trigger step 4 at tick ~180. Tight but honest.
- b) While the ladder is active and step < 4: first raid at 400 (+100 grace).
  Rubber-band philosophy says a green player deserves the mercy the sim
  already gives sloppy ones. **Recommended.**
- c) Scale first wave size down under an active ladder. Rejected — touching
  wave math for tutorial state couples war balance to UI state.

## 8. Implementation sketch (one session)

- `state.tutorial = { step: 0, seen: {}, dismissed: false }` (+ localStorage
  mirror for cross-reign skip). Save-migrates like everything else.
- `src/core/tutorial.js` (~150 lines): a step table `{ id, appearWhen(state),
  doneWhen(state), counselText, doneText }`, ticked from `sim.js` after
  `winTick` — pure state reads, no new events needed for the ladder.
  JIT counsel hooks into existing emits (`tribute-demand`, `camp-founded`,
  `warlord-claimed`, `raid-warning`) plus cheap state checks.
- `ui.js`: one card component above the tabs (parchment, steward name in
  Pirata, counsel in Alegreya italic, Dismiss link). Chronicle lines via
  ordinary `logEvent` with a new `'counsel'` kind (gold-tinted border).
- Verification: headless — scripted placements walk the ladder, assert
  step advance + one-shot flags; browser — fresh reign walkthrough + skip
  path + loaded-save auto-skip.

## 9. Open questions for Chandra

1. Ladder restart on New Kingdom: never (recommended) or every fresh reign
   until dismissed once?
2. First-raid grace (§7b): +100 ticks under an active ladder — yes/no?
3. Does the Steward exist as a *body* (a villager among villagers, killable —
   very on-brand, but then counsel can die mid-tutorial) or as a voice only?
   Recommend: voice only in v1; body is a delightful v2 cruelty.
4. Should step 5 pause speed to 1× when the first raid warning fires (not
   pausing the game, just dropping from 3×)? Gentle, but it touches player
   controls — Chandra's call.

**Kill gate:** hand the game to one person who has never seen it, ladder on.
If they survive the first raid and can say aloud what bread is for, it ships.
If they dismiss the steward inside 60 seconds, the card is too loud — quieter,
not louder, is the fix.
