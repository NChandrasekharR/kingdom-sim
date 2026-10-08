import { MAP, T, TERRAIN_INFO, CAMP, COMBAT, SOLDIER, RAIDER, SKILL, ROAD_SPEED_MULT } from '../config.js';
import { idx, inBounds } from './state.js';
import { logEvent, emit } from './events.js';
import { findPath, roadTiles, soldierSkill, soldierMaxHp, quietGap, garrisonPost } from './raids.js';
import { makeVillager, killVillager, isMaster } from './villagers.js';
import { pron, firstName } from './names.js';

// ── The warlord's camp ─────────────────────────────────────────────
// The warlord gets an ADDRESS: tents in the far wilds, folk who live there,
// a garrison, and a ledger of everything he has taken from you. His dread
// waves march FROM it — and you can march ON it. He is a pressure system
// with a face, never a rival economy (this is not Age of Empires).

const CAMP_NAMES = [
  "Wolf's Rest", 'Crowsfoot', 'the Black Fen', 'Ravenmoor',
  'Grimswallow', 'the Red Hollow', 'Ashvale', 'the Broken Tooth',
  'the Hanged Grove', 'Rotmarsh', 'the Skinned Hill', "Adder's Nest",
  'the Sunken Court', 'Gallowmere', 'the Whetstone', 'Old Scarrow',
  'the Weeping Stones', 'Kraghollow', 'the Salt Scar', 'Mirefast',
  'the Cold Hearth', 'Wyrmditch', 'the Low Door', 'Hungerpit',
];
// Camp folk are never renamed across camps: the Chronicle promises to keep
// their names, so the same Wren cannot die at two burnings (see mintFolkName).
const FOLK_FIRST = [
  'Hakon', 'Aldith', 'Sana', 'Ebba', 'Tam', 'Wren', 'Bo', 'Ida',
  'Finn', 'Mara', 'Olen', 'Suvi', 'Petya', 'Runa', 'Cob', 'Liv',
  'Tova', 'Arne', 'Hild', 'Kale', 'Asa', 'Bjorn', 'Inga', 'Leif',
  'Bera', 'Odd', 'Edda', 'Rolf', 'Saga', 'Ivar', 'Una', 'Sten',
  'Frida', 'Hauk', 'Gyda', 'Toki', 'Oda', 'Brand', 'Rana', 'Ketil',
  'Kelda', 'Vali',
];
const FOLK_TRADE = [
  'a shepherd', 'a weaver', 'a potter', 'a fowler', 'a tanner',
  'a midwife', 'a fisher', 'a beekeeper', 'a woodcarver', 'a cook',
];
const WARLORD_FIRST = [
  'Ulf', 'Grim', 'Skarde', 'Ragna', 'Toke', 'Bront', 'Halvar', 'Yrsa',
  'Kettil', 'Vragi', 'Drust', 'Orm', 'Gorm', 'Ingvar', 'Steinar',
  'Hallgerd', 'Njal', 'Thyra', 'Aslak', 'Kolgrim', 'Egil', 'Hrafn',
  'Mord', 'Torvald',
];
const WARLORD_EPITHET = [
  'Redknife', 'the Cruel', 'Wolfjaw', 'Ironmaw', 'Bloodbraid',
  'the Vulture', 'Two-Axe', 'Corpsegrin', 'the Hollow', 'Longreach',
  'the Flayed', 'Skullring', 'Widowmaker', 'Crowfeeder', 'the Grinning',
  'Blackfen', 'Adderfang', 'the Dour', 'Gallowsborn', 'the Shrike',
];

// A camp-folk name no earlier camp has used. When every name has been spent
// (a very long reign), names may return — but never an avenger's: that one
// belongs to the Chronicle.
function mintFolkName(state, id) {
  const used = (state.folkNamesUsed ||= []);
  const n = FOLK_FIRST.length;
  const pick = () => {
    for (let k = 0; k < n; k++) {
      const cand = FOLK_FIRST[(id + k * 5) % n];   // 5 is coprime to n: visits every name
      if (!used.includes(cand)) return cand;
    }
    return null;
  };
  let first = pick();
  if (!first) {
    // the pool is spent: start over, keeping the avengers' names retired
    used.length = 0;
    used.push(...(state.avengerNames || []));
    first = pick() || FOLK_FIRST[id % n];
  }
  used.push(first);
  return `${first}, ${FOLK_TRADE[(id * 7) % FOLK_TRADE.length]}`;
}

function mintWarlordName(state) {
  const id = state.nextId++;
  return `Warlord ${WARLORD_FIRST[id % WARLORD_FIRST.length]} ${WARLORD_EPITHET[(id * 11) % WARLORD_EPITHET.length]}`;
}

// Is any claimed tile within r of (x, y)? Used to keep camp sites clear of
// the realm's border, not just off claimed tiles themselves.
function claimedNear(state, x, y, r) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const px = x + dx, py = y + dy;
      if (!inBounds(px, py)) continue;
      if (state.claimed[idx(px, py)]) return true;
    }
  }
  return false;
}

// Pick a camp site: the wilds corner farthest from the keep, on buildable,
// REACHABLE ground — and never on ground the realm has claimed. No warlord
// pitches tents inside another man's fence. Strictness relaxes in tiers:
// ideally far enough out that his shadow doesn't even lap the border, then
// merely-unclaimed. A world with NO wild ground left yields no site at all
// (null): total dominion drives the camps from the land — callers disband,
// defer, or simply found nothing until the wilds reopen.
function findCampSite(state, keep, avoid) {
  const N = MAP.size;
  const corners = [[10, 10], [N - 11, 10], [10, N - 11], [N - 11, N - 11]];
  // farthest corner from the keep — the march should be a real journey.
  // An avenger founds his camp in a DIFFERENT corner than the burned one.
  let best = corners[0], bd = -1;
  for (const [cx, cy] of corners) {
    if (avoid && Math.hypot(cx - avoid.x, cy - avoid.y) < 30) continue;
    const d = Math.hypot(cx - keep.x, cy - keep.y);
    if (d > bd) { bd = d; best = [cx, cy]; }
  }
  for (const buffer of [CAMP.shadowRadius, 0]) {
    const siteOk = (x, y) => {
      const t = state.terrain[idx(x, y)];
      if (t !== T.PLAINS && t !== T.FOREST) return false;
      if (state.claimed[idx(x, y)]) return false;
      return buffer === 0 || !claimedNear(state, x, y, buffer);
    };
    // spiral out from the corner
    for (let r = 0; r < 34; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = best[0] + dx, y = best[1] + dy;
          if (x < 3 || y < 3 || x >= N - 3 || y >= N - 3) continue;
          if (!siteOk(x, y)) continue;
          if (findPath(state, keep.x, keep.y, x, y)) return { x, y };
        }
      }
    }
    // that corner is sea, cut off, or claimed — the farthest valid tile anywhere
    let anchor = null, fd = -1;
    for (let y = 3; y < N - 3; y += 4) {
      for (let x = 3; x < N - 3; x += 4) {
        if (!siteOk(x, y)) continue;
        const d = Math.hypot(x - keep.x, y - keep.y);
        if (d > fd && findPath(state, keep.x, keep.y, x, y)) { fd = d; anchor = { x, y }; }
      }
    }
    if (anchor) return anchor;
  }
  return null;   // every wild corner lies inside the realm's fence
}

