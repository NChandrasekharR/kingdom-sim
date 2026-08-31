// Synthesizes the 44-second medieval chiptune soundtrack for the teaser —
// in code, like everything else in this project (the game's raid horn is two
// sawtooth oscillators; every sprite is a pixel matrix). Pure Node, no deps:
// three chip voices (square, triangle, noise) + saw for the horn quote,
// scored to the teaser's scene boundaries, written as a 16-bit stereo WAV.
//
//   node make-soundtrack.mjs          → out/kingdom-soundtrack.wav
//
// Scene map (frames @30fps → seconds):
//   I   Title       0.00– 3.67   drone fades in, a lone fanfare
//   II  Souls       3.67– 9.67   the theme, gently (A dorian over a fifth-drone)
//   III Build       9.67–15.67   drums + walking bass, theme brightens
//   IV  Tradeoffs  15.67–22.67   drums drop, the theme turns minor
//   V   Raid       22.67–28.67   THE GAME'S OWN HORN (saw 196→147 Hz), war drums
//   VI  Enemy      28.67–34.67   the drone slides to E, far war-drums
//   VII Choice     34.67–40.00   near-silence: a held high note and a heartbeat
//   VIII Outro     40.00–44.00   the theme resolves to an open fifth, fade
import { writeFileSync, mkdirSync } from 'fs';

const SR = 44100;
const DUR = 44.0;                        // 1320 frames / 30 fps, exactly
const N = Math.round(SR * DUR);
const L = new Float64Array(N), R = new Float64Array(N);

// ── pitch ──────────────────────────────────────────────────────────
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freqOf = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const semis = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((semis - 69) / 12);
};

// ── voices ─────────────────────────────────────────────────────────
let seed = 0x9e3779b9;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const wave = {
  sq:  (ph, duty) => ((ph % 1) < duty ? 1 : -1),
  tri: (ph) => 4 * Math.abs(((ph % 1) + 0.75) % 1 - 0.5) - 1,
  saw: (ph) => 2 * (ph % 1) - 1,
  noise: () => rnd() * 2 - 1,
};

// one note into the mix. freqTo makes it a slide (the horn); vib is gentle.
function tone({ t, dur, freq, freqTo, w = 'sq', duty = 0.5, vol = 0.2, pan = 0,
                vib = 0, attack = 0.008, release = 0.05 }) {
  const s0 = Math.round(t * SR), n = Math.round(dur * SR);
  const gL = pan <= 0 ? 1 : 1 - pan, gR = pan >= 0 ? 1 : 1 + pan;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const s = s0 + i;
    if (s < 0 || s >= N) continue;
    const tt = i / SR;
    const f = (freqTo ? freq + (freqTo - freq) * (tt / dur) : freq)
      * (1 + vib * Math.sin(2 * Math.PI * 5.2 * tt));
    ph += f / SR;
    const env = Math.min(1, tt / attack) * Math.min(1, Math.max(0, (dur - tt) / release));
    const v = (w === 'noise' ? wave.noise() : wave[w](ph, duty)) * vol * env;
    L[s] += v * gL; R[s] += v * gR;
  }
}

// a melody: [name|null, beats][] on a square voice; returns the end time
function melody(t0, spb, notes, opts = {}) {
  let t = t0;
  for (const [name, beats] of notes) {
    if (name) tone({ t, dur: beats * spb * 0.92, freq: freqOf(name),
      w: 'sq', duty: 0.25, vol: 0.15, pan: 0.12, vib: 0.004, ...opts });
    t += beats * spb;
  }
  return t;
}

// ── the drum kit (a tabor and a stick) ─────────────────────────────
const kick = (t, vol = 0.5) => tone({ t, dur: 0.10, freq: 110, freqTo: 42, w: 'tri', vol, attack: 0.002, release: 0.06 });
const tap  = (t, vol = 0.14) => tone({ t, dur: 0.03, freq: 1, w: 'noise', vol, pan: -0.12, attack: 0.001, release: 0.02 });
const snare = (t, vol = 0.22) => tone({ t, dur: 0.08, freq: 1, w: 'noise', vol, pan: -0.08, attack: 0.001, release: 0.05 });

