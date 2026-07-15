import { MAP, T, TERRAIN_INFO, BUILDINGS, RAIDER, RAID, SOLDIER, ROAD_SPEED_MULT, KEEP, COMBAT, SKILL } from '../config.js';
import { idx } from './state.js';
import { prosperity } from './economy.js';
import { logEvent, emit } from './events.js';
import { killVillager, isMaster } from './villagers.js';

// ── A* over the tile grid ──────────────────────────────────────────
function wallSet(state) {
  const s = new Set();
  for (const b of state.buildings) {
    // a breached wall is rubble — it no longer bars the way (raiders walk through)
    if (b.type === 'wall' && b.hp > 0 && !b.breached) s.add(idx(b.x, b.y));
  }
  return s;
}

class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export function findPath(state, fx, fy, tx, ty) {
  const N = MAP.size;
  const walls = wallSet(state);
  const moveCost = (i) => {
    const base = TERRAIN_INFO[state.terrain[i]].move;
    if (!isFinite(base)) return Infinity;
    return walls.has(i) ? base + 30 : base; // batter through if no way around
  };
  const start = fy * N + fx, goal = ty * N + tx;
  const g = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  g[start] = 0;
  const h = (i) => Math.abs((i % N) - tx) + Math.abs(((i / N) | 0) - ty);
  const heap = new MinHeap();
  heap.push({ i: start, f: h(start) });
  const DIRS = [1, -1, N, -N];
  let guard = 0;
  while (heap.size && guard++ < 60000) {
    const { i } = heap.pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === goal) break;
    const x = i % N;
    for (const d of DIRS) {
      const n = i + d;
      if (n < 0 || n >= N * N) continue;
      if ((d === 1 && x === N - 1) || (d === -1 && x === 0)) continue;
      if (closed[n]) continue;
      const c = moveCost(n);
      if (!isFinite(c)) continue;
      const ng = g[i] + c;
      if (ng < g[n]) {
        g[n] = ng;
        came[n] = i;
        heap.push({ i: n, f: ng + h(n) });
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const path = [];
  let cur = goal;
  while (cur !== -1 && cur !== start) { path.push(cur); cur = came[cur]; }
  path.reverse();
  return path;
}

// ── Raid lifecycle ─────────────────────────────────────────────────
export function raidTick(state, rand) {
  const raid = state.raid;

  if (raid.phase === 'quiet') {
    raid.timer--;
    if (raid.timer <= 0) {
      raid.phase = 'warning';
      raid.timer = RAID.warningTicks;
      logEvent(state, 'Raiders sighted on the horizon! Sound the horn!', 'raid');
      emit('raid-warning');
    }
  } else if (raid.phase === 'warning') {
    raid.timer--;
    if (raid.timer <= 0) spawnRaid(state, rand);
  } else if (raid.phase === 'active') {
    updateRaiders(state, rand);
    updateTowers(state);
    // raiders don't winter over: when the season's looting is done they go home,
    // so even an undefended kingdom is wounded, not besieged forever. The clock
    // starts when pillaging starts — the march in doesn't count — with a hard
    // backstop in case a wave gets stuck pathing and never arrives.
    const lootingLong = raid.lootStartTick && state.tick - raid.lootStartTick > RAID.maxRaidTicks;
    const stuckLong = state.tick - (raid.startTick || 0) > RAID.maxRaidTicks * 3;
    if ((lootingLong || stuckLong) && raid.raiders.some((rd) => rd.mode !== 'flee')) {
      for (const rd of raid.raiders) if (rd.mode !== 'flee') startFlee(state, rd);
      logEvent(state, 'Their sacks full, the raiders melt back into the wilds.', 'info');
    }
    if (raid.raiders.length === 0) endRaid(state, rand);
  }

  updateSoldiers(state, rand);
}

function spawnRaid(state, rand) {
  const raid = state.raid;
  const N = MAP.size;
  raid.wave++;
  raid.startTick = state.tick;
  raid.lootStartTick = 0;
  raid.keepBesieged = false;

  // wave size rides prosperity and your army; a raid that hurt last time
  // eases this one (rubber-band mercy), a fat unscathed kingdom gets none
  let sizeF = RAID.sizeBase + prosperity(state) / RAID.prosperityDivisor
    + state.soldiers.length * RAID.militaryPressure;
  const ease = 1 - (raid.lastSacked || 0) * RAID.easeAfterSack;
  sizeF *= Math.max(RAID.minSizeMult, Math.min(1.2, ease));

  // warlords: a dread wave on a cadence, once the kingdom is worth the march
  const isWarlord = RAID.warlordEveryWaves > 0 && state.pop >= RAID.warlordMinPop &&
    raid.wave % RAID.warlordEveryWaves === 0;
  if (isWarlord) sizeF *= RAID.warlordSizeMult;
  const size = Math.min(RAID.sizeCap, Math.max(1, Math.round(sizeF)));
  raid.sackedThisRaid = 0;

  // pick a land tile on the map edge
  let sx = 0, sy = 0, tries = 0;
  do {
    const side = Math.floor(rand() * 4);
    const t = Math.floor(rand() * N);
    sx = side === 0 ? 0 : side === 1 ? N - 1 : t;
    sy = side === 2 ? 0 : side === 3 ? N - 1 : t;
  } while (state.terrain[sy * N + sx] === T.WATER && tries++ < 100);

  raid.raiders = [];
  for (let i = 0; i < size; i++) {
    const target = pickTarget(state, rand);
    if (!target) break;
    const path = findPath(state, sx, sy, target.x, target.y);
    if (!path) continue;
    raid.raiders.push({
      x: sx + (rand() - 0.5), y: sy + (rand() - 0.5), px: sx, py: sy,
      hp: (RAIDER.hp + raid.wave * 2) * (isWarlord ? RAID.warlordHpMult : 1),
      loot: 0,
      path, pathI: 0, mode: 'march', targetId: target.id,
      spawn: { x: sx, y: sy },
    });
  }
  if (!raid.raiders.length) { endRaid(state, rand); return; }
  raid.phase = 'active';
  state.stats.raids++;
  if (isWarlord) state.stats.warlords++;
  state.stats.raidSizes.push(raid.raiders.length);
  logEvent(state, isWarlord
    ? `A WARLORD marches on ${state.name} with ${raid.raiders.length} raiders!`
    : `${raid.raiders.length} raiders storm in from the wilds!`, 'raid');
}

function pickTarget(state, rand) {
  const value = (b) => {
    if (b.type === 'market') return 6;
    if (b.type === 'keep') return 5;
    if (b.type === 'smelter' || b.type === 'bakery') return 4;
    if (b.type === 'wall' || b.type === 'tower') return 0.2;
    if (b.type === 'road') return 0.05;
    return 1.5;
  };
  // an already-gutted building isn't worth sacking again
  const cands = state.buildings.filter((b) => b.hp > b.maxHp * RAID.abandonHpFrac);
  if (!cands.length) return null;
  let total = 0;
  for (const b of cands) total += value(b);
  let r = rand() * total;
  for (const b of cands) {
    r -= value(b);
    if (r <= 0) return b;
  }
  return cands[cands.length - 1];
}

function updateRaiders(state, rand) {
  const raid = state.raid;
  const N = MAP.size;
  for (const rd of raid.raiders) {
    rd.px = rd.x; rd.py = rd.y;
    if (rd.hp <= 0) continue;

    if (rd.mode === 'march' || rd.mode === 'flee') {
      if (rd.pathI >= rd.path.length) {
        if (rd.mode === 'flee') { rd.mode = 'gone'; continue; }
        rd.mode = 'loot';
        continue;
      }
      if (rd.mode === 'march' && rd.pathI >= rd.path.length - 1 && !raid.lootStartTick) {
        raid.lootStartTick = state.tick; // the pillaging clock starts on arrival
      }
      const next = rd.path[rd.pathI];
      const nx = next % N, ny = (next / N) | 0;
      // an intact wall in the way → batter it; a breached one is passable rubble
      const wall = state.buildings.find(
        (b) => b.x === nx && b.y === ny && b.hp > 0 && b.type === 'wall' && !b.breached);
      if (wall && rd.mode === 'march') {
        wall.hp -= RAIDER.dmg;
        state.buildingsDirty = true;
        if (wall.hp <= 0) {
          // walls breach, they don't vanish: left as rubble at 1 HP, repairable
          // in place. Raiders pour through; builders can wall it back up.
          wall.hp = 1;
          wall.breached = true;
          state.stats.wallsBreached++;
          logEvent(state, 'A wall is breached! Raiders pour through the gap!', 'raid');
        }
        continue;
      }
      const speed = RAIDER.speed / TERRAIN_INFO[state.terrain[next]].move;
      const dx = nx - rd.x, dy = ny - rd.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= speed) { rd.x = nx; rd.y = ny; rd.pathI++; }
      else { rd.x += (dx / d) * speed; rd.y += (dy / d) * speed; }
    } else if (rd.mode === 'loot') {
      const target = state.buildings.find((b) => b.id === rd.targetId && b.hp > 0);
      if (!target) { retargetOrFlee(state, rd, rand); continue; }
      // steal from the richest stockpile
      let best = null, bestAmt = 0;
      for (const r of ['gold', 'iron', 'bread', 'food', 'wood', 'stone', 'ore']) {
        if (state.res[r] > bestAmt) { best = r; bestAmt = state.res[r]; }
      }
      if (best && bestAmt > 0.5) {
        const take = Math.min(2, state.res[best]);
        state.res[best] -= take;
        rd.loot += take;
      }
      // the keep is the kingdom's heart — raiders reaching it sound the alarm
      // and every soldier rushes to its defense (a grace window to hold)
      if (target.type === 'keep' && !raid.keepBesieged) {
        raid.keepBesieged = true;
        logEvent(state, `The raiders are storming the KEEP! Rally to ${state.name}!`, 'raid');
        state.raidShock = Math.min(40, state.raidShock + 12);
        emit('keep-besieged');
      }
      // grind the building down — raiders SACK capacity, they don't raze it.
      // The wound is measured in lost output-days, not rubble.
      target.hp -= RAID.lootDmg;
      state.raidShock = Math.min(30, state.raidShock + 0.3);
      state.buildingsDirty = true;
      if (target.hp <= target.maxHp * RAID.abandonHpFrac) {
        target.hp = Math.max(1, target.maxHp * RAID.abandonHpFrac);
        if (!target.sacked) {
          target.sacked = true;
          raid.sackedThisRaid = (raid.sackedThisRaid || 0) + 1;
          if (target.type !== 'keep') state.stats.buildingsSacked++;
          // the keep falling is a catastrophe of its own — a dark age, not a
          // routine sack (but the realm survives and rebuilds from it)
          if (target.type === 'keep') {
            state.stats.keepFalls++;
            keepDarkAge(state, rand);
          } else {
            logEvent(state, `${BUILDINGS[target.type].name} has been sacked!`, 'raid');
            state.raidShock = Math.min(40, state.raidShock + 8);
            // workers may die in the sacking — but only once per raid per
            // building, so repairing mid-raid can't re-feed the grinder
            if (target.deathRolledWave !== raid.wave) {
              target.deathRolledWave = raid.wave;
              for (const v of [...(target.workers || [])]) {
                if (rand() < RAID.sackDeathChance) {
                  const wasMaster = isMaster(v);
                  if (wasMaster) state.stats.mastersLost++;
                  killVillager(state, v);
                  logEvent(state, wasMaster
                    ? `${v.name}, master ${target.type === 'smelter' ? 'smith' : 'of the ' + target.type}, was slain in the sacking. Years of craft die too.`
                    : `${v.name} was slain defending the ${BUILDINGS[target.type].name.toLowerCase()}.`, 'bad');
                }
              }
            }
          }
        }
        retargetOrFlee(state, rd, rand);
        continue;
      }
      if (rd.loot >= RAIDER.lootCap) startFlee(state, rd);
    }
  }
  raid.raiders = raid.raiders.filter((rd) => rd.hp > 0 && rd.mode !== 'gone');
}

function startFlee(state, rd) {
  rd.mode = 'flee';
  const path = findPath(state, Math.round(rd.x), Math.round(rd.y), rd.spawn.x, rd.spawn.y);
  rd.path = path || [];
  rd.pathI = 0;
}

// after a sacking: move on to the next worthwhile building, or go home sated
function retargetOrFlee(state, rd, rand) {
  if (rd.loot >= RAIDER.lootCap) { startFlee(state, rd); return; }
  const next = pickTarget(state, rand);
  if (!next) { startFlee(state, rd); return; }
  const path = findPath(state, Math.round(rd.x), Math.round(rd.y), next.x, next.y);
  if (!path) { startFlee(state, rd); return; }
  rd.targetId = next.id;
  rd.path = path;
  rd.pathI = 0;
  rd.mode = 'march';
}

// Any building with range+arrowDmg looses arrows on the nearest raider: the
// watchtower, and the keep (its own guard — no garrison needed).
function updateTowers(state) {
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const def = BUILDINGS[b.type];
    if (!def.range || !def.arrowDmg) continue;
    let nearest = null, nd = def.range;
    for (const rd of state.raid.raiders) {
      const d = Math.hypot(rd.x - b.x, rd.y - b.y);
      if (d < nd) { nd = d; nearest = rd; }
    }
    if (nearest) {
      nearest.hp -= def.arrowDmg;
      emit('arrow', { fx: b.x, fy: b.y, tx: nearest.x, ty: nearest.y });
      if (nearest.hp <= 0) {
        state.stats.raidersKilled++;
        logEvent(state, b.type === 'keep'
          ? "A raider falls to the keep's archers."
          : 'A raider falls to tower arrows.', 'good');
      }
    }
  }
}

