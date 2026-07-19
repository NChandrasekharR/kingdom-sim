# The endgame: something to want

**Status: PARTIALLY BUILT.** The counter-raid half (§5) SHIPPED in Session 5
(2026-07-16→19) — built ON-MAP and richer than drafted: the camp is a real
place with named folk, the warlord rides at the head of his waves, and victory
poses a Frostpunk-style moral choice (punish vs. massacre) with the
consequences Chandra picked: blood-feud avenger + scripted survivor, marked
men, mercy-pays-in-people. See `docs/CHANGELOG.md` Session 5 for what shipped.
The Great Works ladder (§4) and Crown of Ages remain the drafted next build. Solves the #1 open problem (OPEN-QUESTIONS.md Session-4 pickup):
by ~yr10 every threat is handled, five hoards pile up, and nothing pulls the
player forward. Duncastle yr 19: two crowns, gold 9k, iron 1.4k, tribute never
paid, 47k food rotted.

---

## 1. The reframe

"Gold sink" was the wrong brief. Tribute and merc upkeep are working,
sim-validated sinks — and Duncastle proved a strong player correctly never
touches either. You cannot drain a hoard whose owner has no reason to spend.
The hoard is a symptom. The disease: **every want in the game is a survival
want, and survival gets solved.** The game has world-class *push* (raids,
winter, rot, warlords) and zero *pull*.

Design target: an **ambition the player authors**. The spending follows.

Constraints (applying settled pillars, not relitigating):
1. Consumes **all five hoards**, not just gold.
2. **Puts something at risk** — a purchase without jeopardy is a progress bar
   (A1: tense-but-fair is the identity).
3. Built from **existing nouns**: villagers, masters, HP, raids, territory,
   the warlord. Masters were just made precious (0.8 bar); nothing yet
   *deserves* a precious master.
4. **Loss is recoverable** (A2) — losing the ambition is a dark age, never a
   game-over.
5. The sim cannot measure want (the bot has no desires). Sim validates balance
   safety only; **playtest is the evidence for pull.**

## 2. The shape (Chandra's calls, 2026-07-16)

- **Fantasy:** builder-first, with an aggression valve. Explicitly NOT a
  symmetric rival kingdom ("then we have made a worse Age of Empires") — the
  warlord never gets an economy, buildings, or a map presence to besiege. He
  gets an **address**. "Warlord sends raids; I send raids back and fuck up the
  warlord."