// tents ring the hall
function buildTents(state, anchor) {
  const N = MAP.size;
  const tents = [{ x: anchor.x, y: anchor.y, kind: 'hall' }];
  const ring = [[-2, -1], [2, -1], [-1, 1], [1, 1], [-3, 1], [3, 0]];
  for (const [dx, dy] of ring) {
    const x = anchor.x + dx, y = anchor.y + dy;
    if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
    if (state.terrain[idx(x, y)] === T.WATER) continue;
    tents.push({ x, y, kind: 'tent' });
  }
  return tents;
}

// Found the camp in the wilds corner farthest from the keep. Called the first
// time a warlord shows himself (and again when an avenger returns to ashes).
export function ensureCamp(state, rand, opts = {}) {
  // a massacred camp stays ashes — only the avenger timer (which nulls
  // state.camp first) may found anew. No cadence shortcut past the grief.
  if (state.camp) return state.camp;
  const keep = state.buildings.find((b) => b.type === 'keep');
  if (!keep) return null;

  const anchor = findCampSite(state, keep, opts.avoidXY);
  // total dominion: no wild ground left anywhere — no camp can form
  if (!anchor) return null;

  const name = opts.campName ||
    CAMP_NAMES[Math.floor(rand() * CAMP_NAMES.length)];
  // an UNCLAIMED camp is a mere brigand nest — no warlord yet; one will claim
  // it when the kingdom grows worth the march (claimCampByWarlord)
  const unclaimed = !!opts.unclaimed;
  const warlordName = unclaimed ? null : (opts.warlordName || mintWarlordName(state));

  const tents = buildTents(state, anchor);

  const camp = {
    x: anchor.x, y: anchor.y, name, unclaimed,
    warlord: {
      name: warlordName, hp: CAMP.warlordHp, maxHp: CAMP.warlordHp,
      home: !unclaimed, x: anchor.x, y: anchor.y - 0.6, px: anchor.x, py: anchor.y - 0.6,
    },
    avenger: !!opts.avenger,      // an avenger sends no rider and takes no gold
    folk: [], garrison: [], tents,
    massing: [],                  // bodies gathering before a wave (props for the eye)
    massingCount: 0,              // the TRUE size of that gathering — what you fight
    massers: [],                  // battle-only: the gathering, turned to meet the host
    ledger: { gold: 0, plunder: 0 },
    broken: false, brokenUntil: 0,
    leaderless: false, successorAt: 0,
    gone: false, avengerAt: 0, avengerName: null, burnedXY: null,
    settlersLeft: 0, nextSettlerAt: 0,
  };
  for (let i = 0; i < CAMP.folk; i++) {
    const id = state.nextId++;
    const t = tents[1 + (i % Math.max(1, tents.length - 1))] || tents[0];
    camp.folk.push({
      id, name: mintFolkName(state, id),
      x: t.x + (rand() - 0.5), y: t.y + 0.8 + (rand() - 0.5) * 0.5,
      px: 0, py: 0, dead: false, survivor: false, escaped: false,
    });
  }
  if (unclaimed) {
    for (let i = 0; i < CAMP.nestGarrison; i++) addSword(state, camp, rand);
  } else {
    refillGarrison(state, camp, rand);
  }
  state.camp = camp;
  state.campDirty = true;
  logEvent(state, opts.avenger
    ? `${warlordName} raises ${pron(warlordName).his} banner at ${name}. ${pron(warlordName).He} sends no riders. ${pron(warlordName).He} wants no gold.`
    : unclaimed
      ? `The raiders have set up camp in the wilds — ${name}. For now, it is only a nest of brigands.`
      : `Scouts bring word: a warlord has made camp in the wilds — ${name}, under ${warlordName}.`, 'raid');
  emit('camp-founded', camp);
  return camp;
}

// The kingdom has grown worth the march: a warlord rides in and claims the
// nest. From here the rider, the Danegeld, and the dread waves are his.
export function claimCampByWarlord(state) {
  const c = state.camp;
  if (!c || !c.unclaimed || c.gone) return;
  c.unclaimed = false;
  c.warlord = {
    name: mintWarlordName(state), hp: CAMP.warlordHp, maxHp: CAMP.warlordHp,
    home: true, x: c.x, y: c.y - 0.6, px: c.x, py: c.y - 0.6,
  };
  logEvent(state, `A warlord has claimed ${c.name}: ${c.warlord.name}. ${pron(c.warlord.name).His} banner rises over the tents.`, 'raid');
  emit('warlord-claimed', c);
}

// ── The gathering ──────────────────────────────────────────────────
// Before a camp-origin wave marches, bodies gather at the tents: props for the
// eye (c.massing) plus the true count of the coming host (c.massingCount).
// Strike the camp while they stand there and they turn to meet you — so every
// path that ends the gathering (wave launched, raid over, tribute paid, camp
// struck, camp broken) must clear BOTH, or scenery animates at a dead camp.
export function clearMassing(state) {
  const c = state.camp;
  if (!c) return;
  c.massing = [];
  c.massingCount = 0;
}

