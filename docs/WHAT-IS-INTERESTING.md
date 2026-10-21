# What is interesting here, what is not, and what you have not tried

*2026-09-02. An opinion, not a review. Written after reading all of `src/`,
the models, the design docs, and the three reign post-mortems. The review is
in `REVIEW-SESSION-10.md`; this is the part of the read that does not fit in
a review: what I found myself thinking about, and where I think the unplayed
game is.*

---

## 1. What is interesting

**HP-as-output is the whole game, and it is a better idea than the docs give
it credit for.** Most sims keep two ledgers: an economy that produces, and a
war layer that destroys. Here there is one number per building and both
layers write to it. A raid is measured in lost output-days, a repair crew
competes with the harvest for the same hands, and a wall breach feeds the
builder draft that starves the farms. The Aldermere collapse (the phantom
repair mob) was not a bug in the economy or in the war layer; it was the
coupling working exactly as designed, one tick too literally. That is the
sign of a real core: it fails in ways that are *about* the idea.

**The hoard is a ledger.** The anti-farming problem (players milking a
weak enemy) is normally solved with a rule: diminishing returns, a cooldown,
a cap. Here it is solved by fiction: the warlord's hoard is literally what he
took from you plus what you paid him, so raiding a poor warlord yields
nothing because he *has* nothing. No rule, no exploit, and the fiction is
the explanation. `design/ENDGAME.md` §5 says this in one clause and moves
on. It is the best single design move in the project.

**Fate as a design invariant.** "The survivor must always escape" was a bug
report (Wyrmditch, the corner camp) that became a rule: never let a scripted
certainty depend on open geometry. That is an unusual stance for a
simulation to take. Most sims are proud of emergence and embarrassed by
authorship. This one authors a small number of certainties (one survivor,
one avenger, one rider before each dread wave) and lets everything else
emerge around them. The Ash-Sworn line in Eastwold reads like a saga
*because* the return is guaranteed and the rest is not.

**Depletion as landscape.** The wood-line receding, hills flattening, veins
falling back to quarryable rock. Two reigns produced two geographies
(Wolfsden's bridges, Eastwold's lakes eaten around) and the post-mortems
could reconstruct doctrine from coordinates. The map is not a board; it is a
record of what was done to it.

**The journal is the best asset you have.** Not the game's telemetry, the
game's *memory*. `kingdom.export()` turned playtests into history-writing.
The Byzantium reading of Eastwold was possible because the census lines
carried enough to infer a fiscal-military model from a text file. That loop
(play, export, read the reign as a historian would, find the design flaw in
the history) is the project's real method, and it is more interesting than
the Monte Carlo that preceded it.

**Coprime names.** A tiny thing. The name pools were producing 120
combinations, not 360, because the index stride shared a factor with the
pool length, and the Wolfsden saga had several identical Dorias in it. It is
interesting because it is the kind of bug only a game about *names* would
notice, and the fix is number theory. The codebase has a few of these
(gathering invariants, the eat-order flip, the Zeno stall on the ladder):
small, specific, correct, with the run that found them cited in the comment.

## 2. What is not interesting (to me)

**The three survival crowns.** Dominion, Plenty, People are thresholds. They
are fine as milestones in a game that promises no game-over, but they are
not *wants*; your own ENDGAME doc says so. The Crown of Ages is better
because it is a story with jeopardy. If I were cutting, the first three
would become quiet chronicle achievements and the Great Works would be the
only crowns.

**The merchant.** A vending machine with a cart cap. He arrives, prices are
set by a formula, you click ×10. There is no counterparty: nobody wants
anything, nothing you do changes what he brings, and the "away" he comes
from does not exist. Eastwold's import economy (4,456 gold of ore through
35 spent veins) was the most interesting economic story of any reign, and
it happened *despite* the merchant, not because of him.

**Mercenaries as a price ladder.** An escalating market with no market. The
price rises because you hired; it does not rise because someone else did,
or fall because a war ended somewhere. Wolfsden hired 67 companies; the
sellswords were a gold sink with a name, never a relationship.

