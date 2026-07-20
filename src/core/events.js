// Tiny pub/sub + the kingdom chronicle (event log).

const listeners = {};

export function on(evt, fn) {
  (listeners[evt] ||= []).push(fn);
}

export function emit(evt, ...args) {
  for (const fn of listeners[evt] || []) fn(...args);
}

// kind: 'info' | 'good' | 'bad' | 'raid' | 'trade' | 'counsel'
export function logEvent(state, text, kind = 'info') {
  state.log.push({ tick: state.tick, text, kind });
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
  emit('log', state.log[state.log.length - 1]);
}