// Is the host fighting at the tents while a camp-origin wave is still
// gathering there? (The window in which the pending raid is on the field.)
export function massingUnderAssault(state) {
  const c = state.camp;
  const exp = state.expedition;
  if (!c || c.gone || !exp) return false;
  if (exp.phase !== 'battle') return false;
  const raid = state.raid;
  return raid.stage >= 1 && raid.nextFromCamp === true && (exp.massersJoined || 0) > 0;
}

function garrisonTarget(camp) {
  return Math.min(CAMP.garrisonMax,
    Math.round(CAMP.garrisonBase + camp.ledger.plunder * CAMP.garrisonPerPlunder));
}

function addSword(state, camp, rand) {
  const id = state.nextId++;
  const t = camp.tents[id % camp.tents.length] || camp;
  camp.garrison.push({
    id, name: `${WARLORD_FIRST[id % WARLORD_FIRST.length]} of ${camp.name}`,
    hp: RAIDER.hp, x: t.x + (rand() - 0.5) * 2, y: t.y + 1 + (rand() - 0.5),
    px: 0, py: 0,
  });
}

function refillGarrison(state, camp, rand) {
  while (camp.garrison.length < garrisonTarget(camp)) addSword(state, camp, rand);
}

// ── Hooks from the raid system ─────────────────────────────────────

// Can a warlord wave actually march? (Camp broken, leaderless, burned, or
// the man himself already afield → the cadence downgrades to a normal raid.)
export function warlordAvailable(state) {
  const c = state.camp;
  if (!c) return true;               // not founded yet — founding happens now
  if (c.gone) return false;          // ashes; the avenger is not yet come
  if (c.unclaimed) return false;     // a nest of brigands — no warlord to march
  return !c.broken && !c.leaderless && c.warlord.home;
}

// Every fled brigand pays the camp fealty: carried-off loot lands in the
// warlord's hoard. This is what makes the counter-raid worth the blood.
export function addPlunder(state, amount) {
  const c = state.camp;
  if (!c || c.gone || amount <= 0) return;
  c.ledger.plunder += amount;
}

export function addTributeGold(state, amount) {
  const c = state.camp;
  if (!c || c.gone) return;
  c.ledger.gold += amount;
}

// The warlord fell in open battle — at your walls, like a soldier. Honorable
// death: his host breaks, and one day a successor claims the camp.
export function warlordFell(state) {
  const c = state.camp;
  if (!c || c.gone || c.leaderless || c.unclaimed || !c.warlord?.name) return;
  c.leaderless = true;
  c.successorAt = state.tick + CAMP.successorTicks;
  logEvent(state, `${c.warlord.name.toUpperCase()} IS SLAIN! ${pron(c.warlord.name).His} host breaks and scatters.`, 'good');
  emit('warlord-slain');
}

// The warlord walked home from a raid (or the wave was wiped around him).
export function warlordReturned(state) {
  const c = state.camp;
  if (!c) return;
  if (c.gone) {
    // he marched out with his warband and came home to ashes and silence
    logEvent(state, `${c.warlord.name} returns to what was ${c.name}. Ashes. Silence. Something in ${pron(c.warlord.name).him} breaks.`, 'raid');
    c.avengerAt = Math.min(c.avengerAt || Infinity, state.tick + Math.floor(CAMP.avengerTicks / 2));
    if (!c.avengerName) {
      c.avengerName = `${c.warlord.name.replace('Warlord ', '')} the Ash-Sworn`;
      (state.avengerNames ||= []).push(firstName(c.warlord.name));
    }
    return;
  }
  c.warlord.home = true;
  c.warlord.hp = c.warlord.maxHp;    // he licks his wounds among his own
  c.warlord.x = c.x; c.warlord.y = c.y - 0.6;
  c.warlord.px = c.warlord.x; c.warlord.py = c.warlord.y;
}

// ── The march ──────────────────────────────────────────────────────
// Send EVERY sword you have. The home-guard decision is how many you muster
// before you march — the militia system is the dial.
export function marchOnCamp(state) {
  const c = state.camp;
  if (!c || c.gone) return { ok: false, reason: 'There is no camp to march on' };
  if (c.broken) return { ok: false, reason: `${c.name} already lies broken` };
  if (state.expedition) return { ok: false, reason: 'The host is already afield' };
  if (state.raid.keepBesieged) return { ok: false, reason: 'The keep is under assault!' };
  // garrisons hold their posts: the host is the field army (and any sellswords)
  const host = state.soldiers.filter((s) => s.hp > 0 && !garrisonPost(state, s));
  if (host.length < 3) {
    return { ok: false, reason: state.soldiers.some((s) => garrisonPost(state, s))
      ? 'Too few swords to march (3 or more) — garrisons hold their posts'
      : 'Too few swords to march (3 or more)' };
  }

  const foodCost = host.length * CAMP.provisionFood;
  const goldCost = CAMP.provisionGold;
  if (state.res.food + state.res.bread * 2 < foodCost) {
    return { ok: false, reason: `Not enough food to provision the march (${foodCost})` };
  }
  if (state.res.gold < goldCost) return { ok: false, reason: `Not enough gold (${goldCost})` };

  const keep = state.buildings.find((b) => b.type === 'keep');
  const path = findPath(state, keep.x, keep.y, c.x, c.y);
  if (!path) return { ok: false, reason: 'No road leads through the wilds' };

  // provisions: raw food first, then the bread reserve (like eating)
  let need = foodCost;
  const fromFood = Math.min(state.res.food, need);
  state.res.food -= fromFood; need -= fromFood;
  if (need > 0) state.res.bread -= need / 2;
  state.res.gold -= goldCost;

  for (const s of host) { s.exp = true; s.expI = 0; }
  state.expedition = {
    phase: 'march', path,
    startCount: host.length, lost: 0, slain: 0, warlordSlain: false,
    startTick: state.tick, battleLogged: false,
  };
  state.stats.expeditions = (state.stats.expeditions || 0) + 1;
  const mercCount = host.filter((so) => so.merc).length;
  logEvent(state, `The host marches on ${c.name} — ${host.length} swords. The kingdom stands thinner behind them.`, 'info',
    `(${host.length - mercCount} subjects, ${mercCount} sellswords)`);
  emit('expedition-marched', { camp: c, count: host.length });
  return { ok: true };
}

