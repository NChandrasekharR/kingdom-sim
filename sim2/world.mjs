// Agent-based model of the redesigned kingdom.
// Buildings have HP (=capacity) and local stockpiles. Villagers are discrete
// agents with jobs, skills, and needs. This models the NEW mechanics — it is
// deliberately independent of the game's current code.

import { makeRng } from './rng.mjs';

const RESOURCES = ['food', 'wood', 'stone', 'ore', 'iron', 'bread', 'gold'];
const PRODUCERS = ['farm', 'dock', 'lumber', 'quarry', 'mine', 'smelter', 'bakery'];

let _bid = 1, _vid = 1;

export class World {
  constructor(P, seed) {
    this.P = P;
    this.rng = makeRng(seed);
    this.tick = 0;
    this.res = { food: P.startFood ?? 40, wood: 60, stone: 30, ore: 0, iron: 0, bread: 0, gold: 10 };
    this.buildings = [];
    this.villagers = [];
    this.raiders = [];
    this.raid = { phase: 'quiet', timer: this.P.raid.baseGapTicks, wave: 0 };
    this.log = [];
    this.stats = { raids: 0, warlords: 0, buildingsLost: 0, buildingsSacked: 0,
      villagersLost: 0, mastersLost: 0, starvationDeaths: 0, outputLostToHp: 0,
      villagersHunted: 0, ticksInCrisis: 0, peakPop: 6, recoveryTicks: [] };
    this._shockPop = null;

    // found the keep + starting village
    this.addBuilding('keep', { popCap: 10, influence: 11 });
    this.addBuilding('farm');
    this.addBuilding('farm');
    this.addBuilding('lumber');
    this.addBuilding('house');
    for (let i = 0; i < (P.startPop ?? 6); i++) this.addVillager();
  }

  // ── construction ──────────────────────────────────────────────────
  addBuilding(type, extra = {}) {
    const HP = { keep: 300, tower: 90, barracks: 90, church: 80, wall: 120 };
    const maxHp = HP[type] || 60;
    const b = {
      id: _bid++, type, hp: maxHp, maxHp,
      stock: {}, workers: [], assigned: 0,
      popCap: extra.popCap || (type === 'house' ? this.P.prod.house.popCap : 0),
      supplyCut: false,
      // buildings raised early sit in the town core and auto-distribute
      inCore: this.buildings.length < this.P.logistics.coreBuildings,
    };
    for (const r of RESOURCES) b.stock[r] = 0;
    this.buildings.push(b);
    return b;
  }

  addVillager(job = 'idle') {
    const v = {
      id: _vid++, job, workplace: null,
      skills: {}, // per job-key proficiency
      hunger: 0, alive: true,
    };
    this.villagers.push(v);
    return v;
  }

  count(type) { return this.buildings.filter((b) => b.type === type && b.hp > 0).length; }
  get pop() { return this.villagers.filter((v) => v.alive).length; }
  get soldiers() { return this.villagers.filter((v) => v.alive && v.job === 'soldier'); }
  get popCap() { return this.buildings.reduce((s, b) => s + (b.hp > 0 ? b.popCap : 0), 0); }

  outputMult(b) {
    const { outputFloor, outputCurve } = this.P.hp;
    const frac = Math.max(0, b.hp / b.maxHp);
    return outputFloor + (1 - outputFloor) * Math.pow(frac, outputCurve);
  }

  // skill key: producers skill by building type; others by job
  skillKey(v) { return v.job === 'producer' && v.workplace ? v.workplace.type : v.job; }
  skillOf(v) {
    const k = this.skillKey(v);
    return v.skills[k] || 0;
  }

  // ── the tick ──────────────────────────────────────────────────────
  step() {
    this.tick++;
    const P = this.P;
    const winter = this.season() === 3;

    this.assignJobs();       // player policy: who does what
    this.runProduction(winter);
    this.runLogistics();
    this.runMaintenance();
    this.runConsumption(winter);
    this.gainSkills();
    this.decayHp();
    this.runRaids();
    this.runPlayerBuild();
    this.trackCrisis();

    if (this.pop > this.stats.peakPop) this.stats.peakPop = this.pop;
  }

  season() { return Math.floor(this.tick / 120) % 4; }
  year() { return 1 + Math.floor(this.tick / this.P.ticksPerYear); }

  prosperity() {
    let v = 0;
    for (const r of RESOURCES) v += this.res[r] * (r === 'gold' ? 1.5 : 1);
    v += this.buildings.filter((b) => b.hp > 0).length * 20 + this.pop * 5;
    // skilled villagers ARE wealth (tests the "snowball relocated" risk)
    v += this.villagers.reduce((s, x) => s + (x.alive ? this.skillOf(x) * 15 : 0), 0);
    return v;
  }

  // ── player awareness (B1 tiers) ───────────────────────────────────
  // The passive bot (iq 0) never reads any of these signals.
  raidTelegraphed() {
    return this.raid.phase === 'quiet' && this.raid.timer < this.P.player.raidAlertTicks &&
      this.year() >= this.P.raid.firstYear;
  }
  // muster = keep the army up: from the telegraph through the fight
  mustering() {
    return !!this.P.player.iq && (this.raid.phase === 'active' || this.raidTelegraphed());
  }
  // surge = throw extra labor at repair: before the raid (top up HP so sacking
  // takes longer) and after it (recover output fast). NOT during — repairing
  // under active raider damage is wasted labor a competent player doesn't spend.
  surging() {
    if (!this.P.player.iq || this.raid.phase === 'active') return false;
    return this.raidTelegraphed() || (this._surgeUntil && this.tick < this._surgeUntil);
  }

  // What a competent player expects the next wave to bring (mirrors spawnRaid).
  expectedRaidSize() {
    const R = this.P.raid;
    let size = R.sizeBase + Math.pow(this.prosperity(), R.prosperityExpo) / R.prosperityDivisor
      + this.soldiers.length * R.militaryPressure;
    if (R.rubberBand) {
      size *= Math.max(R.minSizeMult, Math.min(1.2, 1 - (this._lastSacked || 0) * R.easeAfterSack));
    }
    return Math.min(R.sizeCap, Math.max(1, Math.round(size)));
  }

