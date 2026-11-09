# Fates: emergent warlord stories, and the promise that every name gets an ending

**Status: PROPOSAL. Nothing built.** Written 2026-11-09 after the Ravenmoor
chain in Chandra's live reign. §10 holds the headless campaign that measured
how far the warlord systems already run on their own (Campaign 17). The
decisions in §11 are Chandra's.

Companion docs: `design/ENDGAME.md` (the counter-raid and the moral choice
this builds on), `design/REAVING.md` (the off-map holds a broken warlord might
one day flee to), `docs/WHAT-IS-INTERESTING.md` §1 "Fate as a design
invariant" and §3a "Memory runs one way", `docs/DECISIONS.md` (what may not be
relitigated).

---

## 0. The one-paragraph version

The warlord systems already compose into stories nobody scripted: a successor
inherits an avenger's grudge, his camp is burned while he is out raiding you,
and he walks home to ashes. Emergence is good at *starting* stories and bad at
*finishing* them. When the next avenger rides, the code replaces the whole camp
record and the broken warlord silently vanishes, a line after the Chronicle
told you something in him broke. The proposal is one invariant and three
features built on it. **The invariant: a line in the Chronicle that promises a
future is owed a later line that pays it off.** Every named figure the
Chronicle has made a promise about gets an ending it states. The features:
rules that decide a figure's ending from their *situation* rather than the path
that led there (§4), a visible list of open grudges that turns loose ends into
late-game wants (§5), and a costly blood-price that can end a feud (§6). A
headless check (§8) enforces the invariant the way the corner-camp fix enforces
"the survivor always escapes".

---

## 1. The case: Kolgrim Crowfeeder and the ashes of Ravenmoor

What happened in the reign, reconstructed from the code:

1. A camp was massacred. One survivor escaped, as the rules guarantee
   (`camp.js:982`).
2. The survivor returned as the Ash-Sworn and raised Ravenmoor
   (`camp.js:456`). An avenger camp sends no tribute rider and its dread waves
   are ×1.35.
3. The Ash-Sworn fell at the walls. Ravenmoor went leaderless
   (`warlordFell`, `camp.js:307`).
4. Kolgrim Crowfeeder claimed it as successor (`camp.js:446`). The camp's
   `avenger` flag is never cleared, so **he inherited the grudge**: still no
   rider, still ×1.35. The Chronicle said only "A new chief claims Ravenmoor".
5. The realm marched on Ravenmoor while Kolgrim was at its walls, and burned
   it.
6. His raid ended; he walked home (`warlordReturned`, `camp.js:317`). "Ashes.
   Silence. Something in him breaks." The next avenger's timer is cut to at
   most 700 ticks (~1.5 years).

No code was written for this chain. Four general rules composed it.

**The loose end.** `warlordReturned` tries to name Kolgrim the next avenger,
but only `if (!c.avengerName)`, and `finishMassacre` (`camp.js:1030`) always
sets a name first: the escaped survivor's, or the fallback "the Ash-Sworn". The
branch is unreachable. When the next avenger rides, `state.camp = null`
(`camp.js:458`) discards the old record, and Kolgrim with it. The player is
promised a broken man and never sees him again.

---

## 2. The stance

The project already authors a small number of certainties and lets everything
else emerge (`WHAT-IS-INTERESTING.md` §1): one survivor, one avenger, one rider
before each dread wave. This doc adds one more certainty, of a different kind.

- **Guarantee endings, never outcomes.** Who wins a fight stays emergent. That
  a named figure's story *closes*, in a line the player can read, is
  guaranteed.
- **Rules key on situation, not on path.** Nobody can anticipate "successor of
  a slain avenger, burned out while raiding". Anyone can write a rule for "a
  warlord with a grudge, no home, and a few sworn men left". Situations are
  few; paths are endless.
- **The Chronicle is the contract.** A promise is whatever the Chronicle says
  will happen. If the game says "they will remember", something must.

---

## 3. The audit: every promise the Chronicle makes today

Lines that tell the player about a future, and whether the code delivers it.