// ── Per-tick camp life + expedition state machine ──────────────────
export function campTick(state, rand) {
  const c = state.camp;
  if (c) {
    if (!c.gone) campLife(state, c, rand);
    timers(state, c, rand);
  }
  if (state.expedition) expeditionTick(state, rand);
}

function campLife(state, c, rand) {
  // folk mill among the tents (unless fleeing a massacre — handled there)
  const massacre = state.expedition?.phase === 'massacre';
  for (const f of c.folk) {
    if (f.dead || f.escaped) continue;
    f.px = f.x; f.py = f.y;
    if (massacre) continue;
    f.x += (rand() - 0.5) * 0.1;
    f.y += (rand() - 0.5) * 0.1;
    const d = Math.hypot(f.x - c.x, f.y - c.y);
    if (d > 3.2) { f.x += (c.x - f.x) * 0.05; f.y += (c.y - f.y) * 0.05; }
  }
  for (const g of c.garrison) { g.px = g.x; g.py = g.y; }
  // massing raiders mill restlessly by the tents — the storm you can see coming
  for (const m of c.massing || []) {
    m.px = m.x; m.py = m.y;
    m.x += (rand() - 0.5) * 0.12;
    m.y += (rand() - 0.5) * 0.12;
  }
  const w = c.warlord;
  if (w.home && !c.leaderless) {
    w.px = w.x; w.py = w.y;
    if (w.hp < w.maxHp) w.hp = Math.min(w.maxHp, w.hp + 0.3);
  }
}

function timers(state, c, rand) {
  // a camp standing on ground the realm has claimed strikes its tents and
  // moves deeper into the wilds (the site was claimed before the camp was
  // founded, or the save predates the claim check) — or, when no wild ground
  // is left anywhere, is driven from the land entirely. Never mid-expedition —
  // the host is marching on the old address. Ashes stay where they burned.
  if (!c.gone && !state.expedition && state.tick % 64 === 0 &&
      state.claimed[idx(Math.round(c.x), Math.round(c.y))]) {
    relocateCamp(state, c, rand);
  }
  // wealth attracts swords: the garrison trickles up toward what the hoard
  // commands — but no sword signs on while a host stands at the tents (the
  // same gate relocation uses; a mid-massacre camp once recruited a man)
  if (!c.broken && !c.gone && !state.expedition && state.tick % 200 === 0 &&
      c.garrison.length < garrisonTarget(c)) {
    addSword(state, c, rand);
  }
  // a punitive burning heals: war-tents rise again when the quiet runs out
  if (c.broken && state.tick >= c.brokenUntil && !c.gone) {
    c.broken = false;
    refillGarrison(state, c, rand);
    state.campDirty = true;
    logEvent(state, `War-tents rise again at ${c.name}. The warlord's banner flies once more.`, 'raid');
  }
  // a slain warlord's camp eventually finds a new chief
  if (c.leaderless && state.tick >= c.successorAt && !c.gone) {
    c.leaderless = false;
    c.warlord = {
      name: mintWarlordName(state), hp: CAMP.warlordHp, maxHp: CAMP.warlordHp,
      home: true, x: c.x, y: c.y - 0.6, px: c.x, py: c.y - 0.6,
    };
    refillGarrison(state, c, rand);
    logEvent(state, `A new chief claims ${c.name}: ${c.warlord.name}.`, 'raid');
  }
  // the survivor of a massacre returns — grown, named, and unbuyable
  if (c.gone && c.avengerAt && state.tick >= c.avengerAt) {
    const name = c.avengerName || 'the Ash-Sworn';
    const burned = c.burnedXY || { x: c.x, y: c.y };
    state.camp = null;
    ensureCamp(state, rand, {
      warlordName: `Warlord ${name}`, avenger: true, avoidXY: burned,
    });
    if (!state.camp) {
      // total dominion: no wild ground to raise his banner on. The ashes keep
      // their place and the avenger bides his time beyond the border — he
      // comes only if the wilds ever reopen.
      state.camp = c;
      c.avengerAt = state.tick + 2000;
      return;
    }
    logEvent(state, `${name.toUpperCase()} HAS COME. ${pron(name).He} remembers the burning. ${pron(name).He} will take no gold.`, 'raid');
    emit('avenger-come', state.camp);
  }
  // spared folk drift to your gates in the years after a punitive burning —
  // but not from ashes: a later massacre ends the drift with everything else
  if (!c.gone && c.settlersLeft > 0 && state.tick >= c.nextSettlerAt) {
    c.settlersLeft--;
    c.nextSettlerAt = state.tick + Math.floor(CAMP.settlerGapTicks * (1 + rand()));
    const v = makeVillager(state);
    state.villagers.push(v);
    let line = `${v.name} comes to your gates from ${c.name} — spared, and remembering it.`;
    if (rand() < CAMP.settlerSkillChance) {
      const crafts = ['farm', 'lumber', 'quarry', 'smelter', 'bakery'];
      const craft = crafts[Math.floor(rand() * crafts.length)];
      v.skills[craft] = Math.min(SKILL.max, 0.5 + rand() * 0.35);
      line = `${v.name} comes to your gates from ${c.name} — a skilled hand at the ${craft}, spared, and remembering it.`;
    }
    logEvent(state, line, 'good');
  }
}

