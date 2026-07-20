import React from 'react';
import { AbsoluteFill } from 'remotion';
import { loadFont as loadPirata } from '@remotion/google-fonts/PirataOne';
import { loadFont as loadAlegreya } from '@remotion/google-fonts/Alegreya';
import { Sprite } from './sprites.jsx';

const pirata = loadPirata().fontFamily;
const alegreya = loadAlegreya().fontFamily;

// the game's design tokens (same set as Teaser.jsx)
const C = {
  iron: '#1c1712', ink: '#2a1f12', inkSoft: '#4a3a26',
  parch: '#e9d8ac', parch2: '#dfc998', parch3: '#d2b87e',
  wood: '#3a2818', wood2: '#241809',
  crimson: '#8e2f23', crimson2: '#c8452e',
  gold: '#d9a441', gold2: '#e0b04c',
  good: '#4a7a2e', bad: '#a02818',
};
const ironBg = {
  background: `radial-gradient(ellipse 80% 55% at 50% 20%, rgba(224,176,76,0.08), transparent 60%), ${C.iron}`,
};
const parchBg = {
  background: `radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.3), transparent 55%), linear-gradient(165deg, ${C.parch} 0%, ${C.parch2} 55%, ${C.parch3} 100%)`,
};
const mono = 'ui-monospace, Menlo, Consolas, monospace';

const Panel = ({ children, style }) => (
  <div style={{
    ...parchBg, border: `3px solid ${C.wood2}`, borderRadius: 6,
    boxShadow: '0 16px 50px rgba(0,0,0,0.6)', padding: '36px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
    textAlign: 'center', ...style,
  }}>{children}</div>
);
const Title = ({ children, size = 72, color = C.gold2 }) => (
  <div style={{
    fontFamily: pirata, fontSize: size, color, letterSpacing: 2,
    textShadow: '0 4px 0 rgba(0,0,0,0.7)', textAlign: 'center', lineHeight: 1.1,
  }}>{children}</div>
);
const Sub = ({ children, size = 34, color = C.parch2, style }) => (
  <div style={{
    fontFamily: alegreya, fontStyle: 'italic', fontSize: size, color,
    textAlign: 'center', lineHeight: 1.45, ...style,
  }}>{children}</div>
);
const Chip = ({ children, size = 30 }) => (
  <div style={{
    fontFamily: mono, fontSize: size, color: C.parch,
    background: 'rgba(58,40,24,0.8)', border: `2px solid ${C.wood2}`,
    borderRadius: 5, padding: '8px 26px',
  }}>{children}</div>
);
const LogLine = ({ children, kind = 'bad', size = 27, width }) => (
  <div style={{
    fontFamily: alegreya, fontSize: size, color: kind === 'good' ? '#2c4d17' : kind === 'counsel' ? '#5c4310' : '#6e1a0e',
    fontStyle: kind === 'counsel' ? 'italic' : 'normal',
    background: kind === 'counsel' ? 'rgba(233,216,172,0.97)' : 'rgba(233,216,172,0.92)',
    borderLeft: `9px solid ${kind === 'good' ? C.good : kind === 'counsel' ? C.gold : C.bad}`,
    padding: '12px 24px', width, textAlign: 'left',
  }}>{children}</div>
);

// ── OG / social card (1200×630) ────────────────────────────────────
export const OgCard = () => (
  <AbsoluteFill style={{ ...ironBg, flexDirection: 'row', alignItems: 'center', padding: '0 70px' }}>
    <div style={{ filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.7))', flex: '0 0 auto' }}>
      <Sprite art="keep" scale={22} />
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{
        fontFamily: pirata, fontSize: 120, color: C.gold2, letterSpacing: 8,
        textShadow: '0 5px 0 rgba(0,0,0,0.7), 0 0 70px rgba(224,176,76,0.4)',
      }}>⚜ KINGDOM</div>
      <Sub size={33} style={{ maxWidth: 640 }}>
        Rule <b style={{ color: C.gold2, fontStyle: 'normal' }}>named souls</b> on a map that <b style={{ color: C.gold2, fontStyle: 'normal' }}>keeps score</b> —
        against an enemy who <b style={{ color: C.gold2, fontStyle: 'normal' }}>remembers</b>.
      </Sub>
      <div style={{ display: 'flex', gap: 26, alignItems: 'flex-end', marginTop: 4 }}>
        <Sprite art="villager" scale={9} />
        <Sprite art="soldier" scale={9} />
        <Sprite art="raider" scale={9} />
        <Sprite art="warlord" scale={9} />
      </div>
      <Chip size={26}>free · in the browser · no install</Chip>
    </div>
  </AbsoluteFill>
);

