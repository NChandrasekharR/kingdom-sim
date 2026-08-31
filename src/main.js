import { createState, loadGame } from './core/state.js';
import { makeSim, dumpStats, exportChronicle } from './core/sim.js';
import { buildUI } from './ui/ui.js';
import { createGame } from './game/scene.js';
import { emit } from './core/events.js';

const state = loadGame() || createState();
const ctx = {
  state,
  sim: null,
  placement: null,
  selected: null,
};
ctx.sim = makeSim(state);

const root = document.getElementById('app');
const { mapDiv } = buildUI(root, ctx);
const game = createGame(mapDiv, ctx);

// debug/console handle
window.kingdom = ctx;
ctx.game = game;
ctx.emit = emit;
// run telemetry: call kingdom.summary() in the console for the run-so-far stats
ctx.summary = () => dumpStats(ctx.state);
// the full reign as a text file: kingdom.export() downloads the chronicle —
// every event with its tick, grouped by year and season, summary appended
ctx.export = () => {
  const text = exportChronicle(ctx.state);
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ctx.state.name.toLowerCase().replace(/\s+/g, '-')}-chronicle.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  return `${ctx.state.journal?.length || 0} entries — the chronicle of ${ctx.state.name} is downloading`;
};
