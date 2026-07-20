import { MAP, T, TERRAIN_INFO, BUILDINGS, RAIDER, RAID, SOLDIER, ROAD_SPEED_MULT, KEEP, COMBAT, SKILL, MERCENARY, HUNT, TRIBUTE, CAMP } from '../config.js';
import { idx } from './state.js';
import { prosperity } from './economy.js';
import { logEvent, emit } from './events.js';
import { killVillager, isMaster, ejectVillager, isSheltered, bestSkill } from './villagers.js';
import { ensureCamp, claimCampByWarlord, warlordAvailable, warlordFell, warlordReturned, addPlunder, addTributeGold } from './camp.js';

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

// road and bridge tiles, for road-aware pathing and marching speed
export function roadTiles(state) {
  const s = new Set();
  for (const b of state.buildings) {
    if ((b.type === 'road' || b.type === 'bridge') && b.hp > 0) s.add(idx(b.x, b.y));
  }
  return s;
}

export function findPath(state, fx, fy, tx, ty) {
  const N = MAP.size;
  const walls = wallSet(state);
  // roads are the arteries of the map: marching a road tile is CHEAPER than
  // open ground, so the pathfinder bends every route onto the network — the
  // expedition host, stragglers walking home, and the raiders too. Armies
  // flow down roads, which makes a road both a lifeline and an approach.
  // Bridges are road over water (walkable, same marching speed).
  const roads = roadTiles(state);
  const ROAD_COST = 1 / ROAD_SPEED_MULT;
  const moveCost = (i) => {
    if (roads.has(i)) return ROAD_COST;
    const base = TERRAIN_INFO[state.terrain[i]].move;
    if (!isFinite(base)) return Infinity;
    return walls.has(i) ? base + 30 : base; // batter through if no way around
  };
  const start = fy * N + fx, goal = ty * N + tx;
  const g = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  g[start] = 0;
  // heuristic scaled by the cheapest tile cost so it stays admissible now
  // that roads undercut plains (else A* would skip the very detours we want)
  const h = (i) => (Math.abs((i % N) - tx) + Math.abs(((i / N) | 0) - ty)) * ROAD_COST;
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
    // the staged march: once the camp stands, you can WATCH a wave build —
    // "raiders are massing" (bodies gather at the tents) → "they may march
    // soon" → the horn. Opportunist bands from the map edges give no notice.
    const c = state.camp;
    if (c && !c.gone && !c.broken) {
      if (raid.stage == null && raid.timer <= CAMP.massingAtTicks) {
        raid.stage = 1;
        const willBeWarlord = RAID.warlordEveryWaves > 0 && state.pop >= RAID.warlordMinPop &&
          (raid.wave + 1) % RAID.warlordEveryWaves === 0 && !c.unclaimed;
        raid.nextFromCamp = willBeWarlord || rand() < CAMP.raidFromCampChance;
        if (raid.nextFromCamp) {
          let predicted = RAID.sizeBase + prosperity(state) / RAID.prosperityDivisor
            + state.soldiers.length * RAID.militaryPressure;
          if (willBeWarlord) predicted *= RAID.warlordSizeMult;
          predicted = Math.min(RAID.sizeCap, Math.max(1, Math.round(predicted)));
          c.massing = Array.from({ length: Math.min(predicted, 18) }, (_, i) => {
            const mx = c.x + (((i * 7) % 9) - 4) * 0.55;
            const my = c.y + 1.6 + ((i * 5) % 3) * 0.6;
            return { x: mx, y: my, px: mx, py: my };
          });
          logEvent(state, `Raiders are massing at ${c.name}.`, 'raid');
        }
      } else if (raid.stage === 1 && raid.nextFromCamp && raid.timer <= CAMP.stirAtTicks) {
        raid.stage = 2;
        logEvent(state, `The war-camp stirs — ${c.name} may march soon.`, 'raid');
      }
    }
    if (raid.timer <= 0) {
      raid.phase = 'warning';
      raid.timer = RAID.warningTicks;
      // the FIRST raid founds the nest: raiders make camp in the far wilds,
      // and from then on most waves march from it (an opponent to build toward)
      if (!state.camp) ensureCamp(state, rand, { unclaimed: true });
      // is the coming wave a warlord? He sends a rider ahead of his host:
      // pay the tribute, or he marches (the Danegeld choice — see TRIBUTE).
      // The first time the kingdom is worth the march, a warlord CLAIMS the nest.
      let wantWarlord = RAID.warlordEveryWaves > 0 && state.pop >= RAID.warlordMinPop &&
        (raid.wave + 1) % RAID.warlordEveryWaves === 0;
      if (wantWarlord) {
        ensureCamp(state, rand);
        if (state.camp?.unclaimed) claimCampByWarlord(state);
        if (!warlordAvailable(state)) wantWarlord = false;   // camp broken/leaderless/ashes
      }
      raid.incomingWarlord = wantWarlord;
      if (wantWarlord && state.camp?.avenger) {
        // the avenger cannot be bought — no rider, no demand, only the horn
        logEvent(state, `${state.camp.warlord.name} marches. No rider comes. He wants no gold.`, 'raid');
      } else if (wantWarlord && TRIBUTE.enabled) {
        const name = state.camp.warlord.name;
        const gold = Math.max(TRIBUTE.demandMin, Math.round(
          state.res.gold * TRIBUTE.demandFrac *
          Math.pow(TRIBUTE.appetiteMult, state.tributeAppetite || 0)));
        raid.demand = { gold, name };
        raid.timer = TRIBUTE.decideTicks;   // the rider waits for an answer
        logEvent(state, `A rider from ${name}: "${gold} gold — or I come and take it."`, 'raid');
        emit('tribute-demand', raid.demand);
      } else {
        logEvent(state, 'Raiders sighted on the horizon! Sound the horn!', 'raid');
      }
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
    // the raid is OVER the moment the last raider turns tail — the kingdom
    // exhales, villagers come out of hiding, the alarm clears. The stragglers
    // still walk off the map (and can be shot in the back on the way out).
    const allFleeing = raid.raiders.length > 0 &&
      raid.raiders.every((rd) => rd.mode === 'flee' || rd.mode === 'gone');
    if (raid.raiders.length === 0 || allFleeing) endRaid(state, rand, allFleeing);
  }

  // stragglers from an already-ended raid keep walking home (and towers keep
  // loosing parting shots) even though the alarm state is over
  if (raid.phase !== 'active' && raid.raiders.length) {
    updateRaiders(state, rand);
    updateTowers(state);
  }

  updateSoldiers(state, rand);
  // the hunt runs LAST: only raiders that survived the towers and the line of
  // soldiers get to run down civilians (the defense is the shield)
  if (raid.phase === 'active') resolveHunt(state, rand);
}

