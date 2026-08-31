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
// as a text file grouped by year and season. Generously capped; the earliest
// pages fall away first and the export says so.
export const JOURNAL_MAX = 4000;
export function journal(state, text, kind = 'detail') {
  (state.journal ||= []).push({ tick: state.tick, text, kind });
  if (state.journal.length > JOURNAL_MAX) {
    state.journal.splice(0, state.journal.length - JOURNAL_MAX);
    state._journalLost = true;
  }
}

// kind: 'info' | 'good' | 'bad' | 'raid' | 'trade' | 'counsel'
// `detail` goes to the JOURNAL only — extra precision (a death's coordinates)
// the sidebar chronicle doesn't need.
export function logEvent(state, text, kind = 'info', detail = null) {
  state.log.push({ tick: state.tick, text, kind });
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
  journal(state, detail ? `${text} ${detail}` : text, kind);
  emit('log', state.log[state.log.length - 1]);
}
