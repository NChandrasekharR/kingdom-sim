# Changelog

Commit-level record of what shipped, newest session first. For the narrative see
[`CHATLOG.md`](CHATLOG.md); for the *why* see [`DECISIONS.md`](DECISIONS.md); for
the sim numbers see [`SIMULATIONS.md`](SIMULATIONS.md).

Everything is on `main` (Session 4 merged the Session-3 branch). The Vercel
deploy is manual (`npx vercel --prod`) and current through **Session 8** —
redeployed 2026-08-18 at Chandra's word, the full Session-8 stack included.

---

## Session 10b — garrisons and refuges (2026-10-05)

**Garrisons.** A barracks more than 10 tiles from the keep is a garrison post
(toggle in the inspector, with a ring on the map).
- Its 4 soldiers live there and hold 9 tiles around it.
- It sallies only at even odds; otherwise it shuts its gates.
- It stays home when the host marches.

**Refuges.** Fleeing workers run to the nearest tower, barracks or keep with
room, not always the keep.

Measured in Campaign 16. Refuges save about 15% of craft masters where
workers are hunted. Garrisons are neutral-to-costly in the bot's realms,
which never pair an army with exposed outlying sites; the playtest is the
real test (HOMEOSTASIS.md §3.4).

## Session 10 — homeostasis: the √ raid curve and the chronicle's honesty (2026-10-02)

Prompted by the Thornmere playthrough. Design and numbers are in
`design/HOMEOSTASIS.md`; measurements are Campaign 15 in `SIMULATIONS.md`.

**The raid curve.** Waves now grow on `2 + 4.5√(prosperity/1000) +
0.15·soldiers` (`RAID.sizeCurve: 'sqrt'`, `raidSizeF`), cap 90, warlord ×1.8.
The old linear curve was pinned at 40 from about Year 10 while its own
formula asked for about 300. The opening and the early warlord waves are
unchanged. Late raids grow to about 58.

**The chronicle.**
- Camp folk names never repeat across camps, and an avenger's name is
  retired (42-name pool).
- Warlords and avengers get the right pronouns (`names.js`).
- No more "the The High Seat".
- Each caravan visit writes one line per resource ("Sold 300 stone to the
  caravan for 689 gold (4.9 → 0.8 each)").
- When the journal runs long it drops births, trades and single blows first,
  so the founding years survive.

**Housing hints.** The population tooltip and the grain-rot message now say
when every bed is taken.

## Session 8 — loot justice, the boss, the ladder, and the Reaving (2026-08-17→18)

The session's arc, in merge order: an old broken promise paid off (loot
recovery) → the warlord made worth killing (sworn men + camp spoils) → the
ground made finite for stone and ore, and swept → the Reaving designed on
paper → the depletion polish batch (below) → the preemptive strike, which
began as a bug report and ended as a verb. Measurements in
`docs/SIMULATIONS.md` (Campaigns 13–14).

### `7b551a9` — The gathering turns to meet them (the preemptive strike)

Started as a playtest question — *what happens if I march while they're
massing?* — and the answer was: nothing good, in four ways at once.

**The diagnosis.** The massing bodies at the tents were **render-only props**
(`c.massing`, capped at 18 for the eye) with no count behind them. So a host
that marched mid-massing fought **only the garrison** — the wave standing right
there was scenery you walked through. Worse, breaking the camp left the pending
camp-origin wave still armed in `state.raid`: with no camp to march from, it
**teleported to a random map edge** and arrived as if it had always come from
the wilds. And the sally stance had nothing to target, because the gathering
wasn't made of bodies.

**The fix** (`camp.js`, `raids.js`, `state.js`, `scene.js`)
- `c.massingCount` now carries the **true size** of the coming wave (the props
  stay capped); `joinMassers()` mints that many real bodies — named in the
  raiders' saga style — into a **battle-only** `c.massers` array when the host
  engages. Battle-only, not folded into the garrison, because the garrison
  drives the iron spoils reckoning and the refill target, and none of that
  should count men who were never garrison.
- **Victory cancels the wave.** The gathering died on its own ground, so it
  never marches: the pending raid goes back to a fresh `quietGap()` — the same
  formula that follows any raid, now extracted so both callers share it.
- **The timer HOLDS during the battle.** While your host is fighting at the
  tents and the gathering has turned to meet it, the countdown stops. The
  battle decides the wave, not the clock.
- **Repulse or host-wiped releases them.** Survivors stand back down to props
  and their wave marches as it always would have — being repulsed buys nothing.
