# The Reaving: off-map raiding, prisoners, and the price of predation

**Status: DESIGN ONLY. Nothing built.** This is the reference doc a build
session implements from. It assumes the shipped Session 5–8 machinery: the
camp and the march (`src/core/camp.js`), the punish/massacre choice with its
consequence package (avenger, marked men, mercy-settlers), the tribute rider
(`payTribute`/`refuseTribute` in `raids.js`), loot recovery off slain raiders
(`recoverLoot`), the sworn-men retinue, camp spoils, and finite
wood/stone/ore (`DEPOSITS`, `drawDeposit`).

Companion docs: `design/ENDGAME.md` (the pull half of the late game — Great
Works, the Crown of Ages), `docs/DECISIONS.md` (what may not be
relitigated), `docs/OPEN-QUESTIONS.md` (the register this doc feeds).

---

## 0. The one-paragraph version

The ground gives out. Wood, stone, and ore are finite now, and a kingdom that
has eaten its map has exactly three answers: **buy it** (trade), **claim it**
(expand), or **take it** (the Reaving). The Reaving is the third door — a
roster of named off-map holds you can march on for their gold and grain, and
the people you bring back in chains. It is deliberately the most profitable
door in the short run and the most corrosive in the long one. **Raiding is a
pump, not an engine:** it buys TIME and STOCK, paid for in FLOW — trade
income, incoming settlers, army availability — plus a risk curve that
steepens with every raid. There is no steady state in which thralls
outperform freemen. A player can absolutely build the ninety-percent-thrall
garrison state; it must be reachable, dramatic, and doomed in the ways
history actually doomed it.

---

## 1. The balance law (read this before any number below)

Everything else in this doc is an implementation of one law. If a mechanic
below conflicts with it, the mechanic is wrong.

> **The Reaving converts flow into stock, and the conversion rate worsens as
> you do it more.**

Unpacked:

- **What it buys:** goods NOW (loot lands in the stockpile the tick the host
  walks through the gate), labor NOW (thralls work the tick they arrive, no
  twenty-year wait for a child to grow up), tribute LATER (a broken hold that
  submits pays you Danegeld — the game's opening gesture, inverted).
- **What it spends:** army availability (the host is off the map — this is
  the true cost, see §3.4), merchant goodwill and caravan frequency (§6),
  settler drift (§6), and the soldiers themselves, permanently converted into
  wardens by the guard ratio (§5.4).
- **Why there is no equilibrium:** every one of the four caps below is
  STRUCTURAL — it emerges from a resource the player must spend, not from a
  penalty multiplier we tuned. Structural caps survive players finding the
  numbers; tuned penalties do not.

**The four structural caps.** Memorize these; they are the doc's spine.

| Cap | Mechanism | What it makes impossible |
|---|---|---|
| **Guards** | thralls need soldier-overseers at ~1:5 (§5.4) | scaling thralls without dismantling your field army |
| **Revolt** | escape risk goes nonlinear past a thrall fraction of ~1/3 (§5.5) | a large thrall population that is also a *safe* one |
| **Assimilation** | thralls manumit to free settlers after ~8 years (§5.6) | a permanent unfree class that never costs you anything |
| **Response** | holds arm / band / submit; infamy erodes trade and settlers (§6) | farming one fat hold forever |

**The forbidden fixes.** If balance breaks, do NOT reach for: a hard cap on
thralls; a flat morale penalty per thrall; a "raiding is bad" gold tax; a
cooldown on expeditions. Every one of those is the designer telling the
player what to feel. Reach instead for the guard ratio, the revolt threshold,
the manumission clock, or the hold-response curve — the four things the
*world* does back.

**The failure mode we are deliberately building toward.** The 90%-thrall
garrison state should be reachable by a competent player who wants it. When
they get there they should find: a huge grain surplus and no bread worth
eating (no masters — §5.3), an army that is entirely prison guards, a border
nobody defends, a warlord camp fattened on their own escapees (§5.5), and one
bad winter between them and the torch. Not a lose screen. A2 holds: the
uprising is a dark age you climb out of, and the climb is the best story the
game can tell.

---

## 2. The interlock

The Reaving is one system, not three features. Here is why.

```
      the ground gives out
              │
     ┌────────┼────────┐
   TRADE    EXPAND   REAVE ──────────────────┐
     │        │        │                     │
     │        │        ├─ loot: gold/grain/iron NOW
     │        │        ├─ thralls: labor NOW
     │        │        └─ a broken hold's tribute LATER
     │        │                               │
     ▼        ▼                               ▼
  merchant  claim                     ┌── guards eat the army
  prices    reach                     ├── revolt risk climbs
     ▲        ▲                       ├── holds ARM / BAND / SUBMIT
     │        │                       └── INFAMY
     │        │                               │
     └────────┴───────────────────────────────┘
        (infamy raises prices, thins caravans,
         dries the settler drift — the reaver
         and the merchant-prince erode each other)
```

And the exposure loop, which is the beating heart of the feature:

```
  host marches off-map  →  the camp SEES the kingdom stand thin
          ↑                              ↓
   loot + thralls come home  ←  the warlord masses a wave
          ↑                              ↓
   you need the loot to rebuild  ←  he takes what you can't defend
```

That second diagram is the whole design. The counter-raid on the camp (§5 of
ENDGAME.md, shipped) has one address and a moral choice at the end. The
Reaving has *many* addresses and no choice at the end — the choice was made
when you saddled up. Its tension isn't "punish or massacre," it's **"can I
afford to be away?"**

---

## 3. Off-map holds

### 3.1 Why off-map, and why this is not Age of Empires

DECISIONS.md Session 5 forbids a symmetric rival kingdom: "then we have made
a worse Age of Empires." That decision stands and this design obeys it in the
strictest reading. The holds:

- have **no map presence** — no tiles, no buildings, no units, nothing to
  besiege or garrison;
- have **no economy** — their wealth is a number that regenerates on a curve,
  not a production chain;
- **never attack you on their own initiative** (with exactly one exception —
  the coalition, §6.2 — which is a scripted consequence, not an AI decision);
- exist in a **list**, not a world. The UI is a ledger of names.

The warlord got an address. The holds get **addresses in a book** — the
merchant's gossip and a captured man's confession. You never see Osfrith's
Holding. You see the line in the Chronicle, the numbers on the card, and the
carts that come home.

### 3.2 The roster model

**Count.** 6–9 holds known-or-discoverable per reign. Start with **zero
known**; the first is revealed by merchant rumor somewhere in years 4–8.
Rationale: a roster of three gets farmed and memorized; a roster of fifteen
becomes a spreadsheet. Six-to-nine gives the ARM response somewhere to push
the player (§6.1) without ever becoming a target-selection puzzle.

**The stat block.** Four numbers and a name. Everything the player needs on
one card.

```
  Osfrith's Holding
  "Fat, and ill-walled."

  Wealth     ████████░░  fat        (rich · fair · lean · stripped)
  Defense    ██░░░░░░░░  ill-walled (fortified · walled · ill-walled · open)
  Disposition           wary        (heedless · wary · armed · leagued · broken)
  Reach      6 days' march          (provisioning cost + absence window)
```

Provisional generation ranges (mark all as provisional; calibrate in
Campaign 13, §9):

| Field | Model | Notes |
|---|---|---|
| `wealth` | 0–100, seeded 25–85 | drives loot magnitude; drawn down by raids |
| `defense` | 0–100, seeded 15–70 | drives the battle math (§3.5); raised by ARM |
| `kind` | one of five (below) | skews loot composition |
| `distance` | 4–10 "days" (≈ 260–650 ticks round trip) | provisioning + absence |
| `disposition` | enum, starts `heedless` | the response state machine (§6) |
| `wealthRegen` | ~2.5 wealth/year, ×(1 − raids/10) | see below |

**Five hold kinds**, because "a hold" is not a texture:

| Kind | Flavor line | Loot skew | Notes |
|---|---|---|---|
| **Farmstead-thorpe** | "sheep on the hill, no wall worth the name" | food-heavy, little gold | low defense, low wealth ceiling, many thralls |
| **Trading beach** | "boats on the strand, coin in the chest" | gold-heavy | wealth regens fastest (trade); armes fastest too |
| **Mining hold** | "smoke off the hillside" | ore/iron-heavy | the depletion answer; mid defense |
| **Minster / holy house** | "bells, and no swords" | gold + fine goods, *no* thralls | lowest defense, highest infamy cost (§7) |
| **Fortified burh** | "a ditch, a bank, and men who know why" | balanced, large | high defense, best prize, spawns avengers most |

**Regeneration.** Wealth regrows toward its seeded ceiling at roughly
**+2.5/year**, so a hold stripped from 80 to 20 is genuinely worth revisiting
in ~20 years — a generational cycle, not a respawn timer. Critically: each
raid **permanently lowers the ceiling** by ~5 (they don't rebuild what was
burned) and **permanently raises defense** if ARM is in play. So the second
visit is worse than the first, and the fifth is not worth the march. This is
the anti-farming invariant, and it is the same shape as the warlord's
ledger-hoard: **anti-farming falls out of the fiction, not out of a cap
rule.**

Pacing law, inherited from depletion (A3): a hold's recovery is punctuation
measured in YEARS. Nobody should ever be watching a wealth bar refill.

### 3.3 Discovery

You cannot raid what you have not heard of. Two channels, both existing
fictions:

**1. Merchant rumor.** When the caravan is at your gates there is a chance
per visit (~25%) of a rumor line, weighted toward holds the merchant would
plausibly know (trading beaches first, remote mining holds last):

> *"There's a fat little holding four days east — Osfrith's. Sheep, silver,
> and a fence a dog could step over. I say nothing, of course."*

Two design consequences worth stating: the merchant is the one who *tells you
where to raid*, and the merchant is the one whose prices worsen when you do
(§6.3). He is arming the hand that will eventually stop paying him. That is a
better joke than any tooltip.

**2. Interrogation of named prisoners.** **NOTE — this machinery does NOT yet
exist.** ENDGAME.md §5 drafted "camp location revealed by interrogating
routed/captured raiders," but the shipped game founds the camp visibly and
never built an interrogation path; there is no `interrogate` anywhere in
`src/`. Package A (§8) must build the prisoner object and the interrogation
action from scratch. Budget for it.

Interrogation reveals **more and better** than rumor: a named raider gives
you a hold's true `wealth` and `defense` (rumor gives a band — "fat,"
"ill-walled" — while interrogation gives the numbers), and a **sworn man**
gives you the warlord's own raiding grounds, which are the richest holds on
the roster. Mechanically:

- one interrogation per prisoner, ever;
- reveals 1 unknown hold, or upgrades a known hold from banded to exact;
- a sworn man reveals 2, one of them high-wealth;
- **interrogation destroys the ransom.** A questioned man is not saleable
  merchandise — the warlord's rider looks at him and turns away. This is the
  real decision the prisoner system poses (§4.3) and it must be stated
  plainly in the UI before the click.

### 3.4 The expedition — reusing the march

`marchOnCamp()` already does nearly all of this. The Reaving expedition
reuses its bones with three changes.

**Change 1: send a PROPORTION, not everything.** `marchOnCamp` sends every
sword (`state.soldiers.filter(s => s.hp > 0)`) — correct for the camp, which
is the climax. The Reaving needs a dial, because the whole tension is how
thin you leave home:

```
  The Reaving of Osfrith's Holding
  ─────────────────────────────────────────────
  Send:  ▮▮▮▮▮▮▮▮░░░░  8 of 12 swords
  Home:  4 swords, 2 towers manned, walls sound
  Provisions:  48 food · 15 gold
  Away:  ~310 ticks (two seasons and a bit)
  ─────────────────────────────────────────────
  Odds against an ill-walled hold with 8 swords:  favourable
  ⚠ Raiders are massing at Wolf's Rest.
```

That last line is the design. The massing state already exists
(`CAMP.massingAtTicks`, `state.camp.massing`) and is already rendered as
bodies gathering. The Reaving panel must surface it, and the camp must
*preferentially* mass while a host is afield (§3.6).

**Change 2: no map path.** There is nowhere to walk to. The host leaves via
the map edge nearest the hold's bearing and vanishes; phases become
`away → resolve → return`, with the absence window driven by `distance`
rather than pathfinding. Sprites walk off the edge and walk back on. (This is
strictly simpler than the camp march and reuses `followPath` only for the
short walk to the edge.)

**Change 3: the report, not the battle.** The camp battle plays out on screen
because the camp is a place. The Reaving resolves **abstractly** and comes
home as a Chronicle passage and a card. Rationale: showing it would require
building a place, and building a place is the rival kingdom we rejected. The
absence of a spectacle is load-bearing — reaving is something you *order*,
and only hear about. That is also, not incidentally, how it felt.

Provisioning reuses `CAMP.provisionFood` (6 food-eq/soldier) scaled by
distance: `provisionFood × soldiers × (distance / 5)`, plus
`provisionGold × (distance / 5)` for guides and carts. Raw food first, then
the bread reserve — same order as `marchOnCamp`, same order as eating.

### 3.5 The battle math

Mirror the camp battle's *family* — probabilistic exchanges, force ratio,
veterans tilt every die — but resolve it in one pass instead of per-tick,
since there is no map to fight on.

**The abstraction.** Convert the hold's `defense` into a notional garrison,
then run N rounds of paired exchanges using the same constants the on-map
fight uses (`COMBAT.*`, `SOLDIER.dmg`, `RAIDER.hp`). Pseudocode, provisional:

```
defenders = round(3 + defense / 8)          // defense 15→5 swords, 70→12
defQuality = 0.2 + defense / 150            // ~skill 0.3–0.66; a burh fights well
hostQuality = mean(soldierSkill(s) for s in host)

// no home ground, no tower cover — his ground, like the camp fight
for round in 1..maxRounds:
    forceRatio = min(1, defenders / host.length)
    for each soldier:
        exchange using COMBAT.baseCrit/critSkillScale/woundBase/
        woundSkillReduce, woundHp, killWoundedFrac,
        killChanceGood..killChanceBad lerped by forceRatio,
        veteranKillResist by skill, markedKillResist if marked
    for each defender: symmetric roll against the host
    if hostLosses >= host.length * CAMP.routFrac:  → REPULSED
    if defenders == 0:                             → TAKEN
```

Three deliberate properties:

1. **Numbers decide it, bloodily.** Same as the camp: the 98%-at-home vs
   41%-in-the-open spread, pointed outward. A hold assaulted with twice its
   notional garrison is a near-bloodless success; parity is a butcher's bill.
2. **A repulse is survivable but expensive.** Rout at `routFrac` (0.5 afield)
   sends the remnant home with nothing, having spent the provisions, the
   absence, *and* the infamy — you get the reputation of a reaver without the
   loot. Cruel and correct.
3. **Defense is the lever the world pulls.** ARM (§6.1) raises `defense`,
   which raises `defenders` and `defQuality` — so a farmed hold slides from
   "favourable" to "even" to "don't" without a single tuned penalty.

**Casualty target** (calibrate in Campaign 13): a favourable raid should
cost 5–15% of the host; an even one 25–40%; a repulse 50%+. Reaving must
never be the *cheap* way to get iron. It must be the *fast* way.

### 3.6 Exposure — the true cost

While `state.expedition` is afield with a Reaving:

- **the camp masses preferentially.** Give the raid timer a hard nudge: while
  a host is off-map, the massing threshold effectively drops (treat
  `CAMP.massingAtTicks` as reached sooner, or subtract from `raid.timer` once
  on departure). The existing code already does a smaller version of this on
  a repulse (`state.raid.timer = min(timer, 150)` — "he smells weakness").
  Extend the same instinct: the warlord watches the roads.
- **the telegraph is honest.** The player must be able to *see* the massing
  bodies at the camp before committing, and the Reaving panel must warn.
  Never a gotcha; always a gamble the player entered with open eyes.
