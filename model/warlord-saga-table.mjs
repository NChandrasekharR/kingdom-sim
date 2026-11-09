// Campaign 17 tables: ranges per doctrine, every warlord's ending, and the
// wildest reigns. Reads model/out/warlord-saga/*.json.
// Usage: node model/warlord-saga-table.mjs [dir]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), 'out/warlord-saga');
const loaded = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => { try { return JSON.parse(readFileSync(join(DIR, f), 'utf8')); } catch { return null; } })
  .filter(Boolean);
// a realm that never reaches the warlord's minimum (pop 25) never meets one:
// a wood-deadlocked map (Campaign 14's seed 8), not a war doctrine's result
const stalled = loaded.filter((r) => r.final.pop < 25);
const runs = loaded.filter((r) => r.final.pop >= 25);
if (stalled.length) {
  const seeds = [...new Set(stalled.map((r) => r.seed))].join(', ');
  console.log(`*Left out: ${stalled.length} reigns on seed ${seeds}, which never grew past ${Math.max(...stalled.map((r) => r.final.pop))} souls and so never met a warlord.*\n`);
}
const ORDER = ['butcher', 'opportunist', 'mixed', 'merciful', 'payer', 'turtle'];
const doctrines = ORDER.filter((d) => runs.some((r) => r.doctrine === d));

const has = (s, t) => s.events.some((e) => e.includes(`:${t}`));
const metrics = (r) => {
  const st = r.stories;
  return {
    warlords: st.length,
    avengers: st.filter((s) => s.origin === 'avenger-raised').length,
    feudDepth: r.maxAvengerGen,
    massacres: r.tally.massacres,
    punishes: r.tally.punishes,
    repulsed: r.tally.repulsed,
    folkSlain: r.final.folkSlain,
    marked: r.final.marked,
    burnedAway: r.burns.filter((b) => b.lordAway).length,
    ashes: st.filter((s) => has(s, 'returned-to-ashes')).length,
    crossings: r.crossings,
    grudges: r.inheritedGrudges,
    dropped: st.filter((s) => s.fate === 'dropped' || s.fate === 'broken-then-dropped').length,
    silent: st.filter((s) => s.fate === 'slain-silently').length,
    tribute: r.tally.paidGold,
    warlordWave: r.maxWarlordWave,
    fallen: r.final.soldiersFallen,
    keepFalls: r.final.keepFalls,
    pop: r.final.pop,
  };
};
const KEYS = Object.keys(metrics(runs[0]));
const LABEL = {
  warlords: 'named warlords', avengers: 'Ash-Sworn avengers', feudDepth: 'deepest feud (avenger generations)',
  massacres: 'massacres', punishes: 'punishments', repulsed: 'marches repulsed', folkSlain: 'camp folk slain',
  marked: 'marked soldiers at the end', burnedAway: 'camps burned while the lord was away',
  ashes: 'lords who came home to ashes', crossings: 'times two armies crossed', grudges: 'successors who inherited a grudge',
  dropped: 'warlords dropped with no ending', silent: 'warlords killed with no line', tribute: 'tribute paid (gold)',
  warlordWave: 'largest warlord wave', fallen: 'soldiers fallen', keepFalls: 'keep falls', pop: 'final population',
};
const q = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return `${s[0]}–${s[s.length - 1]} (${Number.isInteger(med) ? med : med.toFixed(1)})`;
};

const byD = Object.fromEntries(doctrines.map((d) => [d, runs.filter((r) => r.doctrine === d)]));
console.log(`## Ranges per doctrine — min–max (median), ${runs.length} reigns, ${runs[0].years} years each\n`);
console.log(`| | ${doctrines.map((d) => `${d} (${byD[d].length})`).join(' | ')} |`);
console.log(`|---|${doctrines.map(() => '---').join('|')}|`);
for (const k of KEYS) {
  console.log(`| ${LABEL[k]} | ${doctrines.map((d) => q(byD[d].map((r) => metrics(r)[k]))).join(' | ')} |`);
}

console.log('\n## How every named warlord\'s story ended\n');
const FATES = ['slain-at-hall', 'slain-at-walls', 'slain-silently', 'exile', 'reigning', 'broken-then-dropped', 'dropped'];
console.log(`| ending | ${doctrines.join(' | ')} | all |`);
console.log(`|---|${doctrines.map(() => '---').join('|')}|---|`);
const all = runs.flatMap((r) => r.stories);
for (const f of FATES) {
  const n = (rs) => rs.flatMap((r) => r.stories).filter((s) => s.fate === f).length;
  console.log(`| ${f} | ${doctrines.map((d) => n(byD[d])).join(' | ')} | ${n(runs)} |`);
}
console.log(`| **total** | ${doctrines.map((d) => byD[d].flatMap((r) => r.stories).length).join(' | ')} | ${all.length} |`);

console.log('\n## Origins\n');
const ORIG = ['founded', 'claimed-nest', 'successor', 'avenger-raised', 'unannounced'];
for (const o of ORIG) console.log(`- ${o}: ${all.filter((s) => s.origin === o).length}`);
console.log(`- successors who inherited an avenger's grudge: ${runs.reduce((a, r) => a + r.inheritedGrudges, 0)}`);

// ── the wildest reigns ─────────────────────────────────────────────
const top = (key, n = 3) => [...runs].sort((a, b) => metrics(b)[key] - metrics(a)[key]).slice(0, n)
  .filter((r) => metrics(r)[key] > 0);
console.log('\n## Leaderboard\n');
for (const k of ['feudDepth', 'folkSlain', 'ashes', 'crossings', 'grudges', 'dropped', 'silent', 'warlordWave', 'tribute', 'repulsed']) {
  const t = top(k);
  if (!t.length) { console.log(`- **${LABEL[k]}**: none in any reign`); continue; }
  console.log(`- **${LABEL[k]}**: ${t.map((r) => `${r.doctrine}/${r.seed} = ${metrics(r)[k]}`).join(', ')}`);
}

// ── the strangest single stories ───────────────────────────────────
console.log('\n## Stories that took unusual turns\n');
const odd = runs.flatMap((r) => r.stories.map((s) => ({ r, s })))
  .filter(({ s }) => s.events.some((e) => /\+grudge|burned-while-away|returned-to-ashes|slain-silently|exile/.test(e)) ||
    s.fate === 'dropped')
  .sort((a, b) => b.s.events.length - a.s.events.length);
const seen = new Set();
for (const { r, s } of odd) {
  const sig = s.events.map((e) => e.replace(/^\d+:/, '').replace(/@.*/, '')).join('>') + '|' + s.fate;
  if (seen.has(sig)) continue;
  seen.add(sig);
  console.log(`- ${r.doctrine}/${r.seed} — **${s.name}** (${s.fate}): ${s.events.join(' → ')}`);
  if (seen.size >= 14) break;
}
