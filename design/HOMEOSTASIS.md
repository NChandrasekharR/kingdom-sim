# Homeostasis: why a winning realm stops playing, and what pulls it back

**Status: DESIGN + MEASUREMENTS. Two items shipped:**
- **The √ raid curve** (§2.4, §10.6): `2 + 4.5√p + 0.15 × soldiers`, warlord
  ×1.8, cap 90.
- **The text fixes** (§11): names, pronouns, articles, trade lines, journal
  trimming, housing hints.

Everything else is a proposal. §10 gives the harness numbers for the levers
that could be tested without new systems.

Source material: the Thornmere playthrough (seed 144155786, 39.8 years,
victorious, chronicle Years 18–40) and a 40-run harness batch against the
real core (`model/homeostasis-run.mjs`).

Companion docs: `design/ENDGAME.md` (Great Works, crowns), `design/REAVING.md`
(the camp, massacre and mercy, marked men), `docs/DECISIONS.md`.

---

## 0. The one-paragraph version

A competent realm reaches **homeostasis** somewhere between Year 12 and Year 26.
After that:
- **Food, housing, the army and defence are all solved.**
- **Every stock grows without limit.** Gold, bread, iron and stone pile up.
- **Every threat is flat.** Raids are capped at 40 men, and the crown
  thresholds are long passed.

Thornmere sat at 300/300 people with morale 79 for 14 years. It banked 55k
gold, let 20k food rot, and fought 20 raids of exactly 40 raiders, losing
about one soldier per raid. Stopping at 300 was the rational move, not a
mistake: **nothing in the game makes an extra person, an extra coin or an
extra granary worth having.**

The root cause has one shape everywhere. **Sinks are fixed while income grows
with skill and land.** So every fix in this doc is the same move: make a
sink grow with success, or make an input scarce again.

---

## 1. Evidence

### 1.1 Thornmere, by phase

| Phase | Years | What happened |
|---|---|---|
| Crisis | 18–21 | Raids cost 10–20 soldiers each. Barracks built in bursts. Warlord Torvald's tribute refused, then he was killed. Guildhall built. Mercy at the Salt Scar. |
| Boom | 22–26 | Great Temple and High Seat built. Masters went from 85 to 184. Population reached 300. Raid losses fell to 0–4. |
| Plateau | 27–40 | Population flat at 300, morale flat at 79. Gold rose from 13k to 55k. Three massacres, each followed by an avenger, each avenger killed. Dominion, the last crown, arrived in Year 40. |

Final reckoning:

| Measure | Value |
|---|---|
| Gold | 55,376 |
| Iron | 5,502 |
| Bread | 16,537 |
| Food spoiled | 20,039 |
| Kill/death ratio | 12.9 |
| Masters lost | 34, mostly run down at remote extraction sites |
| Veins spent | 35 |
| Hills flattened | 104 |
| Raid size, wave 16 onward | 40–45 every time |

### 1.2 The crowns were done long before victory

| Crown | Threshold | Thornmere at the end |
|---|---|---|
| People | 80 | 300 |
| Plenty | 800 gold | 55k |
| Dominion | 30% of claimable land | Won Year 40 |
| Ages | High Seat built | Won Year 30 |

Dominion alone gated victory, and painting roads (279 road tiles) was the
cheapest way to buy territory.

### 1.3 The harness reproduces it

The baseline bot (§10) hits its housing cap at a median of **Year 13**. It
then holds a 105-man army, loses about 2 soldiers a raid from Year 20 on, and
banks a median of 52k gold by Year 30. **Raids are pinned at 40 from Year 10.**
From Year 20 on, the uncapped formula asks for a median of **298 raiders**.

---

## 2. The raid size curve

### 2.1 What ships

```
size = 2 + prosperity/350 + soldiers × 0.4    → min(·, sizeCap = 40)
```

`raids.js:185`. The cap has been 40 since the formula was introduced
(`fdd2ae7`), and it binds from about Year 10. For the remaining 20–30 years
none of these feed through: wealth, army size, the warlord ×2.5, the avenger
×1.35, or Great Work menace. Warlord waves read 45 only because the warlord
and his 4 sworn men are added after the cap.

At Thornmere's Year 40 wealth (prosperity about 130k), the uncapped formula
wants about **430** raiders. The cap is covering for a formula that grows too
fast.

### 2.2 The options