- **the recall.** A Reaving in progress may be recalled (the host turns for
  home, loses the provisions, gains nothing, arrives at half the remaining
  distance). This is the panic button that makes the gamble fair, and A2's
  "recoverable" applied to a decision rather than a disaster.
- **prisoners are a target.** If you hold his men, the massing wave may be a
  prison-break raid (§4.4) — and it will come while your host is away, which
  the player will eventually learn to expect, which is the point.

---

## 4. Named prisoners (ransom-stock)

### 4.1 Who becomes a prisoner

Named raiders and sworn men already exist as objects with names, HP, and
kill attribution. Capture is the third outcome after "killed" and "fled":

- when a raid **breaks** (the existing flee path), each fleeing named raider
  has a chance to be taken instead of escaping — roughly `0.25`, raised by
  soldiers-nearby, zeroed if `stance === 'hold'` and the flee path exits
  claimed land (you cannot take a man you refuse to chase — a small, real
  reason to sally);
- when the **camp is taken** (`exp.phase === 'choice'`), surviving garrison
  are prisoners if the player chooses `punish`. Massacre takes none: **the
  massacre has no prisoners, by construction.** That asymmetry is worth
  having — mercy is also the profitable option, which is a better argument
  than a lecture;
- **sworn men** are the premium stock (§4.3) and are capturable only from a
  broken warlord wave, never a common raid;
- the **warlord himself is never capturable.** He dies at his hall or rides
  home. Making him ransomable would collapse the whole pressure system into
  a transaction. Keep him unbuyable, same instinct as the avenger.

### 4.2 Where they are held

Prisoners need a **location**, because the prison-break raid needs a target
(§4.4) and because a location is a decision.

- **v1: the keep.** Prisoners are held in the keep, capacity ~4 named
  prisoners. Simple, no new building, and it makes the break-raid target the
  best-defended building on the map — which makes the break-raid *hard*,
  which is correct for v1.
- **later: a gaol / thrall-quarters building** doubling as the pen for both
  classes, which becomes a genuine placement decision (safe behind the walls
  and far from the fields, or near the work and near the treeline). Deferred
  — see Q7.
- Over capacity: the oldest prisoner "is put to the sword" or (better) is
  offered a free release with a small morale/infamy effect. Never a silent
  deletion.

### 4.3 The ransom — the rider, inverted

**The same rider machinery, walking the other way.** `payTribute` /
`refuseTribute` and the warning-window UI already model "a man at your gate
with a demand and a clock." Reuse it wholesale:

> *A rider from Wolf's Rest — not for gold this time. "Hakon Wolfjaw's
> brother sits in your cellar. Three hundred, and I take him home."*
>
> **[ Take the gold ]  [ Refuse ]  ( 90 ticks )**

**Pricing.** Scale with the man's rank and the warlord's own ledger — the
same instinct as `TRIBUTE.demandFrac` reading the treasury, so the offer is
always *interestingly* sized rather than trivially small:

| Prisoner | Base offer (provisional) |
|---|---|
| named raider | `60 + 8 × wave` gold |
| notable (a raider with kills to his name) | `× 1.6` |
| **sworn man** | `× 3.0` — the oath is the premium; he is family |

Modifiers: `× 1.5` if his warlord is short of swords (his garrison below
`garrisonBase`); `× 0.5` if the camp is `broken` (a broke warlord haggles);
**zero, no rider comes** if the camp is `gone` (nobody left to buy him) or if
the prisoner has been **interrogated** (damaged goods — §3.3).

**Where the gold comes from.** Out of the camp's `ledger.gold` where
possible, which is *your own tribute coming home* — the ledger invariant
(DECISIONS Session 5) preserved exactly. If the ledger is thin, he pays what
he has and the rest is owed in the fiction only (no debt system).

**Refusing** has three onward paths, and the player should feel all three
exist: he may raise the offer once (`× 1.4`, one time); he may come to **take
him back by force** (§4.4); or he may do nothing, and you keep a man who is
now worth nothing and eats. A prisoner is not a resource with a market price;
he is a hostage with a clock.

### 4.4 The prison-break raid

A new raid objective, not a new raid system. When the warlord wants his men
back:

- **target selection is overridden**: instead of `pickTarget`'s value
  weighting, the wave beelines for the prisoners' location (the keep in v1).
  Sworn men lead it; they do not sack on the way (they already never do —
  `if (rd.sworn) { ... continue; }`);
- the wave is **smaller but harder** (~0.7× size, warlord-grade HP): a
  rescue party, not a plunder wave;
- **success condition is different**: they win by *reaching and holding* the
  prison for N ticks, not by grinding HP. Freed prisoners run for the map
  edge with them, and a freed sworn man goes straight back onto the camp
  ledger as a garrison sword;
- it fires preferentially **while your host is afield** (§3.6);
- if repulsed, the attempt itself raises the next ransom offer (he wants
  him badly) — a small, satisfying loop.

Design value: it gives the prisoner an ongoing cost. A cellar full of
hostages is not a trophy shelf; it is a *reason for the enemy to come to a
specific tile*. That is the best thing a hostage can be in a game about
defending places.

---

## 5. Thralls (the labor economy)

The long section, because this is where the design either earns its keep or
becomes a strategy-game slavery button. The rule for the whole section: **we
model the institution's actual failure modes honestly, and let the player
discover them.** No lectures. The Chronicle says what happened; the numbers
say what it cost; the player draws the conclusion.

### 5.1 What a thrall is, mechanically

A thrall is a villager object with `v.thrall = true` and a few flags. Not a
new agent type — same array, same bodies on the map, same names (this
matters; see §5.7). Deltas from a free villager:

| Property | Free villager | Thrall | Why |
|---|---|---|---|
| eats | `EAT_PER_POP` (0.04) | **× 0.75** | fed worse; the historically honest number |
| output | `1 + skill` | **× 0.75** | coerced labor is worse labor — the whole verdict |
| skill gain | `SKILL.gainPerTick` | **× 0.5**, hard-capped below `masterAt` | can never become a master (§5.3) |
| jobs | any | **producer / builder only** | never soldier, never militia, never overseer |
| militia | `v.armed` persists | **never armed** | you do not arm the people you own |
| raid behavior | panic at radius 3 | **panic first, wider radius, do not flee toward the keep** | they have no keep |
| counts toward | pop, Crown of People | **pop yes, Crown NO** (§5.8) | crowns count free souls |
| morale | contributes | **does not contribute; has none** | see §5.7 for the discussion |

**Acquisition.** From a broken raid or a taken camp (Package A), and from a
Reaving (Package B). Numbers provisional:

- broken raid: 0–2 thralls (the camp folk who followed the wave to carry
  loot);
- camp taken with `punish`: `folk` count × ~0.5, i.e. ~4 — and note the
  cruel elegance, **the spared folk are exactly the mercy-settler pool.**
  Taking them as thralls *consumes* `settlersLeft`. The same nine souls are
  either four settlers who arrive over years remembering they were spared, or
  four thralls who arrive today remembering they were not. That's the choice,
  stated in bodies;
- Reaving: `2 + round(wealth / 20)` scaled by success margin, and **zero from
  a minster** (no thralls in a holy house — take the silver and go);
- **thralls do not breed.** A thrall child would be an unfree child, which is
  a line this game does not need to cross to make its argument, and it would
  also break the assimilation cap by giving thralls a growth curve. Thralls
  arrive by raid and leave by manumission, escape, or death. Full stop.

### 5.2 Housing and where they live

Thralls need shelter or they die in winter — but not *your* houses.

- **Thrall-quarters** (new building): `wood 15`, `hp 40`, `popCap 0`,
  **thrallCap 6**, influence 1. Cheap, ugly, and it houses nobody free.
- A thrall may also be housed in a normal house at 2 thralls per free slot
  (crowded), at a **morale cost to the free folk of that house's district** —
  the only place I'd accept a morale coupling, because it's local and
  physical rather than a global conscience meter (§5.7).
- Unhoused thralls: no death spiral, but **escape risk doubles** and they
  contribute 0.5× output. Neglect is expensive, immediately, in the currency
  the player cares about.