  // Smart tiers keep a standing army sized to the threat — but capped by what
  // the population can absorb. Combat attrition is flat per tick fought, so
  // soldiers are ablative: a small kingdom that fields a militia feeds its
  // producers into a meat grinder (tried; it collapses faster than passivity).
  // Towers do the early killing; soldiers come with population depth.
  armyTarget() {
    const P = this.P.player;
    const want = Math.max(P.peacetimeSoldiers, Math.ceil(this.expectedRaidSize() * P.threatArmyFactor));
    return Math.min(want, Math.floor(this.pop / P.popPerSoldier));
  }

  // Repair threshold by tier: passive is fixed; competent surges around raids;
  // sharp also keeps peacetime HP high so weakHp targeting finds nothing soft.
  repairThreshold(surge) {
    const P = this.P.player;
    if (!P.iq) return P.maintenanceThreshold;
    if (surge) return P.surgeRepairThreshold;
    return P.iq >= 2 ? Math.max(P.maintenanceThreshold, P.sharpMaintenance)
                     : P.maintenanceThreshold;
  }

  // ── player labor allocation (auto) ────────────────────────────────
  assignJobs() {
    const P = this.P;
    const surge = this.surging();
    const alive = this.villagers.filter((v) => v.alive);

    // smart tiers track the army to the threat: stand down only what exceeds
    // the current target (e.g. after rubber-band mercy shrinks the next wave)
    if (P.player.iq && !this.mustering()) {
      const excess = this.soldiers.length - this.armyTarget();
      if (excess > 0) {
        // stand down the least-skilled first, keeping veterans
        const bySkill = [...this.soldiers].sort((a, b) => (a.skills.soldier || 0) - (b.skills.soldier || 0));
        for (const s of bySkill.slice(0, excess)) s.job = 'idle';
      }
    }

    // reset non-soldier jobs; soldiers persist
    for (const v of alive) {
      if (v.job !== 'soldier') { v.job = 'idle'; v.workplace = null; }
    }
    let pool = alive.filter((v) => v.job !== 'soldier');

    // 1. builders for maintenance: enough to fix everything below threshold.
    // The smart tiers cap this — no competent player strips their farms bare
    // to swing hammers, no matter how much is damaged.
    const needRepair = this.buildings.filter(
      (b) => b.hp > 0 && b.hp < b.maxHp * this.repairThreshold(surge));
    const perBuilder = surge ? 1.2 : 2;
    let buildersWanted = Math.min(pool.length, Math.ceil(needRepair.length / perBuilder) +
      (this._pendingBuild ? 1 : 0));
    if (P.player.iq) {
      buildersWanted = Math.min(buildersWanted,
        Math.max(1, Math.floor(pool.length * P.player.maxBuilderFrac)));
      // NEVER repair while raiders are inside the walls: healing a sacked
      // building past half HP lets it be sacked afresh — and each re-sack
      // rolls worker deaths. Mid-raid repair is a meat grinder (measured).
      if (this.raid.phase === 'active') buildersWanted = 0;
    }
    const builders = pool.splice(0, buildersWanted);
    for (const v of builders) { v.job = 'builder'; }

    // 2. haulers, scaled to PERIPHERAL buildings only (core hauls for free)
    if (P.player.haulersAuto) {
      const peripheral = this.buildings.filter((b) => b.hp > 0 && !b.inCore &&
        (this.P.prod[b.type]?.out || this.needsInput(b)));
      const haulersWanted = Math.min(pool.length,
        Math.ceil(peripheral.length / P.logistics.haulerPerBuildings));
      const haulers = pool.splice(0, haulersWanted);
      for (const v of haulers) v.job = 'hauler';
    }

    // 2b. watchmen: one villager per tower keeps it firing (competes for the
    // same civilian labor as production — a wall of towers costs you hands).
    // this._staffedTowers is read by the tower volley in updateRaiders().
    if (P.raid.towerNeedsWatchman) {
      const towers = this.count('tower');
      const watchmen = pool.splice(0, Math.min(pool.length, towers));
      for (const v of watchmen) v.job = 'watchman';
      this._staffedTowers = watchmen.length;
    } else {
      this._staffedTowers = this.count('tower');
    }

    // 3. producers: fill buildings by priority, best-skilled first.
    // The passive bot fills each type completely before the next — so every
    // lumber camp gets hands before the first quarry does, and stone (towers!)
    // can starve for years. Smart tiers stage one camp + one quarry before
    // filling out the rest.
    for (const b of this.buildings) b.workers = [];
    const fillType = (type, maxBuildings) => {
      let filled = 0;
      for (const b of this.buildings) {
        if (b.type !== type || b.hp <= 0) continue;
        if (filled >= maxBuildings) break;
        const want = (P.prod[type] && P.prod[type].workers) || 0;
        if (b.workers.length >= want) continue;
        for (let i = b.workers.length; i < want && pool.length; i++) {
          // pick the villager with the best skill for this building type
          let bestI = 0, bestSk = -1;
          for (let j = 0; j < pool.length; j++) {
            const sk = pool[j].skills[type] || 0;
            if (sk > bestSk) { bestSk = sk; bestI = j; }
          }
          const v = pool.splice(bestI, 1)[0];
          v.job = 'producer'; v.workplace = b; b.workers.push(v);
        }
        filled++;
      }
    };
    const passes = P.player.iq
      ? [['farm', Infinity], ['dock', Infinity], ['lumber', 1], ['quarry', 1],
         ['lumber', Infinity], ['quarry', Infinity], ['mine', Infinity],
         ['smelter', Infinity], ['bakery', Infinity], ['market', Infinity]]
      : [['farm', Infinity], ['dock', Infinity], ['lumber', Infinity], ['quarry', Infinity],
         ['mine', Infinity], ['smelter', Infinity], ['bakery', Infinity], ['market', Infinity]];
    for (const [type, max] of passes) fillType(type, max);
    this.idle = pool.length;
    for (const v of pool) v.job = 'idle';
  }