function updateSoldiers(state, rand) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  const roads = new Set();
  const defenders = [];   // buildings that give covering fire (towers + keep)
  for (const b of state.buildings) {
    if (b.type === 'road' && b.hp > 0) roads.add(idx(b.x, b.y));
    const def = BUILDINGS[b.type];
    if (b.hp > 0 && def.range && def.arrowDmg) defenders.push(b);
  }
  const liveRaiders = state.raid.raiders.filter((r) => r.hp > 0);
  // force-ratio: outnumber the raiders → your soldiers take far less (Finding 8.1)
  const forceRatio = Math.min(1, liveRaiders.length / Math.max(1, state.soldiers.length));
  // a living veteran on the field lets rookies season under fire
  const hasVeteran = state.soldiers.some((so) => {
    const vv = state.villagers.find((v) => v.id === so.villagerId);
    return vv && (vv.skills.soldier || 0) >= COMBAT.veteranSkill;
  });

  for (const s of state.soldiers) {
    s.px = s.x; s.py = s.y;
    const onRoad = roads.has(idx(Math.round(s.x), Math.round(s.y)));
    const speed = SOLDIER.speed * (onRoad ? ROAD_SPEED_MULT : 1);
    const raiders = state.raid.raiders.filter((r) => r.hp > 0);
    if (raiders.length) {
      // when the keep is besieged, every soldier rushes its attackers — target
      // the raider nearest the KEEP, not the one nearest to me
      const anchor = (state.raid.keepBesieged && keep) ? keep : s;
      let nearest = null, nd = Infinity;
      for (const rd of raiders) {
        const d = Math.hypot(rd.x - anchor.x, rd.y - anchor.y);
        if (d < nd) { nd = d; nearest = rd; }
      }
      // distance for the ATTACK check is always soldier→raider
      nd = nearest ? Math.hypot(nearest.x - s.x, nearest.y - s.y) : Infinity;
      if (nd < 1.1) {
        const vet = state.villagers.find((v) => v.id === s.villagerId);
        const skill = vet?.skills.soldier || 0;

        // OFFENSE: strike, with a skill-scaled crit chance (veterans burst)
        const crit = rand() < COMBAT.baseCrit + skill * COMBAT.critSkillScale;
        nearest.hp -= SOLDIER.dmg * (1 + skill) * (crit ? COMBAT.critMult : 1);

        // DEFENSE: does a raider wound this soldier? The danger is how many raiders
        // are ganging THIS soldier right now (spatial force-ratio) — being swarmed
        // is deadly, holding a line where you outnumber them is nearly safe.
        let localGang = 0;
        for (const rd of raiders) { if (Math.hypot(rd.x - s.x, rd.y - s.y) < 1.6) localGang++; }
        let woundChance = COMBAT.woundBase * Math.min(3, Math.max(0.5, localGang)); // each attacker adds risk
        woundChance *= (1 - COMBAT.woundSkillReduce * skill);  // veterans get hit less
        const sx = Math.round(s.x), sy = Math.round(s.y);
        const onHomeGround = state.claimed[idx(sx, sy)];       // real spatial check
        if (onHomeGround) woundChance *= (1 - COMBAT.homeGroundReduce);
        const underCover = defenders.some((b) => Math.hypot(b.x - s.x, b.y - s.y) <= BUILDINGS[b.type].range);
        if (underCover) woundChance *= (1 - COMBAT.towerCoverReduce);

        if (rand() < woundChance) {
          s.hp -= COMBAT.woundHp;
          // KILL only a badly-wounded soldier, and the odds scale with conditions:
          // good ground (outnumbering, covered) → survivable; bad → lethal
          if (s.hp <= SOLDIER.hp * COMBAT.killWoundedFrac) {
            const killChance = COMBAT.killChanceGood +
              (COMBAT.killChanceBad - COMBAT.killChanceGood) * forceRatio;
            if (s.hp <= 0 || rand() < killChance) s.hp = 0;   // dies (culled below)
          }
        }

        // SEASONING: a rookie beside a veteran learns fast under fire
        if (vet && hasVeteran && skill < COMBAT.veteranSkill) {
          vet.skills.soldier = Math.min(SKILL.max,
            (vet.skills.soldier || 0) + SKILL.gainPerTick * (COMBAT.seasonRookieBonus - 1));
        }

        if (nearest.hp <= 0) { state.stats.raidersKilled++; logEvent(state, 'A raider is cut down by your soldiers.', 'good'); }
      } else {
        const dx = nearest.x - s.x, dy = nearest.y - s.y;
        const d = Math.max(0.001, Math.hypot(dx, dy));
        s.x += (dx / d) * speed;
        s.y += (dy / d) * speed;
      }
    } else if (keep) {
      // drift back to a rally point by the keep
      const rx = keep.x + (s.id % 3) - 1, ry = keep.y + 2 + ((s.id / 3) | 0) % 2;
      const dx = rx - s.x, dy = ry - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5) { s.x += (dx / d) * Math.min(speed, d); s.y += (dy / d) * Math.min(speed, d); }
      s.hp = Math.min(SOLDIER.hp, s.hp + 0.4); // rest and mend wounds between raids
    }
  }
  // a fallen soldier is a fallen villager — their skills fall with them
  for (const s of state.soldiers) {
    if (s.hp > 0) continue;
    const vet = state.villagers.find((v) => v.id === s.villagerId);
    if (vet) {
      const wasMaster = isMaster(vet);
      state.stats.soldiersFallen++;
      if (wasMaster) state.stats.veteransFallen++;
      killVillager(state, vet);
      logEvent(state, wasMaster
        ? `${vet.name}, a veteran of many battles, fell defending the realm.`
        : `${vet.name} fell in battle.`, 'bad');
    }
  }
  state.soldiers = state.soldiers.filter((s) => s.hp > 0);
}