This is the housing-pressure interplay the brief asks about: thralls let you
staff buildings *without* building houses, which is the single biggest thing
they do for a housing-gated population. A player who has hit their housing
cap and can't grow discovers that raiding is the only way to add hands
quickly. That is exactly the temptation the feature exists to offer — and
`thrallCap` quarters are so cheap that the *real* limit is never housing. It
is guards (§5.4).

### 5.3 Thralls can never become masters

Hard rule, two justifications that happen to agree:

1. **Pillar B (DECISIONS Session 4).** Masters are years of devoted work and
   deliberately precious — `gainPerTick` halved, `masterAt` 0.8. A pipeline
   that mints masters by raiding would gut the pillar in one patch.
2. **The historical verdict.** Coerced-labor economies do not industrialize.
   They don't develop skilled crafts, they don't accumulate technique, and
   they don't produce the free artisan class that invents anything. That's
   not a moral claim bolted on; it is the mechanism (§7.4).

Implementation: cap `v.skills[craft]` at `min(SKILL.masterAt - 0.05, ...)`
for thralls, and halve their gain. A thrall can be *competent* — a good pair
of hands at the quarry — and never a master of it. The kingdom that runs on
thralls therefore runs at roughly 0.75 × (1 + ~0.5) output per worker where
freemen would eventually reach 0.75 × 2.0. **You get the grain and you never
get the bakery that matters.** The 90%-thrall state is industrially hollow by
construction, and it shows up in the numbers the player already watches.

### 5.4 The guard ratio — the central mechanism

**Every 5 thralls require 1 soldier as overseer.** This is the most important
number in the document.

- Overseer is an **assignment**, drawn from `state.soldiers`, like a warden
  post: `v.job === 'soldier'` with `s.overseer = true`. Overseers eat 3× (they
  are soldiers), do not produce, and **do not answer the horn** — they are
  standing over the thralls precisely when the raid comes, because that is
  when the thralls are most likely to run.
- Auto-assigned by the same worst-first logic the economy uses, with a
  policy dial consistent with A3's "few global levers": **Warden priority —
  Field first / Fields and pens even / Pens first.** Field-first means fewer
  overseers, more escapes; pens-first means a defended prison and an
  undefended border.
- Understaffed pens: escape risk scales with the shortfall, sharply. Two
  overseers short is not a 10% penalty; it's a nightly drain.

**Why this is the right cap.** It converts the reaving's profit directly back
into the resource the reaving spends. Each raid brings home ~4 thralls and
therefore consumes ~1 soldier permanently. Ten raids: 40 thralls, 8 wardens.
Your field army is now smaller than it was before you started raiding, and
your economy depends on the pens staying quiet. That is the Sparta
garrison-state problem, expressed as arithmetic the player does themselves.
It is self-limiting without a single tuned penalty — which is precisely what
§1 demands.

Secondary effect worth stating: **the guard ratio makes mercenaries newly
interesting.** Hired swords as prison guards is a historically apt and
mechanically excellent bad idea — it works, it's expensive per tick
(`MERCENARY.upkeepPerTick` with escalation), and they desert if unpaid. A
thrall economy propped up by unpaid mercenaries is one missed payment from an
open gate. Don't build a special case; the existing systems already compose
into that story.

### 5.5 Escape, and the revolt threshold

Two regimes, deliberately shaped differently.

**Below the threshold: linear, ignorable-but-costly attrition.** Per thrall
per (say) 200 ticks, escape chance ≈

```
  base 0.02
  × (1 + guardShortfall)          // pens understaffed
  × (unhoused ? 2 : 1)
  × (1 + max(0, 40 - morale)/40)  // a hungry, frightened realm watches badly
  × (raidActive ? 3 : 1)          // the night of a raid is the night to run
```

**Escapees flee to the warlord's camp.** They arrive as garrison swords —
`addSword(state, camp)` — and their carried knowledge shows up as the camp's
ledger growing (`addPlunder` a token amount: they know where your stores
are). This is the sentence the whole system is built to earn: **your cruelty
feeds your enemy.** The Chronicle says it flatly and never editorializes:

> *Ida, who was taken at Osfrith's Holding, is gone from the pens. Two nights
> later there is one more sword at Wolf's Rest.*

**Above the threshold: nonlinear, and it ends in fire.** Past a thrall
fraction of population of ~**1/3**, multiply the escape rate by
`(1 + k × (frac - 0.33)²)` with `k` large enough that 0.5 is dangerous and
0.7 is untenable (start `k ≈ 40`; calibrate in Campaign 13). And past the
threshold, a second clock starts: **unrest**, accumulating per tick with
`(frac - 0.33)`, guard shortfall, low morale, and each escape. At full
unrest, the **uprising** fires.

**The uprising** — a raid from inside, using the raid system's parts:

- thralls become hostile actors on the map at their workplaces (reuse the
  raider agent shape: they have positions already);
- **fires**: buildings they worked take heavy HP damage — the sack path,
  applied from within, no marching required. Structures they built, they know;
- the pens break open: every thrall in the realm becomes a runner, and
  runners head for the camp;
- soldiers fight them; overseers are attacked first and specifically;
- **a simultaneous raid from outside** if the camp has swords available (the
  escapees have been telling him things — this is the payoff of the
  escape→garrison pipeline);
- resolution: an A2 dark age, not a game-over. You keep the keep. You lose
  the thralls, a lot of HP, some soldiers, and every quiet illusion. Morale
  floors. And the Chronicle writes the best line of the run.

**Why nonlinear rather than a cap.** A cap says "you may not." A nonlinear
curve says "you may, and here is what it will cost, and you can see it
coming." The player who pushes past 33% is making a choice with a visible
gauge, and the drama of the gauge climbing is worth more than the safety of a
forbidden number.

**The gauge.** Show thrall fraction and unrest plainly — a bar that changes
color past the threshold, sitting next to morale. Never hide the mechanism.
The tension in a garrison state is *knowing*.

### 5.6 Manumission — the way out

After **~8 years** (~3,800 ticks; provisional) a thrall becomes a **free
settler**: `v.thrall = false`, full output, full skill ceiling, counts toward
the Crown of People, may be recruited, may bear children.

This reuses the mercy-settler machinery's shape (`settlersLeft`,
`nextSettlerAt` and the "comes to your gates" Chronicle line) and is the
mechanical expression of the serfdom lesson (§7.2): the solution to the
guard-cost problem is **giving the unfree a stake**. Every manumitted thrall
is one fewer body needing a warden and one more body defending the place.

**Freeing early is a choice, and should be a good one.**

- **Free one:** immediate. Loses you a worker at 0.75× and gains a settler at
  1.0× with a real skill ceiling. Almost always correct on a pure
  spreadsheet, which is the joke.
- **Free all:** a single dramatic act. Massive morale gain, unrest to zero,
  every warden released to the line, thrall fraction to zero — and the
  Chronicle marks it, and the free-folk remember it, and your grain output
  drops for a year while they find their feet. The Reaving's version of
  choosing `punish`.
- **A thrall who serves out the clock** should feel like a small mercy the
  system granted rather than one you did. Let it fire on its own, with a
  Chronicle line, so a player who never thinks about it still slowly converts
  their thralls into subjects. **The default drift of this system is toward
  freedom.** That is a design statement and I'd defend it as the correct one.

### 5.7 Citizen–thrall interaction

The brief asks for this thought through. Six sub-questions, answered.

**(a) Where they live.** §5.2. Quarters are cheap and separate; crowding into
houses works and costs local morale. The physical separation is the point:
you build a second, worse village inside your village, and you can see it on
the map.

**(b) Labor-market displacement — the emergent benefit.** Yes, and this is
the most interesting *positive* thing thralls do. `WORK_PRIORITY` fills
buildings in a fixed order, best-skilled-first. Change one thing: **thralls
sort to the bottom of the skill preference for high-craft work and are
preferred for base extraction** (farm, lumber, quarry, mine). The emergent
result — no special-casing needed — is that free villagers get pushed *up*
the chain into the smelter, the bakery, the market, the tower, and the
building trades, where their skills actually accumulate toward mastery.