- **The dispersal branch kills the teleport at source**: a camp broken or
  burned while a wave was gathering scatters it outright
  (*"The war-band that was gathering has scattered — there is no camp to muster
  at."*) rather than re-homing it on a map edge.
- `clearMassing()` is the single exit — every path that ends a gathering (wave
  launched, raid over, tribute paid, camp struck, camp relocated) clears both
  the props and the count, so scenery never animates at a dead camp.
- Save migration infers `massingCount` from the prop count for pre-fix saves;
  massers render beside the garrison.
- **38/38 staged assertions** pass.

### `c92d692` — Finite stone and ore (merge of `f94ce4c` + `244e524` + `e7b240b`)

The forest's pattern extended to the two mining chains: the ground itself gives
out. Swept before landing — see SIMULATIONS Campaign 14.

- **`DEPOSITS` config block** (`src/config.js`): `stoneBase 250 ±90`,
  `oreBase 150 ±60`, `harvestRadius 2.2` shared with the FOREST cadence. Every
  value `_envNum`-overridable (`KSIM_STONE_BASE` / `KSIM_ORE_BASE` / `…_VAR`),
  with `'inf'` for a bottomless control run — that's what made the sweep
  possible.
- Every HILLS tile holds stone and every ORE tile holds ore, as **per-tile
  Float32 reserves**; quarries and mines draw down the nearest live tile in
  reach, and a depleted site employs nobody.
- **HILLS → PLAINS**: worked-out hill country flattens — the quarry ground
  becomes a plain, farmable, exactly as spent forest becomes assarted field.
- **ORE → HILLS cascade**: a spent vein falls back to bare hills that are
  themselves quarryable. `244e524` fixed this: the conversion had been leaving
  `stoneStock` at 0, so the cascade never actually fired. The fallen tile is
  now seeded through `stoneTileStock()` and the stone drawn from such tiles is
  tracked as `cascadeStone` (155–567 in mining-heavy runs).
- Save migration seeds reserves for pre-deposit saves.

### `4539a14` — `design/REAVING.md` (merge of `9216fd9`)

Design only, no code. The third answer to depletion — trade, expand, or
**take** — specced at 1,304 lines.

- **Off-map holds** as stat-block addresses: no map presence, no rival economy
  (DECISIONS Session 5's asymmetry law held), a roster model, discovery, the
  expedition reusing the existing march, battle math, and exposure as the true
  cost of being away.
- **Named prisoners** with ransom (the warlord's rider, inverted), where they
  are held, and the prison-break raid.
- **Thralls** at full structural depth: what a thrall is mechanically, housing,
  why they can never become masters, the **guard ratio** as the central
  mechanism, escape and the revolt threshold, manumission, citizen–thrall
  interaction, the Crowns exclusion, and voice.
- **Hold relationships** as a tradeoff space (ARM / BAND / SUBMIT / INFAMY)
  with a v1 recommendation; historical grounding across the plunder-and-tribute
  economy, serfdom, Sparta, the Black Death, colonization frontiers, and the
  structural verdict on coerced labor.
- **Phasing A → C → B** with kill gates, an explicit out-of-scope list, a sim
  plan, adversarial checks, and **nine open questions for Chandra** (§11).
  Its sim plan is written as "Campaign 13"; that number went to the polish
  batch, so the Reaving campaign will number from 15.

### `e5056d7` — The warlord rides with sworn men + the spoils of the camp (merge of `842aa8a`)

Two halves of one problem: the boss fight was cheap, and winning it could pay
nothing at all.

**The sworn men** (`config.js` CAMP, `raids.js`, `camp.js`)
- Four **Oathbound** ride at the warlord's shoulder (`swornMen: 4`), each
  `RAIDER.hp × 2.2` = 66 HP and named in his own style.
- They **clamp to his position** (within 2.5 tiles) while he lives, **never
  loot** — they hold at their lord's side — and **flee the moment he falls**.
- `warlordArrowMult: 0.4` — while any sworn man still stands, his
  shield-bearers catch the shafts and arrows bite the warlord at 40%. Kill the
  retinue first or the tower fire is wasted on him.
- In the spatial force-ratio, **the warlord counts as two men** in `localGang`
  and a sworn man as one: standing in front of him is genuinely dangerous.
- `stats.warlordsSlain` now counted.

**The spoils of the camp** (`CAMP.spoils`, `camp.js`, `ui.js`)
- A victory floor: `gold 25, food 20, wood 15, ironPerSword 0.4` — arm-rings,
  stores, and weapons stripped off the dead. Iron is reckoned against
  `exp.battleGarrison`, the swords counted **before the killing starts**, not
  the empty ground left after.
- **Identical for punish and massacre.** Mercy is not priced.
- An empty ledger now gets its own chronicle line and its own victory-modal
  copy (*"The hoard is bare — but the camp itself is worth the taking"*)
  instead of announcing zero gold and zero goods.
- **Validation** (seed 42, 25y): the fight now costs **+7 soldier deaths** and
  **−8.5% population** against baseline, with no death spiral.

### `9918c96` — Slain raiders drop their plunder (merge of `f274725` + `fee84f6`)

The sally-stance tooltip has promised *"loot recovered, blood risked"* since
Session 4. The code never delivered it — a raider cut down with your grain on
his back simply deleted it.

- Each raider carries a **typed `lootBag`**: `{gold, iron, bread, food, wood,
  stone, ore}` recording *what* he stole, not just how much. Cut him down and
  the very goods roll back into the stockpile, resource by resource.
- **The escape rule is by mode, not by pulse** (`fee84f6`): a raider who has
  already slipped away (`mode === 'gone'`) banks to the camp hoard *even if an
  arrow finds him at the treeline on his escape tick*. He got away; the ledger
  says so. Without the guard, that one man's plunder was paid to the player and
  to the hoard both.
- The per-raid reckoning gained a line: *"N goods won back from the slain."*
- `stats.lootRecovered` tracked; save migration backfills `lootBag` on
  in-flight raiders and refunds bag-less legacy loot as food, so nothing stolen
  is ever silently destroyed.

### The depletion polish batch (`2b775a6`, `0284f7a`)

Four ratified designer calls built together, because they all touch the same
seam: the ground is finite, and the systems around it hadn't caught up.
Measurements in `docs/SIMULATIONS.md` (Campaign 13).

**Wood retune** (`src/config.js` FOREST)
- `woodBase` 90 → **250**, `woodVar` 50 → **125**. The block's "~4-6 years per
  site" comment had been aspirational since Session 5c — the shipped value
  actually delivered **1.0–1.8 years**. Swept 250/300/350/450 over seeds
  42/7/123; 250 lands **3.6–5.0** with year-3 wood and pop unchanged.
- The comment now states the measured cadence and cites the sweep.
- `_envNum` hoisted above FOREST so wood is env-sweepable too
  (`KSIM_WOOD_BASE` / `KSIM_WOOD_VAR`) alongside the existing stone/ore knobs.

**The Potosí — per-vein richness** (`src/core/mapgen.js`, `src/core/state.js`)
- Each vein draws a fortune from the map seed: ordinary **0.8–1.3×**, and
  `1.5/11` of them a **deep vein at 3–6×**. Measured 1.56 deep veins per map
  over 300 seeds; 52/300 maps get none.
- `generateMap` now returns `veinRichness` (tile → multiplier) and `deepVeins`;
  `seedStoneOre(terrain, veinRichness)` multiplies each ORE tile's own roll by
  its vein's fortune. Deterministic per seed; reserves serialize as before.
- First DRAW from a deep vein writes one chronicle line in the house voice:
  *"The miners strike a vein that runs deeper than any man of {name} has known."*
- A run that mines one banks **~30× the ore and ~8× the iron** of one that
  doesn't (seed 11: ore 2,282 / iron 81, vs seed 42's 73 / 10).

**Merchant buy cap — resolves D4** (`src/config.js` TRADE_CAP, `src/core/trade.js`)
- Per-visit cap on goods BOUGHT: `capBase 20 + 15/dock + 5/market`. Selling
  stays uncapped. Resets on caravan arrival; survives save/load.
- Commerce-scaled by design: a harbor kingdom imports its way through a spent
  hinterland, a landlocked one cannot.
- `buy()` now returns `true` or the REASON it refused, so the UI can say
  *"the caravan's carts are full — harbors would carry more"*. Oversized orders
  are refused whole — no silent partial fills.
- Trade panel shows remaining capacity in both merchant states.

**Auto-demolish spent camps** (`src/core/economy.js`, `src/core/sim.js`)
- A depleted lumber camp / quarry / mine strikes itself, reusing the existing
  condition-scaled `demolish()` refund (no new refund math). Runs before
  `maintenanceTick` so a husk never takes a last mouthful of repair wood, and
  as its own pass so husks carried in on a LOADED SAVE are swept too.
- Chronicle line: *"The … at the spent ground is struck — its timbers come home."*
- The steward's `depleted` counsel now keys on a sticky `sawDepletedSite` flag,
  because the building is gone before `tutorialTick` runs; its text was rewritten
  (it used to tell the player to tear the camp down).
- **Ghost repair 25.7/18.8/22.7/24.1% → 0.0%.** Knock-on: mean late-game
  building HP recovered from 0.02–0.13 to **0.70+** on three of four seeds, and
  every keep fall across the four validation seeds disappeared. Seed 99's
  baseline collapse (pop 1, FALLEN at year 15.7) now finishes at pop 700.

**Harness** (`model/`)
- `depletion-polish-run.mjs` — site lifetime, ghost repair, vein fortune, cap usage.
- `polish-unit-checks.mjs` — 39 assertions covering the cap, the Potosí, the
  auto-demolish refund, and old-save migration. All pass.
- `vein-probe.mjs`, `wood-sweep.sh`, `wood-one.sh`, `polish-batch.sh`.

---

## Session 7 — The Steward's Counsel + launch assets (2026-07-20)

The onboarding plan (`design/ONBOARDING.md`, drafted Session 6) built as
specified, plus the launch thread's visual assets.

**The Steward's Counsel** (`src/core/tutorial.js`, ~230 lines)
- A minted advisor ("Steward Osric the Steady" style, seeded from the reign)
  offers ONE counsel at a time in a parchment card above the sidebar tabs.
  Eight-step ladder (house → farm → lumber → staffed tower → the first raid →
  barracks+soldier → 8 roads → farewell), each completed by the real event via
  pure state reads — no tutorial actions, no gating, no pausing.
- Counsel + acknowledgments land in the Chronicle as a new `'counsel'` kind
  (gold-tinted). Just-in-time one-shots cover first contact with spoilage,
  tribute, the nest, the warlord, massing, depleted lumber, wall breach, and
  march-readiness; the victory choice is deliberately silent.
- Skips: "Dismiss the steward" link (polite, final, localStorage-flagged so no
  reign ever shows it again); auto-skip on 4 unprompted building types; loaded
  pre-tutorial saves retire the ladder and pre-mark in-play systems as seen.
- §7b grace: +100 ticks before the first raid while the ladder is fresh.
- Verified headless (scripted full-ladder walk, dismissal, auto-skip, JIT
  one-shots, save/load roundtrip, pre-tutorial save migration — all pass) and
  in-browser (card render, dismiss flow, New-Kingdom-never-restarts, grace
  timer). Production build clean.

**Launch assets** (`teaser/src/Stills.jsx`, rendered to `teaser/out/thread/`)
- `public/og-card.png` (1200×630) + full `og:`/`twitter:` meta on both
  `index.html` and `landing.html` — tweets/LinkedIn/Slack now unfurl a card.
- One still per thread post: custom compositions for posts 3 (HP=output),
  6 (~4,900 reigns), 7 (NaN warlord), 8 (eat order), 9 (masters), 10 (no
  rival), plus teaser frame-grabs for 2, 4, 5, 11 and a bonus "Meet the
  Steward" card. Asset map in `teaser/TWEET.md`.
- Two extra cards for Chandra's personal-thread copy: `still-entropy`
  ("tradeoffs under entropy" punchline) and `still-taste` (config sliders +
  the tuning questions; "the sims find the numbers, taste finds the game").
  Rendered files live in `teaser/out/thread/` (gitignored — re-render from
  `src/Stills.jsx` with `npx remotion still`).

---

## Session 6 — The border, the roads, and the launch kit (2026-07-20)

Four commits, `6a466b0`→`982cca0`. Arc: two playtest-driven map fixes from
Chandra's year-60 Caer Bryn reign (the camp founding on claimed ground, armies
ignoring the roads he'd paid for) → the outward-facing kit — landing page,
Remotion teaser, launch-thread draft — and the FIRST deploy of current `main`
(the live build had been five sessions stale) → the onboarding plan Session 7
would build. Its CHATLOG turns were not reconstructed; the commit messages
carry the record.

### `6a466b0` — Camp respects the border + roads carry the war

The one gameplay commit of the session; both halves shipped together
(`camp.js`, `raids.js`, `config.js`).

- **The camp never founds on claimed ground.** Site selection runs in
  strictness tiers (shadow-clear of the border → merely unclaimed → legacy
  anywhere), and a standing camp swallowed by the border (pre-fix saves)
  strikes its tents and relocates to open wilds — folk, garrison, warlord,
  and hoard re-pitched, Chronicle line written. Never mid-expedition; ashes
  stay where they burned; a fully-claimed world backs off instead of
  rescanning.
- **Roads are the arteries of the map.** Road/bridge tiles are cheap in the
  shared pathfinder (1/1.7 of plains, heuristic rescaled to stay admissible),
  so raiders, stragglers, and the expedition host all bend onto the network
  and march it at 1.7×. Also fixes a latent bridge stall: movement speed read
  the water tile beneath a bridge (`move=Infinity`) and froze units mid-river.
  The road description now teaches the tradeoff: armies march the roads —
  yours, and theirs.
- Verified headless (14 camp assertions + road-preference/bridge-crossing
  tests, seed-42 harness regression clean) and in-browser (camp relocation
  live; a 22-raider camp wave averaged 74% of its path on player roads).

### `b53fd7d` — The landing page + the deploy

- `landing.html`: a self-contained page in the game's own design language
  (iron/parchment chrome, Pirata One + Alegreya, sprite matrices rendered by
  the game's own `drawArt`) — hero with a living pixel diorama (raiders
  marching the road from the camp on the horizon), what-it-is ledger,
  how-a-reign-goes cards, Three Crowns rows, a Chronicle excerpt, the teaser
  framed between hero and ledger.
- `vite.config.js` multipage build (landing ships beside the game); `public/`
  carries the teaser mp4 + poster into dist; `.vercelignore` keeps
  teaser/sim2/model/docs/design out of deploy uploads.
- **Deployed 2026-07-20**: kingdom-sim-fawn.vercel.app now runs current
  `main` — the live build had been five sessions stale.

### `32e8911` — Teaser video (Remotion) + launch tweet thread

- `teaser/`: a Remotion 4 project rendering a 44s silent social teaser from
  the game's own sprite matrices (SVG-rendered, crisp at 1080p) — eight
  scenes: title, named souls with real Chronicle lines, raise-the-works, the
  tradeoffs (HP-as-output, rot vs bread, mortal masters), the raid, the
  enemy's address, the moral choice, outro.
- Render note: Remotion's bundled ffmpeg targets macOS 15 and fails on this
  machine — the working pipeline is `--sequence` PNG frames + an
  `ffmpeg-static` encode (both scripted; recipe in the render docs).
- `teaser/TWEET.md`: an 11-post launch thread with the behind-the-scenes
  numbers (~4,900 Monte Carlo reigns, the raiderDmg master dial, the
  warlord-NaN bug, the eat-order flip, the 201-masters problem), all checked
  against `docs/`; includes a short-cut variant.

### `982cca0` — The onboarding plan (`design/ONBOARDING.md`)

- Design only, no code: the Steward's Counsel — a named steward offers ONE
  diegetic counsel at a time (parchment card above the sidebar tabs),
  completed by real events, acknowledged in the Chronicle, dismissible
  forever in one click. Eight-step first-reign ladder + just-in-time
  one-shots for every system's first contact; auto-skip for returning
  players; no rewards; never blocks the sandbox (A3/sandbox constraints
  honored). Open questions for Chandra + kill gate included. Built as
  specified in Session 7.

---

## Session 5 — The endgame design, the counter-raid, and the living map (2026-07-16→19)

Six commits, `e639935`→`e4293c2`. Arc: the late-game WANT design session
(`design/ENDGAME.md`) → the counter-raid built ON-MAP with the moral choice →
Chandra's LIVE playtest loop (his Chrome on the dev server, asks arriving as
he played) → watchtower rework, raids-from-camp with staged massing, finite
forests, territory-from-works, bridges, and a QoL batch. A stable build
server (`vite preview :4173`) now separates playtesting from development.

### `e639935` — The warlord gets an address (the counter-raid)

One feature, whole first build: the warlord gets an ADDRESS. Design session first
(see `design/ENDGAME.md` — reframe: the late-game problem is no PULL, not no
sink; Chandra rejected symmetric rival kingdoms as "a worse Age of Empires" and
asked for counter-raids: "warlord sends raids, I send raids back"), then the
build. Verified headless (all three resolution paths scripted end-to-end) +
in-browser (march, battle, choice modal, on-screen massacre hunt, marked-man
refusal); baseline seed-42 numbers unchanged; production build clean.

**The camp** (`src/core/camp.js`, `CAMP` config block)
- Founded in the far wilds corner the first time a warlord shows himself:
  hall + tents, ~9 named camp folk (shepherds, weavers — not fighters), a
  garrison that grows with the hoard, and the warlord himself at his hall.
- His **ledger**: every fled raider's loot and every tribute payment lands in
  the camp hoard — the counter-raid's prize is *what he took from you*.
- Warlord dread waves now **march from the camp** (visible telegraphing, watch
  the road); he rides at their head as a boss body (170 HP, 3× wall batter,
  crowned sprite). Kill him at your walls → his host breaks and scatters; the
  camp waits leaderless until a successor claims it (~5 yr).
- Common brigand raids still slip in from random map edges.

**The march**
- "March on the camp" (Kingdom tab) sends EVERY soldier — the home-guard
  decision is how many you muster first (militia is the dial). Provisions cost
  food + gold. The host walks there on the real map (pale dots on the minimap);
  home genuinely thinner while they're gone.
- The fight is on HIS ground: no home-ground, no tower cover, garrison gang
  pressure, warlord counts double in the melee — expeditions are bloody by
  construction. Lose half the host → rout, survivors limp home, he smells
  weakness (next raid sooner).

**The choice** (at the moment of victory, game paused, standing in his camp)
- **Take back what is ours** — reclaim the hoard, burn the war-tents (camp
  broken ~4 yr), spare the folk. Mercy pays: spared folk drift to your gates
  as settlers over the years, sometimes with a craft.
- **Leave nothing standing** — the camp folk scatter and your soldiers run
  them down ON SCREEN (eject-and-hunt pointed the other way), each named in
  the Chronicle. One survivor ALWAYS slips through the reeds. The camp is
  ashes forever — and ~3 yr later the survivor returns as the AVENGER: sooner,
  harder waves (×1.35), and he sends no rider — tribute is dead against him.
  The men who did it come home MARKED: kill-resistant, and they refuse to
  ever stand down ("not since the burning").
- Emergent (observed in test, no dedicated code): the warlord can be mid-raid
  while you burn his home — two armies crossing on one map. He returns to
  ashes, and his grief halves the avenger's timer.

Files: `camp.js` (new), `config.js` (`CAMP`), `raids.js` (camp-origin waves,
warlord body, ledger hooks, marked/exp-aware muster), `sim.js`/`state.js`
(wiring + save migration), `sprites.js`/`scene.js` (tents, crowned warlord,
folk, hit-tests), `ui.js`/`style.css` (camp status box, march button, choice
modal — reload-safe), stats + `kingdom.summary()` camp block.

### `018f928` — Watchtowers: real targets, watchman inside, silent when battered

- Raiders target manned towers (pickTarget value 0.2→2.5 — silence the shield;
  an already-sacked tower is rubble, back to 0.2).
- The watchman goes INSIDE: body hidden within `VILLAGER.towerInsideRadius`,
  the red watch-FLAG flies over a manned tower, he neither panics nor can be
  hunted, and clicks pass through to the tower.
- Battered to its floor → dark rubble tint, arrows SILENT, nobody mans the
  wreckage; the watchman scrambles out (ejected, huntable) with a named
  chronicle line. Repair past half → the watch resumes, flag up. Sack-not-raze
  stands; the keep's guard still fires from its stones.

### `24bf86d` — Refuse the Danegeld + blank-map guard + reachable camps

- Tribute banner gains a crimson **Refuse**: send the rider back empty-handed
  and the warlord marches AT ONCE (defiance spends the waiting window).
- Renderer skips (and names in the console, once) any unit with a non-finite
  position — one NaN transform silently blanked the whole WebGL batch.
  (Root cause of Chandra's blackouts turned out to be dev-server HMR 404s —
  see the stable server below — but the guard stays as armor.)
- Camp founding falls back to the farthest REACHABLE plains tile when its
  corner is sea or cut off.

### `0a1687f` — Raids march from the camp: nest, staged massing, the shadow

- The FIRST raid founds an UNCLAIMED brigand nest (`CAMP.nestGarrison=3`, no
  warlord); a warlord CLAIMS it when the kingdom is worth the march
  (`claimCampByWarlord`). Break the nest early — before anyone claims it.
- ~70% of common raids (`CAMP.raidFromCampChance`) and ALL warlord hosts
  march from the camp; the rest slip in from random edges (load-bearing:
  a single origin would let one walled corridor kill the pressure system).
- STAGED telegraphing for camp waves: "Raiders are massing" at timer≤150 with
  bodies visibly gathering at the tents (count ≈ predicted wave size), "the
  war-camp stirs" at ≤60, stage-aware Kingdom-tab status, origin-aware spawn
  lines. Dispersed on tribute payment or wave end.
- THE WARLORD'S SHADOW: no claim takes root within `CAMP.shadowRadius=9` of a
  living camp — kills the claim-to-his-tents / towers-at-spawn cheese; forward
  forts outside the shadow are legitimate and risky. Lifts when camp is ashes.
- Fix: phantom nameless warlord body riding with common camp-origin waves
  (null-name crash in `warlordFell`) — the man rides only with his own host.

### `0512f23` — Finite forests + territory from works + QoL batch

- **The economy eats the map** (`FOREST` block): every forest tile holds ~90
  wood (±50 by mapgen richness); lumber camps cut the nearest standing timber
  (`cutTimber`, cached target, radius 2.2). ~2 tiles cleared/year; a camp site
  lasts 4–6 years. The forest THINS visibly (tree density by remaining stock,
  band-crossing repaints), and a spent tile converts to farmable PLAINS
  (`terrain-changed` event → scene + minimap repaint). A camp with nothing in
  reach goes quiet for good (workers reassigned, chronicle line, inspector
  shows "timber in reach ~N"). Old saves seed stock fresh.
- **Territory follows the works of the realm**: houses (3), lumber (3),
  farms/docks/quarries/mines/smelters/bakeries (2), market (4), barracks (3),
  and ROADS (2) all project influence — push a road into the wilds and the
  border ribbons after it (and claims the ground the next lumber camp needs).
- **Enclave auto-fold** (`claimEnclaves`, every 32 ticks): pockets of wilds
  fully surrounded by the realm join it (lakes stay lakes; the shadow resists).
- **QoL**: roads/walls PAINT under a left-drag (line-walked, no skipped
  tiles); lumber placement shows its harvest ring, ranged buildings their
  arrow ring; demolish refunds ALL cost components scaled by HP condition
  (sound building ≈ full refund — relocation is routine under depletion);
  stale minimap after New Kingdom fixed; headless bot relocates camps.
- **Stable playtest server**: `kingdom-sim-stable` launch config
  (`vite preview :4173`) serving `dist/` — Chandra's blackouts were his tab
  fetching stale modules from the LIVE dev server during edits (HMR 404s).
  Play on 4173; 5173 is the workbench.

### `e4293c2` — Bridges: the road tool crosses water

- Drag a road over water → BRIDGE segments (6 wood + 4 stone each), chainable
  from shore or from another bridge. The ghost shows planks over water.
- A bridge CLAIMS the tile beneath it (the border marches across the water and
  can take the far shore); soldiers and the merchant count it as road; the
  pathfinder makes the water tile walkable — for raiders too. A bridge is a
  chokepoint worth a watchtower.

---

## Session 4 — Merge, the two ports, and the 21-idea run (2026-07-16)

Seven commits on `main`, from the fast-forward merge of `phase1-defense-and-keep`
(`b0417ad`). Arc: first-principles review → merge + the two overdue ports →
Chandra's 21-item playtest list done in four prioritized batches → the Duncastle
playtest log → two economy fixes it demanded. All sim-validated where balance
was at stake; all verified headless + browser; production builds clean.

### The ports

**`60bec47` — Port food spoilage to game (bread finally matters)**
- Raw food above a per-capita buffer (`FOOD.spoilFreeTicks=60` of eating) rots
  at 1%/tick; bread keeps — sim numbers verbatim. Chronicle event teaches the
  mechanic; `foodSpoiled` in stats + `kingdom.summary()`. Headless: food
  oscillates 300–1,000 instead of hoarding into the thousands.

**`1331386` — Port Phase 3 spatial layer: villager bodies, eject-and-hunt, watchman towers**
- Villagers get positions, walk home↔work, render as sprites, click-to-inspect.
- UNIFIED DEATH RULE ships: the 12% die-at-post sack roll is REMOVED; sacked
  buildings eject crews; civilians panic within `VILLAGER.panicRadius=3` of a
  raider and flee to the keep (leaving the labor pool until the raid ends); the
  hunt (`HUNT` block, Campaign-6 numbers: cadence 20, killChance 0.35, hoe-swing
  fightback) runs LAST in the raid tick with REAL spatial checks — a soldier
  within 1.6 tiles pins a raider; keep/house proximity shelters.
- Watchtowers need a villager watchman (`workers: 1`, first in `WORK_PRIORITY`,
  inert unstaffed, arrows scale with watch skill; fallen tower ejects him).

### The 21-idea batches

**`57f136a` — Legibility batch**
- Raids END when the last raider turns tail (stragglers still walk off, towers
  take parting shots); named raiders + two-way kill attribution; per-raid
  reckoning (Chronicle line + console tally, browser-only so headless CSVs stay
  clean); merchant-arrival toast; Rally-to-the-Keep button (150-tick fallback);
  tabular-monospace resource/trade numbers.

**`091abf2` — Tribute (Danegeld) + uncapped merc market — THE gold sink**
- Warlord's rider demands `TRIBUTE.demandFrac=0.25` of the treasury (min 40);
  pay → wave skipped, appetite ×1.6; face him → appetite resets. Banner UI.
- sim2 Campaign 9: safe (0-1% collapse baseline+gauntlet), real (median 3.9k
  gold sunk). **Fixed the latent sim2 warlord-cadence NaN** — warlords never
  spawned in ANY prior campaign (see SIMULATIONS.md caveat).
- Mercs: hard cap removed; escalating upkeep (+35% per extra company on every
  merc) is the market's own soft cap. `mercUpkeepRate()` drives the UI.

**`a5c9454` — Army fights as a line: spread targeting, merc first contact, rout, stance**
- Diagnosed die-en-masse (dogpile → same-tick melee entry → same-tick deaths);
  coverage-spread targeting (`coverPenalty=2.5`) halves death clusters, win
  rate unchanged; mercs pick targets first; ROUT at `routFrac=0.4` raid losses
  (keep-besieged fights to the death); hold/sally stance toggle in Kingdom tab.

**`1526633` — Mobilise/demobilise: militia**
- `v.armed` persists; stand down = militia (eats 1×, keeps skill); re-muster
  free, most-seasoned first; recruit button shows the reserve.

### The Duncastle fixes

**`a33b8d5` — Bread is the reserve + masters are precious + rot indicator**
- EAT-ORDER FLIP (game + sim2): raw food first, bread only on shortfall — bread
  accumulates (seed-42: 3,139 loaves by yr 12; Duncastle had rotted 47,690 food
  with bread at 0). Morale +8 from a stocked larder (`bread*2 >= pop`), not
  daily eating. Food chip goes moldy (`.rot`) + tooltip while surplus rots.
- MASTERS: `gainPerTick` 0.0008→0.0004, `masterAt` 0.6→0.8 (game + sim2, which
  also got its five hardcoded 0.6 bars parameterized). Duncastle had 201
  masters of 245 pop; sim now 0.40-0.54.
- Null-guard fix in soldier targeting (all raiders in reach dead mid-tick —
  introduced by the spread change, caught by headless seed 42).
- Side effect to WATCH: pop booms harder (seed 42: 153→375) — ex-rot becomes
  bread becomes people; housing still gates.

---

## Session 3 — Playtest-driven build (2026-07-15)

Eleven commits on `phase1-defense-and-keep`, from `938e8cd` (prior session tip).
A design→playtest→build loop: defense/keep mechanics, then a full combat rework
driven by `kingdom.summary()` telemetry, then the population-growth fix Chandra
diagnosed. All changes verified headless + browser; production build clean.

### Defense & the Keep (Phase 1)

**`82916ae` — Phase 1: wall breaches, unit inspector, keep-as-heart**
- **Walls breach, don't shatter.** A wall battered to 0 HP becomes passable
  rubble at 1 HP (`breached=true`), repairable in place, never removed.
  `raids.js` `wallSet()`/batter branch; `economy.js` clears `breached` past 50%
  HP; `scene.js` dark-tints a breach.
- **Click-to-inspect units.** Hit-test soldiers/raiders (0.7-tile radius) before
  buildings in `scene.js` pointerup → `select-unit` event; `ui.js` inspector
  shows soldier's villager name/HP/skills or raider hp/loot/mode. Added
  soldier/raider DOM icons. `main.js` exposes `window.kingdom.game`/`.emit` as a
  debug/test handle.
- **The Keep as the kingdom's heart.** Auto-defends (config `range:8, arrowDmg:5`;
  `updateTowers` fires for any building with range+arrowDmg — no garrison).
  Besieged alarm + auto-rally soldiers when stormed. On sacking: a one-time
  **dark-age** payload (`KEEP.darkAge`: loot 60% of stockpiles, gut morale to
  floor, knock 5 buildings to their sack floor, up to 3 deaths) — but the keep
  survives at its floor and the **run continues** (extends A2, NOT a game-over).

