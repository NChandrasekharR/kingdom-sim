# Session 8 — the record (2026-08-17 → 18)

Design doc and session log in one, end to end. Companion to the commit-level
[CHANGELOG](CHANGELOG.md), the ratified calls in [DECISIONS](DECISIONS.md), the
numbers in [SIMULATIONS](SIMULATIONS.md) (Campaigns 13–14), and the new design
canon in [../design/REAVING.md](../design/REAVING.md). What this file adds: the
whole arc in order — what was asked, what was found, what was decided and why,
what shipped, and what is still open.

**The working method, set by Chandra at the top of the session:** Fable plans,
coordinates, and reviews; scoped subtasks go to Opus/Sonnet subagents in
isolated git worktrees with locked briefs ("don't have them invent the plan");
independent pieces run in parallel; every result is reviewed against its brief
before merging; if something's off, the brief is rewritten and respawned rather
than silently patched — inline fixes only when trivial. Roughly a dozen agents
ran under this contract across the two days. It held up well, with one
instructive failure recorded honestly in §9.

---

## 1. The review (where the session started)

Two parallel survey agents mapped the codebase and backlog. The load-bearing
finding came from the economy deep-dive: **the forest was already a complete,
shipped implementation of universal depletion** — per-tile finite wood,
draw-down by the nearest-timber scan, tile transform FOREST→PLAINS on
exhaustion, camp idles, render thins, saves migrate. Quarries and mines,
producing from nothing forever, were the *inconsistency* — not Chandra's
depletion idea. That reframing shaped the whole session: extending a proven
pattern, not inventing a system.

The survey also caught two doc rots (deploy banners five sessions stale;
Session 6 missing from CHANGELOG entirely) — spun off as a background task
chip, completed in its own session, reviewed and merged (`2e700d3`).

## 2. Loot justice (`9918c96`)

> "if goods are carried off but all raiders slain, I should get goods back"

The trace found loot already rides per-raider (`rd.loot`), is banked to the
camp hoard only at the escape tick, and simply *evaporates* if the carrier dies
first — and that the sally-stance tooltip had promised "loot recovered" since
Session 4 without the code ever delivering it. The build upgraded the ask: each
raider carries a **typed lootBag** (the theft site knows what it stole), so
every kill drops that man's actual goods — which strictly contains the
"all slain → all recovered" rule while fixing the one-survivor edge case and
rewarding tower shots on fleeing stragglers. Review caught one real edge (a
raider both dead *and* escaped on the same tick would double-count into hoard
and stockpile); fixed inline with the treeline guard — escape wins.

## 3. The warlord costs blood + the camp always pays (`e5056d7`)

> "warlord fight is always a easy kill. I want it to be difficult and mean
> something. and ideally loot camp even if it doesnt have anything."

Trace confirmed the piñata: 170 flat HP, walks *alone* (his A* path computed
separately from his wave), no fightback bonus of any kind (+1 gang like any
raider), arrows chip him for free, and his death instantly routs the whole
wave — trivial and optimal to focus-fire. The camp battle already had the right
idea ("the warlord in your face is worth two men") that was never ported. And
`resolveCampChoice` paid exactly ledger gold + plunder: a broke camp = "0 gold,
0 goods."

Shipped: **four sworn men** (hp 66, Oathbound names, escort-clamp within 2.5
tiles, never loot, break when leaderless), the **gang bonus ported** (warlord
counts double in melee pressure), **shield-bearers** (arrows ×0.4 while any
sworn man stands — the raid-break reward now requires meeting him in melee),
and the **spoils floor** (`CAMP.spoils` — arm-rings, stores, iron off the dead
garrison, reckoned on battle-start garrison, identical for punish/massacre so
mercy carries no price tag). Validation: seed 42 paid +7 soldier deaths and
−8.5% pop — the intended cost, no spiral.

## 4. The depletion campaigns (Campaigns 13–14)

> "do the depletion sim."

Two parallel tracks, both on the real game core via `model/simulate.mjs`.

**Wood (the campaign promised since Session 5, never run).** Four verdicts:
- **The repair treadmill fails as a cliff, not a slope.** Border-reachable
  timber dies (y19/24/29 by seed), mean building HP collapses 0.7 → ~0.02
  within two years, population freezes — the "rich slum": treasury swelling,
  every building rubble at the 40% output floor.
- **Sites lasted ~1.1 years**, not the config comment's claimed 4–6.
- **Seeds 8/37 (historic deadlocks) are rescued by trade** — a single 20-wood
  purchase breaks the lock; lifetime import cost a few hundred gold.