| Line (source) | Promise | Paid off? |
|---|---|---|
| "One slips through the reeds — *X*. Remember the name: *X*." (`camp.js:985`) | *X* returns | **Yes** — *X* the Ash-Sworn rides (`camp.js:456`) |
| "*X* HAS COME. He remembers the burning. He will take no gold." (`camp.js:471`) | No tribute | **Yes** — no rider (`raids.js:84`) |
| "…marked by the burning … they will never lay down the sword." (`camp.js:1041`) | Marked men | **Yes** — kill-resist, refuse to stand down |
| "*X* turns away — for now. Word spreads of easy coin." (`raids.js:1175`) | He comes back hungrier | **Yes** — tribute appetite |
| "The assault … is REPULSED … The warlord is emboldened." (`camp.js:756`) | He strikes soon | **Yes** — raid timer cut to ≤150 |
| "War-tents rise again…" / "a successor will rise" (`camp.js:443`, `ui.js:802`) | The camp returns | **Yes** |
| "*Name* is no more. *N* souls. The Chronicle will keep their names…" (`camp.js:1039`) | The names are kept | **Partly** — each death is journalled as it happens; nothing ever recalls them |
| "Something in him breaks." (`camp.js:322`) | The broken warlord matters | **No** — only the avenger's timer; he is discarded |
| "The folk are spared — and they will remember." / "…spared, and remembering it." (`camp.js:920`, `:481`) | Mercy is remembered | **No** — spared settlers arrive as ordinary villagers with no memory or flag |

And one silent inheritance that makes no promise at all: **a successor in an
avenger camp keeps the grudge** without a line saying so (step 4 above).
Either it is intended, and the Chronicle should say "Kolgrim takes up the
Ash-Sworn's feud", or the successor should clear the flag. §11 Q1.

---

## 4. Endings by situation

Each named warlord-side figure sits in one situation at a time. The ending is
chosen from the situation when the figure's record would otherwise be dropped.

### 4.1 The homeless warlord (Kolgrim's case)

**Situation:** his camp is ashes; he is alive; an avenger is coming.
**Inputs:** sworn men still alive, whether wild ground exists, whether an
avenger is already named.

| Outcome | When | What the player sees |
|---|---|---|
| **Rides with the avenger** | An avenger is named (always, today) | The avenger's host has him as its first sworn man, named. "Kolgrim Crowfeeder rides at *X*'s shoulder. He has nothing left to lose." His death in battle gets its own line. |
| **Becomes the avenger** | No survivor escaped (impossible today; reachable if §6 or a future system lets the survivor die) | "Kolgrim Crowfeeder the Ash-Sworn" |
| **Exile** | No wild ground (total dominion) | "Kolgrim Crowfeeder walks out of the realm's sight. No one sees him again." |

**Recommendation: rides with the avenger.** It costs the least (the retinue
already exists, `CAMP.swornMen`), it keeps the survivor's payoff intact, and it
gives the player the Geronimo shape: a smaller, harder host bound by grief
rather than loot. It also echoes *Njáls saga*, where the one who escaped the
burning and the bereaved both carry the feud.

### 4.2 The spared folk