// The keep has fallen — a dark age. A one-time catastrophe (stockpiles carried
// off, morale broken, districts gutted, subjects lost) that you climb back out
// of. The keep itself survives at its floor; the realm is not razed (A2).
function keepDarkAge(state, rand) {
  const D = KEEP.darkAge;
  logEvent(state, `THE KEEP HAS FALLEN. ${state.name} enters a dark age.`, 'bad');
  emit('keep-sacked');

  // stockpiles carried off
  for (const r of Object.keys(state.res)) {
    state.res[r] = Math.max(0, state.res[r] * (1 - D.lootFrac));
  }
  // morale broken
  state.morale = Math.min(state.morale, D.moraleFloor);
  state.raidShock = 40;

  // districts gutted — knock the most valuable standing buildings to their floor
  const others = state.buildings
    .filter((b) => b.type !== 'keep' && b.hp > b.maxHp * RAID.abandonHpFrac)
    .sort((a, b) => b.hp - a.hp)
    .slice(0, D.buildingsGutted);
  for (const b of others) {
    b.hp = Math.max(1, b.maxHp * RAID.abandonHpFrac);
    b.sacked = true;
  }
  state.buildingsDirty = true;

  // subjects lost in the storming (never the last soul — the realm endures)
  let toll = 0;
  for (let i = 0; i < D.deaths && state.villagers.length > 1; i++) {
    const v = state.villagers[Math.floor(rand() * state.villagers.length)];
    killVillager(state, v);
    toll++;
  }
  if (toll > 0) {
    logEvent(state, `${toll} ${toll > 1 ? 'souls are' : 'soul is'} lost in the sack of the keep.`, 'bad');
  }
  logEvent(state, 'From the ashes of the keep, the realm must be rebuilt.', 'info');
}

