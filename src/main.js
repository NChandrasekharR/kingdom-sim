import { createState, loadGame } from './core/state.js';
import { makeSim, dumpStats } from './core/sim.js';
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