// The border swallowed the camp's ground: the warlord will not stay inside
// another man's fence. The whole camp — tents, folk, swords, hoard — is
// struck and raised again on open wilds, and his shadow moves with it.
function relocateCamp(state, c, rand) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  if (!keep) return;
  const site = findCampSite(state, keep, { x: c.x, y: c.y });
  if (!site) {
    // TOTAL DOMINION: the realm has swallowed every wild corner, and a camp
    // cannot stand inside the fence. Driven from the land entirely — hoard
    // and all. No new camp can form until the wilds reopen (findCampSite
    // gates every founding), so raids fall back to opportunist edge bands.
    disbandCamp(state, c);
    return;
  }
  const from = c.name;
  c.x = site.x; c.y = site.y;
  c.tents = buildTents(state, site);
  // everyone re-pitches among the new tents
  for (let i = 0; i < c.folk.length; i++) {
    const f = c.folk[i];
    if (f.dead || f.escaped) continue;
    const t = c.tents[1 + (i % Math.max(1, c.tents.length - 1))] || c.tents[0];
    f.x = t.x + (rand() - 0.5); f.y = t.y + 0.8 + (rand() - 0.5) * 0.5;
    f.px = f.x; f.py = f.y;
  }
  for (const g of c.garrison) {
    const t = c.tents[g.id % c.tents.length] || c;
    g.x = t.x + (rand() - 0.5) * 2; g.y = t.y + 1 + (rand() - 0.5);
    g.px = g.x; g.py = g.y;
  }
  if (c.warlord.home) {
    c.warlord.x = c.x; c.warlord.y = c.y - 0.6;
    c.warlord.px = c.warlord.x; c.warlord.py = c.warlord.y;
  }
  clearMassing(state);
  c.massers = [];
  state.campDirty = true;
  logEvent(state,
    c.unclaimed || !c.warlord.name
      ? `Your border has swallowed the ground at ${from} — the brigands strike their tents and make camp deeper in the wilds.`
      : `Your border has swallowed the ground at ${from} — ${c.warlord.name} strikes ${pron(c.warlord.name).his} tents and raises them again, deeper in the wilds.`,
    'raid');
  emit('camp-moved', c);
}

// The realm owns every wild corner: there is no ground left to pitch tents on.
// The camp is struck for good and its people quit the land — the warlord takes
// his hoard with him (you drove him out; you did not take it). A wave that was
// gathering here scatters by the standing invariant in raidTick (a camp gone
// mid-gathering never re-homes on a map edge).
function disbandCamp(state, c) {
  state.camp = null;
  state.campDirty = true;
  logEvent(state,
    c.unclaimed || !c.warlord.name
      ? `The brigands of ${c.name} find no wild ground left in all the realm. They scatter and quit the land.`
      : `${c.warlord.name} finds no wild ground left in all the realm. ${pron(c.warlord.name).He} strikes ${pron(c.warlord.name).his} tents and quits the land — hoard and all.`,
    'good');
  emit('camp-disbanded', c);
}

// ── The expedition ─────────────────────────────────────────────────
function expSoldiers(state) {
  return state.soldiers.filter((s) => s.exp && s.hp > 0);
}

// roads carry the host at road speed — and a bridge tile marches like road
// (the terrain beneath is water, move ∞: reading it raw stalls the column)
function followPath(state, u, path, speed, roads) {
  const N = MAP.size;
  if (u.expI >= path.length) return true;
  const next = path[u.expI];
  const nx = next % N, ny = (next / N) | 0;
  const sp = roads && roads.has(next)
    ? speed * ROAD_SPEED_MULT
    : speed / TERRAIN_INFO[state.terrain[next]].move;
  const dx = nx - u.x, dy = ny - u.y;
  const d = Math.hypot(dx, dy);
  if (d <= sp) { u.x = nx; u.y = ny; u.expI++; }
  else { u.x += (dx / d) * sp; u.y += (dy / d) * sp; }
  return u.expI >= path.length;
}

function expeditionTick(state, rand) {
  const exp = state.expedition;
  const c = state.camp;
  const host = expSoldiers(state);

  // the whole host is dead or home — the expedition is over
  if (!host.length) {
    if (exp.phase !== 'return' || exp.lost >= exp.startCount) {
      logEvent(state, 'None came back from the march.', 'bad');
    }
    // the host died among the tents: the gathering it was fighting stands down
    // to scenery and its wave marches as it always would have
    releaseGatheredWave(state);
    state.expedition = null;
    return;
  }

  if (exp.phase === 'march') {
    const roads = roadTiles(state);
    let anyNearCamp = false;
    for (const s of host) {
      s.px = s.x; s.py = s.y;
      followPath(state, s, exp.path, SOLDIER.speed, roads);
      if (c && Math.hypot(s.x - c.x, s.y - c.y) < CAMP.battleRadius) anyNearCamp = true;
    }
    if (!c || c.gone) { startReturn(state, 'The camp was gone before the host arrived.'); return; }
    if (anyNearCamp) {
      exp.phase = 'battle';
      if (!exp.battleLogged) {
        exp.battleLogged = true;
        // count the swords defending BEFORE the killing starts — the spoils of
        // the camp (weapons off the dead) are reckoned against this, not the
        // empty ground left after the battle
        exp.battleGarrison = c.garrison.length;
        // THE PREEMPTIVE STRIKE: if a wave was gathering at these tents, it is
        // standing right here — and it turns to meet the host. The scenery
        // becomes bodies you have to kill. Win, and that wave never marches.
        const joined = joinMassers(state, c, rand);
        logEvent(state, joined
          ? `The host falls upon ${c.name} — and the war-band gathered at the tents turns to meet them!`
          : `The host falls upon ${c.name}! Battle is joined at the tents.`, 'raid');
        emit('expedition-battle', { camp: c, massers: joined });
      }
    }
  } else if (exp.phase === 'battle') {
    battleTick(state, rand);
  } else if (exp.phase === 'massacre') {
    massacreTick(state, rand);
  } else if (exp.phase === 'return') {
    const roads = roadTiles(state);
    for (const s of [...host]) {
      s.px = s.x; s.py = s.y;
      if (followPath(state, s, exp.returnPath, SOLDIER.speed, roads)) {
        s.exp = false; delete s.expI;   // home — back under the keep's command
      }
    }
    if (!state.soldiers.some((so) => so.exp)) {
      const r = exp.report || 'The host returns through the gates.';
      logEvent(state, r, 'info');
      state.expedition = null;
    }
  }
  // 'choice' phase: the host stands in the taken camp, awaiting your word
}

// the gathered wave gets saga names too, in the raiders' style
const MASSER_EPITHET = [
  'Redknife', 'the Cruel', 'Wolfjaw', 'Nine-Fingers', 'the Vulture',
  'Bloodbraid', 'the Lame', 'Ironmaw', 'the Quiet Blade', 'Corpsegrin',
  'the Burned', 'Longreach', 'Two-Axe', 'the Hollow', 'Ratbane',
];