**`316b4a7` — Phase 2a: sim2 spatial-combat proxy (raiders hunt villagers)**
- Sim-only (model-before-building). `resolveHunt()` in `world.mjs` runs LAST in
  the raid tick; sacked/destroyed buildings EJECT workers (flee→idle) into an
  exposed pool raiders run down; villagers fight back weakly. Unified death rule:
  caught in the open, replacing the 0.12 sack-death roll. `raidCivDeathModel:
  sack|hunt` switch kept as the A/B control. Villager-staffed watchtowers.
- **`huntCadenceTicks=20`** — the load-bearing knob (Finding 10: per-tick hunting
  scaled the toll with raid *duration* and cratered pop; a chase is occasional).
- Validated equivalent to the old sack model across baseline+gauntlet+specialists,
  iq0-2, ~100 seeds, 0% collapse (Campaign 6). **Not yet ported to the game.**

**`93f5501` — Fix New Kingdom (reset in place)**
- The button relied on `location.reload()`, a no-op in the preview environment.
  Now overwrites the current state object with a fresh `createState()` + emits a
  `new-game` scene event (repaint terrain, drop stale sprites, recenter).
  Robust regardless of reload.

### The combat rework (playtest-driven)

**`fddbb5c` — Run-summary telemetry (`kingdom.summary()`)**
- Lifetime stats on `state.stats` (pop peaks, raids + avg/biggest size, raiders
  killed, buildings sacked, walls breached, keep falls, born/starved, soldiers
  recruited/fallen, veterans fallen, kill/death ratio, masters). `dumpStats()`
  prints a console summary; call `kingdom.summary()` anytime, auto-fires on
  collapse. Old saves migrate. Became the feedback loop for the rest.