A modest thrall population therefore makes your *freemen better craftsmen*,
which is a real historical dynamic (unfree labor in extraction, free labor in
craft) and a genuinely attractive strategy. It also sets the trap perfectly:
this works beautifully at 15% thralls and stops working entirely past ~40%,
because by then there aren't enough freemen left to fill the craft posts and
the thralls can't be masters. **The strategy is good, then it eats itself.**
That's the whole design in one mechanic, and it's free.

**(c) The overseer as a job.** §5.4 — a soldier assignment with a policy
dial, not a new unit. The important bit is that he is *visibly* a soldier who
is not on the wall. Render him at the pens. Let the player look at the map
during a raid and see four of their twelve swords standing in a yard.

**(d) Does free-folk morale couple to thrall fraction?** This is the doc's
biggest genuinely open design question, so here are the options honestly:

- **Option 1 — no coupling.** Thralls are morally inert to the free folk;
  all consequences are material (output, guards, revolt, infamy, crowns).
  *Pro:* zero moralizing-by-numbers; the game never tells the player their
  villagers disapprove. The consequences speak entirely through the world's
  actions. *Con:* a slave society where nobody's mood ever changes reads as
  the designer averting his eyes — and it wastes morale, the one variable the
  player already reads as "how does it feel to live here."
- **Option 2 — global morale penalty scaling with thrall fraction.**
  *Pro:* simple, immediately legible. *Con:* this is exactly the
  moralizing-by-numbers the brief warns against. It's a conscience meter, and
  it implies a modern sensibility these people did not have. Reject.
- **Option 3 (RECOMMENDED) — morale couples to *fear*, not to conscience.**
  Free-folk morale takes no hit from the existence of thralls. It takes a hit
  from **unrest** (past the threshold), from **escapes near their homes**,
  and from **crowding** (thralls in their house). What the free folk resent
  is not slavery; it's *living next to a rebellion*. Mechanically this is a
  clean coupling to the existing `raidShock` channel — call it `unrestShock`
  and let it decay the same way. *Pro:* honest about the period, still gives
  morale a job, and the penalty arrives exactly when it's diagnostic rather
  than when it's preachy. *Con:* a player could read it as the game
  approving of small-scale slavery. I'd take that risk: the alternative is
  the game grading the player's ethics, and this game's whole stance
  (DECISIONS Session 5, the silent steward at the victory choice) is that the
  moral weight belongs to the player, not the scoreboard.

Recommendation: **Option 3**, plus the crowns exclusion (§5.8), plus the
Chronicle's plain voice (§5.9). Those three carry the moral load without a
single number that means "shame."

**(e) Manumitted thralls' integration.** Full settlers. No mark, no
second-class flag, no permanent penalty. They can become masters (slowly —
they start behind), they count toward the crowns, they can be recruited as
soldiers, they can have children.

