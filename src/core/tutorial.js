import { logEvent, emit } from './events.js';

// ── The Steward's Counsel (design/ONBOARDING.md) ───────────────────
// A named advisor offers ONE suggestion at a time in the game's voice.
// The ladder (first reign) is completed by real events, read from state —
// no tutorial-only actions, no gating, dismissible forever. Independent of
// the ladder, just-in-time counsel fires ONCE per system on first contact.

const DONE_KEY = 'kingdom-sim-tutorial-done-v1';

// the cross-reign skip flag lives beside the save, not in state: a keeper who
// has ruled before is never counseled again, even in a fresh kingdom
function ladderDoneBefore() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}
function markLadderDone() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* headless — fine */ }
}

const STEWARD_FIRST = ['Osric', 'Aldous', 'Bertram', 'Edith', 'Maud', 'Wilfred', 'Hugh', 'Sibyl'];
const STEWARD_EPITHET = ['the Steady', 'the Gray', 'the Careful', 'of the Ledger', 'the Elder', 'Longmemory'];
function mintSteward(seed) {
  return `Steward ${STEWARD_FIRST[seed % STEWARD_FIRST.length]} ${STEWARD_EPITHET[(seed >> 3) % STEWARD_EPITHET.length]}`;
}

const hasType = (s, type) => s.buildings.some((b) => b.type === type && b.hp > 0);
const countType = (s, type) => s.buildings.reduce((n, b) => n + (b.type === type && b.hp > 0 ? 1 : 0), 0);

// ── The ladder: eight counsels, first ~10 minutes ──────────────────
// appear/done are pure state reads; late steps degrade gracefully if the
// player outruns the window (a missed raid warning appears afterward and
// completes at once — the two lines still read as story).
export const LADDER = [
  {
    id: 'shelter',
    appear: (s) => s.tick >= 10,
    done: (s) => hasType(s, 'house'),
    counsel: 'Six souls sleep under the keep’s stair, sire. Raise a house — the realm grows only as far as its roofs.',
    doneLog: 'The steward nods: a roof raised is a family rooted.',
  },
  {
    id: 'bread',
    appear: () => true,
    done: (s) => hasType(s, 'farm'),
    counsel: 'The granary counts 40 measures — a season, no more. Plant a farm on open plains.',
    doneLog: 'The steward nods: the granary will hold.',
  },
  {
    id: 'timber',
    appear: () => true,
    done: (s) => hasType(s, 'lumber'),
    counsel: 'Every wall and roof to come is standing in that forest. A lumber camp — near the trees, while they last.',
    doneLog: 'The steward nods: timber for the walls to come.',
  },
  {
    id: 'watch',
    // ~120 ticks before the first raid warning; if the first raid already
    // happened (the player lingered), the counsel is overdue — show it now
    appear: (s) => s.raid.wave >= 1 || s.raid.phase !== 'quiet' || s.raid.timer <= 120,
    done: (s) => s.buildings.some((b) => b.type === 'tower' && b.hp > 0 && b.assigned > 0),
    counsel: 'Riders have been seen in the wilds. A watchtower, sire — and mind it needs a watchman inside, or it is only stone.',
    doneLog: 'The steward nods: eyes on the wilds at last.',
  },
  {
    id: 'horn',
    // counsel only — completes itself when the first raid has come and gone
    appear: (s) => s.raid.wave >= 1 || s.raid.phase !== 'quiet',
    done: (s) => s.raid.wave >= 1 && s.raid.phase === 'quiet',
    counsel: 'They come. Your folk will run for the keep — what stands is what saves them. Watch, and remember what they burn.',
    doneLog: '“Count the cost in the Chronicle, sire. Every raid writes its bill.”',
  },
  {
    id: 'swords',
    appear: () => true,
    done: (s) => hasType(s, 'barracks') && s.soldiers.length > 0,
    counsel: 'Hoes are not enough forever. A barracks, and a subject under arms — he will eat three men’s share, but he holds the line.',
    doneLog: 'The steward nods: the realm has teeth now.',
  },
  {
    id: 'road',
    appear: () => true,
    done: (s) => countType(s, 'road') + countType(s, 'bridge') >= 8,
    counsel: 'Roads carry your grain, your soldiers — and the border itself follows them. Push one toward the next forest.',
    doneLog: 'The steward nods: the realm walks its roads outward.',
  },
  {
    id: 'farewell',
    appear: () => true,
    done: (s) => s.tutorial.shownTick != null && s.tick - s.tutorial.shownTick >= 50,  // ~30s at 1×
    counsel: 'The rest is yours, sire: the crowns, the warlord, the winters. I will hold my tongue — mostly.',
    doneLog: 'The steward’s counsel is ended. The realm is yours.',
  },
];