**Tribute as designed.** Dead across three reigns, and the review argues why:
it demands a share of treasury when the threat it buys off cannot land. But
even redesigned, "pay or he marches" is a binary with a visible number. The
Danegeld that was interesting historically was the one that *worked* for a
while and then bred the appetite that ruined you. The spiral is in the code
(×1.6 per payment); the reason nobody has felt it is that nobody has ever
paid once. It is not uninteresting, it is unreached.

**Watchtowers as the dominant verb.** Covered in the review. The short
version: the best strategy in the game is the least interesting one to
watch, a wall of masters shooting from cover at ~1.8×. Any game where the
optimal play is static has a problem, and here it is a coupling problem
(the Guildhall aura feeding arrow damage), not a numbers problem.

**Anything that would add nouns.** More building types, a fourth ore, a
tech tree, research. The game's strength is that it has few nouns and each
one is load-bearing. Every direction below is about doing more with the
nouns that exist.

## 3. Directions you have not explored, or have only started

### 3a. Memory runs one way. Make it run both.

The enemy remembers (the avenger, the marked men, the appetite spiral).
Your own people do not. Morale is a number; villagers have skills but no
history. A villager who fled a sack, who watched a master die, whose family
was hunted, is indistinguishable the next tick from one who was not there.

The cheapest version: a per-villager `grievance` or `memory` that the
existing events already generate (fled, sheltered, lost a workmate,
recruited and sent home), decaying slowly, feeding morale *locally* rather
than globally, and surfacing in the chronicle by name. The expensive
version: the massacre choice has a domestic cost. Soldiers who burned the
tents come home marked (already), but nobody at home *reacts*. In Eastwold
you massacred four camps and your realm's morale sat at exactly 79 for ten
years. A temple that sang the fears away regardless of what the host did
is a temple that does not know what happened. The Merciful Shepherd reign
you listed would be more than a curiosity if mercy had a constituency.

### 3b. Nobody ever leaves.

Population grows by birth and mercy-settlers and falls by death. There is
no emigration. Aldermere starved 142 people to death with 1,425 wood and
2,770 gold in the stores; in any real famine a third of them would have
walked. Emigration is a soft failure the design philosophy explicitly
wants (A1, A2): the realm empties before it dies, and the people who left
*are somewhere*. Which leads to:

### 3c. There is no "away".

The merchant comes from away, settlers drift from the camp, the raiders
melt into the wilds. But there is no offstage world with state. One
offstage polity, never on the map, with three numbers (its harvest, its
war, its appetite for your goods), would give the merchant a counterparty,
emigration a destination, mercenaries a reason to be scarce (they are
fighting *their* war), and the truce market a template. This is not the
rival kingdom you rejected; it has no buildings and no map presence. It is
a weather system for trade. The Ming horse-market rhyme in OPEN-QUESTIONS
Session 8 is the right instinct; the offstage polity is what makes it
priceable.

### 3d. The ruler is immortal.

Reigns run 20+ years and nothing ages. The one thing an "enemy who
remembers" cannot do is outlive you, because you do not die. A dynasty
layer is cheap in mechanics (a timer, an heir with a competence roll, a
regency that is a dark age you did not choose) and enormous in meaning: it
is the game's own thesis (memory, succession, what you leave standing)
turned on the player's house. The Crown of Ages is already named for it.
Basil II died with vaults that had to be dug; the interesting question was
always who came next.

### 3e. Nobody has seen the dark age.

The keep falling is designed as a recoverable catastrophe and the docs are
proud of it. `keepFalls: 0` in every human reign. Aldermere died of famine
with the keep standing. So the game's most carefully designed failure state
is unreachable by a competent player and skipped by an incompetent one. Two
readings: the tower answer (Phase 2) makes it reachable again, or the dark
age is offered as a *choice*. A regency, an abdication, the deliberate
burning of the High Seat's scaffold to buy peace. If the best content is
the recovery, give the player a way to need one.

