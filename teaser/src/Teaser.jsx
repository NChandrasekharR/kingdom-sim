import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadPirata } from '@remotion/google-fonts/PirataOne';
import { loadFont as loadAlegreya } from '@remotion/google-fonts/Alegreya';
import { Sprite } from './sprites.jsx';

const pirata = loadPirata().fontFamily;
const alegreya = loadAlegreya().fontFamily;

// ── the game's design tokens ───────────────────────────────────────
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

const FadeIn = ({ children, delay = 0, dur = 14 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(f, [delay, delay + dur], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity: o, transform: `translateY(${y}px)` }}>{children}</div>;
};

const Pop = ({ children, delay = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 12, mass: 0.6 } });
  return <div style={{ transform: `scale(${s})`, opacity: f < delay ? 0 : 1 }}>{children}</div>;
};

const Caption = ({ children, delay = 0, size = 44, color = C.parch2 }) => (
  <FadeIn delay={delay}>
    <div style={{
      fontFamily: alegreya, fontStyle: 'italic', fontSize: size, color,
      textAlign: 'center', lineHeight: 1.45, maxWidth: 1400, margin: '0 auto',
    }}>{children}</div>
  </FadeIn>
);

const LogLine = ({ children, kind = 'bad', delay = 0 }) => (
  <FadeIn delay={delay}>
    <div style={{
      fontFamily: alegreya, fontSize: 34, color: kind === 'good' ? '#2c4d17' : '#6e1a0e',
      background: 'rgba(233,216,172,0.92)', borderLeft: `10px solid ${kind === 'good' ? C.good : C.bad}`,
      padding: '14px 28px', marginTop: 18, maxWidth: 1250,
    }}>{children}</div>
  </FadeIn>
);

// ── I. Title ───────────────────────────────────────────────────────
const STitle = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `translateY(${(1 - rise) * 60}px)`, opacity: rise, filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.7))' }}>
        <Sprite art="keep" scale={16} />
      </div>
      <FadeIn delay={18}>
        <div style={{
          fontFamily: pirata, fontSize: 170, color: C.gold2, letterSpacing: 10,
          textShadow: '0 6px 0 rgba(0,0,0,0.7), 0 0 80px rgba(224,176,76,0.4)', marginTop: 8,
        }}>⚜ KINGDOM</div>
      </FadeIn>
      <Caption delay={45} size={50}>
        Rule <b style={{ color: C.gold2, fontStyle: 'normal' }}>named souls</b> on a map that <b style={{ color: C.gold2, fontStyle: 'normal' }}>keeps score</b> —<br />
        against an enemy who <b style={{ color: C.gold2, fontStyle: 'normal' }}>remembers</b>.
      </Caption>
    </AbsoluteFill>
  );
};

// ── II. Named souls ────────────────────────────────────────────────
const SOULS = [
  { name: 'Berta Stoutheart', art: 'villager', speed: 5.2, y: 240, start: 60 },
  { name: 'Godwin the Quiet', art: 'villager', speed: 4.4, y: 330, start: -140 },
  { name: 'Ysolde of the Vale', art: 'soldier', speed: 4.8, y: 285, start: -420 },
];
const SSouls = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ ...ironBg, alignItems: 'center' }}>
      {SOULS.map((s, i) => {
        const x = s.start + f * s.speed;
        const bob = Math.sin((f + i * 17) / 5) * 5;
        return (
          <div key={s.name} style={{ position: 'absolute', left: x, top: s.y + bob, textAlign: 'center' }}>
            <div style={{
              fontFamily: pirata, fontSize: 30, color: C.ink, background: `linear-gradient(180deg, ${C.parch}, ${C.parch2})`,
              border: `2px solid ${C.wood2}`, borderRadius: 4, padding: '4px 16px', marginBottom: 10,
              boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
            }}>{s.name}</div>
            <Sprite art={s.art} scale={16} />
          </div>
        );
      })}
      <div style={{ position: 'absolute', bottom: 150, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Caption delay={8} size={48}>
          Every subject is a <b style={{ color: C.gold2, fontStyle: 'normal' }}>named soul</b> — they walk to work,<br />learn a craft over years… and can die.
        </Caption>
        <LogLine kind="bad" delay={80}>Berta Stoutheart was run down in the open by Ulf Redknife.</LogLine>
        <LogLine kind="good" delay={115}>Cornered, Godwin the Quiet turns with a hoe — and fells Skarde the Vulture!</LogLine>
      </div>
    </AbsoluteFill>
  );
};

