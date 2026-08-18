import { MAP, TERRAIN_INFO, ROAD_SPEED_MULT } from '../config.js';
import { idx } from './state.js';

// ── A* over the tile grid ──────────────────────────────────────────
function wallSet(state) {
  const s = new Set();
  for (const b of state.buildings) {
    // a breached wall is rubble — it no longer bars the way (raiders walk through)
    if (b.type === 'wall' && b.hp > 0 && !b.breached) s.add(idx(b.x, b.y));
  }
  return s;
}

class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

// road and bridge tiles, for road-aware pathing and marching speed
export function roadTiles(state) {
  const s = new Set();
  for (const b of state.buildings) {
    if ((b.type === 'road' || b.type === 'bridge') && b.hp > 0) s.add(idx(b.x, b.y));
  }
  return s;
}

// Scratch buffers for the search, reused across calls: at 128×128 a fresh set
// per call is ~150KB of garbage, and soldiers and villagers now path often
// enough for that to show up. findPath is synchronous and never re-entrant,
// so one set is safe to share.
let _g = null, _came = null, _closed = null;

// `roadSet` is optional: callers that already computed one (the movement ticks
// all do) pass it in rather than making findPath rebuild it per call.
export function findPath(state, fx, fy, tx, ty, roadSet = null) {
  const N = MAP.size;
  const walls = wallSet(state);
  // roads are the arteries of the map: marching a road tile is CHEAPER than
  // open ground, so the pathfinder bends every route onto the network — the
  // expedition host, stragglers walking home, and the raiders too. Armies
  // flow down roads, which makes a road both a lifeline and an approach.
  // Bridges are road over water (walkable, same marching speed).
  const roads = roadSet || roadTiles(state);
  const ROAD_COST = 1 / ROAD_SPEED_MULT;
  const moveCost = (i) => {
    if (roads.has(i)) return ROAD_COST;
    const base = TERRAIN_INFO[state.terrain[i]].move;
    if (!isFinite(base)) return Infinity;
    return walls.has(i) ? base + 30 : base; // batter through if no way around
  };
  const start = fy * N + fx, goal = ty * N + tx;
  if (!_g || _g.length !== N * N) {
    _g = new Float32Array(N * N); _came = new Int32Array(N * N); _closed = new Uint8Array(N * N);
  }
  const g = _g, came = _came, closed = _closed;
  g.fill(Infinity); came.fill(-1); closed.fill(0);
  g[start] = 0;
  // heuristic scaled by the cheapest tile cost so it stays admissible now
  // that roads undercut plains (else A* would skip the very detours we want)
  const h = (i) => (Math.abs((i % N) - tx) + Math.abs(((i / N) | 0) - ty)) * ROAD_COST;
  const heap = new MinHeap();
  heap.push({ i: start, f: h(start) });
  const DIRS = [1, -1, N, -N];
  let guard = 0;
  while (heap.size && guard++ < 60000) {
    const { i } = heap.pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === goal) break;
    const x = i % N;
    for (const d of DIRS) {
      const n = i + d;
      if (n < 0 || n >= N * N) continue;
      if ((d === 1 && x === N - 1) || (d === -1 && x === 0)) continue;
      if (closed[n]) continue;
      const c = moveCost(n);
      if (!isFinite(c)) continue;
      const ng = g[i] + c;
      if (ng < g[n]) {
        g[n] = ng;
        came[n] = i;
        heap.push({ i: n, f: ng + h(n) });
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const path = [];
  let cur = goal;
  while (cur !== -1 && cur !== start) { path.push(cur); cur = came[cur]; }
  path.reverse();
  return path;
}

// ── Road commutes: routing the LONG walk ───────────────────────────
// A man crossing the realm takes the road; a man three paces from a raider
// does not. Everything past FAR_TILES is a march and gets an A* route cached
// on the unit; anything closer is a knife-fight (or the last few steps of a
// commute) and stays a straight line, so combat maneuvering never lanes onto
// the highway and crews don't conga-line into their workplace.
export const FAR_TILES = 4;          // beyond this, route; within, beeline
const REROUTE_GOAL_DRIFT = 2;        // goal moved this far → the route is stale

// Is a tile something a body can stand on? (roads/bridges always are — a
// bridge sits on water, whose raw terrain move cost is Infinity.)
function walkableTile(state, roads, i) {
  if (roads.has(i)) return true;
  return isFinite(TERRAIN_INFO[state.terrain[i]].move);
}

export function clearRoute(u) { u.route = null; u.routeI = 0; u.routeGoal = null; }

// Walk `u` one step along a cached A* route toward (tx, ty).
// Returns true if the unit moved; false means "no route available this tick —
// beeline instead" (over budget, or A* found nothing). `budget` is a
// one-element counter so callers can cap fresh paths per tick.
function followRoute(state, u, tx, ty, baseSpeed, roads, budget) {
  const N = MAP.size;
  const gx = Math.round(tx), gy = Math.round(ty);
  const goalI = gy * N + gx;

  // is the cached route still good for this destination?
  let ok = Array.isArray(u.route) && u.routeI < u.route.length;
  if (ok && u.routeGoal != null) {
    const ogx = u.routeGoal % N, ogy = (u.routeGoal / N) | 0;
    if (Math.abs(ogx - gx) + Math.abs(ogy - gy) > REROUTE_GOAL_DRIFT) ok = false;
  }
  // a wall thrown up across the next step (or a bridge burned) invalidates it
  if (ok && !walkableTile(state, roads, u.route[u.routeI])) ok = false;

  if (!ok) {
    if (budget[0] <= 0) { clearRoute(u); return false; }   // over budget: beeline this tick
    budget[0]--;
    const sx = Math.round(u.x), sy = Math.round(u.y);
    const path = findPath(state, sx, sy, gx, gy, roads);
    if (!path || !path.length) { clearRoute(u); return false; }
    u.route = path; u.routeI = 0; u.routeGoal = goalI;
  }

  // step toward the next tile on the route, at that tile's marching speed
  const next = u.route[u.routeI];
  const nx = next % N, ny = (next / N) | 0;
  const speed = baseSpeed * (roads.has(next) ? ROAD_SPEED_MULT : 1);
  const dx = nx - u.x, dy = ny - u.y;
  const d = Math.hypot(dx, dy);
  if (d <= speed) {
    u.x = nx; u.y = ny; u.routeI++;
    if (u.routeI >= u.route.length) clearRoute(u);
  } else {
    u.x += (dx / d) * speed; u.y += (dy / d) * speed;
  }
  return true;
}

// Move a unit toward (tx, ty): routed if the walk is long, straight if it's
// short. The unit has moved (or is deliberately holding) either way.
export function marchOrStep(state, u, tx, ty, baseSpeed, roads, budget, stopAt = 0.5) {
  const dx = tx - u.x, dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopAt) { clearRoute(u); return; }
  if (d > FAR_TILES && followRoute(state, u, tx, ty, baseSpeed, roads, budget)) return;
  if (d <= FAR_TILES) clearRoute(u);
  // near, or unroutable: the straight line, at the speed of the ground underfoot
  const speed = baseSpeed * (roads.has(idx(Math.round(u.x), Math.round(u.y))) ? ROAD_SPEED_MULT : 1);
  const step = Math.min(speed, d);
  u.x += (dx / d) * step; u.y += (dy / d) * step;
}