  needsInput(b) {
    const def = this.P.prod[b.type];
    return def && def.in;
  }

  // ── production, scaled by HP × skill × staffing × supply ───────────
  runProduction(winter) {
    for (const b of this.buildings) {
      const def = this.P.prod[b.type];
      if (!def || b.hp <= 0) continue;
      const want = def.workers || 0;
      if (want === 0 && b.type !== 'market') continue;

      const staffing = want > 0 ? b.workers.length / want : 1;
      if (staffing <= 0) continue;
      const hpMult = this.outputMult(b);
      // average skill of the crew → output bonus (Pillar B)
      const skillMult = 1 + (b.workers.reduce((s, v) => s + (v.skills[b.type] || 0), 0)
        / Math.max(1, b.workers.length));

      // record the output lost purely to HP degradation (headline metric)
      if (def.out) {
        for (const r of Object.keys(def.out)) {
          const full = def.out[r] * staffing * skillMult * (winter && def.winterMult ? def.winterMult : 1);
          this.stats.outputLostToHp += full * (1 - hpMult);
        }
      }

      // conversion buildings: gated by LOCAL input stock (logistics)
      if (def.in) {
        let scale = staffing * hpMult;
        for (const r of Object.keys(def.in)) {
          const have = b.stock[r];
          if (have < this.P.logistics.starveIfBelow) { scale = 0; break; }
          scale = Math.min(scale, have / def.in[r]);
        }
        if (scale > 0.001) {
          for (const r of Object.keys(def.in)) b.stock[r] -= def.in[r] * scale;
          for (const r of Object.keys(def.out)) b.stock[r] = (b.stock[r] || 0) + def.out[r] * scale * skillMult;
        }
      } else if (def.out) {
        const winterMult = winter && def.winterMult ? def.winterMult : 1;
        for (const r of Object.keys(def.out)) {
          b.stock[r] = (b.stock[r] || 0) + def.out[r] * staffing * hpMult * skillMult * winterMult;
        }
      }
      if (b.type === 'market' && b.workers.length > 0) {
        const tax = this.pop * 0.012 * hpMult;
        this.res.gold += tax;
      }
    }
  }

  // ── logistics: core auto-distributes; periphery needs hauler capacity ─
  runLogistics() {
    const haulers = this.villagers.filter((v) => v.alive && v.job === 'hauler');
    const haulPenalty = (this._haulPenaltyUntil && this.tick < this._haulPenaltyUntil) ? 0.5 : 1;
    let capacity = haulPenalty * haulers.reduce((s, v) => s + this.P.logistics.haulerCarry *
      (1 + (v.skills.hauler || 0)), 0);

    // Core buildings move goods for free (short walk to the town square).
    // Peripheral buildings draw on hauler capacity; when it runs out, their
    // goods pile up (output wasted) and their inputs starve (supplyCut).
    const pull = (b) => {
      const def = this.P.prod[b.type];
      if (!def || !def.out) return;
      for (const r of Object.keys(def.out)) {
        const move = b.inCore ? b.stock[r] : Math.min(b.stock[r], capacity);
        if (move <= 0) continue;
        b.stock[r] -= move; this.res[r] += move;
        if (!b.inCore) capacity -= move;
      }
    };
    const deliver = (b) => {
      const def = this.P.prod[b.type];
      if (!def || !def.in) return;
      b.supplyCut = false;
      for (const r of Object.keys(def.in)) {
        const need = this.P.logistics.stockpileCap - b.stock[r];
        if (need <= 0) continue;
        const cap = b.inCore ? Infinity : capacity;
        const avail = Math.min(need, this.res[r], cap);
        if (avail <= 0) {
          if (b.stock[r] < this.P.logistics.starveIfBelow) b.supplyCut = true;
          continue;
        }
        this.res[r] -= avail; b.stock[r] += avail;
        if (!b.inCore) capacity -= avail;
      }
    };

    // core first (free), then periphery (spends capacity), outputs before inputs
    const live = this.buildings.filter((b) => b.hp > 0);
    for (const b of live) if (b.inCore) pull(b);
    for (const b of live) if (b.inCore) deliver(b);
    for (const b of live) if (!b.inCore) pull(b);
    for (const b of live) if (!b.inCore) deliver(b);

    // overflow backpressure everywhere
    for (const b of live) {
      for (const r of RESOURCES) {
        if (b.stock[r] > this.P.logistics.stockpileCap) b.stock[r] = this.P.logistics.stockpileCap;
      }
    }
  }

