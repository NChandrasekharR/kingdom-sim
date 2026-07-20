# Kingdom — launch thread

Post 1 carries the video (`out/kingdom-teaser.mp4`). Everything in here is true
to the docs: the sim numbers are from `docs/SIMULATIONS.md` / `DECISIONS.md`,
the playtest stories from the Duncastle log.

---

**1/**
I've been building KINGDOM — a tiny medieval realm sim where every subject has
a name, the map keeps score, and your enemy remembers what you did.

Free, in the browser, no install.

A thread on the game — and the ~4,900 simulated reigns behind it 🧵

*(attach: kingdom-teaser.mp4)*

**2/**
It's an ant farm you tend, not an army you drive.

You never order anyone around. You raise buildings, set a few policies, and
named people live their lives — walk to work, learn crafts over years, panic
when the raid horn sounds.

When Berta Stoutheart dies, the chronicle says so. By name.

**3/**
The core mechanic: a building's output IS its hit points.

Raiders grind buildings down. Decay nibbles. Repair burns wood, stone, and —
crucially — the same scarce hands that could be harvesting.

And raids sack, they never raze. A raid is a wound measured in lost
output-days, not a game over.

**4/**
Your enemy has an address.

The warlord's camp is on the map: tents, a garrison, shepherds and weavers who
aren't fighters — and a hoard that is a *ledger of what he took from you*.
Raids visibly mass at his tents before they march.

March on him, win, and the game pauses to ask what kind of sovereign you are.

**5/**
Spare his people, and they remember — some drift to your gates as settlers.

Or leave nothing standing. The camp is ashes forever. But one survivor ALWAYS
slips through the reeds, and returns years later as an avenger who sends no
rider and takes no gold. The soldiers who did it come home changed — they will
never lay down the sword.

**6/**
Behind the scenes: before writing game code, we built a headless simulator and
ran ~4,900 Monte Carlo reigns to find the "interesting" band — most runs
tense-but-fair, few collapses, few snoozes.

One number (raider damage per tick) turned out to be the master difficulty
dial. At 2.5, every single run collapsed. The redesign that made 4.5 safe is
basically the whole game.

**7/**
Best bug: warlords never spawned in ANY simulation for weeks — a NaN in the
cadence math silently disabled them.

Fixing one line moved a scenario from 98% "too easy" to 50% "interesting."
The difficulty design was being carried by an enemy who didn't exist.

**8/**
Favourite playtest lesson: one 19-year reign rotted 47,690 food while bread
sat at zero. Why? People ate bread FIRST, so it could never stockpile.

We flipped the eat order — raw food first, bread only in shortfall — and bread
became what it always should have been: the winter reserve.

**9/**
Same playtest: 201 of 245 subjects were "masters" of their craft. Mastery was
the default human condition, so losing a master meant nothing.

Now a master is ~4 years of devoted work — rare enough that when one is run
down in a raid, the chronicle line stings: "The knowledge dies too."

**10/**
The design decision I'm most attached to: NO rival kingdom on the map.

An AI kingdom building counter-walls is a worse Age of Empires. Instead the
warlord is asymmetric — no economy, no tech, just an address, a shadow you
can't claim land near, and a grudge. Builder-first, with an aggression valve.

**11/**
Built with Claude Code — I playtested live in one window while the game was
rebuilt around me in the other, and every sprite is drawn in code (pixel
matrices, no asset packs).

Play it here: https://kingdom-sim-fawn.vercel.app
Reigns autosave. The warlord is patient.

---

## Notes before posting

- **Deploy: DONE (2026-07-20).** The live site now runs current main —
  everything in this thread exists at the URL. The landing page (with the
  teaser embedded) is at https://kingdom-sim-fawn.vercel.app/landing.html —
  consider linking THAT in the final post instead of the game root: it sells
  the game before dropping a visitor into the sandbox.
- Numbers check out against the docs: ~4,900 sim runs (sim2 campaign total),
  raiderDmg 2.5→100% collapse / 4.5 tuned (FINDINGS/DECISIONS), warlord NaN
  → 98% too-easy → 50% interesting (SIMULATIONS caveat), Duncastle 47,690
  food rotted / bread 0 / 201 masters of 245 (Playtest log).
- Post 5 and 7 are the strongest hooks if you want a shorter thread: keep
  1, 4, 5, 7, 11 and drop the rest.