// ── Post 3: output IS hit points (1600×900) ────────────────────────
export const StillHp = () => {
  const hp = 0.38;
  return (
    <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
      <Title size={80}>A building’s output IS its hit points</Title>
      <div style={{ display: 'flex', gap: 60, alignItems: 'center', marginTop: 54 }}>
        <Panel style={{ width: 560 }}>
          <Sprite art="farm" scale={14} />
          <div style={{ width: 440, height: 34, background: 'rgba(0,0,0,0.2)', border: `2px solid ${C.inkSoft}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${hp * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.bad}, ${C.crimson2})` }} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 34, color: C.ink }}>
            HP 19/50 → output <b>{Math.round((0.4 + 0.6 * hp) * 100)}%</b>
          </div>
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
          {[
            ['⚔', 'Raiders grind it down'],
            ['🕯', 'Decay nibbles, every tick'],
            ['🔨', 'Repair burns wood, stone — and the same scarce hands that could be harvesting'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ fontSize: 44 }}>{icon}</div>
              <div style={{ fontFamily: alegreya, fontSize: 33, color: C.parch2, lineHeight: 1.35 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
      <Sub size={36} color={C.gold2} style={{ marginTop: 56 }}>
        Raids <b style={{ fontStyle: 'normal' }}>sack</b>, they never raze — a raid is a wound in lost output-days, not a game over.
      </Sub>
    </AbsoluteFill>
  );
};

// ── Post 6: ~4,900 simulated reigns (1600×900) ─────────────────────
const Bar = ({ label, frac, color, note }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
    <div style={{ fontFamily: mono, fontSize: 27, color: C.ink, width: 260, textAlign: 'right' }}>{label}</div>
    <div style={{ width: 560, height: 40, background: 'rgba(0,0,0,0.15)', border: `2px solid ${C.inkSoft}`, borderRadius: 5, overflow: 'hidden' }}>
      <div style={{ width: `${frac * 100}%`, height: '100%', background: color }} />
    </div>
    <div style={{ fontFamily: alegreya, fontSize: 27, color: C.inkSoft, fontStyle: 'italic', width: 300, textAlign: 'left' }}>{note}</div>
  </div>
);
export const StillSim = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={76}>~4,900 simulated reigns before launch</Title>
    <Sub size={32} style={{ marginTop: 10 }}>
      A headless Monte Carlo simulator searched for the “interesting” band — tense-but-fair, few collapses, few snoozes.
    </Sub>
    <Panel style={{ marginTop: 44, gap: 22, padding: '40px 50px' }}>
      <div style={{ fontFamily: pirata, fontSize: 38, color: C.crimson }}>
        One number is the master difficulty dial: raider damage per tick
      </div>
      <Bar label="raiderDmg 2.5" frac={1} color={`linear-gradient(90deg, ${C.bad}, ${C.crimson2})`} note="100% of runs collapsed" />
      <Bar label="raiderDmg 4.5" frac={0.62} color={`linear-gradient(90deg, ${C.good}, #6fa04a)`} note="the game you can play" />
      <div style={{ fontFamily: alegreya, fontSize: 29, color: C.inkSoft, fontStyle: 'italic', maxWidth: 1050, lineHeight: 1.4 }}>
        The redesign that made 4.5 safe — repair crews, sack-don’t-raze, rubber-band mercy — is basically the whole game.
      </div>
    </Panel>
  </AbsoluteFill>
);