// A manual order: every soldier falls back to the keep and holds there for a
// while, engaging only what comes close. The horn that calls the army home.
export function rallyToKeep(state) {
  if (!state.buildings.some((b) => b.type === 'keep')) return { ok: false, reason: 'No keep to rally to' };
  if (!state.soldiers.length) return { ok: false, reason: 'No soldiers to rally' };
  state.rallyUntil = state.tick + 150;
  logEvent(state, 'The horn sounds — the army falls back to the keep!', 'info');
  return { ok: true };
}

// raiders have names too — it makes the Chronicle read like a saga
const RAIDER_FIRST = [
  'Ulf', 'Grim', 'Skarde', 'Ragna', 'Toke', 'Bront', 'Halvar', 'Yrsa',
  'Kettil', 'Ash', 'Vragi', 'Sorka', 'Drust', 'Moira', 'Fenn', 'Orm',
];
const RAIDER_EPITHET = [
  'Redknife', 'the Cruel', 'Wolfjaw', 'Nine-Fingers', 'the Vulture',
  'Bloodbraid', 'the Lame', 'Ironmaw', 'the Quiet Blade', 'Corpsegrin',
  'the Burned', 'Longreach', 'Two-Axe', 'the Hollow', 'Ratbane',
];

function spawnRaid(state, rand) {
  const raid = state.raid;
  const N = MAP.size;
  raid.wave++;
  raid.startTick = state.tick;
  raid.lootStartTick = 0;
  raid.keepBesieged = false;
  // per-raid ledger, reported when the raid ends (and dumped to the console)
  raid.tally = { killed: 0, soldiersLost: 0, mercsLost: 0, hunted: 0, loot: 0, recovered: 0, walls: 0 };

  // wave size rides prosperity and your army; a raid that hurt last time
  // eases this one (rubber-band mercy), a fat unscathed kingdom gets none
  let sizeF = RAID.sizeBase + prosperity(state) / RAID.prosperityDivisor
    + state.soldiers.length * RAID.militaryPressure;
  const ease = 1 - (raid.lastSacked || 0) * RAID.easeAfterSack;
  sizeF *= Math.max(RAID.minSizeMult, Math.min(1.2, ease));

  // warlords: a dread wave on a cadence, once the kingdom is worth the march.
  // Decided at the warning (so the tribute rider could be sent); an unpaid
  // demand means he marches — and facing him resets his appetite: the legend
  // of easy coin dies with the demand.
  const isWarlord = raid.incomingWarlord ?? (RAID.warlordEveryWaves > 0 &&
    state.pop >= RAID.warlordMinPop && raid.wave % RAID.warlordEveryWaves === 0);
  raid.incomingWarlord = false;
  if (raid.demand) {
    logEvent(state, `No answer came. ${raid.demand.name} marches.`, 'raid');
    raid.demand = null;
  }
  if (isWarlord) {
    state.tributeAppetite = 0;
    sizeF *= RAID.warlordSizeMult;
    if (state.camp?.avenger) sizeF *= CAMP.avengerSizeMult;   // grief marches with him
  }
  const size = Math.min(RAID.sizeCap, Math.max(1, Math.round(sizeF)));
  raid.sackedThisRaid = 0;
  raid.armyAtStart = state.soldiers.filter((s) => !s.exp).length;   // for the rout check
  raid.routed = false;

  // a straggling warlord still walking home when the next wave forms simply
  // arrives (his body would be wiped with the old raider list)
  if (raid.raiders.some((rd) => rd.warlord)) warlordReturned(state);

  // spawn point: waves the camp was massing (and every warlord host) march
  // FROM THE CAMP — you can watch the road. The rest slip in from a random
  // map edge, so no single flank is ever perfectly safe.
  const campLive = state.camp && !state.camp.gone && !state.camp.broken;
  const fromCamp = campLive && (isWarlord ? warlordAvailable(state) : raid.nextFromCamp === true);
  // the man himself rides ONLY at the head of his own dread waves — common
  // camp-origin bands march without him
  const warlordRides = fromCamp && isWarlord && warlordAvailable(state);
  if (state.camp) state.camp.massing = [];   // the gathering becomes the wave
  let sx = 0, sy = 0, tries = 0;
  if (fromCamp) {
    sx = state.camp.x; sy = state.camp.y;
  } else {
    do {
      const side = Math.floor(rand() * 4);
      const t = Math.floor(rand() * N);
      sx = side === 0 ? 0 : side === 1 ? N - 1 : t;
      sy = side === 2 ? 0 : side === 3 ? N - 1 : t;
    } while (state.terrain[sy * N + sx] === T.WATER && tries++ < 100);
  }

  raid.raiders = [];
  for (let i = 0; i < size; i++) {
    const target = pickTarget(state, rand);
    if (!target) break;
    const path = findPath(state, sx, sy, target.x, target.y);
    if (!path) continue;
    const rid = state.nextId++;
    raid.raiders.push({
      x: sx + (rand() - 0.5), y: sy + (rand() - 0.5), px: sx, py: sy,
      hp: (RAIDER.hp + raid.wave * 2) * (isWarlord ? RAID.warlordHpMult : 1),
      loot: 0, lootBag: {},
      name: `${RAIDER_FIRST[rid % RAIDER_FIRST.length]} ${RAIDER_EPITHET[(rid * 11) % RAIDER_EPITHET.length]}`,
      path, pathI: 0, mode: 'march', targetId: target.id,
      spawn: { x: sx, y: sy },
    });
  }
  // the warlord rides at the head of his own host — a boss on the field.
  // Kill him here and his line breaks; his camp waits leaderless for a successor.
  if (warlordRides) {
    const keepB = state.buildings.find((b) => b.type === 'keep');
    const wPath = keepB ? findPath(state, sx, sy, keepB.x, keepB.y) : null;
    if (wPath && keepB) {
      state.camp.warlord.home = false;
      raid.raiders.push({
        x: sx, y: sy, px: sx, py: sy,
        hp: CAMP.warlordHp, loot: 0, lootBag: {}, warlord: true,
        name: state.camp.warlord.name,
        path: wPath, pathI: 0, mode: 'march', targetId: keepB.id,
        spawn: { x: sx, y: sy },
      });
    }
  }
  if (!raid.raiders.length) { endRaid(state, rand); return; }
  raid.phase = 'active';
  state.stats.raids++;
  if (isWarlord) state.stats.warlords++;
  state.stats.raidSizes.push(raid.raiders.length);
  logEvent(state, isWarlord
    ? `${fromCamp ? state.camp.warlord.name.toUpperCase() : 'A WARLORD'} marches on ${state.name} with ${raid.raiders.length} raiders!`
    : fromCamp
      ? `${raid.raiders.length} raiders march out from ${state.camp.name}!`
      : `${raid.raiders.length} raiders storm in from the wilds!`, 'raid');
}

