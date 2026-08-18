import { mulberry32, makeNoise2D, fbm } from './rng.js';
import { MAP, T } from '../config.js';

export function generateMap(seed) {
  const N = MAP.size;
  const rand = mulberry32(seed);
  const hN = makeNoise2D(rand);
  const mN = makeNoise2D(rand);
  const terrain = new Uint8Array(N * N);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x / N) * 6, ny = (y / N) * 6;
      // gentle falloff toward edges so lakes/coast tend to ring the map
      const dx = x / N - 0.5, dy = y / N - 0.5;
      const edge = Math.sqrt(dx * dx + dy * dy) * 0.55;
      const h = fbm(hN, nx, ny, 5) - edge * edge * 2.2;
      const m = fbm(mN, nx + 13.7, ny + 7.3, 4);
      let t;
      if (h < 0.30) t = T.WATER;
      else if (h > 0.72) t = T.MOUNTAIN;
      else if (h > 0.60) t = T.HILLS;
      else t = m > 0.55 ? T.FOREST : T.PLAINS;
      terrain[y * N + x] = t;
    }
  }

  // Ore veins: small blobs seeded on hills/mountains.
  //
  // POTOSÍ (Session 8): a vein is not just ore, it is a LOTTERY. Each vein
  // draws a richness multiplier from the map seed: most run ordinary (0.8-1.3×
  // — a good seam, a thin one), but roughly one vein per map is a DEEP VEIN at
  // 3-6×, the Potosí that finances a whole reign. The multiplier is per-vein,
  // not per-tile, so the bonanza is a PLACE you can find, lose, and fight over
  // — and the run that strikes one plays differently from the run that doesn't.
  //
  // `veinRichness` maps tile index → multiplier for every ORE tile, so ore
  // seeding (state.js) can apply it without knowing how veins were painted.
  const veinRichness = new Map();
  const deepVeins = [];
  let veins = 0, guard = 0;
  while (veins < VEIN_COUNT && guard++ < 4000) {
    const x = 2 + Math.floor(rand() * (N - 4));
    const y = 2 + Math.floor(rand() * (N - 4));
    const t = terrain[y * N + x];
    if (t !== T.HILLS && t !== T.MOUNTAIN) continue;
    // draw this vein's fortune BEFORE painting it, from the same map rand —
    // deterministic in the seed, and every vein consumes exactly two draws
    // (fortune roll + richness) so adding the lottery can't desync a blob.
    const deep = rand() < DEEP_VEIN_CHANCE;
    const mult = deep
      ? DEEP_MULT_MIN + rand() * (DEEP_MULT_MAX - DEEP_MULT_MIN)
      : ORDINARY_MULT_MIN + rand() * (ORDINARY_MULT_MAX - ORDINARY_MULT_MIN);
    let cx = x, cy = y;
    const blob = 3 + Math.floor(rand() * 5);
    const tiles = [];
    for (let i = 0; i < blob; i++) {
      terrain[cy * N + cx] = T.ORE;
      tiles.push(cy * N + cx);
      cx = Math.max(1, Math.min(N - 2, cx + Math.floor(rand() * 3) - 1));
      cy = Math.max(1, Math.min(N - 2, cy + Math.floor(rand() * 3) - 1));
      const ct = terrain[cy * N + cx];
      if (ct === T.WATER || ct === T.PLAINS) break;
    }
    // blobs can overlap: the richer fortune wins the shared tile
    for (const i of tiles) {
      if (!veinRichness.has(i) || veinRichness.get(i) < mult) veinRichness.set(i, mult);
    }
    if (deep) deepVeins.push({ mult, tiles });
    veins++;
  }

  const start = findStart(terrain, N);
  return { terrain, start, veinRichness, deepVeins };
}

// Vein lottery knobs (mapgen-local: they shape the map, not the economy).
const VEIN_COUNT = 11;
const DEEP_VEIN_CHANCE = 1.5 / 11;   // ≈ 1 deep vein per map, sometimes 0, sometimes 2
const ORDINARY_MULT_MIN = 0.8, ORDINARY_MULT_MAX = 1.3;
const DEEP_MULT_MIN = 3, DEEP_MULT_MAX = 6;

// Score candidate keep locations: plains underfoot, forest & hills reachable, no water too close.
function findStart(terrain, N) {
  let best = null, bestScore = -1;
  for (let attempt = 0; attempt < 900; attempt++) {
    // spiral-ish sampling biased to the middle
    const x = Math.floor(N * (0.25 + 0.5 * ((attempt * 137) % 100) / 100));
    const y = Math.floor(N * (0.25 + 0.5 * ((attempt * 61) % 100) / 100));
    if (terrain[y * N + x] !== T.PLAINS) continue;
    let plains = 0, forest = 0, hills = 0, water = 0;
    for (let dy = -10; dy <= 10; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= N || py >= N) continue;
        const t = terrain[py * N + px];
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (t === T.PLAINS && d <= 6) plains++;
        if (t === T.FOREST && d <= 9) forest++;
        if ((t === T.HILLS || t === T.ORE) && d <= 10) hills++;
        if (t === T.WATER && d <= 3) water++;
      }
    }
    const score = Math.min(plains, 60) + Math.min(forest, 25) * 1.5 + Math.min(hills, 20) * 2 - water * 8;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best || { x: N >> 1, y: N >> 1 };
}