Here **p** is prosperity ÷ 1000.

| Shape | Formula (example) | p = 22 (Y19) | p = 130 (Y40) | What the player learns |
|---|---|---|---|---|
| Linear + cap (shipped) | `2 + 2.9p`, cap 40 | 40 | 40 | Wealth stops mattering in the middle game. |
| √ | `8 + 6√p` | 36 | 76 | Wealth always costs raiders, but less and less. |
| Log | `10 + 15·ln(1+p/5)` | 35 | 59 | Flattens fast, so the late game is cheap again. |
| Saturating | `80p/(p+30)` | 34 | 65 | A soft ceiling. The same problem, smoothed. |
| Power 0.7 | `3p^0.7` | 26 | 92 | Barely curves, so it keeps pace with a hoarder. |
| Defence-scaled | `k × defence strength` | 43 | 84 | Never goes stale. An unwinnable arms race (RimWorld's lesson). |
| Rate-scaled | on Δhoard over N years | — | — | Spending your surplus is how you manage threat. |

**Design the slope, not the level.** The slope (extra raiders per extra
1,000 gold) is the price of hoarding.
- **Log and saturating curves push it to zero**, which recreates homeostasis.
- **√ and power-0.7 keep a real, declining price.**

### 2.3 Growing difficulty without more bodies

Raider count is a crude dial: it costs performance and readability, and 400
raiders aren't a better fight than 60. Alongside a headcount curve:

- **Composition tiers.** Unlocked by milestones (each Great Work, each crown,
  each camp destroyed): armoured raiders, archers who answer towers, rams and
  sappers who go for walls. The steward already says "every raider from here
  to the sea will hear of what we pile there". This makes it true.
- **Several fronts.** In the late game, 2–3 bands from different edges, each
  capped. This tests coverage rather than totals, and pairs with §3.
- **Target selection.** A richer realm draws raiders who aim at the treasury,
  the Great Works or the granary.

### 2.4 Recommendation

- **A √ curve for headcount. SHIPPED** as `2 + 4.5√p + 0.15 × soldiers`, with
  the warlord multiplier cut from 2.5 to 1.8 and the cap raised to 90 as a
  performance ceiling only. The base of 2 keeps the opening at today's raid
  sizes. The lighter warlord multiplier keeps early dread waves at about 45,
  now that no cap swallows it. See §10.6. (§10.2's `sqrtsoft` used base 8: it
  made Year 1 raids 12 instead of 5 and Year 7 warlord waves about 69.)
- **Composition tiers keyed to milestones.**
- **Two simultaneous bands after the Temple.**
- **Keep the army term small.** Defence must be something you can win.

---

## 3. Regional defence: garrisons, not a keep-centred army

### 3.1 Today

One army. One rally point beside the keep (`raids.js:860`). Every soldier
answers every horn. Stances are hold, sally and rally. Raiders pick targets by
loot value alone (`pickTarget`, `raids.js:311`) and never read defenders.

The army marches out from the keep for every raid on every remote mine. That's
why remote masters die: 34 in Thornmere, a median of 29 in the harness.

### 3.2 How historical states did it

No pre-modern state defended its frontier from the capital. Riders were too
slow.

- **Rome.** A legion was stationed at León for about four centuries, over the
  north-west Spanish gold country (Las Médulas). Detachments sat at the
  mining districts, with watchtowers on the roads. Later this became a
  two-tier system: frontier troops who held and delayed, plus a central field
  army for invasions.
- **Byzantium (the themes).** Soldiers held land inside the province they
  defended. The 10th-century manual *On Skirmishing* says: evacuate people to
  forts, shadow the raiders, and ambush them at the passes **on the way
  out**, when they're loaded and slow.
- **Alfred's burhs.** Fortified towns sited so no one was more than about
  20 miles from refuge. Garrisons were assessed on the land around each one
  (the Burghal Hidage). The fyrd served in rotating halves.
- **Normans.** A castle about every day's ride, each with a castellan
  responsible for his district.
- **Han and Ming China.** Frontier military farms that fed themselves.

The principles:
1. **Layers:** local delay, then regional garrison, then central reserve.
2. **Troops live where they defend.**
3. **Protect people and accept losing property.**
4. **Fight the exit.**
5. **The ruler sets postings and doctrine, not individual fights.**

The tension that never goes away is **spreading out versus concentrating**.
Raiders working around your army isn't a bug. It's the problem every frontier
existed to manage.

### 3.3 Proposal

| Mechanic | What it does | Historical anchor |
|---|---|---|
| **Barracks garrisons** | Soldiers belong to a barracks, rest there, and respond within its radius. Twenty barracks becomes a placement decision. | Legion bases, themes, castellanies |
| **Field army** | Unassigned soldiers at the keep go to the largest threat or reinforce a garrison that's losing. The hold, sally and rally stances map onto it. | Late-Roman field army |
| **Beacon chain** | A tower that sees raiders relays the alarm along the chain to the nearest garrison. Reaction time becomes something you build. | Roman signal towers |
| **Refuges** | Remote workers flee to the nearest tower, wall or barracks instead of running across open ground. | Burhs, motte-and-bailey |
| **Militia** | Extraction crews fight weakly near their own site. A delay, not a defence. | The fyrd |
| **Exit interception** | Raiders carrying loot are slow and head home. The field army can cut them off. "Goods won back" becomes a plan. | Byzantine shadowing |
| **Raiders read defence** (later) | Target value is discounted by nearby garrison strength. | — |

**The cost:** every soldier in a garrison is one missing from the field army.
Spread too thin, and a warlord wave beats garrisons one at a time. That makes
§2's bigger raids a real decision between spreading out and concentrating.

**Smallest useful slice:** barracks garrisons with a response radius, plus
refuges.

---

## 4. Food: from solved to a constraint

### 4.1 Today

| | Output per worker | Feeds | Fully skilled |
|---|---|---|---|
| Farm | 0.25 (winter ×0.4, so about 0.21 over the year) | about 5 | about 10 |
| Dock | 0.20 all year, never depletes | 5 | 10 |
| Bakery | +0.2 food-equivalent per worker | — | — |

Thornmere's Year 40 realm needed about 23 food a tick: 27 skilled farmers,
**under 10% of the population**. Medieval Europe was roughly 80–90% on the
land, with a surplus per household of only a quarter to a half above its own
needs. That surplus capped armies, towns and clergy. The game's agriculture
is 4–8× too productive. Farms and docks are also the same choice: within 6%
of each other per worker, with no land quality, no depletion and no risk.

### 4.2 Proposals

1. **Make yields fall as the realm grows; never cut them flat** (see §10.2:
   a flat cut is fatal). Give tiles a fertility value: the best land is
   farmed first, and marginal land yields less. Forest that "lies open for
   farming" becomes worth clearing.
2. **Make farms and docks different bets.**
   - **Farms:** high, variable output. Bad harvests, winter, and raiders
     burning standing crops (the standard medieval way to make a raid hurt).
   - **Docks:** low and steady. Fish stocks thin if overfished, as forests
     and veins already do.
3. **Harvest labour peak.** Farms need double crews in late summer.
   Campaigning season and harvest collide, as they did historically: armies
   went home for the harvest, and the fyrd served in halves for that reason.
   A summer expedition then costs grain. An army that can never be disbanded
   (the marked men) gains a real economic cost.
4. **The steward names the binding constraint.** "Grain rots — bake bread"
   fired about 10 times in Thornmere when housing was what bound. Replace it
   with "the granaries overflow and every bed is taken".

---

## 5. Materials: stone, wood and charcoal

### 5.1 Stone-rich, not stone-hungry

Thornmere sold **5,890 stone**, more than every Great Work combined needs
(about 4,050 across the three tiers, foundations included), and still ended
with 2,813. Stone *feels* dominant because:
- the map is covered in quarry scars;
- every state-level building costs stone;
- it was the best export (49 gold per 10 against wood's 20–28).

The split is historically right: stone was the state's material, and ordinary
people built in timber. Two things are wrong:

- **Roads cost stone.** That's Roman, not medieval. Medieval roads were packed
  earth. Proposal: a dirt track costs labour only, with paving as a later
  upgrade that needs stone.
- **Wood isn't under pressure.** Medieval iron was limited by charcoal, which
  stripped the Weald and the Swedish forests. The smelter burns 0.15 wood per
  0.3 ore. Proposal: raise the wood draw so iron competes with houses for
  forest. **The harness shows this does nothing on its own (§10.2)** while
  the caravan sells iron directly. It needs §6's import limits to bite.

---

## 6. Trade

### 6.1 What Thornmere's ledger looks like

| Resource | Quantity | Gold |
|---|---|---|
| Stone sold | 5,890 | 11,340 |
| Bread sold | 5,280 | 9,482 |
| Wood sold | 3,400 | 5,207 |
| Iron sold | 450 | 2,892 |
| Ore bought | about 1,420 | about 10,000 |

Net: about 29k gold earned against about 10k spent. The surplus went into the
hoard.

### 6.2 Historical precedents

- **Mesopotamia: grain out, metal in.** It exported grain and textiles and
  imported copper and tin. The lesson is dependency: tin-reliant states
  couldn't arm when the trade collapsed around 1200 BCE. Thornmere imported
  its strategic metal and nothing ever tested that dependency.
- **Bergen and the Hanseatic League: one buyer on both sides.** Thornmere's
  stone price fell from 49 to 8 within one visit while its ore price rose
  from 51 to 103. The caravan is the only buyer *and* the only seller.
- **Mercantilism, and Ming China's silver sink.** Pile up bullion as
  strength. But bullion *did* something there: Ming taxes were paid in
  silver, and Spanish silver paid armies. In Thornmere gold does nothing.
- **Bulk stone overland is not historical.** Stone travelled only as a
  prestige good, and by water: Caen stone to Canterbury and Westminster,
  marble from the Sea of Marmara, Egyptian granite to Rome.

Note: prices already re-roll on every caravan visit (`trade.js:29`), so
prices recovering between visits is not the gap. The gap is a single counterparty.

### 6.3 Proposals

1. **Transport cost by weight.** Overland caravans pay little for stone and
   more for bread, iron and goods. Dock routes carry bulk goods, so a coastal
   realm can become a Caen.
2. **A second, competing caravan.** Breaks the single buyer and gives the
   market screen a real decision: sell now at 20, or wait.
3. **The ore route can be cut.** Warlords raid or block the caravan road, or
   a camp sits astride it. This also gives §3's exit interception a second
   target.
4. **A stop-loss when selling.** Show the next lot's price on the button, or
   let the player set a minimum price. Thornmere sold stone down to 6 gold
   per 10 while holding 10k gold.

---

## 7. Gold needs a job

Mercenaries and the Great Works are its only uses. After the High Seat, gold
is a score. Candidates, each a sink that grows with success:

- **Soldier wages in peacetime**, rising with army size. Marked men can't be
  disbanded, so they must be paid.
- **Great Work upkeep.** Festivals cost bread and gold.
- **Taxes and tribute both ways**: vassal stipends, bribes to camps.
- **§2.2's rate-scaled raids**, which make *spending* the defence against
  attention.

---

## 8. Massacre versus mercy: consequences paid in surplus currencies

The massacre's costs, and why none of them bit in Thornmere:

| Cost | Why it didn't hurt |
|---|---|
| Avenger raids ×1.35 | Cancelled by the 40-man cap. |
| An avenger arrives ~500 ticks sooner | Against a 140-sword army. |
| Marked men can never be disbanded | Food was surplus, so their 3× eating cost nothing. |

And marked men get **50% kill resistance** (`CAMP.markedKillResist`), which is
a buff. Morale was 79 before the first massacre and 79 after the third.
Mercy's reward is up to 4 settlers, worth nothing at a full housing cap.
`REAVING.md` says "mercy is also the profitable option". In the late game the
opposite is true.

Proposals:
- **Put the costs in what is actually scarce late:** masters, depleting ore and
  stone, time, and morale.
- **Give marked men politics.** A morale drag in peacetime. Pressure to march.
  Refusals to garrison. The Praetorian, Mamluk and Janissary problem: a
  military caste you can't demobilise ends up running the state. That is
  Thornmere's real Year 41 threat, and the game can't express it today.
- **Mercy's settlers bypass the housing cap**, or arrive as skilled masters.

---

## 9. Population: give people a marginal value

There is no ageing and no natural death. Upkeep exists only for mercenaries.
At the people threshold (80), more people stops helping. Candidates:

1. **Ageing and mortality.** Masters grow old and must train apprentices. A
   steady drain on labour, and it gives "the knowledge dies too" meaning
   outside of raids.
2. **Depletion that needs more labour, not just more distance.** Remote sites
   take 2–3× the crew per unit.
3. **Great Works need a crowd** on site at once.
4. **Dominion held by people.** Territory needs population living on it, not
   roads painted across it.
5. **§4's lower food yield** puts a cost on every extra mouth.

---

## 10. Harness results (Campaign 15)

### 10.1 Method

Command: `sh model/homeostasis-batch.sh 30`. Then `node model/homeostasis-table.mjs`.
The batch was 8 variants × 5 seeds (42, 7, 123, 99, 2024) × 30 years, all
against the real `src/core/`.

The bot (`model/homeostasis-run.mjs`) is shaped like Thornmere:
- it stops raising houses at 300 people;
- it aims to keep 35% of the population under arms;
- it runs 4–5 mines, 2 smelters, 5 lumber camps and 3 quarries once past 120 people;
- it builds docks, buys iron when short, and never sells iron;
- it builds the Great Works when it's rich and defended;
- its food rule reads the *live* yields, so a leaner farm makes it build more
  farms rather than starve.

The variants:

| Variant | What it changes |
|---|---|
| `baseline` | Shipped config |
| `sqrt` | `8 + 6√p + 0.25 × soldiers`, cap 90 |
| `sqrtsoft` | `8 + 4√p + 0.15 × soldiers`, cap 90 |
| `leanfood` | Farm 0.25, dock 0.2: half today's yield, flat |
| `taperfood` | Today's yield up to 60 people, tapering to half at 200 (stands in for fertility) |
| `charcoal` | Smelter wood draw 0.15 → 0.45 |
| `combined` | sqrt + leanfood + charcoal |
| `combined2` | sqrtsoft + taperfood + charcoal |

### 10.2 Results (medians across 5 seeds)

**Economy**

| Variant | At 300 people (seeds, median year) | Farm+dock share of pop, Y25 | Years of food stored, Y25 | Food spoiled (total) | Gold Y30 | Army Y30 | Soldiers fallen | Masters lost |
|---|---|---|---|---|---|---|---|---|
| baseline | 5/5, Y13 | 43% | 1.7 | 56,729 | 51,805 | 105 | 213 | 29 |
| sqrt | 4/5, Y15 | 35% | 2.7 | 54,989 | 29,868 | **8** | 279 | **80** |
| sqrtsoft | 5/5, Y12 | 43% | 1.6 | 57,295 | 63,816 | 105 | 217 | 48 |
| leanfood | **0/5 (stuck at 10)** | 60% | 0.1 | 1,505 | 334 | 0 | 0 | 0 |
| taperfood | 4/5, Y17 | **73%** | 0.2 | 29,539 | 18,675 | 21 | 253 | 60 |
| charcoal | 5/5, Y12 | 43% | 1.7 | 52,348 | 53,995 | 105 | 214 | 29 |
| combined | 0/5 | 60% | 0.1 | 1,387 | 328 | 0 | 0 | 0 |
| combined2 | 3/5 | 70% | 0.3 | 18,107 | 15,418 | 43 | 232 | 79 |

**Raids**

| Variant | Raid size Y10–19 | Raid size Y20+ | Uncapped wish Y20+ | Soldiers lost per raid, Y20+ | Keep falls (all seeds) |
|---|---|---|---|---|---|
| baseline | 40 | 40 | 298 | 2.0 | 2 |
| sqrt | 49 | 63 | 68 | 16.0 | 2 |
| sqrtsoft | 42 | 60 | 57 | 8.0 | 1 |
| taperfood | 40 | 40 | 120 | 10.0 | 0 |
| charcoal | 40 | 40 | 276 | 1.0 | 1 |
| combined2 | 32 | 41 | 42 | 11.0 | 1 |

**Trade**

| Variant | Stone sold | Wood sold | Iron bought | Gold spent on iron |
|---|---|---|---|---|
| baseline | 9,220 | 20,531 | 1,210 | 15,898 |
| taperfood | 3,005 | 8,779 | 1,300 | 15,948 |
| combined2 | 1,818 | 3,969 | 1,270 | 16,118 |

### 10.3 What the numbers say

1. **The shipped curve is pinned at 40 for 20 years.** The formula's own wish
   reaches about 300 by Year 20. The cap does all the work. Confirms §2.1.
2. **The first √ curve is too harsh for a wall-less defender.** The army
   bleeds 16 soldiers a raid and collapses to 8. Masters lost nearly triple.
   **`sqrtsoft` holds:**
   - raids grow from 42 to 60 across the game;
   - the three seeds whose army reached critical mass keep 105 soldiers;
   - losses settle at about 8 a raid;
   - masters lost rise from 29 to 48. Remote extraction now costs something,
     which is §3's argument made in numbers.
3. **A flat cut to food yield is a poverty trap.** Every seed stalls at
   10 people with 6 farming: no wood, no houses, no growth, forever. *The
   opening depends on today's yield.*
4. **A tapering yield works and produces the historical shape:**
   - 53–81% of people on the land;
   - about a quarter of a year's food in store instead of 1.7 years;
   - spoilage roughly halved;
   - gold at Year 30 down 64%;
   - stone exports down 67%, because quarry labour moved to the fields.

   It also brings back pressure. Homeostasis arrives later (median Year 17,
   not 13), and seed 42 never reaches it: it finishes at 194 people with
   about 750 gold. Some realms are now *poor*.
   Taper rates, and how they interact with the army share, need tuning.
5. **The charcoal change alone does nothing.** Iron bought, gold, army and
   wood stock are all unchanged within noise. The caravan sells iron
   directly, so the smelter's wood draw never binds. Charcoal needs §6's
   import limits (or no iron for sale) before it matters.
6. **Armies are bistable.** In every variant, seeds split into two groups.
   Some build a big army (around 105) whose losses fall to 0–3 a raid
   (force ratio, `COMBAT` Finding 8.1). Others never reach critical mass:
   they bleed about 10 a raid and can't buy iron fast enough to replace them,
   so they sit at 0–15 soldiers with 25–70k gold they can't spend.

   That second group is §6.2's tin-dependency failure in miniature. It also
   means medians across mixed seeds hide two regimes, so read per-seed
   trajectories (§10.4) before tuning.

### 10.4 Per-seed trajectories

Population and army at Years 10 / 15 / 20 / 25 / 30.

| Variant | Seed | Population | Army | Gold Y30 |
|---|---|---|---|---|
| baseline | 42 | 160/300/300/300/300 | 56/82/105/105/105 | 69,086 |
| baseline | 7 | 298/300/300/300/300 | 0/13/9/16/3 | 25,708 |
| baseline | 2024 | 277/300/300/300/300 | 72/105/105/105/105 | 77,802 |
| sqrtsoft | 99 | 230/300/300/300/300 | 60/105/105/105/105 | 63,816 |
| sqrtsoft | 123 | 295/300/300/300/300 | 6/10/9/1/13 | 25,215 |
| taperfood | 42 | 134/161/187/189/194 | 47/45/49/25/21 | 760 |
| taperfood | 2024 | 195/271/300/300/300 | 48/52/72/72/72 | 11,320 |
| combined2 | 99 | 170/185/154/185/185 | 47/52/37/52/52 | 2,815 |

Full data: `model/out/homeostasis/<variant>-<seed>.json`, with a yearly
series and a per-raid ledger for each run.

### 10.5 Caveats

- **The bot doesn't build walls and places towers only by territory size.**
  Thornmere's 12.9 kill/death ratio came from walls, 12 towers and the keep.
  The bot's losses overstate what a human would suffer under the harder raid
  curves.
- **The bot sells food above 3 per person.** Food exports (about 100k in
  baseline) hide some spoilage. The effect is the same across variants.
- **`taperfood` is applied by the harness**, on each policy tick, from the
  population. It stands in for fertility per tile and is not a mechanic.
- **Five seeds, with a bistable army.** Treat medians as directional.

### 10.6 The shipping tune (sqrtA, sqrtB → shipped)

`sqrtsoft` looked right late but was wrong early. With a base of 8:
- Year 1–3 raids were 14 against today's 10;
- warlord waves at Years 4–12 reached about 69, because the ×2.5 multiplier
  was no longer swallowed by a cap of 40.

Two retunes, 5 seeds × 30 years each. "Lost" is the median soldiers lost per
raid.

| Variant | Curve | Y1–3 | Y4–9 (lost) | Y10–19 (lost) | Y20+ (lost) | Warlord waves Y4–12 (lost) | Masters lost |
|---|---|---|---|---|---|---|---|
| baseline (linear, cap 40, warlord ×2.5) | — | 10 | 32 (13) | 40 (10) | 40 (2) | 45 (21) | 29 |
| sqrtsoft | `8 + 4√p + 0.15s` | 14 | 22 (7) | 42 (6) | 60 (8) | 69 (28) | 48 |
| sqrtA | `2 + 4√p + 0.15s` | 9 | 20 (5) | 41 (5) | 56 (6) | 55 (31) | 68 |
| **sqrtB, shipped** | `2 + 4.5√p + 0.15s`, warlord ×1.8 | **9** | 22 (4) | 44 (6) | **58 (6)** | **45 (19)** | 57 |

What changes with the shipped curve:
- **The opening and the first dread waves match today's game.**
- **Years 4–9 are slightly lighter** (22 against 32). The linear curve climbed
  faster there.
- **The late game finally moves:** raids grow to about 58 and cost about
  6 soldiers each instead of 2.
- **Late warlord waves reach the cap of 90** (95 with the warlord and his
  sworn men).
- **Masters lost roughly double** (29 to 57). Remote extraction now costs
  something, which is the pressure §3's garrisons and refuges are meant to
  answer. Until those ship, expect players to feel it at outlying mines.
- **Army bistability is unchanged:** 3 of 5 seeds sustain about 105 soldiers,
  as in baseline.

`node model/homeostasis-run.mjs shipped <years> <seed>` runs the live config.
Every other variant first resets the raid settings to the pre-Campaign-15
curve, so the tables above stay reproducible.

---

## 11. Text and UX fixes (cheap, independent)

**Shipped:** all but the last two rows.
- **Names:** `mintFolkName` in `camp.js`, 42 names, retired avenger names.
- **Pronouns and articles:** `src/core/names.js` (`pron`, `theName`).
- **Trade lines:** `ledgerLine` in `trade.js`, one line per resource per
  visit, rewritten in place.
- **Journal trimming:** `trimJournal` in `events.js`. Births, trades, single
  blows and recruitments are dropped first, so the founding years survive.
- **Housing hints:** the population tooltip and the "every bed is taken"
  rot message.

| Issue | Where | Fix |
|---|---|---|
| The camp folk name pool has 16 first names, indexed by id. Wren escapes the Salt Scar and becomes the Ash-Sworn, then "Wren, a beekeeper" dies at Mirefast. Aldith dies, then escapes. | `camp.js:21`, `:169` | Track used names. Never reuse an avenger's name. Widen the pool. |
| Hardcoded "his" for warlords (Thyra, Aldith) | `camp.js:183`, `:765`, `ui.js:567` | Gendered names, or neutral phrasing |
| "The The High Seat" | `state.js:227`, `economy.js:376` | Drop the added article when the name already starts with "The" |
| Journal drops Years 0–17 (cap of 4,000 lines); 1,650 trade lines and 435 births crowd it | `events.js:19` | One line per caravan visit ("Sold 310 stone, 721 gold, 49→8"). Keep lines by importance, not recency. |
| The 300/300 counter reads as a hard ceiling | `ui.js:696` | Show what raises it: "300/300 — raise houses" |
| No mercenary prompt when the army marches (open) | expedition start | "The kingdom stands thinner. Hire sellswords to hold the walls?" |
| Selling has no stop-loss (open) | trade UI | §6.3.4 |

---

## 12. Sequencing

1. **Done:** the §11 text fixes and the √ raid curve (§10.6).
2. **Food as a constraint:** fertility per tile with tapering yields (§4.2.1),
   farms and docks as different bets (§4.2.2). Before shipping, re-run §10 with
   the fertility mechanic in place of the harness taper.
3. **Regional defence slice:** barracks garrisons plus refuges (§3.3). Re-run
   with the bot assigning garrisons to its extraction sites, and expect
   masters lost to fall.
4. **Trade and gold sinks:** a second caravan, transport by weight, a road
   that can be cut, soldier wages (§6.3, §7). Charcoal (§5) only after these.
5. **Late-game politics:** marked men as an internal actor, consequences
   charged in scarce currencies (§8). Ageing (§9.1).

## 13. Open questions

- Should Dominion be held by people (§9.4) or stay geographic?
- Does a harvest labour peak (§4.2.3) belong in the first food pass, or after
  garrisons, since both pull soldiers?
- Is a bistable army the intended late game (force ratio as a threshold), or
  should replacement be easier for realms below critical mass?
- What ceiling, if any, should population have once food is a real constraint?