function endRaid(state, rand) {
  const raid = state.raid;
  raid.phase = 'quiet';
  raid.keepBesieged = false;
  raid.lastSacked = raid.sackedThisRaid || 0;
  raid.timer = RAID.minGapTicks + Math.floor(rand() * 200) - Math.min(150, Math.floor(prosperity(state) / 15));
  // rubber-band: a raid that hurt buys quiet ticks to rebuild in
  raid.timer += raid.lastSacked * RAID.mercyPerSack;
  raid.timer = Math.max(120, raid.timer);
  logEvent(state, raid.lastSacked > 0
    ? `The raid is over. ${raid.lastSacked} building${raid.lastSacked > 1 ? 's' : ''} lie sacked — repairs await.`
    : 'The raid is over. The kingdom breathes again.', 'info');
}

export function recruitSoldier(state) {
  const barracks = state.buildings.filter((b) => b.type === 'barracks' && b.hp > 0);
  if (!barracks.length) return { ok: false, reason: 'Build a barracks first' };
  if (state.soldiers.length >= barracks.length * SOLDIER.perBarracks) {
    return { ok: false, reason: 'Barracks are full' };
  }
  // a soldier is a villager under arms, not a coin purchase
  const recruit = state.villagers.find((v) => v.job === 'idle')
    || state.villagers.find((v) => v.job === 'producer');
  if (!recruit) return { ok: false, reason: 'No subject free to serve' };
  for (const [r, amt] of Object.entries(SOLDIER.cost)) {
    if (state.res[r] < amt) return { ok: false, reason: `Not enough ${r}` };
  }
  for (const [r, amt] of Object.entries(SOLDIER.cost)) state.res[r] -= amt;
  recruit.job = 'soldier';
  recruit.workplaceId = null;
  recruit.workType = null;
  state.stats.soldiersRecruited++;
  const b = barracks[0];
  state.soldiers.push({
    id: state.nextId++, villagerId: recruit.id,
    x: b.x, y: b.y + 1, px: b.x, py: b.y + 1, hp: SOLDIER.hp,
  });
  logEvent(state, `${recruit.name} takes up arms.`, 'good');
  return { ok: true };
}

export function dismissSoldier(state) {
  const s = state.soldiers[state.soldiers.length - 1];
  if (!s) return { ok: false, reason: 'No soldiers to dismiss' };
  const vet = state.villagers.find((v) => v.id === s.villagerId);
  if (vet) { vet.job = 'idle'; }
  state.soldiers.pop();
  logEvent(state, vet ? `${vet.name} hangs up the sword and returns to the fields.` : 'A soldier stands down.', 'info');
  return { ok: true };
}
