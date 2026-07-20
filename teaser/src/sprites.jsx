import React from 'react';

// The game's own art, verbatim from src/game/sprites.js — pixel matrices,
// rendered here as SVG rects so they scale crisp at video resolution.
export const PALETTE = {
  s: '#b8b0a2', S: '#7d7568', o: '#2e2620',
  w: '#8a5a32', W: '#55361e',
  t: '#d1a54f', T: '#a3762f',
  r: '#9e3a2a', R: '#6e2418',
  g: '#e0b04c', f: '#d6b84e', F: '#8fae4a',
  c: '#e9dfc8', b: '#4a6e9e', k: '#26201a',
  e: '#e87c28', i: '#c8ccd4', d: '#6b4226',
  x: '#c03a2a', X: '#7e1f14', u: '#8fa3b8', D: '#54331c',
  p: '#a76fd6', P: '#6e3fa3',
};

export const ART = {
  keep: [
    '....xx..........', '....xxx.........', '....k...........', '.ss.k.ss....ss..',
    '.sSssssSs..sSs..', '.ssssssss..sss..', '.sSssssssssssS..', '.sssskksssssss..',
    '.sSsskksssssSs..', '.sssssssssssss..', '.sSssssSssssss..', '.sssssssssssSs..',
    '.sSsssssssssss..', '.sssssssssssss..', '.WWWWWWWWWWWWW..', '................',
  ],
  house: [
    '............', '............', '....TT......', '...TttT.....', '..TttttT....',
    '.TttttttT...', 'TttttttttT..', '.wwwwwwww...', '.wWwwkkww...', '.wwwwkkww...',
    '.wwwwkkww...', '.WWWWWWWW...',
  ],
  farm: [
    '............', '..TT........', '.TttT.......', 'Tttttt......', '.wwww.......',
    '.wkww.......', 'FfFfFfFfFfF.', 'fFfFfFfFfFf.', 'FfFfFfFfFfF.', 'fFfFfFfFfFf.',
    'FfFfFfFfFfF.', '............',
  ],
  lumber: [
    '............', '............', '....k.......', '...kk.......', '..kk...WwW..',
    '.ii....wWw..', '..W...WwWwW.', '..W...wWwWw.', '.WWW.WwWwWwW', '.....wWwWwWw',
    '............', '............',
  ],
  quarry: [
    '............', '............', '..ss..sS....', '.sSss.ss....', '.ssss.......',
    '..sss..ss...', '.sSsssSss...', '.sssssssSs..', '.ssSsssssss.', '.sssssSssss.',
    '.kkkkkkkkkk.', '............',
  ],
  smelter: [
    '............', '....k.......', '...kk.......', '..SSSS......', '..SsSS......',
    '..SSsS......', '..SeeS......', '..SeeS......', '..SSSSssss..', '..SSSSsSss..',
    '..kkkkkkkk..', '............',
  ],
  bakery: [
    '............', '.....k......', '....kk......', '..rrrrrr....', '.rRrrrrRr...',
    'rrrrrrrrrr..', '.cccccccc...', '.cckkccgc...', '.cckkccgc...', '.cccccccc...',
    '.WWWWWWWW...', '............',
  ],
  market: [
    '............', '.x.x.x.x.x..', 'xcxcxcxcxcx.', '.xcxcxcxcx..', '.W.......W..',
    '.W.ggg...W..', '.W.gfg.t.W..', '.WwwwwwwwW..', '.WwWwwWwwW..', '.WWWWWWWWW..',
    '............', '............',
  ],
  church: [
    '.....g......', '....ggg.....', '.....g......', '....ccc.....', '...ccccc....',
    '..ccccccc...', '.ccccccccc..', '.ccbccbccc..', '.ccbccbccc..', '.ccccccccc..',
    '.cckkkcccc..', '.SSSSSSSSS..',
  ],
  tower: [
    '....sss.....', '...ssSss....', '...s.s.s....', '...sssss....', '...sSsss....',
    '...sskss....', '...ssksS....', '...sSsss....', '...sssss....', '...ssSss....',
    '...sssss....', '...SSSSS....',
  ],
  tent: [
    '............', '............', '............', '.....W......', '....dWd.....',
    '...ddWdd....', '..dddWddd...', '.ddddWkddd..', '.dDddkkdDd..', '.DDDDDDDDD..',
    '............', '............',
  ],
  hall: [
    '....x.......', '....xx......', '....k.......', '....dWd.....', '...ddWdd....',
    '..dddWddd...', '.ddddWddddd.', '.dDddWdkkdd.', '.dddddkkkdd.', '.dDdddkkddd.',
    '.DDDDDDDDDD.', '............',
  ],
  road: [
    'dDddddwd', 'ddwdDddd', 'Dddddwdd', 'ddDddddD', 'dwddDddd', 'DdddddwD', 'ddDdwddd', 'dddDddDd',
  ],
  villager: ['.tt..', '.cc.w', 'cccc.', '.cc..', '.k.k.'],
  soldier:  ['.ii..', '.uu.i', 'uuuu.', '.uu..', '.k.k.'],
  raider:   ['.kk..', '.xx.k', 'xxxx.', '.xx..', '.k.k.'],
  warlord:  ['g.g.g', '.XXX.', 'XxxxX', 'xXXXx', '.X.X.'],
  folk:     ['.dd..', '.cc.d', 'dddd.', '.dd..', '.k.k.'],
  flag:     ['kxx..', 'kxxx.', 'kxx..', 'k....', 'k....'],
  crown:  ['........', '.g.gg.g.', '.g.gg.g.', '.gggggg.', '.gggggg.', '.gTggTg.', '.gggggg.', '........'],
  food:   ['..f.....', '.fff....', 'ffFff...', '.fffff..', '..fFff..', '...fff..', '....f...', '........'],
  bread:  ['........', '..ttt...', '.ttTtt..', 'ttTttt..', '.ttttT..', '..ttt...', '........', '........'],
  gold:   ['........', '..ggg...', '.ggggg..', '.gTggg..', '.ggggg..', '..ggg...', '........', '........'],
};

export const Sprite = ({ art, scale = 8, style }) => {
  const rows = ART[art];
  const w = rows[0].length, h = rows.length;
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={style}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={PALETTE[ch] || '#f0f'} />
          )
        )
      )}
    </svg>
  );
};