- **Shape:** a **ladder of Great Works**, not one monument (each tier is a
  knob; the want doesn't expire at first completion).
- **Crowns:** the ladder's summit is the **Fourth Crown — the Crown of Ages**.
  The Turn-4 three-crowns decision extends, not reopens: crowns stay
  high-water marks, winning stays optional.

## 3. The interlock (why this is one system, not three features)

```
build a Great Work  →  wealth made visible: warlord appetite rises
        ↑                                        ↓
quiet years to build  ←  pay tribute / turtle / MARCH on his camp
```

- The Work is the **provocation**: each tier raises warlord appetite and makes
  the scaffolded site a preferred raid target.
- Tribute finally tempts the **rich** — the Duncastle finding ("Danegeld is
  drama for the weak") inverts once the strong player has a scaffold to
  protect. Pay, turtle, or march: a real decision with five hoards behind it.
- The **counter-raid** buys the quiet years the Work needs. Aggression in
  service of the builder fantasy — that's the differentiator from AoE.

## 4. The Ladder of Great Works

Mechanics that make it a want, not a progress bar:

- **Masters build it.** A site has master slots; a master on the scaffold is
  not running their workshop — HP-as-output means the economy visibly dips
  while the Work rises. Losing a master mid-build stalls the tier (journeymen
  continue at half speed — a visible ache, not a deadlock).
- **Materials are staged on site** and lootable. A sack plunders staged
  materials and knocks back a % of built progress; the Work is never razed
  (A2). Years of work can be set back; the answer is a dark age, not a reset.
- **Rewards are prestige-forward, never army power** — morale auras, chronicle
  glory, the Crown. Power rewards would turn ambition into an efficiency
  purchase and break war balance the 4,900 runs rest on.

Tier sketch (costs are placeholders — calibrate against post-boom economy,
seed 42 yr 12: pop 375, gold 18k, bread 3.1k; and against the NEXT playtest,
not just Duncastle):

| Tier | Work | Cost profile | Masters | Time | Effect |
|---|---|---|---|---|---|
| 1 | **Guildhall** | ~500g + wood/stone | 2 | ~1 yr | gentle intro; small skill-gain aura; post-dark-age beacon |
| 2 | **Great Temple** | thousands of gold, all materials | 4–6 | 2–3 yr | morale, festivals; serious provocation |
| 3 | **The High Seat** | Duncastle-scale draughts of all five hoards | 8+ | many yrs | warlord marches on it; completion = **Crown of Ages** |

## 5. The counter-raid ("fuck up the warlord")

Asymmetric by construction — the warlord stays a pressure system with a face:

- **The camp**: a location at the map edge / beyond the fog. A stat block —
  strength, defenses, hoard — never an economy.
- **Intel**: camp location revealed by interrogating routed/captured raiders.
  (Named raiders + kill attribution, shipped Session 4, were secretly built
  for this.)
- **The march**: send chosen soldiers; they leave the map for N days. Home
  defense is genuinely weakened while they're gone — the classic sortie
  gamble. Provisioning costs food + gold.
- **The fight**: same probabilistic combat, conditions inverted — no
  home-ground, no tower cover, his gang pressure. Expeditions are bloody by
  design; veterans and numbers decide it (the 98%-home vs 41%-open spread,
  now pointed outward).
- **Outcomes**: break his raiding strength for years (rubber-band setback);
  reclaim loot — his hoard is a **ledger of what he took from you plus
  tribute paid**, so raiding him when he's poor yields nothing (anti-farming
  falls out of the fiction, no cap rule needed); kill the named warlord → a
  successor rises harder later (pressure is A2-recoverable for the world too).

## 6. Adversarial checks (run before shipping)

- **Progress-bar risk**: if provocation + master-drain don't create felt
  tension, the Work is decoration. Kill gate below exists for exactly this.
- **Wonder-rush**: tiers must not be affordable before warlords gate
  (pop ≥ 25); tier costs naturally gate this — verify in sim.
- **Farming the warlord**: ledger-hoard + expedition casualties + home
  exposure should make it negative-EV — sim this, don't assume it.
- **Decapitation**: breaking the warlord must not end all pressure —
  successor cadence is the knob.
- **The 30%**: a player limping out of a dark age must meet this as pull, not
  new pressure. Tier 1 doubles as the rebuild's beacon; the whole layer is
  opt-in.
- **Object model check** (known blind spot): verify the labor system can
  assign masters to a *site* before promising masters-on-scaffold.
- **One-playtest overfit**: Duncastle is one strong run. Calibrate costs
  across seeds and the next human playtest.

## 7. Phasing (kill gates, per the method)

- **W1 — ship next session (small bet: shipping is the discovery):**
  Ladder tiers 1–2. Masters-on-scaffold, staged lootable materials,
  provocation hook into warlord appetite. **Kill gate: Chandra playtest —
  "did you feel pull?" If no pull, stop decorating and rethink.**
- **W2 — sim first (bigger bet: discovery de-risks):** counter-raid math in
  sim2 (expedition vs. camp strength, appetite-break duration, anti-farm EV,
  collapse safety). Campaign 12. Runs in parallel with W1's playtest.
- **W3 — game build:** march UI, interrogation-reveals-camp, expedition
  resolution, successor system. Only after W2 validates.
- **W4 — the summit:** tier 3 + Crown of Ages, once both halves feel right.

Prerequisite reminder: the Session-4 main hasn't had its human playtest yet,
and the Vercel deploy predates Sessions 3–4. Playtest current main first —
it gates the redeploy AND settles the walls/raid-size watch items W1 tuning
will lean on.
