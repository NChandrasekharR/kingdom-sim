// Tiny pub/sub + the kingdom chronicle (event log) + the full-run journal.

const listeners = {};

export function on(evt, fn) {
  (listeners[evt] ||= []).push(fn);
}

export function emit(evt, ...args) {
  for (const fn of listeners[evt] || []) fn(...args);
}

// ── The journal: the WHOLE reign, not the last 120 lines ──────────
// Every chronicle line lands here too, and subsystems add journal-only
// detail (each birth, each trade, death sites, Work milestones) that would
// drown the sidebar. kingdom.export() (sim.js exportChronicle) writes it out
// as a text file grouped by year and season. Generously capped — and when the
// cap bites, the MINOR lines go first (births, trades, single blows in a
// skirmish), oldest first: the founding years outlive a hundred raids' worth
// of "is cut down by". Only when nothing minor is left do major pages fall.
export const JOURNAL_MAX = 4000;
const TRIM_SLACK = 250;   // trim in batches, not one splice per line
const isMinor = (e) => e.minor || e.kind === 'people' || e.kind === 'trade';

export function journal(state, text, kind = 'detail', minor = false) {
  const e = { tick: state.tick, text, kind };
  if (minor) e.minor = true;
  (state.journal ||= []).push(e);
  if (state.journal.length > JOURNAL_MAX) trimJournal(state);
}

function trimJournal(state) {
  const j = state.journal;
  let drop = j.length - JOURNAL_MAX + TRIM_SLACK;
  const kept = [];
  for (const e of j) {
    if (drop > 0 && isMinor(e)) { drop--; continue; }
    kept.push(e);
  }
  if (drop > 0) {
    kept.splice(0, drop);   // nothing minor left: the oldest pages go
    state._journalLost = true;
  } else {
    state._journalThinned = true;
  }
  state.journal = kept;
}

// kind: 'info' | 'good' | 'bad' | 'raid' | 'trade' | 'counsel'
// `detail` goes to the JOURNAL only — extra precision (a death's coordinates)
// the sidebar chronicle doesn't need.
// `minor`: a line the journal may thin first when it runs long (a single blow
// in a skirmish) — the sidebar still shows it live.
export function logEvent(state, text, kind = 'info', detail = null, minor = false) {
  state.log.push({ tick: state.tick, text, kind });
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
  journal(state, detail ? `${text} ${detail}` : text, kind, minor);
  emit('log', state.log[state.log.length - 1]);
}