function pickTarget(state, rand) {
  const value = (b) => {
    if (b.type === 'market') return 6;
    if (b.type === 'keep') return 5;
    if (b.type === 'smelter' || b.type === 'bakery') return 4;
    // silence the shield: a manned tower is worth attacking — batter it down
    // and the arrows stop (an already-sacked one is just rubble, skip it)
    if (b.type === 'tower') return b.sacked ? 0.2 : 2.5;
    if (b.type === 'wall') return 0.2;
    if (b.type === 'road' || b.type === 'bridge') return 0.05;
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
  // raiders march the roads like anyone else — faster on them, and a bridge
  // tile moves at road speed (the terrain beneath is water, move ∞: reading
  // it raw would stall every unit mid-river)
  const roads = roadTiles(state);
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
        // the warlord brings a ram — walls fall faster before him
        wall.hp -= RAIDER.dmg * (rd.warlord ? CAMP.warlordBatterMult : 1);
        state.buildingsDirty = true;
        if (wall.hp <= 0) {
          // walls breach, they don't vanish: left as rubble at 1 HP, repairable
          // in place. Raiders pour through; builders can wall it back up.
          wall.hp = 1;
          wall.breached = true;
          state.stats.wallsBreached++;
          if (raid.tally) raid.tally.walls++;
          logEvent(state, 'A wall is breached! Raiders pour through the gap!', 'raid');
        }
        continue;
      }
      const speed = roads.has(next)
        ? RAIDER.speed * ROAD_SPEED_MULT
        : RAIDER.speed / TERRAIN_INFO[state.terrain[next]].move;
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
        // remember WHAT was taken, not just how much — so a slain raider
        // drops back the very grain and gold he was carrying
        rd.lootBag[best] = (rd.lootBag[best] || 0) + take;
        if (raid.tally) raid.tally.loot += take;
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
            const watchman = target.type === 'tower' ? target.workers?.[0] : null;
            logEvent(state, watchman
              ? `The watchtower is battered down! ${watchman.name} scrambles from the rubble — its arrows fall silent.`
              : `${BUILDINGS[target.type].name} has been sacked!`, 'raid');
            state.raidShock = Math.min(40, state.raidShock + 8);
            // the unified death rule: nobody dies at their post. The sacked
            // building EJECTS its crew — they run for the keep, and the only
            // way a civilian dies is caught in the open (resolveHunt).
            for (const v of [...(target.workers || [])]) ejectVillager(v);
          }
        }
        retargetOrFlee(state, rd, rand);
        continue;
      }
      if (rd.loot >= RAIDER.lootCap) startFlee(state, rd);
    }
  }
  cullRaiders(state);
}

