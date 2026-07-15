// All art is generated in code: tiny pixel matrices → canvas textures.
// '.' = transparent; letters index PALETTE.

export const PALETTE = {
  s: '#b8b0a2', S: '#7d7568', o: '#2e2620',
  w: '#8a5a32', W: '#55361e',
  t: '#d1a54f', T: '#a3762f',
  r: '#9e3a2a', R: '#6e2418',
  g: '#e0b04c', f: '#d6b84e', F: '#8fae4a',
  c: '#e9dfc8', b: '#4a6e9e', k: '#26201a',
  e: '#e87c28', i: '#c8ccd4', d: '#6b4226',
  x: '#c03a2a', X: '#7e1f14', u: '#8fa3b8', D: '#54331c',
};

export const BUILDING_ART = {
  keep: [
    '....xx..........',
    '....xxx.........',
    '....k...........',
    '.ss.k.ss....ss..',
    '.sSssssSs..sSs..',
    '.ssssssss..sss..',
    '.sSssssssssssS..',
    '.sssskksssssss..',
    '.sSsskksssssSs..',
    '.sssssssssssss..',
    '.sSssssSssssss..',
    '.sssssssssssSs..',
    '.sSsssssssssss..',
    '.sssssssssssss..',
    '.WWWWWWWWWWWWW..',
    '................',
  ],
  house: [
    '............',
    '............',
    '....TT......',
    '...TttT.....',
    '..TttttT....',
    '.TttttttT...',
    'TttttttttT..',
    '.wwwwwwww...',
    '.wWwwkkww...',
    '.wwwwkkww...',
    '.wwwwkkww...',
    '.WWWWWWWW...',
  ],
  farm: [
    '............',
    '..TT........',
    '.TttT.......',
    'Tttttt......',
    '.wwww.......',
    '.wkww.......',
    'FfFfFfFfFfF.',
    'fFfFfFfFfFf.',
    'FfFfFfFfFfF.',
    'fFfFfFfFfFf.',
    'FfFfFfFfFfF.',
    '............',
  ],
  dock: [
    '............',
    '..wwwwwww...',
    '..WwWwWwW...',
    '....ww......',
    '....ww......',
    '....ww......',
    '....ww..c...',
    '....ww.ccc..',
    '....W.cccc..',
    '....WWWWWW..',
    '.....WWWW...',
    '............',
  ],
  road: [
    'dDddddwd',
    'ddwdDddd',
    'Dddddwdd',
    'ddDddddD',
    'dwddDddd',
    'DdddddwD',
    'ddDdwddd',
    'dddDddDd',
  ],
  lumber: [
    '............',
    '............',
    '....k.......',
    '...kk.......',
    '..kk...WwW..',
    '.ii....wWw..',
    '..W...WwWwW.',
    '..W...wWwWw.',
    '.WWW.WwWwWwW',
    '.....wWwWwWw',
    '............',
    '............',
  ],
  quarry: [
    '............',
    '............',
    '..ss..sS....',
    '.sSss.ss....',
    '.ssss.......',
    '..sss..ss...',
    '.sSsssSss...',
    '.sssssssSs..',
    '.ssSsssssss.',
    '.sssssSssss.',
    '.kkkkkkkkkk.',
    '............',
  ],
  mine: [
    '............',
    '............',
    '..WWWWWWW...',
    '..W.....W...',
    '..W.kkk.W...',
    '..Wkkkkkw...',
    '..Wkkkkkw...',
    '..WkkkkkW...',
    '.SSkkkkkSS..',
    '.SSSSSSSSS..',
    '............',
    '............',
  ],
  smelter: [
    '............',
    '....k.......',
    '...kk.......',
    '..SSSS......',
    '..SsSS......',
    '..SSsS......',
    '..SeeS......',
    '..SeES......'.replace('E', 'e'),
    '..SSSSssss..',
    '..SSSSsSss..',
    '..kkkkkkkk..',
    '............',
  ],
  bakery: [
    '............',
    '.....k......',
    '....kk......',
    '..rrrrrr....',
    '.rRrrrrRr...',
    'rrrrrrrrrr..',
    '.cccccccc...',
    '.cckkccgc...',
    '.cckkccgc...',
    '.cccccccc...',
    '.WWWWWWWW...',
    '............',
  ],
  market: [
    '............',
    '.x.x.x.x.x..',
    'xcxcxcxcxcx.',
    '.xcxcxcxcx..',
    '.W.......W..',
    '.W.ggg...W..',
    '.W.gfg.t.W..',
    '.WwwwwwwwW..',
    '.WwWwwWwwW..',
    '.WWWWWWWWW..',
    '............',
    '............',
  ],
  church: [
    '.....g......',
    '....ggg.....',
    '.....g......',
    '....ccc.....',
    '...ccccc....',
    '..ccccccc...',
    '.ccccccccc..',
    '.ccbccbccc..',
    '.ccbccbccc..',
    '.ccccccccc..',
    '.cckkkcccc..',
    '.SSSSSSSSS..',
  ],
  tower: [
    '....sss.....',
    '...ssSss....',
    '...s.s.s....',
    '...sssss....',
    '...sSsss....',
    '...sskss....',
    '...ssksS....',
    '...sSsss....',
    '...sssss....',
    '...ssSss....',
    '...sssss....',
    '...SSSSS....',
  ],
  wall: [
    '............',
    '............',
    '............',
    '.s.ss.ss.s..',
    '.ssssssssss.',
    '.sSssSssSss.',
    '.ssssssssss.',
    '.ssSssssSss.',
    '.ssssssSsss.',
    '.sSssssssss.',
    '.SSSSSSSSSS.',
    '............',
  ],
  barracks: [
    '............',
    '....x.......',
    '....xx......',
    '....k.......',
    '.rrrrrrrrr..',
    'rRrrrrRrrrr.',
    '.wwwwwwwww..',
    '.wkkwwwkkw..',
    '.wkkwuuwkw..'.replace('uu', 'ww'),
    '.wwwwwwwww..',
    '.WWWWWWWWW..',
    '............',
  ],
};