- **Imports are too cheap for the rich** — full import-maintenance costs only
  12–25% of late gold income. The interesting buy-cap threshold: ~20–25/visit.
- Bonus: **ghost repair** — dead camps pinned the worst-first repair queue and
  soaked 25–30% of ALL repair wood forever.

**Stone/ore (prototype + sweep, 5 scenarios × 5 seeds × 25y).** Every guessed
reserve value was too small — stone 60/90/150 all killed a quarry site by year
2–3, because a quarry works a hill *edge* (3–5 reachable tiles) where a lumber
camp faces a whole forest front. **Stone 250** hits the 4–5 year era feel;
**ore 150** keeps iron flowing to ~y17–19 through two vein rushes and 3–5
forced relocations, consuming 20–30% of the map's ore per reign (ore 90 starved
iron by year 7). The ORE→HILLS cascade worked — after the agent caught a spec
bug in the brief itself (as written, a spent vein became a hill with *zero*
stone; the cascade could never fire) and fixed it with fresh stone seeded into
the fallen tile. Controls ran tick-identical until first exhaustion; no
depletion death spirals anywhere.

**The design conversation this fed** (the ladder, ratified):

    FOREST ──cut──→ PLAINS          (wood to land — assarting)
    ORE ──mined out──→ HILLS        (ore to quarry — the cascade)
    HILLS ──quarried out──→ PLAINS  (the quarry ground becomes a plain)

Depletion as *succession*, not loss — the kingdom eats its geology and excretes
farmland; the terrain is the chronicle of the reign. Historically grounded end
to end: assarting, itinerant ironworks chasing charcoal, Kutná Hora and vein
death, the bullion famine driving expansion, Baltic timber and trade-by-water,
coppicing as the renewable escape hatch (parked). **Food/soil never depletes**
(A2 stands): medieval soil was renewable only because actively renewed —
rotation, legumes, dung — so if soil texture ever comes, it's a *cycle with a
maintenance cost*, never a countdown. Ore is a bank account; soil is a
treadmill you're allowed to walk slowly.

## 5. The ratifications (Chandra, 2026-08-17 evening)

Verbatim scope of the calls: merge at those parameters; **mine variance —
"imagine potosi level bumper stock you can really make a run interesting"**;
buy caps that scale with docks ("and scales with more docks been built. Maybe
with more markets also? So relaly go into commerce state"); auto-demolish
depleted camps/quarries/mines with refund (logged in DECISIONS *before*
building, per his instruction); mine keeps the shared 2.2 radius, no special
dead-end mechanic; endgame summit and small calls pushed; REAVING.md ordered
in full detail.

## 6. The depletion polish batch (`2b775a6`)

- **Wood 90 → 250** (measured 4.3 yr/site across seeds; 350 overshot; year-3
  economy unchanged — early game identical, late game stops churning).
- **The Potosí** — per-vein fortune rolled in mapgen (a property of the map):
  most veins 0.8–1.3×, ~1.5 deep veins per map at 3–6×, one map in six gets
  none. A reign that strikes one banks ~30× the ore. Chronicle line on first
  draw: the miners learn what they stand on by digging.
- **Merchant buy cap, commerce-scaled** — `20 + 15/dock + 5/market` per visit,
  selling uncapped, oversized orders refused whole with the reason shown.
  Resolves D4 (deferred since Turn 6) with the campaign's threshold data.
- **Auto-demolish** — spent sites strike themselves *before* the repair queue
  forms, standard condition-scaled refund. Ghost repair: 25% → **0.0%** on all
  four seeds. Downstream: seed 99's *baseline collapse* (pop 1, keep fallen,
  334 starved) now ends at pop 700; every keep fall across four seeds gone;
  late-game mean HP 0.02–0.13 → ~0.73. The dead camps were eating the wood the
  kingdoms needed. Steward's counsel rewritten (it used to instruct the player
  to demolish by hand; now the camp already struck itself).

## 7. The Reaving (design only — `design/REAVING.md`, `4539a14`)