**Situation:** a settler arrived after a punitive burning. Give the villager a
`spared: { camp, year }` record. Payoffs, cheapest first: the Chronicle names
them at their death ("*Aldith*, spared at Ravenmoor in Year 9, dies a
grandmother"); they refuse to march on the camp they came from; morale holds
up locally around them (`WHAT-IS-INTERESTING.md` §3a's cheap form). The first
alone keeps the promise.

### 4.3 The inheriting successor

Decided by §11 Q1. If the grudge is inherited, the claim line says so.

---

## 5. Unfinished business: open grudges, visible

A short list on the Kingdom tab, in the Chronicle's voice, of promises not yet
paid off. Only promises appear; it is not a quest log and has no checkboxes.

> **Unfinished business**
> Kolgrim Crowfeeder — last seen at the ashes of Ravenmoor, Year 14.
> Wren the Ash-Sworn — gathering swords somewhere in the wilds.
> 3 souls spared at Saltmere — living among your people.

Why: the Duncastle playtest found that the late game has nothing left to want
(`design/ENDGAME.md`, opening; Wolfsden ended the same way). The Great Works are the designer's list of wants;
this is the player's own history producing them. The risk is the UI telling
the story instead of the Chronicle. Mitigation: every entry must quote or
paraphrase a line the Chronicle already wrote, and entries leave the list the
moment their payoff line is written.

---

## 6. Ending a feud: the blood-price

Today the only exit from the revenge cycle is choosing punish over massacre.
History had another: compensation for the dead, paid to end a feud. *Njáls
saga* ends in reconciliation; accepting payment for slain kin was also widely
seen as shameful, which is why it was hard.

Proposal: the avenger still takes no gold by default. A **blood-price** offer
becomes possible only when the feud is weakened: the avenger has been beaten
at your walls once, or his sworn men are down to one or two. The price scales
with the souls slain in the burning that started it (`stats.folkSlain` per
camp). Paid, the camp becomes an ordinary camp (the flag clears, a rider can
come again), and the Chronicle closes the thread by name. Refused by him,
which should be possible, it fails loudly.

This sits next to the undecided "truce market" from Session 8. The cost must
stay high, or the massacre loses its lasting price.

---

## 7. Where a broken man goes

Of the three historical paths for a warlord stripped of his base (revenge,
bringing a foreign power back with him, exile), the game can show two.
Tostig's path, returning at the head of someone else's army, needs an "away"
that does not exist (`WHAT-IS-INTERESTING.md` §3c). **Do not build an offstage
power for this.** Exile now, written in the Chronicle; if the Reaving's
off-map holds (`REAVING.md` §3) are ever built, exiles are their natural
first allies.

---

## 8. Enforcing the invariant

Two checks, both headless, both runnable from `model/`:

1. **Promise ledger.** Each promise line registers `{ who, kind, tick }` in
   `state.threads`; each payoff line closes it. A run ends with a list of open
   threads. In the shipped game this list *is* §5's UI.
2. **Dropped-name scan.** Over many seeds, flag every named warlord-side
   figure whose last Chronicle line is a promise. This needs no new game
   state, which is why Campaign 17 (§10) could run it before anything is
   built.

---

## 9. The emergent register

When play or a campaign turns up a chain nobody wrote, record it with its seed
and one of three calls:

- **Keep:** good and rare. Leave it emergent; make sure the Chronicle names
  it.
- **Guarantee:** good, but its payoff depends on luck or geometry. Promote it
  to a certainty, as the corner-camp fix did for the survivor.
- **Forbid:** a stall or an exploit. Block it with a rule that makes sense in
  the fiction (the warlord's shadow, the hoard as a ledger), never an
  arbitrary cap.

The register belongs beside `docs/SIMULATIONS.md`. Its first entries:

| Chain | Where | Call |
|---|---|---|
| A successor inherits an avenger's grudge; his camp burns while he raids; he comes home to ashes | Chandra's live reign (Ravenmoor); mixed seed 10 | **Keep**, and give him an ending (§4.1) |
| Two armies cross: the host burns the camp while its lord is at your walls | opportunist, up to 7 times a reign | **Keep**; it is the best scene the warlord systems make |
| The same Ash-Sworn rises twice, from the ashes of her own camp | opportunist 9, 15; butcher 12, 13 | **Forbid**: a naming bug, fixed 2026-11-09 (§10 finding 7) |
| An avenger is named and killed at her hall within the year, eleven times a reign | butcher, median | **Undecided** (§11 Q6) |

---

## 10. What the headless campaign found (Campaign 17)

120 reigns of 40 years on the shipped config: six war doctrines × seeds 1–20,
real `src/core/`, the Thornmere-shaped economy bot (army at 35% of the
population, marching only at 2.2:1 odds or better). Seed 8 never passes 15
souls (the Campaign 14 wood deadlock) and is left out; seed 18 reaches 300
souls with only 6 soldiers (an iron-starved map for this bot) and never
marches. Full tables: `model/out/warlord-saga/TABLES.md`.

| Doctrine | marches | at victory | tribute |
|---|---|---|---|
| butcher | at 2.2:1 odds | massacre | refuse |
| opportunist | only while the warlord is at your walls | massacre | refuse |
| mixed | at 2.2:1 odds | coin | coin |
| merciful | at 2.2:1 odds | punish | refuse |
| payer | never | — | pay |
| turtle | never | — | refuse |

Ranges, min–max (median) over 19 reigns each:

| | butcher | opportunist | mixed | merciful | payer | turtle |
|---|---|---|---|---|---|---|
| named warlords | 2–11 (11) | 2–7 (6) | 2–9 (6) | 1–5 (5) | 3–5 (4) | 1–6 (5) |
| avenger generations | 0–11 (**11**) | 0–7 (6) | 0–8 (4) | 0 | 0 | 0 |
| camp folk slain | 0–96 (96) | 0–56 (48) | 0–67 (32) | 0 | 0 | 0 |
| marked soldiers at the end | 0–105 (103) | 0–99 (85) | 0–105 (89) | 0 | 0 | 0 |
| camps burned while the lord was away | 0–2 (0) | 0–6 (**5**) | 0–2 (0) | 0 | 0 | 0 |
| lords who came home to ashes | 0–1 (0) | 0–6 (3) | 0–1 (0) | 0 | 0 | 0 |
| successors who inherited a grudge | 0 | 0 | 0–3 (1) | 0 | 0 | 0 |
| tribute paid (gold) | 0 | 0 | 0 | 0 | 65k–112k (100k) | 0 |
| largest warlord wave | 0–95 (55) | 61–95 (95) | 0–95 (0) | 0–95 (0) | 52–95 (90) | 61–95 (95) |
| soldiers fallen (median, seed 18 out) | **85** | 199 | 126 | 199 | 106 | **421** |
| keep falls (sum) | 9 | 10 | 8 | 6 | 1 | 4 |

How the 655 named warlords' stories ended:

| ending | butcher | opportunist | mixed | merciful | payer | turtle | all |
|---|---|---|---|---|---|---|---|
| slain at their own hall | 172 | 0 | 102 | 62 | 0 | 0 | 336 |
| slain at your walls | 1 | 1 | 3 | 6 | 72 | 82 | 165 |
| still reigning at year 40 | 3 | 11 | 4 | 16 | 9 | 5 | 48 |
| **slain with no line** | 8 | 32 | 4 | 0 | 0 | 0 | 44 |
| **came home to ashes, then dropped** | 2 | 57 | 1 | 0 | 0 | 0 | 60 |
| **dropped** (run ended mid-story) | 0 | 2 | 0 | 0 | 0 | 0 | 2 |

**Findings.**

1. **The feud is set entirely by the choice at victory.** Every doctrine
   that never massacres has zero avengers in every reign. Every massacre
   produces one, and the chain never ends on its own.
2. **The butcher's feud is a treadmill.** Median 11 generations of Ash-Sworn
   in 40 years, a burning every 3.3 years. 172 of 186 butcher warlords die at
   their own hall, most in the year they raise their banner, before leading
   a single wave. The whole army ends marked (103 of ~105).
3. **The cruelest doctrine is the safest for your own people.** Butcher loses
   a median 85 soldiers; merciful 199; turtle 421. Paying tribute is the
   next safest (106) at ~100k gold. Against a strong army the massacre has
   no lasting price: the avenger dies before raiding, and marked men are only
   a benefit. This is the largest design finding of the campaign (§11 Q6).
4. **Kolgrim's case is the opportunist's norm.** Striking the empty hall
   burns a median 5 camps while their lord is away. 91 of the opportunist's
   103 warlords end with no closing line; across all doctrines, 106 of 655
   (16%).
5. **44 warlords were killed with no line at all.** `warlordFell` returns
   early when the camp is ashes (`camp.js:309`), so a homeless lord cut down
   at your walls counts in `stats.warlordsSlain` and nowhere in the
   Chronicle.
6. **The inherited grudge happens only under mixed play** (22 times): kill an
   avenger at their hall, then punish rather than burn, and a successor
   claims the camp still flagged as avenger. One of them, in mixed seed 10,
   is named Kolgrim Crowfeeder.
7. **A naming bug let an avenger rise twice. FIXED 2026-11-09.** In four
   reigns (butcher 12 and 13, opportunist 9 and 15) the survivor of an
   avenger's own camp shared the avenger's first name, so "Gyda the
   Ash-Sworn" came again. Cause: `mintFolkName` (`camp.js:52`) only retired
   avenger names when the 42-name pool reset; a name minted before the last
   reset and made an avenger after it was free again. Now `pick()` skips
   `state.avengerNames` every time. Rerunning the four reigns changes only
   the names (every battle, burning and loss identical); in opportunist 9
   Ravenmoor's survivor is now Sana. One edge remains: once all 42 names are
   avengers (about 150 years of butcher play) the fallback must reuse one.
8. **Exile never happens.** No reign reached total dominion, so §4.1's exile
   branch is rare in practice; riding with the avenger is the case that
   matters.

**Caveats.** The bot never marches below 2.2:1 odds and keeps a third of the
realm under arms, so it wins almost every assault (repulses: 0–4 per reign).
A human will be repulsed more often and will rarely kill an avenger the year
they arrive; finding 3 is the bot's ceiling, not the typical reign. The
harness keys survivors by first name, so it under-counts finding 7's
duplicates; the avenger-side count (4) is exact.

---

## 11. Decisions for Chandra

1. **The inherited grudge** (§4.3). Should a successor keep an avenger camp's
   no-tribute, ×1.35 status? If yes, the claim line must say so.
2. **Kolgrim's ending** (§4.1). Rides with the avenger (recommended), becomes
   the avenger, or exile.
3. **Open grudges on screen** (§5). Build the list, or keep it in the
   Chronicle and the journal only.
4. **The blood-price** (§6). Allow a feud to end by payment, and under which
   conditions.
5. **The spared folk** (§4.2). Which payoff, if any, beyond a named death.
6. **The massacre's missing price** (§10 finding 3). For a strong army the
   cruelest doctrine is the safest. Options: the avenger rides out on
   arrival instead of waiting at the camp to be killed; marked men cost
   something at home (`WHAT-IS-INTERESTING.md` §3a); or accept it as the
   ruthless player's reward.
7. ~~**The name-reuse bug** (§10 finding 7).~~ Fixed 2026-11-09 at
   Chandra's go-ahead.

## 12. Not proposed

A rival kingdom. Warlord dynasties with family trees. Any system whose output
is a number rather than a line the Chronicle can say.