// The gathered wave takes the field. Kept in a BATTLE-ONLY array (c.massers)
// rather than folded into c.garrison: the garrison drives the iron spoils
// reckoning, the refill target, and what survives a punitive burning — none of
// which should count men who were never garrison. Cleared on every exit.
function joinMassers(state, c, rand) {
  const raid = state.raid;
  const n = c.massingCount || 0;
  if (raid.phase !== 'quiet' || !(raid.stage >= 1) || raid.nextFromCamp !== true || n <= 0) {
    clearMassing(state);
    return 0;
  }
  // the warlord of a dread wave is already a defender when he is home —
  // liveDefenders adds him; don't hand him a second body
  const spots = c.massing || [];
  c.massers = [];
  for (let i = 0; i < n; i++) {
    const id = state.nextId++;
    const spot = spots[i % Math.max(1, spots.length)] ||
      { x: c.x, y: c.y + 1.6 };
    c.massers.push({
      id, masser: true,
      name: `${WARLORD_FIRST[id % WARLORD_FIRST.length]} ${MASSER_EPITHET[(id * 11) % MASSER_EPITHET.length]}`,
      hp: RAIDER.hp,
      x: spot.x + (rand() - 0.5) * 0.6, y: spot.y + (rand() - 0.5) * 0.6,
      px: 0, py: 0,
    });
    c.massers[i].px = c.massers[i].x;
    c.massers[i].py = c.massers[i].y;
  }
  // the bodies you now fight REPLACE the scenery (count stays: it is the
  // pending wave's size, and the victory branch reads it to know what it cancelled)
  c.massing = [];
  state.expedition.massersJoined = n;
  return n;
}

function liveDefenders(c) {
  const d = c.garrison.filter((g) => g.hp > 0);
  for (const m of c.massers || []) if (m.hp > 0) d.push(m);
  if (c.warlord.home && !c.leaderless && c.warlord.hp > 0) d.push(c.warlord);
  return d;
}

// The gathered wave died on its own ground: it will never march. The pending
// raid goes back to a fresh quiet gap — the same formula that follows any raid.
// A wave forming at a random map edge is untouched: it was never at the tents.
function cancelGatheredWave(state, rand) {
  const c = state.camp;
  const exp = state.expedition;
  const raid = state.raid;
  const joined = exp?.massersJoined || 0;
  if (c) { c.massers = []; }
  if (!joined || raid.phase !== 'quiet' || raid.nextFromCamp !== true) {
    if (c) clearMassing(state);
    if (exp) exp.massersJoined = 0;
    return;
  }
  raid.stage = null;
  raid.nextFromCamp = undefined;
  raid.timer = quietGap(state, rand, raid.lastSacked || 0);
  clearMassing(state);
  exp.massersJoined = 0;
  logEvent(state, 'The wave that gathered at the tents will never march.', 'good');
}

// The assault broke against them: the surviving gathering stands down to
// scenery again and the held countdown runs on. The wave still marches, from
// the camp, on schedule — a repulsed strike buys the kingdom nothing.
function releaseGatheredWave(state) {
  const c = state.camp;
  const exp = state.expedition;
  if (!c || !exp?.massersJoined) return;
  const alive = (c.massers || []).filter((m) => m.hp > 0);
  c.massing = alive.slice(0, 18).map((m) => ({ x: m.x, y: m.y, px: m.x, py: m.y }));
  c.massingCount = alive.length;
  c.massers = [];
  exp.massersJoined = 0;   // releases the timer hold (massingUnderAssault)
}