// Remove the dead and the departed — and settle the warlord's fate. A fled
// raider's loot lands in the camp's hoard (every brigand pays the warlord
// fealty); a fallen warlord breaks his own host on the spot.
function cullRaiders(state) {
  const raid = state.raid;
  for (const rd of raid.raiders) {
    // a brigand cut down with his pack still on his back drops the plunder —
    // the very goods he'd stolen roll back into the stockpile, typed
    if (rd.hp <= 0 && rd.loot > 0) recoverLoot(state, rd);
    if (rd.warlord && rd.hp <= 0) {
      warlordFell(state);
      for (const o of raid.raiders) {
        if (o.hp > 0 && o.mode !== 'flee' && o.mode !== 'gone') startFlee(state, o);
      }
    } else if (rd.mode === 'gone') {
      if (rd.loot > 0) addPlunder(state, rd.loot);
      if (rd.warlord) warlordReturned(state);
    }
  }
  raid.raiders = raid.raiders.filter((rd) => rd.hp > 0 && rd.mode !== 'gone');
}

// Empty a slain raider's pack back into the stockpile, resource by resource.
// A migrated save may carry loot with no bag — refund it as food so nothing
// stolen is ever silently destroyed.
function recoverLoot(state, rd) {
  const bag = rd.lootBag || {};
  let back = 0;
  for (const r in bag) {
    const amt = bag[r];
    if (amt > 0) { state.res[r] = (state.res[r] || 0) + amt; back += amt; }
  }
  if (back <= 0 && rd.loot > 0) { state.res.food += rd.loot; back = rd.loot; }
  if (state.raid.tally) state.raid.tally.recovered += back;
  state.stats.lootRecovered += back;
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
// watchtower — but only while a watchman is posted (an unstaffed tower is
// inert, sim2-validated) — and the keep (its own guard, no garrison needed).
function updateTowers(state) {
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const def = BUILDINGS[b.type];
    if (!def.range || !def.arrowDmg) continue;
    if (def.workers > 0 && !(b.assigned > 0)) continue;   // no watchman, no arrows
    // a tower battered to rubble is SILENT until rebuilt past half (the keep's
    // guard still fights from its stones — the keep-as-heart rule stands)
    if (b.type === 'tower' && b.sacked) continue;
    // a practiced eye shoots truer: the watchman's skill sharpens every arrow
    const watchSkill = b.workers?.length ? (b.workers[0].skills[b.type] || 0) : 0;
    let nearest = null, nd = def.range;
    for (const rd of state.raid.raiders) {
      const d = Math.hypot(rd.x - b.x, rd.y - b.y);
      if (d < nd) { nd = d; nearest = rd; }
    }
    if (nearest) {
      nearest.hp -= def.arrowDmg * (1 + watchSkill);
      emit('arrow', { fx: b.x, fy: b.y, tx: nearest.x, ty: nearest.y });
      if (nearest.hp <= 0) {
        state.stats.raidersKilled++;
        if (state.raid.tally) state.raid.tally.killed++;
        const watchman = b.workers?.[0];
        logEvent(state, b.type === 'keep'
          ? `${nearest.name} falls to the keep's archers.`
          : watchman
            ? `${nearest.name} falls to watchman ${watchman.name}'s arrow.`
            : `${nearest.name} falls to tower arrows.`, 'good');
      }
    }
  }
}