But they **remember**, in exactly one way: keep a `v.wasThrall` flag used
*only* by the Chronicle and the villager card ("Ida of the Vale, who came
here in chains"), and by one mechanic — a manumitted thrall in the militia
gives a small morale bonus to other thralls, i.e. **visible manumission
lowers unrest.** Freedom that others can see is what makes the unfree wait
rather than run. That is the Ostsiedlung/serfdom lesson (§7.2, §7.5) as a
mechanic instead of a footnote, and it makes "free a few, visibly" a real
strategy against revolt.

Deliberately NOT doing: a marked-men-style permanent stigma. The marked men
carry a mark because *they* did something. A freed thrall had something done
to them. The game should not punish the victim, and mechanically a permanent
underclass would break the assimilation cap.

**(f) Steward and Chronicle voice.** §5.9.

### 5.8 Thralls and the Crowns

**Thralls do not count toward the Crown of the People.** `WIN.pop` (80)
counts free souls. Thralls count in `state.pop` for eating, for housing math,
for the thrall fraction, for raid sizing (they are wealth — `prosperity()`
already counts skills and bodies), and for absolutely nothing that says
"your reign was good."

No message accompanies this. No steward objection, no tooltip lecture. The
crown counter simply doesn't move, and the player works out why. This is the
game's quiet moral statement and it should stay quiet. A player who builds a
population of 200 with 130 in the pens and finds themselves 10 short of the
Crown of the People has been told something exactly once, in the only
language the game speaks.

(Corollary worth checking in sim: this makes the thrall route strictly bad
for one of three crowns and strictly good for the other two — Plenty and
Dominion both love a labor surplus. That asymmetry is intentional and should
be *visible* in Campaign 13's crown-timing data.)

### 5.9 Voice

**The steward objects once.** At the first thrall brought home, one counsel
card, in the tutorial system's existing voice (`'counsel'` chronicle kind):

> *"My lord. Grain we can grow. Stone we can cut. Men we cannot make, and
> men we take will not thank us for it. …It is your word, not mine."*

Then **he never mentions it again.** Not at ten thralls, not at a hundred,
not at the uprising. The steward is a voice, not a conscience (DECISIONS
Session 7: he is deliberately silent at the victory choice). One objection is
a character; repeated objection is a nag; silence after one objection is
chilling, which is the correct register.

**The Chronicle is a clerk, not a moralist.** It records names, numbers,
dates. It says "Ida, taken at Osfrith's Holding, is dead in the quarry"
without adjectives. It names every thrall, always — the same reason villagers
have names at all (Pillar B: "15 pop is 15 little lives"). The naming does
all the work that editorializing would do worse.

**One exception, earned:** the uprising gets the game's rhetorical register,
the way the massacre does. When the pens break open the Chronicle is allowed
one sentence with a fist in it.

---

## 6. Hold relationships — the tradeoff space

**Chandra's explicit instruction: discuss, do not lock.** So: four
mechanisms, each costed, then a v1 recommendation with the reasoning exposed.

### 6.1 ARM — the hold raises its defense

Each raid permanently raises the target's `defense` (+12–20) and lowers its
wealth ceiling. Disposition walks `heedless → wary → armed → fortified`.

| | |
|---|---|
| **Build cost** | **Trivial.** Two fields on a stat block and a disposition enum. Half a session. |
| **Degenerate play prevented** | Farming one fat, close, ill-walled hold forever. The single most likely exploit. |
| **Pacing effect** | Excellent. Pushes the player *outward* across the roster — each hold gets 2–3 profitable visits, so the roster of 7 supplies ~15–20 raids across a reign, i.e. it's paced for the whole late game without a cooldown. |
| **Risk** | Almost none. Worst case it's boring — a number going up. Needs the flavor line to change with it ("ill-walled" → "they have dug a ditch since we came") or it's invisible. |

### 6.2 BAND — the league of the wronged

Raided holds accumulate grievance; past a threshold (say 4+ raids across 3+
holds, or 2 raids on a fortified burh) they form a league and send **one
coalition punitive expedition** at your walls: a large, one-off, non-warlord
attack that comes from the map edge opposite your reaving bearing, with
better-armed units and no interest in loot.

| | |
|---|---|
| **Build cost** | **Moderate.** Reuses the raid system's spawn/march/fight, but needs a new grievance tracker, a new attacker flavor (armed levy, not brigands), a warning arc, and a "they came, we held / we didn't" resolution. One focused session. |
| **Degenerate play prevented** | Spreading raids evenly across the roster to dodge ARM. Diversification stops being a free dodge and becomes the thing that *builds* the coalition. This is the necessary complement to ARM — together they close both exploits. |
| **Pacing effect** | **Strong and good.** It's the Reaving's climax, the mirror of the warlord's dread wave, and it makes the whole feature a rising arc rather than a flat income stream. It also puts your absent host at maximum risk exactly once, memorably. |
| **Risk** | It's a *second* big-wave system alongside the warlord's, and two escalation curves running at once can either interleave into great drama or stack into an unfair pile-on. Needs a mutual-exclusion rule (never within N ticks of a warlord wave) and sim validation before it ships. |

### 6.3 SUBMIT — the broken hold pays you tribute

A hold raided to `stripped` wealth and `broken` disposition sends **its own
rider** offering annual tribute to be left alone. Accept and it pays
~15–30 gold/year forever (while you remain strong enough to be worth fearing
— it lapses if your army collapses). Refuse and take it again for one last
haul.

| | |
|---|---|
| **Build cost** | **Small.** The rider UI exists (`payTribute`/`refuseTribute`); this is the same card with the arrow reversed, plus a per-hold tribute income line. |
| **Degenerate play prevented** | Not much, honestly — it's an income *source*, so it slightly worsens the balance rather than tightening it. Its job is thematic, not corrective. |
| **Pacing effect** | Late and warm. It converts a burned-out hold from a dead entry into a small permanent income, which is the reaver's version of a settled economy — and it flatters the player at exactly the moment the doc wants them flattered before the coalition arrives. |
| **Payoff** | **The best narrative beat in the design.** The game opens with a rider at your gate demanding Danegeld. It ends with *your* rider at somebody else's. Nothing else in the doc closes a loop that cleanly, and it costs almost nothing to build. |
| **Risk** | Passive income undercuts the "pump, not engine" law if it's generous. Keep it small (a rounding error next to trade), and cap total tribute income at something like 15% of merchant income so it can never become the economy. |

### 6.4 INFAMY — the portfolio cost

A single scalar, rising with each raid (weighted: minster raids worst, farmstead least), decaying slowly over years. Its effects touch the *other* two doors out of depletion:

- **merchant prices worsen** (buy markup up, sell prices down — `MERCHANT.markup` scaled, sell multiplier reduced) — up to ~40% at max infamy;
- **caravan frequency drops** (`MERCHANT.awayMin/awayMax` stretched, up to ~1.5×);
- **settler drift dries up** — mercy-settlers arrive slower or not at all; any future settler-attraction system (Ostsiedlung, §7.5) is gated on low infamy;
- optional: mercenary hire cost *falls* (reavers pay well and sellswords aren't picky). A nice inversion — infamy isn't purely a penalty, it's a *reallocation*: you lose the merchant and gain the sellsword.

| | |
|---|---|
| **Build cost** | **Small.** One scalar, four multipliers at existing call sites. |
| **Degenerate play prevented** | The real one: **being both a merchant-prince and a reaver.** Without infamy, reaving is pure upside layered on top of a trade economy. With it, the two identities erode each other, and the player must *choose a strategy* rather than accumulate both. |
| **Pacing effect** | Continuous background pressure — the slow-burn cost that makes the fast-burn profit feel like a loan. |
| **Risk** | Invisible costs feel unfair. Infamy MUST be shown as a named number with its effects spelled out on the trade panel ("the merchant's prices, +22% — he has heard what you did at the minster"), or players will just think the economy got worse for no reason. |

### 6.5 Recommendation for v1

**Ship ARM + INFAMY + SUBMIT. Defer BAND to v2.**

Reasoning:

- **ARM and INFAMY are the two that do balance work**, and they're the two
  cheapest. Together they close the "farm one hold" exploit and the "reaver
  *and* merchant" exploit — the only two ways I can see this feature breaking
  the game's economy. Both are half-session builds. That is an absurd
  cost-to-value ratio and they should ship first regardless of what else does.
- **SUBMIT is nearly free and pays the doc's best thematic dividend.** The
  tribute inversion is the reason to build this feature at all rather than a
  generic raiding minigame. Skipping it to save a day would be a bad trade.
- **BAND is the best mechanism and the wrong one for v1.** It's the most
  expensive to build, it's the only one that needs sim validation before it's
  safe (two escalation curves in one game), and — crucially — **ARM already
  covers its exploit adequately for a first pass**, because ARM plus the
  wealth-ceiling drop makes even a diversified roster run dry in ~15–20
  raids. Ship the cheap caps, get playtest evidence on whether the reaving
  arc even wants a climax, and build the coalition when we know what it has
  to be the climax *of*.
- **The honest counterargument:** without BAND, the Reaving has no
  antagonist of its own — every consequence is either a number worsening or
  the warlord doing what he already does. That could read as flat. If the
  Package B playtest says "profitable but inert," BAND is the first thing to
  build, and its design should be revisited then rather than pre-specified
  now.

---

## 7. Historical grounding

This section is an argument, not decoration. The mechanics above are
attempts to reproduce a real pattern: **plunder-and-tribute economies are
extremely effective in the short run, structurally incapable of becoming
anything else, and every society that stabilized had to transition off
them.** If the mechanics reproduce that, the game is making a true argument
about economics without a single line of didactic text.

### 7.1 The plunder-and-tribute economy

Early medieval northern Europe ran, in significant part, on movable wealth
taken and given rather than produced and traded. Three threads:

- **Danegeld.** Paying raiders to go away was routine statecraft, not
  weakness — England's payments in the 990s–1010s ran to enormous sums in
  silver. And the well-documented pattern is that payment *invited* return:
  a fleet paid off once has learned the address of a customer. The game
  already models this exactly (`TRIBUTE.appetiteMult = 1.6`, "word spreads of
  easy coin"). §6.3's SUBMIT is the same mechanism with the player as
  recipient — and the player should notice that they have become the thing
  the rider represented.
- **Gift-exchange and the war-band.** A lord's authority rested on
  distributing treasure to sworn followers; the hoard existed to be given
  away, and a lord who couldn't give lost his men. The camp's `ledger` and
  the sworn men who die shielding their warlord are already this. The
  Reaving's implication: a player who raids to fund a war-band has adopted
  the warlord's economic model, and the game's rewards should stay
  prestige-forward rather than power-forward so the player never gets to
  *win* with it (ENDGAME §4's rule, still binding).
- **The slave trade.** This is the part usually left out of the romance.
  Large-scale trafficking of captured people ran through Dublin, through
  Prague, down the river routes to the Black Sea and the Mediterranean — the
  word *slave* itself carries the trace of who was being sold. Captives were
  the single most liquid product of raiding: self-transporting, always
  saleable, worth more than the grain in the same boat. The design's honesty
  requirement is that thralls are *good*, economically, in the short run.
  A version where slavery is simply inefficient would be a lie, and a lie
  the player would see through in ten minutes of spreadsheet.

**But:** every one of these societies that persisted transitioned off
plunder. Not from moral progress — from arithmetic. Plunder scales with
reachable victims and shrinks as neighbors fortify (ARM); it produces no
compounding capital; and it requires a permanent military establishment whose
cost grows with what it holds down. Settled kingdoms that survived converted
war-bands into landholders and tribute into taxation. **The Reaving must be
a phase the player passes through, and the game should reward passing
through it.**

### 7.2 Serfdom as the answer to the guard-cost problem

The interesting European move isn't slavery — it's the retreat from it into
serfdom. Chattel slavery in western Europe largely gave way, over centuries,
to arrangements where the unfree worker had *something*: a tenancy, a
customary right, heritable use of land, a family the lord couldn't casually
break up.

Read cynically, this is a solution to an enforcement problem. A slave who
owns nothing must be watched. A serf with a plot, a family, and customary
rights supervises himself, because running away costs him something. The
lord trades a share of the surplus for a collapse in monitoring costs — and
gets a better worker besides, because a man with a stake works harder than a
man with a whip behind him.

**This maps directly onto the guard ratio and manumission.** §5.4's 1:5
overseer requirement *is* the monitoring cost, made explicit. §5.6's
manumission is the transaction: give the unfree a stake, get the wardens
back. §5.7(e)'s "visible manumission lowers unrest" is the mechanism by
which having a stake — or plausibly expecting one — keeps people from
running. A player who works this out has independently rediscovered why
serfdom replaced slavery, and nobody had to tell them.

### 7.3 Sparta: the garrison state

Sparta's helots outnumbered Spartiates by a large multiple, and the
consequence was total: a society organized around internal suppression, with
a secret police, ritualized violence to keep the helot population terrorized,
and a citizen body that could not campaign far or long because the estates
had to be watched. Spartan military reputation was built on a manpower base
that was simultaneously its greatest vulnerability. Sparta could not project
force freely because Sparta could not leave home.

That is the exposure loop of §3.6, and it's the reason the guard ratio has to
bite on **field availability** rather than on gold. A gold cost is a
spreadsheet line. A cost paid in "swords who are standing in a yard when the
horn blows" is a story, and the player watches it happen on the map.

The Spartan endgame is also instructive for §5.5: the system didn't fail
gradually, it failed *catastrophically and late*, when one military defeat
let the suppressed population go. The uprising should behave the same way —
stable, stable, stable, then everything at once, on the worst possible night.

### 7.4 The Black Death: enforcement capacity decides everything

The best natural experiment in the historical record. A demographic
catastrophe in the mid-14th century removed a huge fraction of Europe's
workers, and the labor shock hit east and west simultaneously. The outcomes
diverged completely:

- **In the west**, scarce labor could bargain. Wages rose, labor legislation
  failed to hold them down, serfdom eroded, and workers moved to whoever paid
  best.
- **In the east**, the same scarcity produced the *opposite* — the "second
  serfdom," a tightening of bondage over the following centuries, precisely
  because lords there had the political and coercive capacity to prevent
  mobility.

Same shock, opposite results, and the variable was **the lord's enforcement
capacity.** Where they could hold people, they held them harder. Where they
couldn't, freedom emerged for entirely unsentimental reasons.

This is the guard ratio again, and it's the strongest argument in the doc for
why the guard ratio must be the primary cap rather than one cost among many.
The game should be able to produce both outcomes from the same shock. Concretely: after a bad raid or a plague-like event, a player with plenty of soldiers should be *able* to clamp down (raise the warden dial, hold the thralls, ride out the unrest), and a player without them should find that thralls escape and the survivors must be courted with freedom. **Same event, two histories, decided by how many swords you have.** If Campaign 13 can demonstrate that divergence emerging from the sim, this feature has justified itself as a design.

### 7.5 Colonization economies: frontiers competed by offering freedom

The medieval eastward settlement (Ostsiedlung) worked on an incentive: new
settlements on the frontier offered terms that established manors couldn't —
better tenures, lighter dues, town liberties, personal freedom. "City air
makes free." Frontier lords needed bodies more than they needed submission,
so they competed for settlers by offering the best deal, and people moved.

**The hint the brief draws from this is right and should be a rule: settlers
flow toward the player who offers the best deal.** Any future settler
attraction system (and there should be one — it's the natural counter-strategy
to reaving, and the thing infamy should tax) works on a legibility score
built from things the world can see:

```
  attraction ≈ f( morale, food security, freedom (1 − thrall fraction),
                  manumissions granted, low infamy, low recent raid damage )
```

A realm that is safe, fed, free, and famous for treating people well *draws
population*. A realm that reaves draws none and must keep reaving to keep its
labor force — the pump with no flow behind it, exactly as §1 requires.

That gives the whole feature its final shape as a strategic choice, without
one word of judgment: **you can grow your kingdom by attracting people or by
taking them, and the two methods actively poison each other.**

### 7.6 The structural verdict: coerced labor and industrialization

The pattern that closes the argument. Economies built on large-scale coerced
agrarian labor — the antebellum American South and the Confederacy being the
sharpest case, because it lost a war to it — reliably fail to industrialize,
and the reasons are structural rather than moral:

- no incentive to develop skill in the workforce, and often active
  prohibition of it (a literate, trained laborer is a dangerous one);
- capital sunk into owning people rather than into machines, transport, and
  technique;
- no mass domestic market of wage-earning consumers to justify manufacturing;
- planter elites whose interests actively opposed the diversification that
  would have threatened their labor system;
- and a military consequence, tested and settled: an economy that can grow
  cotton and cannot make rifles loses to one that can do both.

**This is the verdict §5.3 encodes.** Thralls can never be masters — not as a
punishment, but because that is the finding. The 90%-thrall kingdom has
grain, stone, ore, and gold, and it has no bakery worth the name, no smith
worth the name, no accumulated technique, and an army of prison guards. When
the coalition or the uprising comes, it discovers that a rich kingdom and a
capable one are different things.

A player who builds that kingdom and watches it come apart has not been
lectured. They have run the experiment.

---

## 8. Phasing and kill gates

ENDGAME.md's method: small bets where shipping is the discovery, sim first
where the bet is big. Three packages, in this order, each with a gate that
can stop the whole line.

### Package A — Thralls from won battles (no holds yet)

The whole labor economy, sourced only from fights you already have: captured
raiders after a broken raid, camp folk taken when you choose `punish`.

**Builds:** the thrall villager flags and all §5.1 deltas; thrall-quarters;
the guard ratio + overseer assignment + warden policy dial; linear escape with
escapees→camp-garrison; the revolt threshold, unrest gauge, and the uprising
event; manumission (timed + free-one + free-all); the crowns exclusion; the
work-priority sort that displaces freemen upward; the steward's one objection;
Chronicle voice. Plus the prisoner object itself (§4.1–4.2) since thralls and
prisoners share the capture path.

**Why first:** it's the largest and most novel system, it needs zero new
content pipeline, and it is fully playable and fully meaningful on the map
the player already has. If thralls aren't interesting, nothing downstream
matters.

> **KILL GATE A — Chandra playtest, one full reign, thralls on.** Three
> questions: (1) Does the guard ratio bite in a way you *notice and plan
> around*, or is it a background subtraction? (2) At what thrall fraction did
> you personally get nervous — and did the gauge make you nervous before the
> mechanics did? (3) Was the first thrall a decision you thought about, or a
> button you pressed?
>
> **If the guard ratio doesn't bite, STOP.** Don't build holds. The cap is the
> feature; the raiding is just content on top. A version where thralls are
> free labor with a decorative risk meter is strictly worse than no version.

### Package C — The ransom layer

**Builds:** prisoner holding + capacity; the rider-with-an-offer (reusing the
tribute card); rank-scaled pricing off the camp ledger; interrogation
(destroying the ransom) and the hold-discovery entries it writes; the
prison-break raid objective.

**Why second, before holds:** it's small, it's built almost entirely from
existing parts, and it *creates the discovery channel Package B needs*. The
interrogation-vs-ransom decision is also the cheapest genuinely interesting
choice in the whole doc — sell the man, or learn where he raided.

> **KILL GATE C:** does "sell him or question him" actually feel like a
> decision, and does the prison-break raid read as *the enemy wanting
> something specific* rather than a reskinned wave? If the break-raid is
> indistinguishable from a normal raid, cut it and keep the ransom.

### Package B — The full Reaving

**Builds:** the hold roster + generation + regen; discovery via merchant
rumor; the Reaving panel (proportional host, absence estimate, odds read,
massing warning); the abstract battle resolver; loot composition by hold
kind; the recall; exposure (camp masses while you're away); ARM + INFAMY +
SUBMIT (§6.5); avenger spawns from raided holds; marked men for reavers who
hit a minster or a farmstead.

**Sim before build** for the battle math and the EV question (§9), because
this one touches the war balance the 4,900 runs rest on.

> **KILL GATE B — playtest + Campaign 13 together.** (1) Is reaving EV
> *worse* than trade at equal gold once you price the absence and the infamy?
> (It must be worse in expectation and better in *speed* — a pump, not an
> engine.) (2) Did the player ever get punished for being away — and did they
> see it coming? (3) After ~15 raids across the roster, has the roster gone
> quiet by itself, with no cooldown rule anywhere in the code?
>
> **If reaving out-earns trade at equal risk, do not tune it down.** Find the
> structural cap that's missing (probably BAND, probably the infamy weights)
> and build that instead. §1 is not negotiable.

### Deliberately out of scope for all three

Hold sieges or occupation; permanent conquest; thrall breeding; any building
on a hold; a visible off-map layer; slave *trading* (selling thralls to the
merchant — this makes them a commodity with a price, which is both a worse
game and the one framing I'd rather the game not offer as a convenience).

---

## 9. Sim plan — Campaign 13

Run in sim2 (or the headless harness where spatial behavior matters — the
uprising and the exposure loop both need the map). Five questions, each with
a number that decides it.

**Q1 — Does the guard ratio self-limit?**
Sweep the ratio (1:3, 1:5, 1:8, 1:12) × thrall acquisition rate. Measure:
field-army size over time, thrall fraction at equilibrium, whether a
raid-heavy policy ends with a *smaller* field army than a no-thrall control.
**Success:** at 1:5, an aggressive thrall player's field army peaks and then
declines while their economy grows — the garrison state emerging on its own.
**Failure mode to watch:** the bot just hires mercenaries as wardens and the
cap never binds. If that happens, the merc upkeep escalation may need to
apply extra to warden mercs, or wardens may need to be subjects only.

**Q2 — Where does the revolt threshold bind?**
Sweep threshold (0.25 / 0.33 / 0.4) × `k` (20 / 40 / 80) × warden policy.
Measure: distribution of thrall fraction at uprising, time-to-uprising,
survival of the uprising, run outcome after it.
**Success:** most thrall-heavy runs reach 0.4–0.6 and *then* break; almost
none break below 0.33; and the post-uprising run continues (A2 — recoverable
dark age, not a run-ender). **Watch:** an uprising that ends runs is a hard
fail in disguise and violates A2 outright.

**Q3 — Reaving EV vs trade at equal gold.**
Two matched policy tiers on the same seeds: a trade-first player and a
reave-first player, both starting from the same depleted-map state (this is
the scenario the feature exists for — run it from a save where wood/stone/ore
sites are dying). Measure gold, iron, pop, masters, crowns-by-year-N.
**Success:** the reaver is *ahead early and behind late* — faster to the
first 500 gold, slower to three crowns, fewer masters, smaller army at year
20. That crossover is the whole feature. **Failure:** the reaver wins on all
axes → a structural cap is missing (see Gate B).

**Q4 — Does the 90% state collapse the way we intend?**
Force it: a scripted maximum-thrall policy, wardens prioritized to the pens,
no manumission. Measure the cause of death and the shape of the curve.
**Success:** it survives a long time, accumulates enormous stock, produces
almost no masters, and then dies to an uprising or a coalition/warlord wave
that finds no field army — and the Chronicle of that run reads like a
tragedy. **Failure:** it just plateaus safely (caps too strong — boring), or
it dies at year 6 (caps too sharp — the dramatic route isn't reachable, and
§1 requires that it be reachable).

**Q5 — The Black Death test** (§7.4, the one I most want to see).
Inject a labor shock (kill 40% of free villagers) into two mid-game states:
one with a large army, one with a small one. Do NOT script the response —
let the existing policies react.
**Success:** the army-rich state clamps down and keeps its thralls; the
army-poor state loses them and has to recover by growth and manumission.
Two divergent histories from one event, produced by enforcement capacity
alone. If that shows up in the data, print it in SIMULATIONS.md as the
headline finding, because it means the mechanics are reproducing the history
rather than illustrating it.

**Instrumentation to add:** thralls held / escaped / manumitted / died;
wardens assigned and warden-ticks; unrest peak; uprisings; thrall-fraction
timeseries; masters count split by ever-thrall; infamy timeseries; per-hold
raid count, wealth, defense; reaving casualties and loot by kind; raids
suffered while a host was afield; ransom gold in vs tribute gold out.

---

## 10. Adversarial checks (run before shipping any package)

- **The button problem.** "Take thralls" as a one-click reward after every
  won battle will be clicked reflexively. Make the first one a real pause —
  a choice card with the guard cost stated in swords, not a checkbox.
- **A2 compliance.** The uprising must be a dark age, never a game-over.
  Verify explicitly: keep survives, some population survives, the run
  continues, recovery is possible. Same audit the keep-fall got.
- **Prestige-never-power.** Nothing in the Reaving may grant combat power
  beyond the goods it brings. No "thrall levy," no reaving-derived unit
  upgrades. (ENDGAME §4's rule; the balance the 4,900 runs rest on.)
- **Interaction with Great Works.** A Work under construction plus a host
  afield is double exposure, and staged materials are lootable. That's a
  great tension — verify it isn't an unsurvivable one. Also check: does
  thrall labor trivialize a Work's material cost while the master-slot
  requirement still bites? (It should. Thralls carry stone; they don't build
  the thing.)
- **The depletion interaction is the whole premise — verify it.** If a
  competent player never actually runs out of stone/ore, the Reaving has no
  reason to exist and this doc is answering a question the game doesn't ask.
  Gate on the depletion campaign's findings first.
- **Marked men and avengers must not stack into unfairness.** Reaving
  minsters and farmsteads spawns avengers *and* marks soldiers; combined with
  the camp's avenger, a heavy reaver could face three unbuyable enemies at
  once. Cap concurrent avengers (1, maybe 2) and check the pile-on in sim.
- **UI honesty audit.** Every cost in this doc must be visible *before* the
  click: guard ratio, thrall fraction, unrest, infamy and its price effect,
  absence window, massing warning. The feature is only fair if it's legible.
- **One-playtest overfit.** Same caution as ENDGAME §6. Calibrate across
  seeds and at least two human reigns.

---

## 11. Open questions for Chandra

The calls only he can make. Numbered for the register.

**Q1 — Does this feature ship at all, and does it ship before the Great
Works summit?** The Reaving is a big, dark system, and ENDGAME's ladder is
the agreed next build with a playtest gate still open. Reaving competes with
it for the same sessions. My read: the Works are the *pull* the game is
missing and should come first; the Reaving is a *pressure valve on
depletion*, and depletion isn't even fully shipped. But it's a sequencing
call, not a technical one.

**Q2 — Is slavery in this game, at all?** Stated plainly because it deserves
to be. The doc argues that modeling it honestly — profitable, structurally
doomed, remembered — is the strongest thing the game could say about coerced
economies, and that Pillar-B naming plus the crowns exclusion carries the
moral weight without moralizing. But it puts a slave-taking button in a
cozy-adjacent builder, and it will be the first thing anyone writes about the
game. This is a values call and it's yours. If the answer is no, §4 (named
prisoners, ransom, interrogation) survives on its own and §3 (holds) survives
with loot-only raids; the doc degrades gracefully.

**Q3 — Morale coupling: which option in §5.7(d)?** My recommendation is
Option 3 (morale reacts to *unrest and fear*, never to the mere existence of
thralls), on the grounds that the alternative is a conscience meter grading
the player. But "the game should visibly disapprove" is a legitimate design
position and I'd build it if you want it.

**Q4 — The guard ratio number: 1:5?** The single most load-bearing constant
in the doc. 1:3 makes thralls nearly pointless; 1:8 makes the garrison state
comfortable. Sim can bracket it (§9 Q1) but the *feel* — how many swords in
the yard is too many — is a taste call.

**Q5 — Hold relationships for v1: accept ARM + INFAMY + SUBMIT, defer BAND?**
§6.5 argues yes on cost-to-value grounds. The counterargument — that without
BAND the Reaving has no antagonist of its own and may read as inert — is real
and I've stated it. Your call whether the climax is worth building up front.

**Q6 — Does a raided hold ever appear on the map?** The doc says never
(DECISIONS Session 5's letter and spirit). But there's a version where a
coalition expedition arrives with a *named* leader from a specific hold, and
that name being one you read on a card years earlier would be extremely
effective. Is a name on the field a violation of "no map presence," or is it
the same concession the warlord already gets?

**Q7 — Prisoners and thralls in the keep, or a real building?** v1 says keep
(no new building, hardest break-raid target). A gaol/pens building is a
placement decision and better long-term design, but it's more art and more
UI. Worth it in Package A, or defer?

**Q8 — Manumission at ~8 years: is the default drift toward freedom the
statement you want?** The doc chose it deliberately — a player who never
thinks about thralls slowly frees them anyway, and the system's resting state
is emancipation. That's a soft authorial thumb on the scale. Defensible, but
it is a thumb, and you should decide whether it's yours.

**Q9 — Should thralls be sellable to the merchant?** The doc says no (§8,
out of scope) on the grounds that a market price for people is both a worse
game and a framing the game doesn't need to offer as a convenience. But it is
the historically dominant use of captives (§7.1), and excluding it is the one
place this design flinches. If historical honesty is the priority, this is
the argument against my own call.