// ── Just-in-time counsel: one line, ever, per system ───────────────
// Replaces today's silent-or-cryptic first encounters. Deliberately absent:
// the victory choice at the camp — the steward is SILENT there; the moral
// choice must be the player's alone.
const JIT = [
  {
    key: 'spoilage',
    // the starting stock already sits over the spoil-free buffer, so the bare
    // flag is true at tick 1 — wait for a real loss, or the lesson is noise
    when: (s) => s.spoiling && (s.stats.foodSpoiled || 0) > 10,
    text: () => 'Grain rots past what we can eat, sire. A bakery turns the surplus into bread — and bread keeps.',
  },
  {
    key: 'tribute',
    when: (s) => !!s.raid.demand && s.raid.phase === 'warning',
    text: () => 'Danegeld. Pay, and he leaves — and returns hungrier. Refuse, and he comes now. There is no third rider.',
  },
  {
    key: 'camp',
    when: (s) => !!s.camp && !s.camp.gone,
    text: (s) => `They have made a nest at ${s.camp.name}. Break it early, or it will find itself a master.`,
  },
  {
    key: 'warlord',
    when: (s) => !!s.camp && !s.camp.gone && !s.camp.unclaimed && !s.camp.leaderless && !!s.camp.warlord,
    text: (s) => `${s.camp.warlord.name} has claimed the nest. His raids will march from there — you can watch that road now.`,
  },
  {
    key: 'massing',
    when: (s) => !!s.camp && s.raid.stage >= 1 && s.raid.nextFromCamp,
    text: () => 'When they mass at the tents, you have time yet. When the camp stirs — you do not.',
  },
  {
    key: 'depleted',
    when: (s) => s.buildings.some((b) => b.type === 'lumber' && b.depleted),
    text: () => 'The wood there is spent; the land lies open for the plough. Tear the camp down — the timbers come back — and follow the forest.',
  },
  {
    key: 'breach',
    when: (s) => s.buildings.some((b) => b.type === 'wall' && b.breached),
    text: () => 'A breached wall is rubble, not ruin. Build it back past half and it stands again.',
  },
  {
    key: 'march',
    when: (s) => !!s.camp && !s.camp.gone && !s.camp.broken &&
      s.soldiers.filter((x) => x.hp > 0 && !x.exp).length >= 3,
    text: () => 'You have swords enough to answer him at his own tents, sire — if you dare leave home thin.',
  },
];

// ── State setup ────────────────────────────────────────────────────
export function initTutorial(state) {
  const retired = ladderDoneBefore();
  state.tutorial = {
    step: retired ? LADDER.length : 0,
    shown: false, shownTick: null,
    seen: {},
    dismissed: retired,
    steward: mintSteward(state.seed),
    graceGiven: false,
  };
  if (!retired) {
    // §7b: a green keeper gets the mercy the rubber-band already grants
    // sloppy ones — the first raid waits an extra 100 ticks under counsel
    state.raid.timer += 100;
    state.tutorial.graceGiven = true;
  }
}

// A loaded save from before the tutorial existed: this keeper has ruled
// before. The ladder never shows; JIT counsel stays, but any system already
// in play is marked seen so nothing fires spuriously on load.
export function seedTutorialForLoadedSave(state) {
  if (state.tutorial) return;
  state.tutorial = {
    step: LADDER.length, shown: false, shownTick: null,
    seen: {}, dismissed: true,
    steward: mintSteward(state.seed || 0),
    graceGiven: false,
  };
  for (const j of JIT) {
    if (j.when(state)) state.tutorial.seen[j.key] = true;
  }
}

export function dismissTutorial(state, auto = false) {
  const t = state.tutorial;
  if (!t || t.dismissed) return;
  t.dismissed = true;
  t.shown = false;
  markLadderDone();
  logEvent(state, auto
    ? `${t.steward} bows. “You have ruled before, sire. I will hold my tongue.”`
    : `${t.steward} bows. “You have ruled before, sire.”`, 'counsel');
  emit('counsel-changed', state);
}

// the card's current ladder counsel, or null (UI reads this every tick)
export function activeCounsel(state) {
  const t = state.tutorial;
  if (!t || t.dismissed || t.step >= LADDER.length || !t.shown) return null;
  return {
    steward: t.steward,
    text: LADDER[t.step].counsel,
    stepNo: t.step + 1,
    total: LADDER.length,
  };
}

// ── The tick (called from sim.js after winTick) ────────────────────
export function tutorialTick(state) {
  const t = state.tutorial;
  if (!t) return;

  if (!t.dismissed && t.step < LADDER.length) {
    // auto-skip: 4 different building types before step 3 completes means
    // this keeper has played before — the steward says the line himself
    if (t.step < 3) {
      const types = new Set();
      for (const b of state.buildings) if (b.type !== 'keep') types.add(b.type);
      if (types.size >= 4) dismissTutorial(state, true);
    }
  }

  if (!t.dismissed && t.step < LADDER.length) {
    const step = LADDER[t.step];
    if (!t.shown) {
      if (step.appear(state)) {
        t.shown = true;
        t.shownTick = state.tick;
        logEvent(state, `${t.steward}: “${step.counsel}”`, 'counsel');
        emit('counsel-changed', state);
      }
    } else if (step.done(state)) {
      logEvent(state, step.doneLog, 'counsel');
      t.step++;
      t.shown = false;
      t.shownTick = null;
      if (t.step >= LADDER.length) markLadderDone();  // the ladder retires; §5 counsel remains
      emit('counsel-changed', state);
    }
  }

  // just-in-time counsel runs for everyone, ladder or no ladder
  for (const j of JIT) {
    if (t.seen[j.key]) continue;
    if (!j.when(state)) continue;
    t.seen[j.key] = true;
    const line = `${t.steward}: “${j.text(state)}”`;
    logEvent(state, line, 'counsel');
    emit('counsel-jit', line);
  }
}