### 3f. Ecology is a line, not a cycle.

Forest becomes plains; plains never become forest. Veins fall back to hills;
hills flatten to plains; that is the end. The Cistercian Nomad style you
listed is a march to the edge of the map. With regrowth (slow, on unworked
plains beyond some distance from buildings) it becomes a cycle, and
"fallow" becomes a strategy rather than a chronicle line. The same goes for
winter: it halves farms and does nothing else. `sim2` had fuel-per-house and
bigger-colder knobs that were never turned on. Winter that *eats wood* makes
the receding wood-line a survival problem, not a scenery one.

### 3g. Geography as the difficulty dial.

You beat the game faster each reign, and the instinct is to make it harder.
The evidence says the doctrine was set by the map: Wolfsden's rivers made a
bridge-and-road republic, Eastwold's lakes made a fortress with two fronts.
The mapgen is seeded noise with one shape. Map archetypes (an island chain,
a river delta with one crossing, a mountain pass the raiders must use, a
plain with no stone within twenty tiles) would produce different rulers
without touching a single balance constant, and would fix the "same player
wins faster" problem by changing the question instead of the answer. This
is also where chokepoints (Pillar A, never built) come from for free.

### 3h. Intelligence as a mechanic, without fog.

No fog of war was the right call. But "no fog" became "perfect
information", and the raid-size formula is hidden only by omission. ENDGAME
§5 sketched interrogation revealing the camp; named raiders and kill
attribution were, in your words, secretly built for it. A captured raider
who tells you what wave is massing, a rider who lies about the demand, a
scout you can send and lose: information as something you *do*, in a game
with no hidden map. That is a rarer design space than fog.

### 3i. The historian as a feature.

The post-mortems I wrote for Wolfsden and Eastwold (geography reconstructed
from coordinates, the doctrine inferred from the census, the historical
match) are the best thing that came out of the reigns, and they were done
by hand from a text export. The game could do a third of it itself at the
end of a reign: eras of expansion from build centroids, the two fronts from
breach clusters, the doctrine from muster/stand-down ratios, a one-paragraph
"what this realm was". Not a stats screen; a chronicle entry in the house
voice. It is the journal's telemetry turned back into story, and it is the
thing a player would screenshot.

### 3j. Ambitions the player names.

The Great Works are the designer's ambition list. Eastwold's actual ambition
was "never hire a sellsword" and "never let a building fall", and the game
never knew. A vow system (declare it early: no walls, no mercenaries, no
massacres, no imports, the whole map) that the chronicle tracks and the
saga records as kept or broken is player-authored pull from existing data.
It also solves the six-unplayed-styles problem from the inside: the styles
become vows.

### 3k. Positive loops you can ride.

The systems-theory reading: the game is built almost entirely of negative
feedback (rubber-band raids, spoilage, decay, the appetite that resets when
faced). Its two positive loops were the gold snowball (killed) and the
masters aura (accidental, and currently the tower problem). Eastwold found
a third by play: ore imports → iron → levy → heriot → more iron. A player
who discovers a loop and rides it is having the best kind of fun a sim
offers. Rather than only damping loops, design two or three on purpose, name
them in the steward's voice when the player enters one, and price their
exits.

## 4. The one thing I would build first from this list

3a, in its cheap form. A memory on the villager, fed by events that already
fire, surfaced by name. It costs almost nothing, it uses the roster the game
is proudest of, and it is the prerequisite for 3d (a dynasty is a memory
that inherits) and for making the massacre choice cost something at home.
Everything else on this list is a session; that one is an afternoon, and it
changes what the chronicle is about.

## 5. What I would not build

A rival kingdom on the map (you were right). A tech tree. More resources.
Multiplayer, even the tempting "one player is the warlord" version, until
the single-player enemy has a society worth playing. A tutorial longer than
the Steward. Any system whose main output is a number the player has to
read rather than a line the chronicle can say.