// drone: a bare fifth — the fastest way to sound six centuries old
function drone(t, dur, root, vol = 0.11) {
  tone({ t, dur, freq: freqOf(root), w: 'tri', vol, attack: 0.4, release: 0.8 });
  const fifth = freqOf(root) * 1.5;
  tone({ t, dur, freq: fifth, w: 'tri', vol: vol * 0.7, attack: 0.6, release: 0.8 });
}

// ══ the score ══════════════════════════════════════════════════════
const S = [0, 3.667, 9.667, 15.667, 22.667, 28.667, 34.667, 40.0, 44.0];

// I. Title — the realm wakes
drone(0, S[2] - 0, 'A2', 0.10);
melody(0.9, 0.42, [['A3', 1], ['D4', 1], ['E4', 1.2], ['A4', 3]], { vol: 0.13, duty: 0.5, vib: 0.003 });

// II. Souls — the theme, gently (A dorian)
{
  const spb = 0.5; // 120 bpm
  melody(S[1] + 0.5, spb, [
    ['A4', 1], ['C5', 1], ['D5', 1], ['E5', 2],
    ['D5', 1], ['C5', 1], ['A4', 1.5], ['G4', 0.5],
    ['A4', 2],
  ]);
  for (let b = 0; b < 11; b++) {  // soft alternating bass
    tone({ t: S[1] + 0.5 + b * spb, dur: spb * 0.9, freq: freqOf(b % 2 ? 'E3' : 'A2'), w: 'tri', vol: 0.12 });
  }
}