// ── III. Raise the works ───────────────────────────────────────────
const WORKS = ['farm', 'lumber', 'quarry', 'smelter', 'bakery', 'market', 'church', 'tower'];
const SBuild = () => {
  const f = useCurrentFrame();
  const roadW = interpolate(f, [95, 165], [0, 1560], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ ...parchBg, alignItems: 'center', paddingTop: 90 }}>
      <div style={{ fontFamily: pirata, fontSize: 84, color: C.crimson, letterSpacing: 2 }}>Raise the works</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 240px)', gap: 26, marginTop: 40 }}>
        {WORKS.map((w, i) => (
          <Pop key={w} delay={10 + i * 7}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.4), rgba(0,0,0,0.05))',
              border: `2px solid ${C.inkSoft}`, borderRadius: 5, padding: '24px 10px 18px',
            }}>
              <Sprite art={w} scale={9} />
              <div style={{ fontFamily: pirata, fontSize: 30, color: C.ink, textTransform: 'capitalize' }}>{w}</div>
            </div>
          </Pop>
        ))}
      </div>
      <div style={{ marginTop: 52, height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Caption delay={70} size={44} color={C.inkSoft}>
          Grain becomes bread. Ore becomes iron. And the <b style={{ color: C.crimson, fontStyle: 'normal' }}>border follows your roads</b>.
        </Caption>
        <div style={{ position: 'relative', width: 1560, height: 40, marginTop: 26 }}>
          <div style={{
            position: 'absolute', left: 0, top: 6, width: roadW, height: 22,
            background: '#6b4226', borderTop: '4px solid #c8452e', borderBottom: '4px solid #c8452e',
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── IV. Tradeoffs ──────────────────────────────────────────────────
const TradePanel = ({ delay, children }) => (
  <Pop delay={delay}>
    <div style={{
      width: 520, minHeight: 460, ...parchBg, border: `3px solid ${C.wood2}`, borderRadius: 6,
      boxShadow: '0 16px 50px rgba(0,0,0,0.6)', padding: '40px 36px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center',
    }}>{children}</div>
  </Pop>
);
const H3 = ({ children }) => <div style={{ fontFamily: pirata, fontSize: 42, color: C.crimson, lineHeight: 1.15 }}>{children}</div>;
const P = ({ children }) => <div style={{ fontFamily: alegreya, fontSize: 30, color: C.inkSoft, lineHeight: 1.45 }}>{children}</div>;

const STradeoffs = () => {
  const f = useCurrentFrame();
  const hp = interpolate(f, [40, 170], [1, 0.38], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rot = interpolate(f, [90, 160], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: pirata, fontSize: 76, color: C.gold2, textShadow: '0 4px 0 rgba(0,0,0,0.7)' }}>
          Everything is a tradeoff
        </div>
      </div>
      <div style={{ display: 'flex', gap: 44, marginTop: 60 }}>
        <TradePanel delay={8}>
          <Sprite art="house" scale={10} />
          <div style={{ width: 380, height: 26, background: 'rgba(0,0,0,0.2)', border: `2px solid ${C.inkSoft}`, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${hp * 100}%`, height: '100%', background: `linear-gradient(90deg, ${hp > 0.5 ? C.good : C.bad}, ${hp > 0.5 ? '#6fa04a' : C.crimson2})` }} />
          </div>
          <H3>Output IS hit points</H3>
          <P>Raiders grind buildings down; decay nibbles. Output right now: <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.round((0.4 + 0.6 * hp) * 100)}%</b>. Repair competes with the harvest for the same hands.</P>
        </TradePanel>
        <TradePanel delay={40}>
          <div style={{ display: 'flex', gap: 26, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Sprite art="food" scale={12} />
              <div style={{ position: 'absolute', inset: 0, background: '#5a7a2a', opacity: rot * 0.55, borderRadius: 8 }} />
            </div>
            <div style={{ fontFamily: pirata, fontSize: 50, color: C.inkSoft }}>→</div>
            <Sprite art="bread" scale={12} />
          </div>
          <H3>Raw food rots — bread keeps</H3>
          <P>A fat surplus is exactly when you should be baking. The larder is a decision, not a number going up.</P>
        </TradePanel>
        <TradePanel delay={72}>
          <div style={{ display: 'flex', gap: 20 }}>
            <Sprite art="villager" scale={14} />
            <Sprite art="crown" scale={9} />
          </div>
          <H3>Masters are years of work</H3>
          <P>A master doubles a workshop — and their knowledge <b style={{ color: '#6e1a0e' }}>dies with them</b>. Lose your only smith and the whole craft dims.</P>
        </TradePanel>
      </div>
    </AbsoluteFill>
  );
};

// ── V. The raid ────────────────────────────────────────────────────
const SRaid = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: f, fps, config: { damping: 11 } });
  const pulse = 1 + Math.sin(f / 4) * 0.04;
  return (
    <AbsoluteFill style={{ ...ironBg, alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: 90 * drop - 40, transform: `scale(${pulse})`,
        background: `linear-gradient(180deg, ${C.crimson2}, ${C.crimson})`, color: '#ffe9c8',
        fontFamily: pirata, fontSize: 54, letterSpacing: 8, padding: '16px 60px',
        border: '4px solid #5e150c', borderRadius: 4, boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
      }}>⚔ RAIDERS APPROACH ⚔</div>
      {/* the road they march down */}
      <div style={{ position: 'absolute', top: 520, width: '100%', height: 46, background: '#6b4226', borderTop: '5px solid #54331c', borderBottom: '5px solid #54331c' }} />
      <div style={{ position: 'absolute', left: 120, top: 380 }}>
        <Sprite art="tower" scale={13} />
        <div style={{ position: 'absolute', left: 58, top: -48 }}><Sprite art="flag" scale={9} /></div>
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 2100 - f * 9 + i * 130;
        const bob = Math.sin((f + i * 11) / 4) * 5;
        return <div key={i} style={{ position: 'absolute', left: x, top: 495 + bob }}><Sprite art="raider" scale={13} /></div>;
      })}
      {/* a tower arrow loosed every second */}
      {(() => {
        const t = (f % 30) / 30;
        const targetX = Math.max(400, 2100 - f * 9);
        return <div style={{
          position: 'absolute', left: 220 + (targetX - 220) * t, top: 470 - Math.sin(t * Math.PI) * 90,
          width: 10, height: 10, background: '#e9dfc8',
        }} />;
      })()}
      <div style={{ position: 'absolute', bottom: 220, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Caption delay={20} size={48}>
          Raids <b style={{ color: C.crimson2, fontStyle: 'normal' }}>mass at his camp</b> and march your own roads.<br />Hold the line — or pay the Danegeld, and watch the price grow.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};

// ── VI. The enemy has an address ───────────────────────────────────
const SEnemy = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ ...ironBg }}>
      {/* his camp */}
      <div style={{ position: 'absolute', right: 430, top: 300 }}>
        <div style={{ position: 'absolute', left: 90, top: -95 }}><Sprite art="warlord" scale={17} /></div>
        <div style={{ position: 'absolute', left: 40, top: 0 }}><Sprite art="hall" scale={13} /></div>
        <div style={{ position: 'absolute', left: -110, top: 60 }}><Sprite art="tent" scale={11} /></div>
        <div style={{ position: 'absolute', left: 190, top: 70 }}><Sprite art="tent" scale={11} /></div>
        <div style={{ position: 'absolute', left: -30, top: 165 }}><Sprite art="folk" scale={11} /></div>
        <div style={{ position: 'absolute', left: 140, top: 175 }}><Sprite art="folk" scale={11} /></div>
      </div>
      {/* your host marches on it */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = -200 + f * 8 - i * 110;
        const bob = Math.sin((f + i * 13) / 4) * 5;
        return <div key={i} style={{ position: 'absolute', left: x, top: 430 + bob }}><Sprite art="soldier" scale={13} /></div>;
      })}
      <div style={{ position: 'absolute', bottom: 250, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Caption delay={10} size={52}>
          Your enemy has an <b style={{ color: C.gold2, fontStyle: 'normal' }}>address</b>.
        </Caption>
        <Caption delay={60} size={42}>
          His hoard is a ledger of everything he took from you.<br />March on his camp — and take it back.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};

// ── VII. The choice ────────────────────────────────────────────────
const SChoice = () => {
  const f = useCurrentFrame();
  const punishGlow = interpolate(f, [25, 45, 70, 90], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const razeGlow = interpolate(f, [75, 95, 200], [0, 1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#0d0a06', alignItems: 'center', justifyContent: 'center' }}>
      <Pop delay={0}>
        <div style={{
          ...parchBg, border: `4px solid ${C.gold}`, outline: `3px solid ${C.wood2}`, borderRadius: 6,
          padding: '54px 70px', width: 900, textAlign: 'center', boxShadow: '0 24px 90px rgba(0,0,0,0.9)',
        }}>
          <div style={{ fontFamily: pirata, fontSize: 62, color: C.crimson }}>Wolf's Rest is taken</div>
          <div style={{ fontFamily: alegreya, fontSize: 32, color: C.ink, marginTop: 14, lineHeight: 1.5 }}>
            The garrison is slain. His people cower among the tents —<br />none of them fighters.
          </div>
          <div style={{ fontFamily: pirata, fontSize: 40, color: C.ink, marginTop: 30 }}>What is your word, sovereign?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28 }}>
            <div style={{
              fontFamily: alegreya, fontWeight: 700, fontSize: 32, padding: '16px 0', borderRadius: 4,
              background: 'linear-gradient(180deg, #6a7d94, #46586e)', color: '#f0ece0', border: '2px solid #2c3a4c',
              transform: `scale(${1 + punishGlow * 0.04})`,
              boxShadow: `0 0 ${punishGlow * 40}px rgba(224,176,76,${punishGlow * 0.8})`,
            }}>Take back what is ours</div>
            <div style={{
              fontFamily: alegreya, fontWeight: 700, fontSize: 32, padding: '16px 0', borderRadius: 4,
              background: 'linear-gradient(180deg, #7e1205, #4a0a02)', color: '#ffd9c8', border: '2px solid #2e0500',
              transform: `scale(${1 + razeGlow * 0.05})`,
              boxShadow: `0 0 ${razeGlow * 55}px rgba(210,31,12,${razeGlow * 0.9})`,
            }}>Leave nothing standing</div>
          </div>
        </div>
      </Pop>
      <div style={{ position: 'absolute', bottom: 110, width: '100%', textAlign: 'center' }}>
        <Caption delay={110} size={46} color={C.crimson2}>
          Choose carefully. One survivor always slips through the reeds.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};

// ── VIII. Outro ────────────────────────────────────────────────────
const SOutro = () => (
  <AbsoluteFill style={{ ...ironBg, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', gap: 30 }}>
      {[0, 1, 2].map((i) => <Pop key={i} delay={i * 8}><Sprite art="crown" scale={11} /></Pop>)}
    </div>
    <FadeIn delay={20}>
      <div style={{
        fontFamily: pirata, fontSize: 130, color: C.gold2, letterSpacing: 8, marginTop: 18,
        textShadow: '0 5px 0 rgba(0,0,0,0.7), 0 0 70px rgba(224,176,76,0.35)',
      }}>⚜ KINGDOM</div>
    </FadeIn>
    <Caption delay={40} size={44}>A medieval realm simulator — free in the browser.</Caption>
    <FadeIn delay={62}>
      <div style={{
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 36, color: C.parch, marginTop: 26,
        background: 'rgba(58,40,24,0.8)', border: `2px solid ${C.wood2}`, borderRadius: 5, padding: '10px 30px',
      }}>kingdom-sim-fawn.vercel.app</div>
    </FadeIn>
    <FadeIn delay={80}>
      <div style={{ fontFamily: alegreya, fontStyle: 'italic', fontSize: 26, color: '#8d8062', marginTop: 30 }}>
        every sprite drawn in code · balanced across ~4,900 simulated reigns
      </div>
    </FadeIn>
  </AbsoluteFill>
);

// ── the reel ───────────────────────────────────────────────────────
export const SCENES = [
  [0, 110, STitle], [110, 290, SSouls], [290, 470, SBuild], [470, 680, STradeoffs],
  [680, 860, SRaid], [860, 1040, SEnemy], [1040, 1200, SChoice], [1200, 1320, SOutro],
];
export const DURATION = 1320;

export const Teaser = () => {
  const f = useCurrentFrame();
  const fadeOut = interpolate(f, [DURATION - 18, DURATION - 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.iron }}>
      {SCENES.map(([from, to, Scene]) => (
        <Sequence key={from} from={from} durationInFrames={to - from}>
          <SceneFade><Scene /></SceneFade>
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

// every scene eases in from black so cuts feel like page-turns
const SceneFade = ({ children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};