// ── Post 7: the NaN warlord (1600×900) ─────────────────────────────
export const StillNan = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={78}>Best bug: the enemy didn’t exist</Title>
    <div style={{
      fontFamily: mono, fontSize: 34, color: C.parch, background: 'rgba(0,0,0,0.45)',
      border: `2px solid ${C.wood2}`, borderRadius: 8, padding: '30px 44px', marginTop: 46,
      textAlign: 'left', lineHeight: 1.7,
    }}>
      <div><span style={{ color: '#8d8062' }}>// warlord cadence</span></div>
      <div>nextWarlord = wave * <span style={{ color: C.crimson2, fontWeight: 700 }}>NaN</span>  <span style={{ color: '#8d8062' }}>// → he never comes</span></div>
    </div>
    <div style={{ display: 'flex', gap: 40, marginTop: 50, alignItems: 'center' }}>
      <div style={{ opacity: 0.25 }}><Sprite art="warlord" scale={18} /></div>
      <div style={{ fontFamily: pirata, fontSize: 60, color: C.gold2 }}>→</div>
      <Sprite art="warlord" scale={18} />
    </div>
    <Sub size={34} style={{ marginTop: 44, maxWidth: 1250 }}>
      Warlords never spawned in ANY simulation for weeks. Fixing one line moved a scenario from
      <b style={{ color: C.crimson2, fontStyle: 'normal' }}> 98% “too easy”</b> to <b style={{ color: C.gold2, fontStyle: 'normal' }}>50% “interesting.”</b><br />
      The difficulty design was being carried by an enemy who didn’t exist.
    </Sub>
  </AbsoluteFill>
);

// ── Post 8: the eat order (1600×900) ───────────────────────────────
export const StillBread = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={76}>One 19-year reign rotted 47,690 food</Title>
    <Sub size={34} style={{ marginTop: 8 }}>…while bread sat at <b style={{ color: C.crimson2, fontStyle: 'normal' }}>zero</b>. People ate bread FIRST — so it could never stockpile.</Sub>
    <div style={{ display: 'flex', gap: 46, marginTop: 46 }}>
      <Panel style={{ width: 600, gap: 14 }}>
        <div style={{ fontFamily: pirata, fontSize: 36, color: C.bad }}>Before</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Sprite art="bread" scale={11} />
          <div style={{ fontFamily: pirata, fontSize: 44, color: C.inkSoft }}>→ 🍽 → </div>
          <div style={{ position: 'relative' }}>
            <Sprite art="food" scale={11} />
            <div style={{ position: 'absolute', inset: 0, background: '#5a7a2a', opacity: 0.55, borderRadius: 8 }} />
          </div>
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 28, color: C.inkSoft, lineHeight: 1.4 }}>
          Bread eaten first; the grain surplus rots behind it.<br />
          <b style={{ fontFamily: mono }}>rotted: 47,690 · bread: 0</b>
        </div>
      </Panel>
      <Panel style={{ width: 600, gap: 14 }}>
        <div style={{ fontFamily: pirata, fontSize: 36, color: C.good }}>After</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Sprite art="food" scale={11} />
          <div style={{ fontFamily: pirata, fontSize: 44, color: C.inkSoft }}>→ 🍽 → </div>
          <Sprite art="bread" scale={11} />
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 28, color: C.inkSoft, lineHeight: 1.4 }}>
          Raw food first — bread only in shortfall.<br />
          Bread becomes what it should be: <b>the winter reserve.</b>
        </div>
      </Panel>
    </div>
  </AbsoluteFill>
);