The conversation ran: can I raid settlements / the camp → prisoners (his
category sketch: weaker, can't master, eat 0.75×, escape, turn near raiders) →
**his own balance challenge**: "you keep raiding and then 90% of your pop is
prisoners… its a materially worse economy" → the answer that anchored the doc:
**raiding is a pump, not an engine** — it buys time and stock, paid in flow,
and every cap is structural, never a tuned penalty (guard ratio ~1:5, nonlinear
revolt past ~⅓, escapees join the warlord, manumission drift, hold responses).
The European-economies discussion (plunder/tribute → manorial serfdom as the
answer to guard costs → towns/guilds → fiscal → colonization; the Black Death
making the West free and the East serfs on *enforcement capacity* alone) is
woven through the doc as argument, not decoration. The 💀 exchange — "you have
reinvented confederacy from first principles" — became the design's honesty
bar: the 90% state must be reachable, dramatic, and doomed for the historically
true reasons (no masters → no industry; army becomes wardens; one bad night).

Doc facts: 1,304 lines; holds roster (five kinds, falling wealth ceilings);
BOTH prisoner classes (named ransom-stock with rider-inverted buyback and
prison-break raids; thralls with the full labor structure and a
citizen-interaction section — thralls push freemen *up* the craft ladder,
attractive at 15%, self-devouring past 40%); hold relationships presented as
**tradeoffs, not locked** (ARM/BAND/SUBMIT/INFAMY; v1 rec: defer BAND, with the
counterargument stated); phasing A (thralls from won battles) → C (ransom) → B
(holds); Campaign 15 sim plan. Two honest flags: the interrogation system the
brief assumed **does not exist in src/** (ENDGAME.md drafted it; Package C
builds it), and **nine open questions for Chandra** — led by Q1 (sequencing vs
Great Works; the doc argues Works first), Q2 (is slavery in this game at all —
asked plainly; the design degrades gracefully if no), Q4 (the guard ratio), and
Q9 (merchant-sellable thralls — the doc says no, then argues against itself).

## 8. The preemptive strike (`7b551a9`, merged `dba0313`)

> "I see raiders gathering at the camp. but when I send soldiers they never
> fight the raiders."

Live-playtest bug, diagnosed to the bone: the massing bodies were **render-only
props** (bare {x,y}, unclickable, read by no combat system); an expedition
mid-massing fought only the garrison and could "take" a camp while 18 bodies
milled at the tents; sally had literally nothing to target (the raid array is
empty during massing); and worst — **breaking the camp didn't stop the wave**:
the pending raid's spawn guard quietly relocated it, so the gathering you just
destroyed arrived anyway from a random map edge.

The fix made the scenario Chandra imagined real ("imagine I have 40 raiders
massing. Then I go and wipe it out and the nest. that buys a lot of time"):
march mid-massing and **the gathering turns to meet you** at the true predicted
wave size (battle-only `c.massers` — deliberately not garrison, so spoils/refill
semantics stay honest); **victory cancels the wave** (fresh `quietGap`, wave
never marches); the raid **timer holds while the battle decides**; a repulse
releases the survivors back to the tents and buys nothing; the dispersal branch
kills the teleport at its source. 38/38 staged assertions. The stacked payoff —
cancelled wave + broken camp (~4y) + warlord slain (~5y successor) — is the
biggest time-purchase in the game, priced by the biggest battle in the game on
his ground, and by the race (the timer holds only once battle *opens*; march
late and the wave launches at your emptied town). The Last Muster, emergent.

Adjacent design musings logged as candidates (not built): the **truce market**
(trade with the camp as a third rider answer — he spends his hoard at your
market, his garrison shrinks as it drains; the Ming horse-market precedent:
raiding and trading are substitutes priced by access) and the **small raid**
(steal from the hoard with six men — the middle verb; couples with named
prisoners when the Reaving lands).

## 9. Ship day (2026-08-18) — and the one process failure

> "host it"

Deployed to kingdom-sim-fawn.vercel.app (`npx vercel --prod`). **The near-miss,
recorded because it's the session's best process lesson:** the first deploy
went out *without* the preemptive strike. Its "merge" had run with the shell's
working directory silently drifted into the fix's own worktree (a `cd` in a
review command persisted), so the confirming `git log` was the worktree's, not
main's. **The Session 8 doc-pass agent caught it** by verifying every hash
against main before writing "merged." Properly merged, docs corrected,
redeployed, and the live bundle string-verified. Rule adopted: merges and their
verification always run `git -C <main>` — never bare git after any `cd`.

Same day, two live follow-ups from Chandra's playtest:
- **Inspector parity** (`7b21f6c`): quarries and mines now show "stone/ore in
  reach ~N" via a shared `depositInReach` helper driven by the same
  `DEPOSIT_SPECS`/radius the extraction uses — panel and ground can't drift.
  Browser-verified ("stone in reach ~1136" / "ore in reach ~371" / "the vein is
  spent"), deployed.
- **Roads for your own people** (`22e9450`, merged `b006ea9`): his "civs dont
  always use roads, and neither do soldiers" was exactly right — only raiders
  and the expedition ever routed; soldiers got road speed by accident; villagers
  had no road logic at all. "Do it all": soldiers now A*-route any move past 4
  tiles (combat inside 4 stays straight; blades crossed drops the route),
  villagers get cached road commutes (builders and panic keep the beeline),
  budgeted pathfinding (6+8 fresh paths/tick), A* extracted to `pathing.js`
  with allocation reuse. Road occupancy: soldiers 16.7%→85.7%, villagers
  0%→83.3%; four seeds inside the balance gate; +8.2% ms/tick at pop 700+
  (after the agent caught and corrected its own drift-contaminated first
  measurement). The road tooltip — "armies march the roads — yours, and
  theirs" — is finally true in both halves. Deployed, hash-verified.

## 10. The stone question (open discussion)

Chandra's Year-40 Caer Bryn screenshot (all three crowns, 353 subjects, 39
raids weathered — the long playtest underway on the live deploy, with **ore
reading 0**: vein depletion biting in a real human reign) surfaced the
asymmetry: **stone 10,389** against wood 4,529, iron 5,734, gold 14,171.
Diagnosis, four layers: production near-symmetric but wood is the universal
construction+repair currency while stone's sinks (walls, roads, towers) are
front-loaded defense infra that saturates by ~y15; auto-assigned labor keeps
quarries running into a stockpile nobody wants; stone was *deliberately
bottomless* until this session, so its demand side was never designed; and
historically stone wasn't a stockpiled commodity at all — it was quarried per
project (the cathedral opens the quarry and closes it). Iron and gold share
the disease; stone saturates earliest. **Position on the table:** the real cure
is the Great Works summit (the designed stone/gold/iron sink — the screenshot
is the argument for scheduling it), plus two small independents takeable any
time: walls/towers repair with stone rather than the flat wood-led mix, and
quarries drop in `WORK_PRIORITY` when stone exceeds plausible demand.
**Awaiting Chandra's call.**

---

## The pending register (end to end)

**Chandra's design calls, ready when he is:**
1. **Great Works summit** — Great Works ladder + Crown of Ages + Last Muster +
   rally banner as ONE endgame design session. Pushed this session; the Y40
   screenshot (10k stone, 14k gold, nothing to want) is its standing argument.
2. **Stone sinks pair** (independent of the summit): stone-honest repair for
   walls/towers; demand-aware quarry priority.
3. **REAVING.md's nine questions** — especially Q1 (sequence vs Works), Q2 (is
   slavery in, at all), Q4 (guard ratio feel), Q9 (merchant-sellable thralls).
4. **Truce market** (design next to REAVING's infamy so trader/reaver price
   consistently) and the **small raid** — both candidates in OPEN-QUESTIONS.
5. **Steward Q4** (auto-drop to 1× at first raid warning) — one line, pushed
   three sessions running.
6. **Typed camp hoard** — reclaimed iron still comes home as grain carts;
   inconsistent beside typed on-map loot recovery. Small.
7. **Successor escalation** (each warlord harder than the last) — parked in the
   boss rework, still open per ENDGAME.md.

**Process debt:**
8. **The long playtest** — now live and partway (Caer Bryn, year 40+). Session
   8 loaded it heavily: loot justice, sworn men, spoils, the full depletion
   ladder at 250/150/250, the Potosí, the buy cap, auto-demolish, the
   preemptive strike, roads — all bot-calibrated, none human-felt until this
   reign says so. Watch especially: the sworn-men fight's difficulty curve, the
   buy cap's bite on a rich harbor kingdom, whether depletion reads as story,
   and the preemptive-strike race.
9. **The onboarding kill gate** — hand the game to a stranger; survive the
   first raid; explain bread. Never run.
10. **Unmerged worktree** — the wood campaign's harness instrumentation and
    `TRADE=1` rescue rule (worktree `agent-a7a5292f7f24eb425`); merge or
    cherry-pick decision pending.
11. **sim2 fidelity items** (B3–B6, C1–C3) — unchanged; the abstract harness
    still has no depletion model and its scripted player remains passive.

**Watch items (new this session):**
12. Pathfinding cost at very high pop (+8.2%/tick at 700–870; budgeted, but
    Caer Bryn-scale reigns should stay smooth).
13. The embedded-preview browser renders the Phaser canvas black (WebGL
    "Framebuffer: Incomplete Attachment") — environment limitation, not a game
    bug; real Chrome unaffected. Remember before chasing "black map" reports.
14. "Buildings gone" in the headless summary now counts struck spent camps
    alongside raid losses — the label says so; don't misread sim comparisons.

**Parked (revisit only on playtest evidence):** food/soil depletion (A2
protection, ratified again this session), forester/coppicing renewable wood,
laden dark-age raiders, steward-as-body v2, fog-of-war (still rejected).
