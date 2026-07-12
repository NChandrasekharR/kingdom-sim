// Seeded PRNG + value noise, so worlds are reproducible from a seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise2D(rand) {
  const G = 256;
  const vals = new Float32Array(G * G);
  for (let i = 0; i < vals.length; i++) vals[i] = rand();
  const v = (x, y) => vals[(y & 255) * G + (x & 255)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
    const u = sm(fx), w = sm(fy);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}

export function fbm(noise, x, y, oct = 4) {
  let amp = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise(x * f, y * f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}