  // ── maintenance: builders spend labor + materials to restore HP ────
  runMaintenance() {
    const builders = this.villagers.filter((v) => v.alive && v.job === 'builder');
    if (!builders.length) return;
    const P = this.P.hp;
    // sort damaged buildings worst-first
    const damaged = this.buildings
      .filter((b) => b.hp > 0 && b.hp < b.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    let laborLeft = builders.reduce((s, v) => s + P.repairPerBuilderTick *
      (1 + (v.skills.builder || 0)), 0);

    for (const b of damaged) {
      if (laborLeft <= 0) break;
      const missing = b.maxHp - b.hp;
      let heal = Math.min(missing, laborLeft);
      // gated by materials
      const woodOk = this.res.wood / (heal * P.repairWoodPerHp || 1);
      const stoneOk = this.res.stone / (heal * P.repairStonePerHp || 1);
      heal = Math.min(heal, missing, this.res.wood / P.repairWoodPerHp, this.res.stone / P.repairStonePerHp);
      if (heal <= 0) break;
      this.res.wood -= heal * P.repairWoodPerHp;
      this.res.stone -= heal * P.repairStonePerHp;
      b.hp += heal;
      if (b._sacked && b.hp > b.maxHp * 0.5) b._sacked = false; // repaired past half → can be sacked afresh
      laborLeft -= heal;
    }
  }

  // ── consumption: villagers eat; starvation drops output then kills ─
  runConsumption(winter) {
    const P = this.P.villager;
    let need = 0;
    for (const v of this.villagers) {
      if (!v.alive) continue;
      need += P.eatPerTick * (v.job === 'soldier' ? P.soldierEatMult : 1);
    }
    // eat bread (2 eq) then food
    let supplied = 0;
    const fromBread = Math.min(this.res.bread * this.P.breadFoodEq, need);
    this.res.bread -= fromBread / this.P.breadFoodEq; supplied += fromBread;
    const fromFood = Math.min(this.res.food, need - supplied);
    this.res.food -= fromFood; supplied += fromFood;

    const deficit = need - supplied;
    const fed = need > 0 ? supplied / need : 1;
    // distribute hunger: if underfed, villagers accumulate hunger
    if (deficit > 0.001) {
      for (const v of this.villagers) {
        if (!v.alive) continue;
        v.hunger += (1 - fed);
        if (v.hunger >= P.starveDeathTicks) {
          v.alive = false;
          this.stats.villagersLost++; this.stats.starvationDeaths++;
          if (this.skillOf(v) > 0.6) this.stats.mastersLost++;
        }
      }
    } else {
      for (const v of this.villagers) if (v.alive) v.hunger = Math.max(0, v.hunger - 2);
    }
    this._fed = fed;

    // spoilage: raw food above a per-capita buffer rots (bread keeps). This is
    // what makes bread the winter/siege RESERVE — convert surplus or lose it.
    const F = this.P.food;
    if (F && F.spoilEnabled) {
      const freeFood = this.pop * P.eatPerTick * F.spoilFreeDays;
      const excess = this.res.food - freeFood;
      if (excess > 0) {
        const spoiled = excess * F.spoilRate;
        this.res.food -= spoiled;
        this.stats.foodSpoiled = (this.stats.foodSpoiled || 0) + spoiled;
      }
    }

    // growth: surplus food + housing headroom
    const stock = this.res.food + this.res.bread * this.P.breadFoodEq;
    if (deficit <= 0 && stock > this.pop * this.P.villager.eatPerTick * 40 && this.pop < this.popCap) {
      this._growAcc = (this._growAcc || 0) + 0.02;
      if (this._growAcc >= 1) { this._growAcc = 0; this.addVillager(); }
    }
  }

  // ── skills: rise with use, fade when idle; masters lift apprentices ─
  gainSkills() {
    const P = this.P.skill;
    // guild memory: once any master of a type has existed, the craft retains a
    // baseline so one death can't wipe the knowledge (Finding 5 knowledge floor).
    this._guilds = this._guilds || new Set();
    const masterTypes = new Set();
    for (const v of this.villagers) {
      if (v.alive && v.job === 'producer' && v.workplace && this.skillOf(v) >= 0.6) {
        masterTypes.add(v.workplace.type);
        this._guilds.add(v.workplace.type);
      }
    }
    for (const v of this.villagers) {
      if (!v.alive) continue;
      const k = this.skillKey(v);
      if (v.job === 'idle') {
        for (const sk of Object.keys(v.skills)) v.skills[sk] = Math.max(0, v.skills[sk] - P.decayPerTickIdle);
        continue;
      }
      v.skills[k] = v.skills[k] || 0;
      // apprentice floor: strong if a living master is present, weaker (guild
      // memory) if the craft was once mastered here.
      if (v.job === 'producer' && v.workplace) {
        if (masterTypes.has(v.workplace.type)) v.skills[k] = Math.max(v.skills[k], P.apprenticeFloor);
        else if (this._guilds.has(v.workplace.type)) v.skills[k] = Math.max(v.skills[k], P.guildFloorFromMaster);
      }
      v.skills[k] = Math.min(P.max, v.skills[k] + P.gainPerTick);
    }
  }

  decayHp() {
    const P = this.P.hp;
    for (const b of this.buildings) {
      if (b.hp <= 0 || b.type === 'keep') continue;
      const mult = b.supplyCut ? this.P.logistics.cutoffDecayMult : 1;
      b.hp = Math.max(0, b.hp - P.decayPerTick * mult);
    }
  }

  // ── raids (Pillar C) ──────────────────────────────────────────────
  runRaids() {
    const P = this.P.raid;
    const raid = this.raid;

    if (raid.phase === 'quiet') {
      raid.timer--;
      if (this.year() >= P.firstYear && raid.timer <= 0) this.spawnRaid();
    } else if (raid.phase === 'active') {
      this.updateRaiders();
      this.updateSoldiers();
      this.resolveHunt();   // raiders that survived the shield run down civilians
      // withdrawal (Finding 8.3): raiders don't winter over — a defenseless
      // town is looted hard but the raid still ENDS
      if (this.tick - (this._raidStartTick || 0) > P.maxRaidTicks) this.raiders = [];
      // satiation: a raider with a full sack goes home content
      else this.raiders = this.raiders.filter((rd) => rd.loot < P.lootSatiation);
      if (this.raiders.length === 0) {
        raid.phase = 'quiet';
        this._lastSacked = this._sackedThisRaid || 0;
        // competent player keeps repair surged after the raiders leave
        if (this.P.player.iq) this._surgeUntil = this.tick + this.P.player.postRaidSurgeTicks;
        // gap shrinks as prosperity rises → more frequent; but a raid that hurt
        // buys extra recovery time (rubber-band).
        const pr = this.prosperity();
        const mercy = P.rubberBand ? this._lastSacked * 4 : 0;
        raid.timer = Math.max(120, P.baseGapTicks + this.rng.int(P.gapJitter) - Math.min(180, pr / 12) + mercy);
        // record recovery: ticks until output back to pre-raid
        if (this._raidStartProsp) {
          this._recoveryFrom = { tick: this.tick, target: this._raidStartProsp };
        }
      }
    }
    // measure recovery
    if (this._recoveryFrom) {
      if (this.prosperity() >= this._recoveryFrom.target) {
        this.stats.recoveryTicks.push(this.tick - this._recoveryFrom.tick);
        this._recoveryFrom = null;
      } else if (this.tick - this._recoveryFrom.tick > 2000) {
        this.stats.recoveryTicks.push(9999); // never recovered
        this._recoveryFrom = null;
      }
    }
  }

  spawnRaid() {
    const P = this.P.raid;
    const raid = this.raid;
    raid.wave++;
    this._raidStartProsp = this.prosperity();
    this._raidStartTick = this.tick;
    this._sackedThisRaid = 0;
    this._huntedThisRaid = 0;

    // warlord: on a fixed wave cadence, but only once the kingdom is worth it.
    // (ticksPerYear lives at the top level of params, NOT in the raid block —
    // reading it off P made this NaN and silently disabled warlords for every
    // campaign to date; found 2026-07-16 while validating tribute.)
    const wavesPerWarlord = Math.max(1, Math.round(P.warlordEveryYears * this.P.ticksPerYear / P.baseGapTicks));
    const isWarlord = P.warlordEveryYears > 0 && this.pop >= (P.warlordMinPop || 0) &&
      raid.wave % wavesPerWarlord === 0;

    let size = P.sizeBase + Math.pow(this.prosperity(), P.prosperityExpo) / P.prosperityDivisor
      + this.soldiers.length * P.militaryPressure;

    // rubber-band: last raid's damage eases this one (mercy after a beating);
    // an unscathed fat kingdom gets no mercy.
    if (P.rubberBand) {
      const ease = 1 - (this._lastSacked || 0) * P.easeAfterSack;
      raid._sizeMult = Math.max(P.minSizeMult, Math.min(1.2, ease));
      size *= raid._sizeMult;
    }
    if (isWarlord) size *= P.warlordSizeMult;
    size = Math.min(P.sizeCap, Math.max(1, Math.round(size)));

    // Danegeld: a warlord would as soon take gold as blood. The demand reads
    // the treasury; paying skips the wave but whets the appetite. Refusing —
    // facing him — resets it: the legend of easy coin dies with the demand.
    if (isWarlord && P.tribute?.enabled) {
      const demand = Math.max(P.tribute.demandMin, Math.round(
        this.res.gold * P.tribute.demandFrac *
        Math.pow(P.tribute.appetiteMult, this._tributeAppetite || 0)));
      if (this._paysTribute(size, demand)) {
        this.res.gold -= demand;
        this._tributeAppetite = (this._tributeAppetite || 0) + 1;
        this.stats.tributeGold = (this.stats.tributeGold || 0) + demand;
        this.stats.tributesPaid = (this.stats.tributesPaid || 0) + 1;
        raid.phase = 'quiet';
        raid.timer = Math.max(120, P.baseGapTicks + this.rng.int(P.gapJitter)
          - Math.min(180, this.prosperity() / 12));
        this.log.push({ tick: this.tick, kind: 'raid', text: `Tribute paid: ${demand} gold (appetite ${this._tributeAppetite})` });
        return;
      }
      this._tributeAppetite = 0;
    }
    if (isWarlord) this.stats.warlords++;

    this.raiders = [];
    for (let i = 0; i < size; i++) {
      this.raiders.push({
        hp: P.raiderHp * (isWarlord ? 1.5 : 1),
        target: this.pickTarget(),
        loot: 0,
      });
    }
    raid.phase = 'active';
    this.stats.raids++;
    this.log.push({ tick: this.tick, kind: 'raid', text: `Raid: ${size} raiders${isWarlord ? ' (WARLORD)' : ''}` });
  }

  // Does this player pay the warlord off? The passive bot never does. A
  // competent player pays when the wave looks stronger than the shield
  // (soldiers + staffed towers); a sharp player also refuses to be bled dry.
  _paysTribute(size, demand) {
    const pol = this.P.player.tributePolicy || 'auto';
    if (pol === 'never' || !this.P.player.iq) return false;   // the passive bot never pays
    if (this.res.gold < demand) return false;
    if (pol === 'always') return true;             // the danegeld habit (worst case for the spiral)
    // 'auto': pay only when the wave looks stronger than the shield. A soldier
    // accounts for ~2 raiders over a raid, a staffed tower ~3 (kills for free).
    const shield = this.soldiers.length * 2 + (this._staffedTowers ?? this.count('tower')) * 3;
    if (shield >= size) return false;              // we can take him — keep the coin
    if (this.P.player.iq >= 2 && demand > this.res.gold * 0.5) return false;  // sharp: never gutted
    return true;
  }

  pickTarget() {
    const cands = this.buildings.filter((b) => b.hp > 0 && b.type !== 'keep');
    if (!cands.length) return null;
    const mode = this.P.raid.targeting;
    if (mode === 'random') return this.rng.pick(cands);
    if (mode === 'weakHp') {
      return cands.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    }
    if (mode === 'chokepoint') {
      // buildings that feed others (producers of inputs) are high-value
      const val = (b) => (['lumber', 'mine', 'farm'].includes(b.type) ? 3 : 1);
      return this.weightedPick(cands, val);
    }
    // 'value': granaries/markets/refiners first
    const val = (b) => (b.type === 'market' ? 6 : b.type === 'smelter' || b.type === 'bakery' ? 4 : 1.5);
    return this.weightedPick(cands, val);
  }

  weightedPick(arr, valFn) {
    let total = 0; for (const a of arr) total += valFn(a);
    let r = this.rng.next() * total;
    for (const a of arr) { r -= valFn(a); if (r <= 0) return a; }
    return arr[arr.length - 1];
  }

  updateRaiders() {
    const P = this.P.raid;

    // watchtowers fire first (abstract: each STAFFED tower kills DPS worth of
    // raiders). An unmanned tower is inert — staffing set in assignJobs.
    const towers = this._staffedTowers ?? this.count('tower');
    if (towers > 0 && this.raiders.length) {
      let arrowDmg = towers * P.towerDmg;
      for (const rd of this.raiders) {
        if (arrowDmg <= 0) break;
        const hit = Math.min(rd.hp, arrowDmg);
        rd.hp -= hit; arrowDmg -= hit;
      }
      this.raiders = this.raiders.filter((rd) => rd.hp > 0);
    }

    for (const rd of this.raiders) {
      if (rd.hp <= 0) continue;
      let t = rd.target;
      // retarget if gone OR already sacked (below abandon threshold)
      if (!t || t.hp <= 0 || t.hp < t.maxHp * P.abandonHpFrac) { rd.target = this.pickTarget(); t = rd.target; }
      if (!t) continue;
      // damage HP (the core: they degrade capacity, not just destroy)
      t.hp -= P.raiderDmgPerTick;
      // loot from global pool
      for (const r of ['gold', 'iron', 'bread', 'food', 'wood', 'stone', 'ore']) {
        if (this.res[r] > 0.5) { const take = Math.min(P.lootPerTick, this.res[r]); this.res[r] -= take; rd.loot += take; break; }
      }
      // buildings are SACKED (survive at low HP), only rarely destroyed outright
      if (t.hp < t.maxHp * P.abandonHpFrac) {
        if (!t._sacked) { t._sacked = true; this.stats.buildingsSacked++; this._sackedThisRaid = (this._sackedThisRaid || 0) + 1; }
        t.hp = Math.max(1, t.maxHp * P.abandonHpFrac);       // left standing, gutted
        if (P.raidCivDeathModel === 'sack') {
          // LEGACY model (A/B control): a sacked building may cost a worker's
          // life, once per raid (Finding 8.2: mid-raid repair mustn't re-feed it)
          if (t._deathRolledWave !== this.raid.wave) {
            t._deathRolledWave = this.raid.wave;
            for (const v of t.workers) {
              if (this.rng.chance(0.12)) {
                v.alive = false; this.stats.villagersLost++;
                if (this.skillOf(v) > 0.6) this.stats.mastersLost++;
              }
            }
          }
        } else {
          // HUNT model: workers EJECT (flee → idle), joining the exposed pool
          // that resolveHunt() runs down. No death here — you die caught in
          // the open, not at your post.
          for (const v of t.workers) { v.job = 'idle'; v.workplace = null; }
          t.workers = [];
        }
      }
    }
    this.raiders = this.raiders.filter((rd) => rd.hp > 0);
  }

  updateSoldiers() {
    const soldiers = this.soldiers;
    const C = this.P.combat;
    const SOLDIER_HP = 60;
    // lazily give each soldier a wound pool; mend when no raid is on
    for (const s of soldiers) {
      if (s.hp === undefined) s.hp = SOLDIER_HP;
      if (!this.raiders.length) s.hp = Math.min(SOLDIER_HP, s.hp + C.healPerTickIdle);
    }
    if (!this.raiders.length) return;

    if (C.model === 'flat') { this._updateSoldiersFlat(soldiers); return; }

    // — probabilistic model —
    const Pp = this.P.player;
    const sharpDmg = Pp.iq >= 2 ? Pp.sharpCombatMult : 1;
    // force-ratio: outnumber the raiders → wounds scale toward zero (Finding 8.1)
    const ratio = Math.min(1, this.raiders.length / Math.max(1, soldiers.length));
    // tower cover: staffed towers shelter a fraction of the soldiers
    const towers = this._staffedTowers ?? this.count('tower');
    const coverFrac = Math.min(1, (towers * 1.0) / Math.max(1, soldiers.length));
    // is there a living veteran on the field? (rookies season near one)
    const hasVeteran = soldiers.some((s) => (s.skills.soldier || 0) >= C.seasonVeteranSkill);

    for (let i = 0; i < soldiers.length; i++) {
      const s = soldiers[i];
      if (!this.raiders.length) break;
      const skill = s.skills.soldier || 0;
      const target = this.raiders[0];

      // OFFENSE: hit, with a skill-scaled crit chance (veterans burst)
      const crit = this.rng.chance(C.baseCrit + skill * C.critSkillScale);
      target.hp -= C.soldierBaseDmg * (1 + skill) * sharpDmg * (crit ? C.critMult : 1);

      // DEFENSE: does the raider wound this soldier this exchange?
      let woundChance = C.woundBase * ratio;           // force-ratio softens it
      woundChance *= (1 - C.woundSkillReduce * skill);  // veterans get hit less
      woundChance *= (1 - C.homeGroundReduce);          // sim raids are all home defense
      if (i / soldiers.length < coverFrac) woundChance *= (1 - C.towerCoverReduce); // under a tower
      if (this.rng.chance(woundChance)) {
        s.hp -= C.woundHp;
        // KILL only if already badly wounded — and the odds scale with conditions:
        // good ground (outnumbering, covered) → survivable; bad → lethal
        if (s.hp <= SOLDIER_HP * C.killWoundedFrac) {
          const bad = ratio;   // 0 (dominating) → 1 (fully outnumbered)
          const killChance = C.killChanceGood + (C.killChanceBad - C.killChanceGood) * bad;
          if (s.hp <= 0 || this.rng.chance(killChance)) {
            s.alive = false; this.stats.villagersLost++;
          }
        }
      }

      // SEASONING: a rookie fighting beside a veteran learns fast under fire
      if (hasVeteran && skill < C.seasonVeteranSkill) {
        s.skills.soldier = Math.min(this.P.skill.max,
          (s.skills.soldier || 0) + this.P.skill.gainPerTick * (C.seasonRookieBonus - 1));
      }
    }
    this.raiders = this.raiders.filter((rd) => rd.hp > 0);
  }

  // legacy flat model, kept as the A/B control (combat.model='flat')
  _updateSoldiersFlat(soldiers) {
    const Pp = this.P.player;
    const combatMult = Pp.iq >= 2 ? Pp.sharpCombatMult : 1;
    const baseDeath = Pp.iq >= 2 ? Pp.sharpSoldierDeathChance : this.P.raid.soldierDeathBase;
    const ratio = this.raiders.length / Math.max(1, soldiers.length);
    const deathChance = baseDeath * Math.min(1, ratio);
    for (const s of soldiers) {
      if (!this.raiders.length) break;
      const dmg = 8 * (1 + (s.skills.soldier || 0)) * combatMult;
      this.raiders[0].hp -= dmg;
      if (this.rng.chance(deathChance)) { s.alive = false; this.stats.villagersLost++; }
    }
    this.raiders = this.raiders.filter((rd) => rd.hp > 0);
  }

  // Raiders that survived the towers + soldiers run down exposed civilians
  // (Phase 2a spatial-combat proxy — no coordinates). Runs LAST in the raid
  // tick, so a well-defended town leaves ~0 free raiders and hunting vanishes.
  resolveHunt() {
    const P = this.P.raid;
    if (P.raidCivDeathModel !== 'hunt' || !this.raiders.length) return;
    // a chase is an occasional event, not a per-tick grind — raiders spend most
    // of the raid looting buildings. Firing every tick made the toll scale with
    // raid DURATION (200 ticks) and swamped the balance; the cadence bounds it.
    if (P.huntCadenceTicks > 1 && this.tick % P.huntCadenceTicks !== 0) return;

    // civilians = alive non-soldiers (watchmen included — they flee if the
    // tower falls). Order most-exposed first: idle/ejected → periphery
    // producers → core workers/builders (rewards keeping folk in the core).
    const civilians = this.villagers.filter((v) => v.alive && v.job !== 'soldier');
    if (!civilians.length) return;
    const exposure = (v) => {
      if (v.job === 'idle') return 0;                 // in the open / just ejected
      if (v.job === 'builder') return 3;              // near the works/core
      return v.workplace && !v.workplace.inCore ? 1 : 2; // periphery vs core
    };
    civilians.sort((a, b) => exposure(a) - exposure(b));

    // housing shelters the first popCap*frac; soldiers pin raiders off the hunt
    const shelter = this.popCap * P.huntShelterFrac;
    const exposedBase = Math.max(0, civilians.length - shelter);
    const pinned = this.soldiers.length * P.huntSoldierPin;
    const freeRaiders = Math.max(0, this.raiders.length - pinned);
    let engaged = Math.min(exposedBase, Math.ceil(freeRaiders * P.huntReachPerRaider));
    // optional hard cap on hunt deaths per raid (0 = uncapped)
    if (P.huntDeathsPerRaidCap > 0) {
      const remaining = P.huntDeathsPerRaidCap - (this._huntedThisRaid || 0);
      if (remaining <= 0) return;
    }
    if (engaged <= 0) return;

    for (let i = 0; i < engaged && i < civilians.length; i++) {
      const v = civilians[i];
      if (!v.alive) continue;
      const rd = this.raiders[i % this.raiders.length];
      // the villager swings back weakly first (a hoe, not a blade)
      if (rd) rd.hp -= P.huntVillagerDmg * (1 + 0.5 * this.skillOf(v));
      if (this.rng.chance(P.huntKillChance)) {
        v.alive = false;
        this.stats.villagersLost++;
        this.stats.villagersHunted++;
        this._huntedThisRaid = (this._huntedThisRaid || 0) + 1;
        if (this.skillOf(v) > 0.6) this.stats.mastersLost++;
        if (P.huntDeathsPerRaidCap > 0 && this._huntedThisRaid >= P.huntDeathsPerRaidCap) break;
      }
    }
    this.raiders = this.raiders.filter((rd) => rd.hp > 0);
  }

  // ── player builds & recruits (scripted) ───────────────────────────
  runPlayerBuild() {
    if (this.tick % 10 !== 0) return;
    const P = this.P.player;
    const pay = (cost) => {
      for (const r of Object.keys(cost)) if (this.res[r] < cost[r]) return false;
      for (const r of Object.keys(cost)) this.res[r] -= cost[r];
      return true;
    };

    // food capacity target (competent player pads the margin going into winter)
    const winterPrep = P.iq && this.season() === 2 ? P.winterFoodMult : 1;
    const foodCap = this.count('farm') * 0.5 + this.count('dock') * 0.4;
    const foodNeed = this.pop * this.P.villager.eatPerTick * P.foodMarginTarget * winterPrep;
    if (foodCap < foodNeed && pay({ wood: 15 })) { this.addBuilding('farm'); return; }

    // smart tiers build defense BEFORE comfort: an undefended raid never ends
    // (nothing kills the raiders), and everything else is downstream of that.
    // The passive bot reaches this check last and often never gets there.
    if (P.iq) {
      if (this.count('barracks') < 1 && this.year() + (this.tick % this.P.ticksPerYear) / this.P.ticksPerYear
          >= P.readyByYear && pay({ wood: 30, stone: 20 })) { this.addBuilding('barracks'); return; }
      const towersNeeded = Math.ceil(this.expectedRaidSize() / P.towerPerExpectedRaiders);
      if (this.count('tower') < towersNeeded && pay({ wood: 15, stone: 25 })) {
        this.addBuilding('tower'); return;
      }
    }

    // housing
    if (this.pop >= this.popCap - 1 && pay({ wood: 20 })) { this.addBuilding('house'); return; }

    // chains
    if (this.count('lumber') < 3 && pay({ wood: 10 })) { this.addBuilding('lumber'); return; }
    if (this.count('quarry') < 2 && this.res.wood > 40 && pay({ wood: 20 })) { this.addBuilding('quarry'); return; }
    if (this.count('mine') < 2 && this.res.wood > 50 && pay({ wood: 25, stone: 10 })) { this.addBuilding('mine'); return; }
    if (this.count('smelter') < 1 && this.res.ore > 15 && pay({ stone: 25, wood: 10 })) { this.addBuilding('smelter'); return; }
    // bakeries: 2 by default; a competent player builds MORE when food is piling
    // up, to convert the surplus into preserved bread (winter/siege reserve)
    // before spoilage eats it.
    const bakeryCap = (P.iq && this.P.food?.spoilEnabled && this.res.food > 200) ? 4 : 2;
    if (this.count('bakery') < bakeryCap && this.res.food > 80 && pay({ wood: 20, stone: 10 })) { this.addBuilding('bakery'); return; }
    if (this.count('market') < 1 && this.res.wood > 60 && pay({ wood: 30, stone: 15 })) { this.addBuilding('market'); return; }

    // ── defense readiness (a real player braces for the year-1 raid) ──
    const bracing = this.year() + (this.tick % this.P.ticksPerYear) / this.P.ticksPerYear >= P.readyByYear;
    if (this.count('barracks') < 1 && (bracing || this.res.iron >= 8) &&
        pay({ wood: 30, stone: 20 })) { this.addBuilding('barracks'); return; }
    // watchtowers scale with the town, and materials allow; smart tiers build
    // them to meet the expected wave — towers kill without dying or eating,
    // which makes them the backbone of a competent defense
    let towersWanted = Math.ceil(this.count('house') + this.count('farm')) / P.towerPerBuildings;
    if (P.iq) towersWanted = Math.max(towersWanted, Math.ceil(this.expectedRaidSize() / P.towerPerExpectedRaiders));
    if (this.count('tower') < towersWanted &&
        this.res.stone > 25 && pay({ wood: 15, stone: 25 })) { this.addBuilding('tower'); return; }

    // soldiers: recruit from idle pop; costs iron once, then food-upkeep (not gold).
    // passive bot keeps a fixed standing army; competent player musters to the
    // expected raid size when the telegraph fires, and stays lean otherwise
    // (demobilization happens in assignJobs).
    const mustering = this.mustering();
    let wantSoldiers;
    if (!P.iq) wantSoldiers = bracing ? Math.max(2, P.soldierTarget) : P.soldierTarget;
    else wantSoldiers = this.armyTarget();
    // the passive bot only recruits spare hands; smart tiers keep filling
    // toward the target whenever they're short
    if (this.soldiers.length < wantSoldiers && this.count('barracks') > 0 &&
        (this.idle > 1 || P.iq)) {
      let recruit = this.villagers.find((v) => v.alive && v.job === 'idle');
      // militia: pull the greenest producer if idle is dry — but only a kingdom
      // deep enough to absorb combat losses does this
      if (!recruit && P.iq && this.pop >= P.militiaMinPop) {
        const producers = this.villagers.filter((v) => v.alive && v.job === 'producer')
          .sort((a, b) => this.skillOf(a) - this.skillOf(b));
        recruit = producers[0];
      }
      if (recruit && this.res.iron >= 5) { this.res.iron -= 5; recruit.job = 'soldier'; }
      // bootstrap: if no iron yet but bracing/mustering, allow militia at wood
      // cost (smart tiers won't burn their repair reserve for it)
      else if (recruit && (bracing || mustering) &&
        this.soldiers.length < (P.iq ? wantSoldiers : 2) &&
        (!P.iq || this.res.wood > 30) && pay({ wood: 10 })) recruit.job = 'soldier';
    }

    // sell surplus (capped — the §4 liquidation sink). Smart tiers hold back a
    // repair reserve: enough materials to fix everything currently damaged.
    let missingHp = 0;
    if (P.iq) for (const b of this.buildings) if (b.hp > 0) missingHp += b.maxHp - b.hp;
    for (const r of ['wood', 'stone', 'iron']) {
      let keep = P.sellSurplusAbove;
      if (P.iq && r === 'wood') keep = Math.max(keep, missingHp * this.P.hp.repairWoodPerHp + 40);
      if (P.iq && r === 'stone') keep = Math.max(keep, missingHp * this.P.hp.repairStonePerHp + 20);
      if (this.res[r] > keep) {
        const sellQty = Math.min(this.res[r] - keep, P.merchantBuyCap);
        this.res[r] -= sellQty; this.res.gold += sellQty * 1.5;
      }
    }
  }

  trackCrisis() {
    // "crisis" = underfed OR >30% of buildings below half HP
    const weak = this.buildings.filter((b) => b.hp > 0 && b.hp < b.maxHp * 0.5).length;
    const total = this.buildings.filter((b) => b.hp > 0).length;
    const inCrisis = this._fed < 0.9 || (total > 0 && weak / total > 0.3);
    if (inCrisis) this.stats.ticksInCrisis++;
  }

  snapshot() {
    const masters = this.villagers.filter((v) => v.alive && this.skillOf(v) >= 0.6).length;
    const avgSkill = this.pop ? this.villagers.filter((v) => v.alive)
      .reduce((s, v) => s + this.skillOf(v), 0) / this.pop : 0;
    const avgHp = this.buildings.length ? this.buildings.reduce((s, b) => s + b.hp / b.maxHp, 0) / this.buildings.length : 0;
    return {
      tick: this.tick, year: this.year(), season: this.season(),
      pop: this.pop, popCap: this.popCap, soldiers: this.soldiers.length,
      idle: this.idle || 0, masters, avgSkill: +avgSkill.toFixed(3),
      buildings: this.buildings.filter((b) => b.hp > 0).length,
      avgHp: +avgHp.toFixed(3), supplyCut: this.buildings.filter((b) => b.supplyCut).length,
      food: +this.res.food.toFixed(0), bread: +this.res.bread.toFixed(0),
      wood: +this.res.wood.toFixed(0), stone: +this.res.stone.toFixed(0),
      iron: +this.res.iron.toFixed(0), gold: +this.res.gold.toFixed(0),
      prosperity: +this.prosperity().toFixed(0),
      raids: this.stats.raids, buildingsLost: this.stats.buildingsLost,
      villagersLost: this.stats.villagersLost, fed: +(this._fed ?? 1).toFixed(2),
    };
  }
}