// ── The hunt (sim2 Campaign 6, ported spatially) ──────────────────
// Runs LAST in the raid tick, after towers and soldiers have thinned the wave:
// the defense is the shield, and only raiders that get past it run down
// civilians. A chase resolves only every HUNT.cadenceTicks (occasional, not a
// per-tick grind — the sim's load-bearing finding). A raider in melee with a
// soldier is pinned; a villager near the keep or a house is sheltered. The
// cornered villager swings first — a hoe, not a blade — then rolls to die.
function resolveHunt(state, rand) {
  if (state.tick % HUNT.cadenceTicks !== 0) return;
  const raiders = state.raid.raiders.filter(
    (rd) => rd.hp > 0 && (rd.mode === 'march' || rd.mode === 'loot'));
  if (!raiders.length) return;
  const civilians = state.villagers.filter((v) => v.job !== 'soldier' && v.x != null);
  if (!civilians.length) return;

  const caught = new Set();   // each villager faces at most one raider per round
  for (const rd of raiders) {
    // pinned: a soldier at sword's length keeps this raider too busy to hunt
    let pinned = false;
    for (const s of state.soldiers) {
      if (s.hp > 0 && Math.hypot(s.x - rd.x, s.y - rd.y) < HUNT.pinRadius) { pinned = true; break; }
    }
    if (pinned) continue;

    // the nearest exposed civilian within reach is run down
    let prey = null, pd = HUNT.reach;
    for (const v of civilians) {
      if (caught.has(v.id)) continue;
      const d = Math.hypot(v.x - rd.x, v.y - rd.y);
      if (d < pd && !isSheltered(state, v)) { pd = d; prey = v; }
    }
    if (!prey) continue;
    caught.add(prey.id);

    // the villager swings back weakly first — a doomed farmer still chips the raider
    rd.hp -= HUNT.villagerDmg * (1 + 0.5 * bestSkill(prey));
    if (rd.hp <= 0) {
      state.stats.raidersKilled++;
      if (state.raid.tally) state.raid.tally.killed++;
      logEvent(state, `Cornered, ${prey.name} turns with a hoe — and fells ${rd.name}!`, 'good');
      continue;
    }
    if (rand() < HUNT.killChance) {
      const wasMaster = isMaster(prey);
      if (wasMaster) state.stats.mastersLost++;
      state.stats.villagersHunted = (state.stats.villagersHunted || 0) + 1;
      if (state.raid.tally) state.raid.tally.hunted++;
      killVillager(state, prey);
      state.raidShock = Math.min(40, state.raidShock + 4);
      logEvent(state, wasMaster
        ? `${prey.name}, a master of the craft, was run down by ${rd.name}. The knowledge dies too.`
        : `${prey.name} was run down in the open by ${rd.name}.`, 'bad');
    } else {
      // escaped by a hair — a burst of terror-speed toward the keep
      ejectVillager(prey);
      const keep = state.buildings.find((b) => b.type === 'keep');
      if (keep) {
        const dx = keep.x - prey.x, dy = keep.y - prey.y;
        const d = Math.max(0.001, Math.hypot(dx, dy));
        prey.x += (dx / d) * Math.min(1.2, d); prey.y += (dy / d) * Math.min(1.2, d);
      }
    }
  }
  cullRaiders(state);
}

// combat skill of a fighter: a mercenary carries its own; a subject-soldier's
// comes from their villager record.
export function soldierSkill(state, s) {
  if (s.merc) return s.skill || 0;
  const v = state.villagers.find((vl) => vl.id === s.villagerId);
  return v?.skills.soldier || 0;
}

