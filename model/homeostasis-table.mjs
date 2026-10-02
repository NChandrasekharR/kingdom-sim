// Summarise model/out/homeostasis/*.json into the HOMEOSTASIS.md §8 tables.
// Usage: node model/homeostasis-table.mjs
import { readdirSync, readFileSync } from 'node:fs';
const DIR = new URL('./out/homeostasis/', import.meta.url);
const runs = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, DIR))));
const ORDER = ['baseline', 'sqrt', 'sqrtsoft', 'leanfood', 'taperfood', 'charcoal', 'combined', 'combined2'];
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const r0 = (x) => (Number.isFinite(x) ? Math.round(x) : '—');
const r1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—');
// first year the realm sits at its housing ceiling for good
const capYear = (r) => {
  const y = r.yearly; let at = null;
  for (let i = y.length - 1; i >= 0; i--) { if (y[i].pop >= 295) at = y[i].year; else break; }
  return at ?? NaN;
};
const at = (r, yr, k) => (r.yearly.find((y) => y.year === yr) || {})[k];
const late = (r, k) => r.raids.filter((x) => x.year >= 20).map((x) => x[k]);

console.log('| variant | seeds | at 300 souls (n, median year) | farm+dock share Y25 | years of food Y25 | spoiled total | gold Y30 | army Y30 | starved | soldiers fallen | masters lost |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const v of ORDER) {
  const rs = runs.filter((r) => r.variant === v); if (!rs.length) continue;
  const share = rs.map((r) => (at(r, 25, 'foodWorkers') || 0) / Math.max(1, at(r, 25, 'pop') || 1) * 100);
  const caps = rs.map(capYear).filter(Number.isFinite);
  console.log(`| ${v} | ${rs.length} | ${caps.length}/${rs.length}, Y${r0(med(caps))} | ${r0(med(share))}% | ${r1(med(rs.map((r) => at(r, 25, 'yearsOfFood'))))} | ${r0(med(rs.map((r) => r.final.foodSpoiled)))} | ${r0(med(rs.map((r) => r.final.gold)))} | ${r0(med(rs.map((r) => r.final.soldiers)))} | ${r0(med(rs.map((r) => r.final.starved)))} | ${r0(med(rs.map((r) => r.final.soldiersFallen)))} | ${r0(med(rs.map((r) => r.final.mastersLost)))} |`);
}
console.log('\n| variant | raid size Y10–19 | raid size Y20+ | uncapped wish Y20+ | soldiers lost / raid Y20+ | civilians lost / raid Y20+ | keep falls |');
console.log('|---|---|---|---|---|---|---|');
for (const v of ORDER) {
  const rs = runs.filter((r) => r.variant === v); if (!rs.length) continue;
  const mid = rs.flatMap((r) => r.raids.filter((x) => x.year >= 10 && x.year < 20).map((x) => x.size));
  console.log(`| ${v} | ${r0(med(mid))} | ${r0(med(rs.flatMap((r) => late(r, 'size'))))} | ${r0(med(rs.flatMap((r) => late(r, 'uncapped'))))} | ${r1(med(rs.flatMap((r) => late(r, 'soldiersLost'))))} | ${r1(med(rs.flatMap((r) => late(r, 'civiliansLost'))))} | ${rs.reduce((s, r) => s + r.final.keepFalls, 0)} |`);
}
console.log('\n| variant | stone sold | stone gold | wood sold | iron bought | iron gold | wood Y30 |');
console.log('|---|---|---|---|---|---|---|');
for (const v of ORDER) {
  const rs = runs.filter((r) => r.variant === v); if (!rs.length) continue;
  console.log(`| ${v} | ${r0(med(rs.map((r) => r.traded.sold.stone || 0)))} | ${r0(med(rs.map((r) => r.traded.soldGold.stone || 0)))} | ${r0(med(rs.map((r) => r.traded.sold.wood || 0)))} | ${r0(med(rs.map((r) => r.traded.ironBought || 0)))} | ${r0(med(rs.map((r) => r.traded.ironGold || 0)))} | ${r0(med(rs.map((r) => r.final.wood)))} |`);
}