function battleTick(state, rand) {
  const exp = state.expedition;
  const c = state.camp;
  const host = expSoldiers(state);
  const defenders = liveDefenders(c);

  // victory: the camp is taken — the choice is yours, sovereign
  if (!defenders.length) {
    exp.phase = 'choice';
    logEvent(state, `${c.name} is TAKEN. The garrison is slain. ${c.warlord?.name && !c.unclaimed ? pron(c.warlord.name).His : 'Its'} people cower among the tents.`, 'good');
    cancelGatheredWave(state, rand);
    emit('camp-victory', {
      camp: c, warlordSlain: exp.warlordSlain, wasHome: exp.warlordWasHome,
      leaderless: c.leaderless, unclaimed: c.unclaimed,
      folk: c.folk.filter((f) => !f.dead).length,
      gold: Math.round(c.ledger.gold), plunder: Math.round(c.ledger.plunder),
    });
    return;
  }
  if (exp.warlordWasHome === undefined) exp.warlordWasHome = c.warlord.home && !c.leaderless;

  // rout: half the host down → the survivors turn for home
  if (!exp.routed && exp.lost >= Math.ceil(exp.startCount * CAMP.routFrac)) {
    exp.routed = true;
    // the gathering survived the assault — it re-forms at the tents and the
    // clock is released: that wave marches on schedule, from the camp, as before
    releaseGatheredWave(state);
    state.raid.timer = Math.min(state.raid.timer, 150);   // he smells weakness
    startReturn(state,
      `The assault on ${c.name} is REPULSED — ${exp.lost} of ${exp.startCount} lost. The warlord is emboldened.`);
    return;
  }

  // defenders rush whoever is closest, but never stray far from the tents
  for (const g of defenders) {
    g.px = g.x; g.py = g.y;
    let near = null, nd = Infinity;
    for (const s of host) {
      const d = Math.hypot(s.x - g.x, s.y - g.y);
      if (d < nd) { nd = d; near = s; }
    }
    const fromCamp = Math.hypot(g.x - c.x, g.y - c.y);
    if (near && nd < CAMP.alertRadius && fromCamp < CAMP.battleRadius + 3) {
      if (nd > 1.0) {
        const dx = near.x - g.x, dy = near.y - g.y;
        g.x += (dx / nd) * RAIDER.speed; g.y += (dy / nd) * RAIDER.speed;
      }
    } else if (fromCamp > 2.5) {
      g.x += (c.x - g.x) * 0.04; g.y += (c.y - g.y) * 0.04;
    }
  }

  // the same probabilistic exchanges as home — but this is HIS ground:
  // no home-ground bonus, no tower cover, and his gang presses hard.
  const forceRatio = Math.min(1, defenders.length / Math.max(1, host.length));
  const cover = new Map();
  for (const s of host) {
    s.px = s.px ?? s.x; s.py = s.py ?? s.y;
    s.px = s.x; s.py = s.y;
    let target = null, td = Infinity;
    for (const g of defenders) {
      if (g.hp <= 0) continue;
      const d = Math.hypot(g.x - s.x, g.y - s.y) + (cover.get(g) || 0) * COMBAT.coverPenalty;
      if (d < td) { td = d; target = g; }
    }
    if (!target) continue;
    cover.set(target, (cover.get(target) || 0) + 1);
    const dist = Math.hypot(target.x - s.x, target.y - s.y);
    const skill = soldierSkill(state, s);

    if (dist < 1.1) {
      const crit = rand() < COMBAT.baseCrit + skill * COMBAT.critSkillScale;
      target.hp -= SOLDIER.dmg * (1 + skill) * (crit ? COMBAT.critMult : 1);
      if (target.hp <= 0) {
        exp.slain++;
        if (target === c.warlord) {
          exp.warlordSlain = true;
          logEvent(state, `${c.warlord.name.toUpperCase()} FALLS at ${pron(c.warlord.name).his} own hall${crit ? ' — a mighty blow' : ''}!`, 'good');
        }
      }

      let gang = 0;
      for (const g of defenders) { if (g.hp > 0 && Math.hypot(g.x - s.x, g.y - s.y) < 1.6) gang++; }
      // the warlord in your face is worth two men
      if (c.warlord.home && c.warlord.hp > 0 && Math.hypot(c.warlord.x - s.x, c.warlord.y - s.y) < 1.6) gang++;
      let woundChance = COMBAT.woundBase * Math.min(3, Math.max(0.5, gang));
      woundChance *= (1 - COMBAT.woundSkillReduce * skill);
      if (rand() < woundChance) {
        s.hp -= COMBAT.woundHp;
        if (s.hp <= soldierMaxHp(s) * COMBAT.killWoundedFrac) {
          let killChance = COMBAT.killChanceGood +
            (COMBAT.killChanceBad - COMBAT.killChanceGood) * forceRatio;
          killChance *= (1 - COMBAT.veteranKillResist * skill);
          const v = s.merc ? null : state.villagers.find((vl) => vl.id === s.villagerId);
          if (v?.marked) killChance *= (1 - CAMP.markedKillResist);
          if (s.hp <= 0 || rand() < killChance) s.hp = 0;
        }
      }
    } else {
      const dx = target.x - s.x, dy = target.y - s.y;
      const d = Math.max(0.001, dist);
      s.x += (dx / d) * SOLDIER.speed; s.y += (dy / d) * SOLDIER.speed;
    }
  }

  // the fallen, far from home
  for (const s of [...state.soldiers]) {
    if (!s.exp || s.hp > 0) continue;
    exp.lost++;
    state.soldiers.splice(state.soldiers.indexOf(s), 1);
    if (s.merc) {
      logEvent(state, `A mercenary falls before the tents of ${c.name}.`, 'bad');
      continue;
    }
    const v = state.villagers.find((vl) => vl.id === s.villagerId);
    if (v) {
      // the same reckoning as a death at home: a veteran counts as a veteran
      // fallen, and a master's craft dies with them wherever they fall
      const wasMaster = isMaster(v);
      state.stats.soldiersFallen++;
      if (wasMaster) { state.stats.veteransFallen++; state.stats.mastersLost++; }
      killVillager(state, v);
      logEvent(state, `${v.name} falls before the tents of ${c.name}, far from home.`, 'bad');
    }
  }
  c.garrison = c.garrison.filter((g) => g.hp > 0);
  if (c.massers?.length) c.massers = c.massers.filter((m) => m.hp > 0);
}

function startReturn(state, line) {
  const exp = state.expedition;
  const host = expSoldiers(state);
  const keep = state.buildings.find((b) => b.type === 'keep');
  const from = host[0] || { x: keep.x, y: keep.y };
  exp.returnPath = findPath(state, Math.round(from.x), Math.round(from.y), keep.x, keep.y) || [];
  for (const s of host) s.expI = 0;
  exp.phase = 'return';
  if (line) { exp.report = null; logEvent(state, line, 'bad'); }
}

// ── The choice ─────────────────────────────────────────────────────
// At the moment of victory, standing in his camp: take back what is yours,
// or leave nothing standing. This is the whole point.
export function resolveCampChoice(state, choice) {
  const exp = state.expedition;
  const c = state.camp;
  if (!exp || exp.phase !== 'choice' || !c) return { ok: false, reason: 'No choice stands' };

  // nothing gathers at a taken camp: no props left to animate, no bodies left
  // to fight (the victory branch already cancelled the wave, but a save loaded
  // mid-choice or an unclaimed nest path could still be carrying them)
  clearMassing(state);
  c.massers = [];

  // either way, the hoard comes home: your gold, and his plunder as grain carts
  const gold = Math.round(c.ledger.gold);
  const grain = Math.round(c.ledger.plunder);
  state.res.gold += gold;
  state.res.food += grain;
  const ledgerEmpty = gold <= 0 && grain <= 0;
  c.ledger.gold = 0; c.ledger.plunder = 0;

  // even a broke camp is worth the taking: arm-rings, stores, and the weapons
  // stripped off the fallen garrison. Reckoned the same for punish or massacre.
  const sp = CAMP.spoils;
  const garrisonAtBattle = exp.battleGarrison || 0;
  const spoilGold = sp.gold;
  const spoilFood = sp.food;
  const spoilWood = sp.wood;
  const spoilIron = Math.round(sp.ironPerSword * garrisonAtBattle);
  state.res.gold += spoilGold;
  state.res.food += spoilFood;
  state.res.wood = (state.res.wood || 0) + spoilWood;
  state.res.iron = (state.res.iron || 0) + spoilIron;
  const takeGold = gold + spoilGold;
  const takeGoods = grain + spoilFood;

  // the warlord slain in the assault: his camp will one day find a successor
  if (exp.warlordSlain) {
    c.leaderless = true;
    c.successorAt = state.tick + CAMP.successorTicks;
  }

  if (choice === 'punish') {
    c.broken = true;
    c.brokenUntil = state.tick + CAMP.brokenTicks;
    c.garrison = [];
    c.settlersLeft = CAMP.settlerMax;   // mercy pays in people, over the years
    c.nextSettlerAt = state.tick + CAMP.settlerGapTicks;
    state.stats.campsBroken = (state.stats.campsBroken || 0) + 1;
    state.campDirty = true;
    logEvent(state, ledgerEmpty
      ? `The war-tents of ${c.name} burn. The camp itself is stripped — arm-rings and weapons off the dead: ${takeGold} gold, ${takeGoods} goods. The folk are spared — and they will remember.`
      : `The war-tents of ${c.name} burn. The hoard comes home, and the camp is stripped: ${takeGold} gold, ${takeGoods} goods. The folk are spared — and they will remember.`,
      'good');
    exp.report = `The host returns from ${c.name} with the hoard. Justice, not slaughter.`;
    startReturn(state, null);
    emit('camp-resolved', { choice, gold, grain });
    return { ok: true };
  }

  if (choice === 'massacre') {
    exp.phase = 'massacre';
    state.stats.massacres = (state.stats.massacres || 0) + 1;
    // one always slips away — scripted, remembered, returned
    const alive = c.folk.filter((f) => !f.dead);
    if (alive.length) {
      const survivor = alive[Math.floor(alive.length / 2)];
      survivor.survivor = true;
    }
    exp.massacreStart = state.tick;   // fate's clock — see massacreTick
    for (const f of alive) {
      // flee radially away from the camp's heart…
      const dx = f.x - c.x || 0.5, dy = f.y - c.y || 0.3;
      const d = Math.hypot(dx, dy);
      f.fleeX = dx / d; f.fleeY = dy / d;
      // …but never into a map corner. A heading that would clamp against the
      // edge short of the escape distance is reflected inward — the Wyrmditch
      // lesson: a camp at (10,117) pinned its survivor at hypot(9,9)≈12.7,
      // just under the 13-tile escape radius, the massacre never resolved,
      // and the whole host stood at the ashes forever.
      const N = MAP.size;
      if (c.x + f.fleeX * 15 < 2 || c.x + f.fleeX * 15 > N - 3) f.fleeX = -f.fleeX;
      if (c.y + f.fleeY * 15 < 2 || c.y + f.fleeY * 15 > N - 3) f.fleeY = -f.fleeY;
    }
    logEvent(state, ledgerEmpty
      ? `The camp is stripped bare — arm-rings and weapons off the dead: ${takeGold} gold, ${takeGoods} goods.`
      : `The hoard is seized and the camp stripped: ${takeGold} gold, ${takeGoods} goods.`, 'good');
    logEvent(state, `The order is given. Leave nothing standing at ${c.name}.`, 'bad');
    emit('camp-resolved', { choice, gold, grain });
    return { ok: true };
  }
  return { ok: false, reason: 'Unknown choice' };
}