function updateSoldiers(state, rand) {
  const keep = state.buildings.find((b) => b.type === 'keep');
  const roads = new Set();
  const defenders = [];   // buildings that give covering fire (towers + keep)
  for (const b of state.buildings) {
    if ((b.type === 'road' || b.type === 'bridge') && b.hp > 0) roads.add(idx(b.x, b.y));
    const def = BUILDINGS[b.type];
    if (b.hp > 0 && def.range && def.arrowDmg) defenders.push(b);
  }
  const liveRaiders = state.raid.raiders.filter((r) => r.hp > 0);
  // the army HOLDS its ground: it only engages raiders on or near claimed land
  // (within a short margin), never chasing into the wilds. This keeps soldiers
  // where their home-ground and tower-cover bonuses apply.
  const HOLD_MARGIN = 2;
  const nearTerritory = (rd) => {
    const rx = Math.round(rd.x), ry = Math.round(rd.y);
    for (let dy = -HOLD_MARGIN; dy <= HOLD_MARGIN; dy++) {
      for (let dx = -HOLD_MARGIN; dx <= HOLD_MARGIN; dx++) {
        const x = rx + dx, y = ry + dy;
        if (x >= 0 && y >= 0 && x < MAP.size && y < MAP.size && state.claimed[idx(x, y)]) return true;
      }
    }
    return false;
  };
  // when the keep is besieged the gloves come off — defend it wherever they are.
  // Stance: 'hold' (default) fights only on/near claimed land, where the bonuses
  // live; 'sally' pursues any raider on the map — loot recovered, blood risked.
  const sallying = state.stance === 'sally';
  let engageable = (state.raid.keepBesieged || sallying) ? liveRaiders : liveRaiders.filter(nearTerritory);
  // the line BREAKS when a raid has bled too much of the army: survivors fall
  // back to the keep and live to fight the next one (no more 226/226 wipes)
  const raid = state.raid;
  if (!raid.routed && !raid.keepBesieged && (raid.armyAtStart || 0) >= 4) {
    const lost = (raid.tally?.soldiersLost || 0) + (raid.tally?.mercsLost || 0);
    if (lost >= raid.armyAtStart * COMBAT.routFrac) {
      raid.routed = true;
      logEvent(state, 'Your line breaks! The survivors fall back to the keep.', 'bad');
    }
  }
  // a manual rally — or a broken line — overrides everything but a besieged
  // keep: the army holds at the keep and only meets what comes to its walls
  const rallying = keep && !state.raid.keepBesieged &&
    ((state.rallyUntil || 0) > state.tick || raid.routed);
  if (rallying) {
    engageable = engageable.filter((rd) => Math.hypot(rd.x - keep.x, rd.y - keep.y) < 6);
  }
  // force-ratio: outnumber the raiders → your soldiers take far less (Finding 8.1).
  // Only the HOME army counts — soldiers marching on the camp defend nothing here.
  const homeArmy = state.soldiers.filter((so) => !so.exp);
  const forceRatio = Math.min(1, liveRaiders.length / Math.max(1, homeArmy.length));
  // a living veteran on the field lets rookies season under fire
  const hasVeteran = homeArmy.some((so) => soldierSkill(state, so) >= COMBAT.veteranSkill);

  // the army fights as a LINE: each soldier takes the nearest raider FEW ALLIES
  // ALREADY COVER (coverage-penalized distance), instead of everyone dogpiling
  // one man — the harness showed the dogpile entering melee on the same tick
  // and dying on the same tick. Mercs pick first: sellswords make first contact.
  const cover = new Map();   // raider -> soldiers already on them
  const order = [...state.soldiers].sort((a, b) => (b.merc ? 1 : 0) - (a.merc ? 1 : 0));

  for (const s of order) {
    if (s.exp) continue;   // afield with the expedition — beyond the horn's reach
    s.px = s.x; s.py = s.y;
    const onRoad = roads.has(idx(Math.round(s.x), Math.round(s.y)));
    const speed = SOLDIER.speed * (onRoad ? ROAD_SPEED_MULT : 1);

    // A badly-wounded veteran falls back to mend rather than die in the line —
    // if they're skilled enough to disengage and the keep isn't being stormed.
    // (Green soldiers can't pull back in time; the keep-besieged fight is to
    // the death.) This is how a veteran corps SURVIVES a long war of attrition.
    const sSkill = soldierSkill(state, s);
    const retreating = !state.raid.keepBesieged &&
      s.hp < SOLDIER.hp * COMBAT.retreatBelowFrac && sSkill >= COMBAT.retreatSkillGate;
    if (retreating && keep) {
      const dx = keep.x - s.x, dy = (keep.y + 3) - s.y;
      const d = Math.max(0.001, Math.hypot(dx, dy));
      if (d > 0.5) { s.x += (dx / d) * speed; s.y += (dy / d) * speed; }
      // mend faster once clear of the fray (out of local danger)
      let localGang = 0;
      for (const rd of engageable) { if (Math.hypot(rd.x - s.x, rd.y - s.y) < 1.6) localGang++; }
      if (localGang === 0) s.hp = Math.min(SOLDIER.hp, s.hp + 0.8);
      continue;
    }

    const raiders = engageable;
    if (raiders.length) {
      // when the keep is besieged, every soldier rushes its attackers — target
      // the raider nearest the KEEP, not the one nearest to me. Allies already
      // covering a raider make him a worse pick (the line spreads out).
      const anchor = (state.raid.keepBesieged && keep) ? keep : s;
      let nearest = null, nd = Infinity;
      for (const rd of raiders) {
        if (rd.hp <= 0) continue;
        const d = Math.hypot(rd.x - anchor.x, rd.y - anchor.y)
          + (cover.get(rd) || 0) * COMBAT.coverPenalty;
        if (d < nd) { nd = d; nearest = rd; }
      }
      // every raider in reach may already be dead this tick (killed by towers
      // or an earlier soldier, culled only at tick's end) — hold position
      if (!nearest) continue;
      cover.set(nearest, (cover.get(nearest) || 0) + 1);
      // distance for the ATTACK check is always soldier→raider
      nd = Math.hypot(nearest.x - s.x, nearest.y - s.y);
      if (nd < 1.1) {
        const vet = s.merc ? null : state.villagers.find((v) => v.id === s.villagerId);
        const skill = sSkill;

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
          // good ground (outnumbering, covered) → survivable; bad → lethal. A
          // veteran's experience makes them harder to finish off.
          if (s.hp <= SOLDIER.hp * COMBAT.killWoundedFrac) {
            let killChance = COMBAT.killChanceGood +
              (COMBAT.killChanceBad - COMBAT.killChanceGood) * forceRatio;
            killChance *= (1 - COMBAT.veteranKillResist * skill);
            // a man marked by the burning is harder to finish — nothing frightens him now
            if (vet?.marked) killChance *= (1 - CAMP.markedKillResist);
            if (s.hp <= 0 || rand() < killChance) s.hp = 0;   // dies (culled below)
          }
        }

        // SEASONING: a rookie beside a veteran learns fast under fire
        if (vet && hasVeteran && skill < COMBAT.veteranSkill) {
          vet.skills.soldier = Math.min(SKILL.max,
            (vet.skills.soldier || 0) + SKILL.gainPerTick * (COMBAT.seasonRookieBonus - 1));
        }

        if (nearest.hp <= 0) {
          state.stats.raidersKilled++;
          if (state.raid.tally) state.raid.tally.killed++;
          const killer = s.merc ? 'a mercenary blade' : (vet ? vet.name : 'your soldiers');
          logEvent(state, `${nearest.name} is cut down by ${killer}${crit ? ' — a mighty blow!' : '.'}`, 'good');
        }
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
  // a fallen soldier is a fallen villager — their skills fall with them. A
  // fallen mercenary is just a hireling lost: no subject dies with them.
  for (const s of state.soldiers) {
    if (s.hp > 0) continue;
    if (s.merc) {
      if (state.raid.tally) state.raid.tally.mercsLost++;
      logEvent(state, 'A mercenary falls in your service.', 'bad');
      continue;
    }
    const vet = state.villagers.find((v) => v.id === s.villagerId);
    if (vet) {
      const wasMaster = isMaster(vet);
      state.stats.soldiersFallen++;
      if (wasMaster) state.stats.veteransFallen++;
      if (state.raid.tally) state.raid.tally.soldiersLost++;
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

function endRaid(state, rand, fled = false) {
  const raid = state.raid;
  raid.phase = 'quiet';
  raid.keepBesieged = false;
  raid.stage = null;               // the staged countdown starts anew
  raid.nextFromCamp = undefined;
  if (state.camp) state.camp.massing = [];
  // the danger passed: the fled come out of hiding and go back to work
  for (const v of state.villagers) v.fleeing = false;
  raid.lastSacked = raid.sackedThisRaid || 0;
  raid.timer = RAID.minGapTicks + Math.floor(rand() * 200) - Math.min(150, Math.floor(prosperity(state) / 15));
  // rubber-band: a raid that hurt buys quiet ticks to rebuild in
  raid.timer += raid.lastSacked * RAID.mercyPerSack;
  raid.timer = Math.max(120, raid.timer);

  // the reckoning: one Chronicle line that tells you what the raid cost —
  // and the raw ledger in the console for tuning (kingdom.summary()'s sibling)
  const t = raid.tally || {};
  const parts = [];
  if (t.killed) parts.push(`${t.killed} raider${t.killed > 1 ? 's' : ''} slain`);
  const lost = (t.soldiersLost || 0) + (t.hunted || 0);
  if (lost) {
    const bits = [];
    if (t.soldiersLost) bits.push(`${t.soldiersLost} soldier${t.soldiersLost > 1 ? 's' : ''}`);
    if (t.hunted) bits.push(`${t.hunted} subject${t.hunted > 1 ? 's' : ''}`);
    parts.push(`${bits.join(' and ')} lost`);
  }
  if (t.mercsLost) parts.push(`${t.mercsLost} sellsword${t.mercsLost > 1 ? 's' : ''} dead`);
  if (raid.lastSacked) parts.push(`${raid.lastSacked} building${raid.lastSacked > 1 ? 's' : ''} sacked`);
  if (t.walls) parts.push(`${t.walls} wall${t.walls > 1 ? 's' : ''} breached`);
  if (t.loot >= 1) parts.push(`${Math.round(t.loot)} goods carried off`);
  if (t.recovered >= 1) parts.push(`${Math.round(t.recovered)} goods won back from the slain`);
  const head = fled ? 'The raiders break and flee!' : 'The raid is over.';
  logEvent(state, parts.length
    ? `${head} The reckoning: ${parts.join(' · ')}.`
    : `${head} The kingdom breathes again — not a thing was lost.`, 'info');
  // browser-only so headless CSV runs stay clean
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(`⚔ raid ${raid.wave} reckoning`, {
      ...t, sacked: raid.lastSacked, fled,
      ticks: state.tick - (raid.startTick || state.tick),
    });
  }
}

// Subjects who have borne arms before (the iron was forged once) — the militia
// reserve. Standing down doesn't melt the sword: re-mustering a veteran is free.
export function armedReserve(state) {
  return state.villagers.filter((v) => v.armed && v.job !== 'soldier');
}

export function recruitSoldier(state) {
  const barracks = state.buildings.filter((b) => b.type === 'barracks' && b.hp > 0);
  if (!barracks.length) return { ok: false, reason: 'Build a barracks first' };
  if (state.soldiers.length >= barracks.length * SOLDIER.perBarracks) {
    return { ok: false, reason: 'Barracks are full' };
  }
  // a soldier is a villager under arms, not a coin purchase. Muster the most
  // seasoned of the armed reserve first — their iron is already forged — and
  // only pay iron to arm someone new.
  const reserve = armedReserve(state)
    .sort((a, b) => (b.skills.soldier || 0) - (a.skills.soldier || 0))[0];
  const recruit = reserve
    || state.villagers.find((v) => v.job === 'idle')
    || state.villagers.find((v) => v.job === 'producer');
  if (!recruit) return { ok: false, reason: 'No subject free to serve' };
  if (!recruit.armed) {
    for (const [r, amt] of Object.entries(SOLDIER.cost)) {
      if (state.res[r] < amt) return { ok: false, reason: `Not enough ${r}` };
    }
    for (const [r, amt] of Object.entries(SOLDIER.cost)) state.res[r] -= amt;
    recruit.armed = true;
  }
  const wasVeteran = (recruit.skills.soldier || 0) >= COMBAT.veteranSkill;
  recruit.job = 'soldier';
  recruit.workplaceId = null;
  recruit.workType = null;
  recruit.fleeing = false;
  state.stats.soldiersRecruited++;
  const b = barracks[0];
  state.soldiers.push({
    id: state.nextId++, villagerId: recruit.id,
    x: b.x, y: b.y + 1, px: b.x, py: b.y + 1, hp: SOLDIER.hp,
  });
  logEvent(state, reserve
    ? `${recruit.name} takes up the sword once more${wasVeteran ? ' — a veteran returns to the line' : ''}.`
    : `${recruit.name} takes up arms.`, 'good');
  return { ok: true };
}

export function dismissSoldier(state) {
  // dismiss a subject-soldier first (mercs are dismissed via their own control).
  // They keep their arms and their craft: standing down makes MILITIA, not
  // civilians — re-mustering them later costs nothing (the iron was paid once),
  // and they eat like a citizen until called again. Soldiers afield with the
  // expedition can't be reached — and a man marked by the burning REFUSES.
  const home = [...state.soldiers].reverse().filter((so) => !so.exp);
  const s = home.find((so) => {
    if (so.merc) return false;
    const v = state.villagers.find((vl) => vl.id === so.villagerId);
    return !v?.marked;
  }) || home[home.length - 1];
  if (!s) return { ok: false, reason: 'No soldiers to dismiss' };
  if (!s.merc) {
    const mv = state.villagers.find((vl) => vl.id === s.villagerId);
    if (mv?.marked) {
      return { ok: false, reason: `${mv.name} will not stand down — not since the burning.` };
    }
  }
  const i = state.soldiers.indexOf(s);
  const vet = state.villagers.find((v) => v.id === s.villagerId);
  if (vet) { vet.job = 'idle'; vet.armed = true; }
  state.soldiers.splice(i, 1);
  logEvent(state, vet
    ? `${vet.name} stands down to the fields — sword oiled and hung by the door.`
    : 'A soldier stands down.', 'info');
  return { ok: true };
}

// Pay the warlord's tribute: the wave is bought off, the appetite grows.
// Only possible while the rider waits (the warning window).
export function payTribute(state) {
  const raid = state.raid;
  const d = raid.demand;
  if (!d || raid.phase !== 'warning') return { ok: false, reason: 'No demand stands' };
  if (state.res.gold < d.gold) return { ok: false, reason: 'Not enough gold' };
  state.res.gold -= d.gold;
  state.delta.gold -= d.gold;
  addTributeGold(state, d.gold);   // the Danegeld lands in the camp's hoard
  state.tributeAppetite = (state.tributeAppetite || 0) + 1;
  state.stats.tributeGold = (state.stats.tributeGold || 0) + d.gold;
  state.stats.tributesPaid = (state.stats.tributesPaid || 0) + 1;
  raid.demand = null;
  raid.incomingWarlord = false;
  raid.phase = 'quiet';
  raid.timer = RAID.minGapTicks;   // bought peace — but not a long one
  raid.stage = null;               // the bought-off horde disperses
  raid.nextFromCamp = undefined;
  if (state.camp) state.camp.massing = [];
  logEvent(state, `You pay ${d.gold} gold. ${d.name} turns away — for now. Word spreads of easy coin.`, 'info');
  emit('tribute-paid');
  return { ok: true };
}

// Send the rider back empty-handed: the demand dies and the warlord marches
// NOW — no waiting out the rider's window. Defiance is a choice with a cost.
export function refuseTribute(state) {
  const raid = state.raid;
  const d = raid.demand;
  if (!d || raid.phase !== 'warning') return { ok: false, reason: 'No demand stands' };
  raid.demand = null;
  raid.timer = Math.min(raid.timer, 10);   // he was already saddled
  logEvent(state, `You send the rider back with empty hands. ${d.name} marches.`, 'raid');
  emit('tribute-refused');
  return { ok: true };
}

export function mercCount(state) { return state.soldiers.filter((s) => s.merc).length; }

// The market's price for the swords you hold: every extra company under
// contract raises EVERY merc's per-tick rate (captains talk). This is the
// soft cap — no hard limit, but a great host costs a fortune per season.
export function mercUpkeepRate(state) {
  const n = mercCount(state);
  if (!n) return 0;
  const companies = Math.ceil(n / MERCENARY.companySize);
  return n * MERCENARY.upkeepPerTick * (1 + MERCENARY.upkeepEscalation * (companies - 1));
}

// Hire a company of mercenaries: an up-front gold sum buys pre-trained fighters
// who cost steep per-tick gold and leave if unpaid. They spare your veterans.
export function hireMercenaries(state) {
  const hiring = MERCENARY.companySize;
  for (const [r, amt] of Object.entries(MERCENARY.hireCost)) {
    if (state.res[r] < amt) return { ok: false, reason: `Not enough ${r}` };
  }
  for (const [r, amt] of Object.entries(MERCENARY.hireCost)) state.res[r] -= amt;
  const keep = state.buildings.find((b) => b.type === 'keep');
  const bx = keep ? keep.x : 0, by = keep ? keep.y + 2 : 0;
  for (let i = 0; i < hiring; i++) {
    state.soldiers.push({
      id: state.nextId++, merc: true, skill: MERCENARY.skill,
      x: bx + (i - 1), y: by, px: bx + (i - 1), py: by, hp: MERCENARY.hp,
    });
  }
  logEvent(state, `A mercenary company of ${hiring} takes your coin.`, 'good');
  return { ok: true };
}

export function dismissMercenaries(state) {
  const before = mercCount(state);
  if (!before) return { ok: false, reason: 'No mercenaries to release' };
  // release the most recent company
  let toRelease = Math.min(MERCENARY.companySize, before);
  for (let i = state.soldiers.length - 1; i >= 0 && toRelease > 0; i--) {
    if (state.soldiers[i].merc) { state.soldiers.splice(i, 1); toRelease--; }
  }
  logEvent(state, 'A mercenary company is released from your service.', 'info');
  return { ok: true };
}

// per-tick gold upkeep for mercenaries; if the coffers run dry they walk off
export function mercenaryUpkeepTick(state) {
  const due = mercUpkeepRate(state);
  if (!due) return;
  if (state.res.gold >= due) {
    state.res.gold -= due;
    state.delta.gold -= due;
  } else {
    // can't pay — the whole lot desert
    state.soldiers = state.soldiers.filter((s) => !s.merc);
    logEvent(state, 'Your coffers run dry — the mercenaries desert!', 'bad');
  }
}