**`b87f2e2` — Army rework: probabilistic combat (sim2-validated + ported)**
- Replaces flat `s.hp -= 4`/tick with per-exchange **rolls**: skill-scaled CRIT
  (veterans burst), WOUND, and KILL-only-when-badly-wounded with severity that
  scales with conditions. `COMBAT` config block (both `src/config.js` and sim2
  `combat`). `combat.model='flat'` is the A/B control.
- **Game gets real spatial checks** the sim couldn't: home-ground = claimed-tile
  check, tower-cover = within tower/keep arrow range, and a **local-gang** wound
  scale (raiders within 1.6 tiles of THIS soldier, capped 3×) — being swarmed is
  deadly, holding a line is safe. Ports the missing force-ratio fix.
- Rookies beside a veteran season faster. Wounded mend 0.2→0.4/tick between raids.
- Verified: 6 vets+tower vs 14 on home ground = 100% win, survivors 1-6 (real
  variance); open = 41%; green swarmed = 1%.

**`d6eb6a3` — Soldiers hold territory (don't chase into the wilds)**
- `updateSoldiers` only engages raiders on/within ~2 tiles of claimed land;
  ignores wilds raiders; holds/mends at the keep when the border's clear.
  Keep-besieged overrides. Makes the home-ground bonus usable (fight where ~98%,
  not ~41%).

**`fdd2ae7` — Veterans survive attrition (kill-resist + wounded-retreat)**
- `veteranKillResist × skill` lowers the kill-roll on a wounded soldier; a
  badly-wounded skilled soldier RETREATS toward the keep to mend rather than
  dying in the line (green soldiers / keep-besieged excepted). `COMBAT` knobs.

**`74f2531` — Mercenaries: hire with gold, steep upkeep, desert if unpaid**
- `MERCENARY` config; `hireMercenaries`/`dismissMercenaries`/`mercenaryUpkeepTick`/
  `mercCount` + `soldierSkill()` helper (mercs carry `merc:true` + own skill).
  Hire a company for gold; steep per-tick gold upkeep (the **gold sink**); DESERT
  if unpaid. Fight via the same combat but aren't your people — no seasoning, no
  villager dies. `sim.js` runs upkeep; `ui.js` Hire/Release buttons.

**`919e068` — Fix mercenary hire cap**
- Old cap was `ceil(mercCount/size) >= maxCompanies` — over-counted once any merc
  died and wrongly refused hires. Now a total-headcount cap that lets you top up
  after losses; raised `maxCompanies` 4→8 (up to 24 mercs).

**`71ae221` — Mercenary visuals**
- Purple `u-merc` map sprite (+ palette `p`/`P`), purple DOM icon, own inspector
  card ("Mercenary — HP · skill · deserts if coffers run dry"), and
  "N mercenaries under contract · X gold/tick upkeep" in the Kingdom menu.
  Hit-test emits `kind:'merc'`.

### Population

**`8099e8a` — Population booms on surplus food**
- Fixes the stall Chandra diagnosed (12k food + empty housing but pop frozen at
  65; births ~13/yr ≈ war deaths ~10/yr). Growth now SCALES WITH
  food-surplus-per-capita (`GROWTH` config: abundant → boom capped at
  `surplusCap`, faster baseline). `population.js` growth branch. Surplus food
  finally builds a population; pop tracks the housing cap and eats the surplus
  (seed 42 pop 47→132, food stops hoarding). Pop is housing-gated + food-fuelled.

---

## Prior sessions

See `CHATLOG.md` Turns 1–11 and the initial `git log` from `d0d947b`:
- **Sessions 1–2** (2026-07-08 → 14): built the game; diagnosed the economy
  snowball (`model/`); designed + Monte-Carlo-validated the HP-as-output redesign
  (`sim2/`, ~4,900 runs); implemented the foundation in `src/` (villager agents,
  HP-as-output, sack-not-raze raids, soldiers-as-villagers, save migration);
  Fable review ratified A1-A6.