// ── Post 9: masters (1600×900) ─────────────────────────────────────
export const StillMasters = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={76}>201 of 245 subjects were “masters”</Title>
    <Sub size={33} style={{ marginTop: 8 }}>
      Mastery was the default human condition — so losing a master meant <b style={{ color: C.crimson2, fontStyle: 'normal' }}>nothing</b>.
    </Sub>
    <div style={{ display: 'flex', gap: 60, marginTop: 44, alignItems: 'center' }}>
      <Panel style={{ width: 620, gap: 12 }}>
        <div style={{ fontFamily: pirata, fontSize: 34, color: C.bad }}>Before</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 40px)', gap: 8 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <Sprite art="villager" scale={7} />
              {i % 5 !== 4 && <div style={{ position: 'absolute', top: -14, left: 4 }}><Sprite art="crown" scale={3} /></div>}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 26, color: C.inkSoft, fontStyle: 'italic' }}>a crown on every other head</div>
      </Panel>
      <Panel style={{ width: 620, gap: 12 }}>
        <div style={{ fontFamily: pirata, fontSize: 34, color: C.good }}>Now</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 40px)', gap: 8 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <Sprite art="villager" scale={7} />
              {i === 14 && <div style={{ position: 'absolute', top: -14, left: 4 }}><Sprite art="crown" scale={3} /></div>}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 26, color: C.inkSoft, fontStyle: 'italic' }}>a master is ~4 years of devoted work</div>
      </Panel>
    </div>
    <div style={{ marginTop: 42 }}>
      <LogLine kind="bad" size={30} width={900}>Mildred of the Ford, master baker, was run down in the open. The knowledge dies too.</LogLine>
    </div>
  </AbsoluteFill>
);

// ── Post 10: no rival kingdom (1600×900) ───────────────────────────
export const StillNoRival = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={78}>There is NO rival kingdom on the map</Title>
    <div style={{ display: 'flex', gap: 50, marginTop: 48, alignItems: 'stretch' }}>
      <Panel style={{ width: 620, gap: 16, opacity: 0.92 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ opacity: 0.45, filter: 'grayscale(0.6)' }}><Sprite art="keep" scale={12} /></div>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: pirata, fontSize: 130, color: C.crimson2, textShadow: '0 4px 0 rgba(0,0,0,0.5)',
          }}>✕</div>
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 29, color: C.inkSoft, lineHeight: 1.45 }}>
          An AI kingdom building counter-walls is a <b>worse Age of Empires</b>.
        </div>
      </Panel>
      <Panel style={{ width: 620, gap: 16 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
          <Sprite art="tent" scale={9} />
          <Sprite art="hall" scale={11} />
          <Sprite art="warlord" scale={12} />
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 29, color: C.inkSoft, lineHeight: 1.45 }}>
          The warlord is <b>asymmetric</b>: no economy, no tech — an address, a shadow you can’t claim land near, and a <b style={{ color: '#6e1a0e' }}>grudge</b>.
        </div>
      </Panel>
    </div>
    <Sub size={34} color={C.gold2} style={{ marginTop: 46 }}>
      Builder-first, with an aggression valve.
    </Sub>
  </AbsoluteFill>
);