// III. Build — hands at work
{
  const spb = 0.5, t0 = S[2];
  drone(t0, S[4] - t0, 'A2', 0.07);
  melody(t0, spb, [
    ['A4', 0.5], ['B4', 0.5], ['C5', 0.5], ['D5', 0.5], ['E5', 1], ['F#5', 0.5], ['E5', 0.5],
    ['D5', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
    ['C5', 0.5], ['A4', 0.5], ['B4', 0.5], ['C5', 0.5], ['A4', 2],
  ], { vol: 0.16 });
  for (let b = 0; b < 12; b++) {
    const t = t0 + b * spb;
    kick(t, 0.4);
    tap(t + spb / 2);
    const bassNote = ['A2', 'A3', 'E3', 'A3'][b % 4];
    tone({ t, dur: spb * 0.85, freq: freqOf(bassNote), w: 'tri', vol: 0.13 });
  }
}

// IV. Tradeoffs — the ledger never balances (F natural: aeolian shadow)
{
  const spb = 0.55, t0 = S[3] + 0.3;
  melody(t0, spb, [
    ['E5', 1], ['D5', 1], ['C5', 1], ['B4', 1.5], ['C5', 0.5],
    ['A4', 2], ['G4', 1], ['F4', 1.5], ['E4', 3],
  ], { vol: 0.14, vib: 0.006 });
  for (let b = 0; b < 6; b++) {
    tone({ t: t0 + b * 2 * spb, dur: spb * 1.8, freq: freqOf(b < 3 ? 'A2' : 'D3'), w: 'tri', vol: 0.11 });
  }
}

// V. Raid — the game's own horn, then war drums
{
  const t0 = S[4];
  // the horn from ui.js, verbatim: saw 196 Hz then a falling 147 Hz
  tone({ t: t0, dur: 0.5, freq: 196, w: 'saw', vol: 0.28, attack: 0.08, release: 0.2 });
  tone({ t: t0 + 0.45, dur: 0.9, freq: 147, freqTo: 138, w: 'saw', vol: 0.28, attack: 0.08, release: 0.4 });
  const spb = 0.4, m0 = t0 + 1.4; // 150 bpm, after the horn
  for (let b = 0; b < 11; b++) {
    const t = m0 + b * spb;
    if (b % 2 === 0) kick(t, 0.55); else snare(t);
    tap(t + spb / 2, 0.1);
    tone({ t, dur: spb * 0.8, freq: freqOf('A2'), w: 'tri', vol: 0.15 });
  }
  melody(m0, spb, [
    ['E5', 0.5], ['E5', 0.5], ['D5', 0.5], ['C5', 0.5], ['B4', 0.5], ['C5', 0.5], ['A4', 1],
    ['E5', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['C5', 1], ['B4', 1],
  ], { vol: 0.17, vib: 0.007 });
}

// VI. Enemy — his camp, far off (the drone slides to E)
{
  const t0 = S[5];
  drone(t0, S[6] - t0 + 0.5, 'E2', 0.11);
  melody(t0 + 0.6, 0.7, [
    ['E4', 1.5], ['G4', 1], ['F#4', 1.5], ['E4', 2], ['B3', 2],
  ], { w: 'tri', vol: 0.15, duty: 0.5, vib: 0.005, pan: -0.1 });
  for (let i = 0; i < 6; i++) kick(t0 + 0.4 + i * 1.0, 0.3);  // war drums beyond the treeline
}

// VII. Choice — what is your word, sovereign?
{
  const t0 = S[6];
  tone({ t: t0 + 0.3, dur: S[7] - t0 - 0.6, freq: freqOf('E5'), w: 'tri', vol: 0.055, attack: 1.2, release: 1.2 });
  tone({ t: t0 + 0.3, dur: S[7] - t0 - 0.6, freq: freqOf('A2'), w: 'tri', vol: 0.07, attack: 1.0, release: 1.0 });
  for (let i = 0; i < 4; i++) {          // a heartbeat while the card waits
    const t = t0 + 0.8 + i * 1.3;
    kick(t, 0.22); kick(t + 0.28, 0.15);
  }
  tap(t0 + 4.9, 0.1);
}

// VIII. Outro — the crowns
{
  const t0 = S[7], spb = 0.5;
  drone(t0, DUR - t0, 'A2', 0.1);
  melody(t0 + 0.2, spb, [
    ['A4', 0.5], ['C5', 0.5], ['E5', 1], ['A5', 2],
  ], { vol: 0.16 });
  // the last chord: a bare fifth with the octave — stone and gold
  const tEnd = t0 + 2.3;
  for (const [n, v] of [['A3', 0.12], ['E4', 0.1], ['A4', 0.09]]) {
    tone({ t: tEnd, dur: DUR - tEnd - 0.1, freq: freqOf(n), w: 'tri', vol: v, attack: 0.3, release: 1.0 });
  }
  kick(tEnd, 0.35);
}

// ══ master: fades, 8-bit quantize, normalize, write ════════════════
const fadeIn = 0.25 * SR, fadeOut = 1.2 * SR;
for (let i = 0; i < N; i++) {
  const g = Math.min(1, i / fadeIn) * Math.min(1, (N - i) / fadeOut);
  L[i] *= g; R[i] *= g;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = 0.85 / peak;
const Q = 64;                                  // 7-bit-ish steps: the chip crunch
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const l = Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * Q) / Q;
  const r = Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * Q) / Q;
  buf.writeInt16LE((l * 32767) | 0, 44 + i * 4);
  buf.writeInt16LE((r * 32767) | 0, 44 + i * 4 + 2);
}
mkdirSync('out', { recursive: true });
writeFileSync('out/kingdom-soundtrack.wav', buf);

// sanity: per-scene RMS so silence/clipping shows up without ears
const names = ['title', 'souls', 'build', 'tradeoffs', 'raid', 'enemy', 'choice', 'outro'];
for (let s = 0; s < 8; s++) {
  const a = Math.round(S[s] * SR), b = Math.round(S[s + 1] * SR);
  let sum = 0;
  for (let i = a; i < b; i++) sum += (L[i] * norm) ** 2 + (R[i] * norm) ** 2;
  const rms = Math.sqrt(sum / ((b - a) * 2));
  console.log(`${names[s].padEnd(10)} ${S[s].toFixed(2).padStart(5)}–${S[s + 1].toFixed(2).padEnd(5)} rms ${rms.toFixed(3)}`);
}
console.log(`wrote out/kingdom-soundtrack.wav — ${DUR}s, peak ${(peak * norm).toFixed(2)} after normalize`);