// The massacre plays out ON SCREEN: the camp folk scatter and your soldiers
// run them down — the same hunt that has been used against your own people
// all game, pointed the other way. One survivor always slips through.
function massacreTick(state, rand) {
  const exp = state.expedition;
  const c = state.camp;
  const host = expSoldiers(state);
  const fleeing = c.folk.filter((f) => !f.dead && !f.escaped);
  // fate's clock: the survivor ALWAYS gets away eventually, even where the
  // map's edge leaves no room to run the full escape distance (a normal
  // escape takes ~15 ticks; this also frees any save carried in mid-stall)
  exp.massacreStart ??= state.tick;
  const fateEscape = state.tick - exp.massacreStart > 60;

  for (const f of fleeing) {
    f.px = f.x; f.py = f.y;
    const speed = f.survivor ? 0.9 : 0.5;
    f.x += f.fleeX * speed; f.y += f.fleeY * speed;
    const N = MAP.size;
    f.x = Math.max(1, Math.min(N - 2, f.x)); f.y = Math.max(1, Math.min(N - 2, f.y));
    if (f.survivor && (Math.hypot(f.x - c.x, f.y - c.y) > 13 || fateEscape)) {
      f.escaped = true;
      const first = f.name.split(',')[0];
      logEvent(state, `One slips through the reeds — ${f.name}. Remember the name: ${first}.`, 'raid');
      c.avengerName = `${first} the Ash-Sworn`;
      (state.avengerNames ||= []).push(first);
    }
  }

  // soldiers run down the nearest of the fleeing (never the survivor — fate
  // keeps that one; a soldier is always "a step behind")
  const prey = fleeing.filter((f) => !f.survivor);
  for (const s of host) {
    s.px = s.x; s.py = s.y;
    let near = null, nd = Infinity;
    for (const f of prey) {
      if (f.dead) continue;
      const d = Math.hypot(f.x - s.x, f.y - s.y);
      if (d < nd) { nd = d; near = f; }
    }
    if (!near) continue;
    if (nd < 0.7) {
      near.dead = true;
      state.stats.folkSlain = (state.stats.folkSlain || 0) + 1;
      logEvent(state, `${near.name}, is cut down in the open.`, 'bad');
    } else {
      const dx = near.x - s.x, dy = near.y - s.y;
      s.x += (dx / nd) * SOLDIER.speed; s.y += (dy / nd) * SOLDIER.speed;
    }
  }

  // done when every soul is dead or the survivor is away
  const unresolved = c.folk.some((f) => !f.dead && !f.escaped);
  if (!unresolved) finishMassacre(state, rand);
}

function finishMassacre(state) {
  const exp = state.expedition;
  const c = state.camp;
  c.gone = true;
  c.tents = [];
  c.burnedXY = { x: c.x, y: c.y };
  c.garrison = [];
  clearMassing(state);
  c.massers = [];
  state.campDirty = true;
  const toll = c.folk.filter((f) => f.dead).length;
  c.avengerAt = state.tick + CAMP.avengerTicks;
  if (!c.avengerName) c.avengerName = 'the Ash-Sworn';

  // the men who did it come home changed
  let marked = 0;
  for (const s of state.soldiers) {
    if (!s.exp || s.merc || s.hp <= 0) continue;
    const v = state.villagers.find((vl) => vl.id === s.villagerId);
    if (v && !v.marked) { v.marked = true; marked++; }
  }
  logEvent(state, `${c.name} is no more. ${toll} souls. The Chronicle will keep their names even if you will not.`, 'bad');
  if (marked) {
    logEvent(state, `${marked} of your soldiers come home marked by the burning. Nothing frightens them now — and they will never lay down the sword.`, 'bad');
  }
  exp.report = `The host returns from the ashes of ${c.name}. No songs are sung.`;
  startReturn(state, null);
  emit('massacre-done', { camp: c, toll });
}