// ── Bonus: the Steward's Counsel (onboarding announcement) ─────────
export const StillSteward = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={76}>Meet the Steward</Title>
    <Sub size={33} style={{ marginTop: 8 }}>
      A named advisor for your first reign — counsel, never orders. Dismissible in one click, never seen twice.
    </Sub>
    <div style={{ marginTop: 46, width: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel style={{ alignItems: 'flex-start', textAlign: 'left', gap: 8, padding: '26px 34px', borderLeft: `8px solid ${C.gold}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline' }}>
          <div style={{ fontFamily: pirata, fontSize: 34, color: '#8a6510' }}>Steward Osric the Steady</div>
          <div style={{ fontFamily: alegreya, fontSize: 22, fontStyle: 'italic', color: C.inkSoft }}>counsel 4 of 8</div>
        </div>
        <div style={{ fontFamily: alegreya, fontStyle: 'italic', fontSize: 30, color: C.ink, lineHeight: 1.45 }}>
          “Riders have been seen in the wilds. A watchtower, sire — and mind it needs a watchman inside, or it is only stone.”
        </div>
        <div style={{ fontFamily: alegreya, fontSize: 20, fontStyle: 'italic', color: C.inkSoft, textDecoration: 'underline', opacity: 0.7 }}>Dismiss the steward</div>
      </Panel>
      <LogLine kind="counsel" size={28} width={832}>The steward nods: eyes on the wilds at last.</LogLine>
    </div>
  </AbsoluteFill>
);

// ── "Tradeoffs under entropy" (the core-mechanic tweet, personal-thread copy) ──
export const StillEntropy = () => {
  const hp = 0.38;
  return (
    <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
      <Title size={80}>A building’s output IS its hit points</Title>
      <div style={{ display: 'flex', gap: 60, alignItems: 'center', marginTop: 50 }}>
        <Panel style={{ width: 560 }}>
          <Sprite art="farm" scale={14} />
          <div style={{ width: 440, height: 34, background: 'rgba(0,0,0,0.2)', border: `2px solid ${C.inkSoft}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${hp * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.bad}, ${C.crimson2})` }} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 34, color: C.ink }}>
            HP 19/50 → output <b>{Math.round((0.4 + 0.6 * hp) * 100)}%</b>
          </div>
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 660 }}>
          {[
            ['⚔', 'Raiders grind buildings down'],
            ['🕯', 'Decay nibbles, every tick'],
            ['🔨', 'Repair burns wood, stone — and the same scarce hands that could be harvesting, or defending'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ fontSize: 44 }}>{icon}</div>
              <div style={{ fontFamily: alegreya, fontSize: 33, color: C.parch2, lineHeight: 1.35 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
      <Sub size={40} color={C.gold2} style={{ marginTop: 52 }}>
        The entire game is making <b style={{ fontStyle: 'normal' }}>tradeoffs under entropy</b>.
      </Sub>
    </AbsoluteFill>
  );
};

// ── "Simulations, parameters, taste" (the process tweet) ───────────
const ParamRow = ({ code, frac, note }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22, width: '100%' }}>
    <div style={{ fontFamily: mono, fontSize: 28, color: C.ink, width: 470, textAlign: 'right', whiteSpace: 'nowrap' }}>{code}</div>
    <div style={{ position: 'relative', width: 300, height: 14, background: 'rgba(0,0,0,0.18)', border: `2px solid ${C.inkSoft}`, borderRadius: 7 }}>
      <div style={{
        position: 'absolute', left: `${frac * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
        width: 26, height: 26, background: `linear-gradient(180deg, ${C.gold2}, ${C.gold})`,
        border: `2px solid ${C.wood2}`, borderRadius: '50%', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }} />
    </div>
    <div style={{ fontFamily: alegreya, fontSize: 26, fontStyle: 'italic', color: C.inkSoft, flex: 1, textAlign: 'left', lineHeight: 1.3 }}>{note}</div>
  </div>
);
export const StillTaste = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
    <Title size={76}>Most of the work was tuning</Title>
    <Sub size={32} style={{ marginTop: 10 }}>
      Thousands of simulated reigns, one parameter at a time — then judged by hand.
    </Sub>
    <Panel style={{ marginTop: 42, gap: 26, padding: '42px 54px', width: 1240, alignItems: 'stretch' }}>
      <ParamRow code="FOREST.woodBase = 90" frac={0.42} note="what if the wood runs out too quickly?" />
      <ParamRow code="RAID.minGapTicks = 250" frac={0.55} note="what if I raise the frequency of raids?" />
      <ParamRow code="RAID.lootDmg = 4.5" frac={0.68} note="at 2.5, every single run collapsed" />
      <ParamRow code="TRIBUTE.appetiteMult = 1.6" frac={0.6} note="paying the warlord should sting later" />
    </Panel>
    <Sub size={38} color={C.gold2} style={{ marginTop: 46, maxWidth: 1300 }}>
      The simulations find the numbers. <b style={{ fontStyle: 'normal' }}>Taste</b> finds the game — what feels right, challenging but enjoyable.
    </Sub>
  </AbsoluteFill>
);

export const STILLS = [
  { id: 'og', component: OgCard, width: 1200, height: 630 },
  { id: 'still-hp', component: StillHp, width: 1600, height: 900 },
  { id: 'still-sim', component: StillSim, width: 1600, height: 900 },
  { id: 'still-nan', component: StillNan, width: 1600, height: 900 },
  { id: 'still-bread', component: StillBread, width: 1600, height: 900 },
  { id: 'still-masters', component: StillMasters, width: 1600, height: 900 },
  { id: 'still-norival', component: StillNoRival, width: 1600, height: 900 },
  { id: 'still-steward', component: StillSteward, width: 1600, height: 900 },
  { id: 'still-entropy', component: StillEntropy, width: 1600, height: 900 },
  { id: 'still-taste', component: StillTaste, width: 1600, height: 900 },
];
