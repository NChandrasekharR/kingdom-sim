// Print the Potosí lottery for a set of map seeds: per-vein multipliers, the
// deep veins, and how much of the map's ore the deep vein holds.
// Usage: node model/vein-probe.mjs [seeds...]
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { generateMap } = await import('../src/core/mapgen.js');
const { seedStoneOre } = await import('../src/core/state.js');
const { MAP, T } = await import('../src/config.js');

const seeds = process.argv.slice(2).map(Number);
if (!seeds.length) seeds.push(42, 7, 99, 123);

for (const seed of seeds) {
  const { terrain, veinRichness, deepVeins } = generateMap(seed);
  const { ore } = seedStoneOre(terrain, veinRichness);
  // distinct multipliers = distinct veins (blob overlap merges a few)
  const mults = [...new Set([...veinRichness.values()].map((v) => +v.toFixed(2)))].sort((a, b) => a - b);
  let total = 0, deepOre = 0;
  const deepSet = new Set();
  for (const v of deepVeins) for (const i of v.tiles) deepSet.add(i);
  for (let i = 0; i < MAP.size * MAP.size; i++) {
    if (terrain[i] !== T.ORE) continue;
    total += ore[i];
    if (deepSet.has(i)) deepOre += ore[i];
  }
  console.log(JSON.stringify({
    seed,
    oreTiles: [...veinRichness.keys()].filter((i) => terrain[i] === T.ORE).length,
    mults,
    deepVeins: deepVeins.map((v) => ({ mult: +v.mult.toFixed(2), tiles: v.tiles.length })),
    mapOre: Math.round(total),
    deepOre: Math.round(deepOre),
    deepShare: total > 0 ? +(deepOre / total).toFixed(3) : 0,
  }));
}