export const UNIT_ART = {
  raider: [
    '.kk..',
    '.xx.k',
    'xxxx.',
    '.xx..',
    '.k.k.',
  ],
  soldier: [
    '.ii..',
    '.uu.i',
    'uuuu.',
    '.uu..',
    '.k.k.',
  ],
  merchant: [
    '.tt..',
    'ttttt',
    '.ww..',
    'wwww.',
    '.k.k.',
  ],
};

export const RES_ICON_ART = {
  food: ['..f.....', '.fff....', 'ffFff...', '.fffff..', '..fFff..', '...fff..', '....f...', '........'],
  wood: ['........', '..WwW...', '.wWwWw..', 'WwWwWwW.', '.wWwWw..', '..WwW...', '........', '........'],
  stone: ['........', '..sss...', '.sSsss..', 'ssssSs..', 'sSssss..', '.ssss...', '........', '........'],
  ore: ['........', '...kk...', '..kgkk..', '.kkkgk..', '.kgkkk..', '..kkk...', '........', '........'],
  iron: ['........', '........', '..iii...', '.iiiii..', 'iiiuii..', '.iiiii..', '........', '........'],
  bread: ['........', '..ttt...', '.ttTtt..', 'ttTttt..', '.ttttT..', '..ttt...', '........', '........'],
  gold: ['........', '..ggg...', '.ggggg..', '.gTggg..', '.ggggg..', '..ggg...', '........', '........'],
  pop: ['..kk....', '..cc....', '.rrrr...', '.rrrr...', '..rr....', '..kk....', '.k..k...', '........'],
  morale: ['........', '.rr.rr..', 'rrrrrrr.', 'rrrrrrr.', '.rrrrr..', '..rrr...', '...r....', '........'],
  crown: ['........', '.g.gg.g.', '.g.gg.g.', '.gggggg.', '.gggggg.', '.gTggTg.', '.gggggg.', '........'],
  // a hooded brigand for the unit inspector (raiders)
  raider: ['..XX....', '..XX....', '.xRRx...', '.xRRx...', '..RR....', '..XX....', '.X..X...', '........'],
  soldier: ['..ii....', '..cc....', '.uSSu...', '.uSSu...', '..SS....', '..ii....', '.i..i...', '........'],
};

function drawArt(ctx, rows, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = PALETTE[ch] || '#f0f';
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

export function makeTextures(scene) {
  for (const [key, rows] of Object.entries(BUILDING_ART)) {
    const w = rows[0].length, h = rows.length;
    const tex = scene.textures.createCanvas(`b-${key}`, w, h);
    drawArt(tex.getContext(), rows);
    tex.refresh();
  }
  for (const [key, rows] of Object.entries(UNIT_ART)) {
    const tex = scene.textures.createCanvas(`u-${key}`, 5, 5);
    drawArt(tex.getContext(), rows);
    tex.refresh();
  }
}

// Data-URL pixel icons for the DOM UI.
export function iconDataURL(key, scale = 3) {
  const rows = RES_ICON_ART[key];
  const c = document.createElement('canvas');
  c.width = 8 * scale; c.height = 8 * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = 8; tmp.height = 8;
  drawArt(tmp.getContext('2d'), rows);
  ctx.drawImage(tmp, 0, 0, 8 * scale, 8 * scale);
  return c.toDataURL();
}

export function buildingIconURL(key, scale = 3) {
  const rows = BUILDING_ART[key];
  const w = rows[0].length, h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  drawArt(tmp.getContext('2d'), rows);
  ctx.drawImage(tmp, 0, 0, w * scale, h * scale);
  return c.toDataURL();
}
