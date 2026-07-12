import { MAP, T, TERRAIN_INFO } from '../config.js';
import { idx, inBounds } from './state.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Border creep: each territory tick, spend an expansion budget claiming
// frontier tiles, weighted by influence and how easily the terrain absorbs.
export function claimTick(state, rand) {
  const N = MAP.size;
  const budget = (0.8 + state.pop * 0.06) * (state.morale / 60);
  state.expandAcc += budget;
  let toClaim = Math.floor(state.expandAcc);
  if (toClaim <= 0) return;
  state.expandAcc -= toClaim;

  // gather frontier: unclaimed land adjacent to claimed, with influence
  const frontier = [];
  const weights = [];
  let totalW = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (state.claimed[i]) continue;
      const ease = TERRAIN_INFO[state.terrain[i]].claim;
      if (ease <= 0) continue;
      const inf = state.influence[i];
      if (inf <= 0.02) continue;
      let adj = false;
      for (const [dx, dy] of DIRS) {
        const px = x + dx, py = y + dy;
        if (inBounds(px, py) && state.claimed[py * N + px]) { adj = true; break; }
      }
      if (!adj) continue;
      const w = inf * inf * ease;
      frontier.push(i);
      weights.push(w);
      totalW += w;
    }
  }
  if (!frontier.length) return;

  toClaim = Math.min(toClaim, frontier.length);
  for (let n = 0; n < toClaim; n++) {
    let r = rand() * totalW;
    for (let k = 0; k < frontier.length; k++) {
      if (weights[k] <= 0) continue;
      r -= weights[k];
      if (r <= 0) {
        state.claimed[frontier[k]] = 1;
        totalW -= weights[k];
        weights[k] = 0;
        state.territoryDirty = true;
        break;
      }
    }
  }
}

// Starvation makes the border recede from its weakest edges.
export function recedeTick(state) {
  const N = MAP.size;
  let toLose = 1 + Math.floor(state.pop * 0.03);
  const edge = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (!state.claimed[i]) continue;
      let exposed = false;
      for (const [dx, dy] of DIRS) {
        const px = x + dx, py = y + dy;
        if (!inBounds(px, py) || !state.claimed[py * N + px]) { exposed = true; break; }
      }
      if (exposed) edge.push({ i, inf: state.influence[i] });
    }
  }
  edge.sort((a, b) => a.inf - b.inf);
  for (const e of edge) {
    if (toLose <= 0) break;
    // never unclaim under a building — buildings anchor their tile
    if (state.buildings.some((b) => idx(b.x, b.y) === e.i)) continue;
    state.claimed[e.i] = 0;
    state.territoryDirty = true;
    toLose--;
  }
}

export function territorySize(state) {
  let n = 0;
  for (let i = 0; i < state.claimed.length; i++) n += state.claimed[i];
  return n;
}
