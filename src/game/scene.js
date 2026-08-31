import Phaser from 'phaser';
import { MAP, T, TICK_MS, BUILDINGS, VILLAGER, FOREST } from '../config.js';
import { canPlace, place, idx } from '../core/state.js';
import { makeTextures } from './sprites.js';
import { on, emit } from '../core/events.js';

const TILE = MAP.tile;
const WORLD = MAP.size * TILE;

// terrain painting: [base, [speckle shades]]
const TERRAIN_STYLE = {
  [T.WATER]:    ['#3a6a8e', ['#2e5878', '#31617f', '#54879f']],
  [T.PLAINS]:   ['#8aa957', ['#7c9a4b', '#97b465', '#84a251']],
  [T.FOREST]:   ['#4f7a3a', ['#3a5f2b', '#456e33', '#2f5223']],
  [T.HILLS]:    ['#9a8f72', ['#7f755c', '#8d8368', '#a89d80']],
  [T.MOUNTAIN]: ['#8d8578', ['#5f594e', '#b5af9f', '#736c60']],
  [T.ORE]:      ['#8a7f64', ['#6f664f', '#d9a441', '#4a4238']],
};

export class KingdomScene extends Phaser.Scene {
  constructor(ctx) {
    super('kingdom');
    this.ctx = ctx;          // { state, sim, placement, selected }
    this.acc = 0;
    this.buildingSprites = new Map();
    this.campSprites = [];
    this.unitPool = [];
    this.arrows = [];
  }

  create() {
    const { state } = this.ctx;
    makeTextures(this);
    this.paintTerrain();

    this.overlayTex = this.textures.createCanvas('overlay', MAP.size * 2, MAP.size * 2);
    this.overlayImg = this.add.image(0, 0, 'overlay').setOrigin(0).setDepth(500);
    this.overlayImg.setDisplaySize(WORLD, WORLD);

    this.unitLayer = this.add.layer().setDepth(900);
    this.fxGfx = this.add.graphics().setDepth(950);
    this.ghost = this.add.image(0, 0, 'b-house').setVisible(false).setAlpha(0.65).setDepth(960);
    this.selGfx = this.add.graphics().setDepth(955);

    const cam = this.cameras.main;
    cam.setBounds(-40, -40, WORLD + 80, WORLD + 80);
    cam.setBackgroundColor('#1a1610');
    const keep = state.buildings.find((b) => b.type === 'keep');
    cam.centerOn(keep.x * TILE, keep.y * TILE);
    cam.setZoom(Math.max(1.6, this.scale.width / WORLD * 1.8));
    cam.roundPixels = true;

    this.setupInput();
    on('arrow', (a) => this.arrows.push({ ...a, ttl: 200 }));
    // the map changes under the axes: batch dirty tiles, repaint once per frame
    this.dirtyTiles = [];
    on('terrain-changed', (t) => this.dirtyTiles.push(t));

    // New Kingdom: the state object was reset in place to a fresh realm — repaint
    // the new terrain, drop stale building sprites, recenter on the new keep.
    on('new-game', () => {
      this.paintTerrain();
      for (const [, img] of this.buildingSprites) img.destroy();
      this.buildingSprites.clear();
      for (const img of this.campSprites) img.destroy();
      this.campSprites.length = 0;
      this.arrows.length = 0;
      const nkeep = this.ctx.state.buildings.find((b) => b.type === 'keep');
      if (nkeep) cam.centerOn(nkeep.x * TILE, nkeep.y * TILE);
      this.ctx.state.territoryDirty = true;
      this.ctx.state.buildingsDirty = true;
    });

    this.textures.get('terrain').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get('overlay').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // paint one tile onto the terrain canvas. Forest density follows the
  // remaining wood stock — the wood-line visibly thins as the axes work.
  paintTile(c, x, y) {
    const { state } = this.ctx;
    const N = MAP.size;
    const t = state.terrain[y * N + x];
    const [base, shades] = TERRAIN_STYLE[t];
    c.fillStyle = base;
    c.fillRect(x * TILE, y * TILE, TILE, TILE);
    // deterministic-ish speckle from coords
    let h = (x * 7349 + y * 9151) >>> 0;
    const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
    const n = t === T.FOREST ? 9 : 6;
    for (let s = 0; s < n; s++) {
      c.fillStyle = shades[Math.floor(rnd() * shades.length)];
      c.fillRect(x * TILE + Math.floor(rnd() * TILE), y * TILE + Math.floor(rnd() * TILE), 1, 1);
    }
    if (t === T.FOREST) {
      // tree blobs by remaining stock: old growth 2, thinning 1, scrub 0
      const stock = state.forestWood ? state.forestWood[y * N + x] : 90;
      const trees = stock >= 60 ? 2 : stock >= 30 ? 1 : 0;
      for (let tr = 0; tr < trees; tr++) {
        const tx = x * TILE + 1 + Math.floor(rnd() * (TILE - 3));
        const ty = y * TILE + 1 + Math.floor(rnd() * (TILE - 4));
        c.fillStyle = '#2f5223';
        c.fillRect(tx, ty, 2, 2);
        c.fillStyle = '#3f6b2e';
        c.fillRect(tx, ty, 1, 1);
      }
    }
    if (t === T.MOUNTAIN && rnd() > 0.5) {
      c.fillStyle = '#cfcabd';
      c.fillRect(x * TILE + 3, y * TILE + 2, 2, 1);
    }
    if (t === T.ORE) {
      c.fillStyle = '#e0b04c';
      c.fillRect(x * TILE + 2, y * TILE + 3, 1, 1);
      c.fillRect(x * TILE + 5, y * TILE + 5, 1, 1);
    }
  }

  paintTerrain() {
    const N = MAP.size;
    // reuse the canvas texture if it exists (repaint on New Kingdom), else make it
    const tex = this.textures.exists('terrain')
      ? this.textures.get('terrain')
      : this.textures.createCanvas('terrain', WORLD, WORLD);
    const c = tex.getContext();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) this.paintTile(c, x, y);
    }
    tex.refresh();
    this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(0);
  }

  redrawOverlay() {
    const { state } = this.ctx;
    const N = MAP.size;
    const tex = this.textures.get('overlay');
    const c = tex.getContext();
    c.clearRect(0, 0, N * 2, N * 2);
    const claimed = state.claimed;
    c.fillStyle = 'rgba(12,11,20,0.34)';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!claimed[y * N + x]) c.fillRect(x * 2, y * 2, 2, 2);
      }
    }
    // border: crimson edging on claimed tiles facing the wilds
    c.fillStyle = '#c8452e';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!claimed[y * N + x]) continue;
        const up = y === 0 || !claimed[(y - 1) * N + x];
        const dn = y === N - 1 || !claimed[(y + 1) * N + x];
        const lf = x === 0 || !claimed[y * N + x - 1];
        const rt = x === N - 1 || !claimed[y * N + x + 1];
        if (up) c.fillRect(x * 2, y * 2, 2, 1);
        if (dn) c.fillRect(x * 2, y * 2 + 1, 2, 1);
        if (lf) c.fillRect(x * 2, y * 2, 1, 2);
        if (rt) c.fillRect(x * 2 + 1, y * 2, 1, 2);
      }
    }
    tex.refresh();
    state.territoryDirty = false;
  }

  syncBuildings() {
    const { state } = this.ctx;
    const seen = new Set();
    for (const b of state.buildings) {
      seen.add(b.id);
      let img = this.buildingSprites.get(b.id);
      if (!img) {
        // roads lie flat under everything else; buildings stand proud of their tile
        const flat = b.type === 'road' || b.type === 'bridge';
        img = this.add.image(0, 0, `b-${b.type}`).setDepth(flat ? 550 : 600 + b.y);
        // Great Works stand monumental — near the keep's stature
        const size = b.type === 'keep' ? 16 : BUILDINGS[b.type].greatWork ? 15 : flat ? TILE : 12;
        img.setDisplaySize(size, size);
        this.buildingSprites.set(b.id, img);
      }
      img.setPosition(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2 - (b.type === 'road' || b.type === 'bridge' ? 0 : 2));
      // breached walls and silenced towers read as dark rubble; other damage
      // tints red under half HP; an unfinished Great Work wears scaffold-brown
      img.setTint(b.breached || (b.type === 'tower' && b.sacked) ? 0x6b5a4a
        : b.hp < b.maxHp * 0.5 ? 0xff8877
        : BUILDINGS[b.type].greatWork && !b.greatWorkDone ? 0xb59a72 : 0xffffff);
      img.setAlpha(state.claimed[idx(b.x, b.y)] ? 1 : 0.55);
    }
    for (const [id, img] of this.buildingSprites) {
      if (!seen.has(id)) { img.destroy(); this.buildingSprites.delete(id); }
    }
    state.buildingsDirty = false;
  }

  // the warlord's camp: tents synced like buildings, tinted dark while broken
  syncCamp() {
    const { state } = this.ctx;
    for (const img of this.campSprites) img.destroy();
    this.campSprites.length = 0;
    const c = state.camp;
    if (c && !c.gone) {
      for (const t of c.tents) {
        const img = this.add.image(
          t.x * TILE + TILE / 2, t.y * TILE + TILE / 2 - 2,
          t.kind === 'hall' ? 'b-hall' : 'b-tent').setDepth(600 + t.y);
        img.setDisplaySize(t.kind === 'hall' ? 14 : 11, t.kind === 'hall' ? 14 : 11);
        if (c.broken) img.setTint(0x5a4636);   // charred — the war-tents burned
        this.campSprites.push(img);
      }
    }
    state.campDirty = false;
  }

  drawUnits(alpha) {
    const { state } = this.ctx;
    const units = [];
    // manned watchtowers fly the watch-flag — and the watchman is INSIDE
    // (his body vanishes into the tower; he reappears only when it falls)
    const towers = state.buildings.filter((b) => b.type === 'tower');
    for (const b of towers) {
      if (b.hp > 0 && !b.sacked && b.assigned > 0) {
        units.push({ u: { x: b.x + 0.35, y: b.y - 1.2, px: b.x + 0.35, py: b.y - 1.2 }, key: 'u-flag', size: 6 });
      }
    }
    const insideTower = (v) => {
      if (v.workType !== 'tower') return false;
      const t = towers.find((b) => b.id === v.workplaceId);
      return !!t && t.hp > 0 && !t.sacked && Math.hypot(t.x - v.x, t.y - v.y) <= VILLAGER.towerInsideRadius;
    };
    // villagers first (drawn under the fighters); fleeing folk flash alarm-tinted
    for (const v of state.villagers) {
      if (v.job === 'soldier' || v.x == null || insideTower(v)) continue;
      units.push({ u: v, key: 'u-villager', size: 5, tint: v.fleeing ? 0xffb36b : 0xffffff });
    }
    // the camp's people and swords (and the man himself, when he's home)
    const camp = state.camp;
    if (camp && !camp.gone) {
      for (const f of camp.folk) {
        if (f.dead || f.escaped) continue;
        units.push({ u: f, key: 'u-folk', size: 5 });
      }
      for (const g of camp.garrison) if (g.hp > 0) units.push({ u: g, key: 'u-raider' });
      // the massing wave, milling by the tents — the storm you can see coming
      for (const m of camp.massing || []) units.push({ u: m, key: 'u-raider', tint: 0xd98877 });
      // ...and once the host arrives, that same gathering turned to meet it:
      // real bodies now, fighting in the line (same tint — same men)
      for (const m of camp.massers || []) {
        if (m.hp > 0) units.push({ u: m, key: 'u-raider', tint: 0xd98877 });
      }
      if (camp.warlord.home && !camp.leaderless && camp.warlord.hp > 0) {
        units.push({ u: camp.warlord, key: 'u-warlord', size: 8 });
      }
    }
    for (const s of state.soldiers) units.push({ u: s, key: s.merc ? 'u-merc' : 'u-soldier' });
    for (const r of state.raid.raiders) {
      units.push(r.warlord ? { u: r, key: 'u-warlord', size: 8 } : { u: r, key: 'u-raider' });
    }

    while (this.unitPool.length < units.length) {
      const img = this.add.image(0, 0, 'u-raider').setDepth(910);
      img.setDisplaySize(6, 6);
      this.unitLayer.add(img);
      this.unitPool.push(img);
    }
    for (let i = 0; i < this.unitPool.length; i++) {
      const img = this.unitPool[i];
      if (i >= units.length) { img.setVisible(false); continue; }
      const { u, key, size, tint } = units[i];
      // a single NaN transform corrupts the whole WebGL batch and blanks the
      // map — never let a bad unit through, and say who it was (once) so the
      // root cause can be found instead of a black screen
      const px = Number.isFinite(u.px) ? u.px : u.x;
      const py = Number.isFinite(u.py) ? u.py : u.y;
      const x = (px + (u.x - px) * alpha) * TILE + TILE / 2;
      const y = (py + (u.y - py) * alpha) * TILE + TILE / 2;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        img.setVisible(false);
        if (!this._badUnitWarned) {
          this._badUnitWarned = true;
          // eslint-disable-next-line no-console
          console.warn('kingdom-sim: unit with non-finite position skipped', key, u);
        }
        continue;
      }
      if (img.texture.key !== key) img.setTexture(key);
      img.setVisible(true);
      img.setPosition(x, y);
      img.setDisplaySize(size || 6, size || 6);
      img.setTint(tint || 0xffffff);
    }

    // tower arrows
    this.fxGfx.clear();
    for (const a of this.arrows) {
      const t = 1 - a.ttl / 200;
      const x = (a.fx + (a.tx - a.fx) * t) * TILE + TILE / 2;
      const y = (a.fy + (a.ty - a.fy) * t) * TILE + TILE / 2;
      this.fxGfx.fillStyle(0xe9dfc8, 1);
      this.fxGfx.fillRect(x, y, 1.5, 1.5);
    }
  }

  setupInput() {
    const cam = this.cameras.main;
    let dragging = false, moved = 0, lastX = 0, lastY = 0;

    this.input.on('pointerdown', (p) => {
      dragging = true; moved = 0; lastX = p.x; lastY = p.y;
      // start a paint-stroke on the pressed tile (roads/walls lay under the drag)
      this.lastPaint = null;
      const painting = this.ctx.placement === 'road' || this.ctx.placement === 'wall';
      if (painting && !p.rightButtonDown()) {
        const wp = cam.getWorldPoint(p.x, p.y);
        const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
        place(this.ctx.state, this.ctx.placement, tx, ty);
        this.lastPaint = { x: tx, y: ty };
      }
    });
    this.input.on('pointermove', (p) => {
      const wp = cam.getWorldPoint(p.x, p.y);
      this.hoverTile = { x: Math.floor(wp.x / TILE), y: Math.floor(wp.y / TILE) };
      // laying roads or walls: LEFT-DRAG PAINTS a line of them (no more
      // click-click-click); the camera pans only outside placement mode
      const painting = this.ctx.placement === 'road' || this.ctx.placement === 'wall';
      if (dragging && p.isDown && painting && !p.rightButtonDown()) {
        const { x: tx, y: ty } = this.hoverTile;
        const last = this.lastPaint || { x: tx, y: ty };
        // walk the line so a fast drag doesn't skip tiles
        const steps = Math.max(Math.abs(tx - last.x), Math.abs(ty - last.y), 1);
        for (let s = 1; s <= steps; s++) {
          const px = Math.round(last.x + (tx - last.x) * (s / steps));
          const py = Math.round(last.y + (ty - last.y) * (s / steps));
          place(this.ctx.state, this.ctx.placement, px, py);   // failures are silent while painting
        }
        this.lastPaint = { x: tx, y: ty };
        moved += 10;   // a paint-drag is never a click
        emit('tick', this.ctx.state);
        return;
      }
      if (dragging && p.isDown) {
        const dx = p.x - lastX, dy = p.y - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
        lastX = p.x; lastY = p.y;
      }
    });
    this.input.on('pointerup', (p) => {
      dragging = false;
      if (moved > 6) return; // was a pan, not a click
      if (p.rightButtonReleased()) { this.ctx.placement = null; emit('placement', null); return; }
      const wp = cam.getWorldPoint(p.x, p.y);
      const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
      if (this.ctx.placement) {
        const res = place(this.ctx.state, this.ctx.placement, tx, ty);
        if (res.ok) {
          // walls, roads, and shift-click stay in placing mode
          if (this.ctx.placement !== 'wall' && this.ctx.placement !== 'road' && !this.shiftKey.isDown) {
            this.ctx.placement = null;
            emit('placement', null);
          }
        } else {
          emit('toast', res.reason);
        }
        emit('tick', this.ctx.state);
      } else {
        // hit-test moving units first (they sit sub-tile), then buildings
        const st = this.ctx.state;
        const wx = wp.x / TILE, wy = wp.y / TILE;
        let unit = null, kind = null, ud = 0.7;
        for (const s of st.soldiers) {
          const d = Math.hypot(s.x + 0.5 - wx, s.y + 0.5 - wy);
          if (d < ud) { ud = d; unit = s; kind = s.merc ? 'merc' : 'soldier'; }
        }
        for (const r of st.raid.raiders) {
          const d = Math.hypot(r.x + 0.5 - wx, r.y + 0.5 - wy);
          if (d < ud) { ud = d; unit = r; kind = r.warlord ? 'warlord' : 'raider'; }
        }
        if (st.camp && !st.camp.gone) {
          const c = st.camp;
          if (c.warlord.home && !c.leaderless) {
            const d = Math.hypot(c.warlord.x + 0.5 - wx, c.warlord.y + 0.5 - wy);
            if (d < ud) { ud = d; unit = c.warlord; kind = 'warlord'; }
          }
          for (const g of c.garrison) {
            if (g.hp <= 0) continue;
            const d = Math.hypot(g.x + 0.5 - wx, g.y + 0.5 - wy);
            if (d < ud) { ud = d; unit = g; kind = 'garrison'; }
          }
          for (const f of c.folk) {
            if (f.dead || f.escaped) continue;
            const d = Math.hypot(f.x + 0.5 - wx, f.y + 0.5 - wy);
            if (d < ud) { ud = d; unit = f; kind = 'folk'; }
          }
        }
        for (const v of st.villagers) {
          if (v.job === 'soldier' || v.x == null) continue;
          // a watchman inside his tower is invisible — clicks hit the tower
          if (v.workType === 'tower') {
            const t = st.buildings.find((b) => b.id === v.workplaceId);
            if (t && t.hp > 0 && !t.sacked && Math.hypot(t.x - v.x, t.y - v.y) <= VILLAGER.towerInsideRadius) continue;
          }
          const d = Math.hypot(v.x + 0.5 - wx, v.y + 0.5 - wy);
          if (d < ud) { ud = d; unit = v; kind = 'villager'; }
        }
        if (unit) {
          this.ctx.selected = null;
          emit('select', null);
          emit('select-unit', { unit, kind });
        } else {
          const b = st.buildings.find((bb) => bb.x === tx && bb.y === ty);
          this.ctx.selected = b || null;
          emit('select-unit', null);
          emit('select', b || null);
        }
      }
    });
    this.input.on('wheel', (p, _o, _dx, dy) => {
      const before = cam.getWorldPoint(p.x, p.y);
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.87 : 1.15), 0.8, 8));
      const after = cam.getWorldPoint(p.x, p.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    });
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.input.keyboard.on('keydown-ESC', () => {
      this.ctx.placement = null;
      this.ctx.selected = null;
      emit('placement', null);
      emit('select', null);
      emit('select-unit', null);
    });
    this.input.mouse.disableContextMenu();
    on('goto', ({ x, y }) => cam.centerOn(x * TILE, y * TILE));
  }

  update(_time, delta) {
    const { state, sim } = this.ctx;

    this.acc += delta * state.speed;
    let guard = 0;
    while (this.acc >= TICK_MS && guard++ < 8) {
      this.acc -= TICK_MS;
      sim.tick();
    }

    for (const a of this.arrows) a.ttl -= delta;
    this.arrows = this.arrows.filter((a) => a.ttl > 0);

    if (this.dirtyTiles.length) {
      const tex = this.textures.get('terrain');
      const c = tex.getContext();
      for (const { x, y } of this.dirtyTiles) this.paintTile(c, x, y);
      this.dirtyTiles.length = 0;
      tex.refresh();
    }
    if (state.territoryDirty) this.redrawOverlay();
    if (state.buildingsDirty) this.syncBuildings();
    if (state.campDirty) this.syncCamp();

    const alpha = Math.min(1, this.acc / TICK_MS);
    this.drawUnits(state.speed > 0 ? alpha : 1);

    // placement ghost (the road tool shows a bridge over water)
    if (this.ctx.placement && this.hoverTile) {
      const { x, y } = this.hoverTile;
      const isRoad = this.ctx.placement === 'road';
      const overWater = isRoad && state.terrain[idx(x, y)] === T.WATER;
      this.ghost.setTexture(overWater ? 'b-bridge' : `b-${this.ctx.placement}`);
      this.ghost.setDisplaySize(isRoad ? TILE : 12, isRoad ? TILE : 12);
      this.ghost.setVisible(true);
      this.ghost.setPosition(x * TILE + TILE / 2, y * TILE + TILE / 2 - (isRoad ? 0 : 2));
      const ok = canPlace(state, this.ctx.placement, x, y).ok;
      this.ghost.setTint(ok ? 0x88ff88 : 0xff6666);
    } else {
      this.ghost.setVisible(false);
    }

    // selection box
    this.selGfx.clear();
    // placement reach rings: how far the axes cut, how far the arrows fly
    if (this.ctx.placement && this.hoverTile) {
      const { x, y } = this.hoverTile;
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      const def = BUILDINGS[this.ctx.placement];
      if (this.ctx.placement === 'lumber') {
        this.selGfx.lineStyle(1, 0x9fd06a, 0.9);
        this.selGfx.strokeCircle(cx, cy, FOREST.harvestRadius * TILE);
      } else if (def?.range) {
        this.selGfx.lineStyle(1, 0xe9dfc8, 0.7);
        this.selGfx.strokeCircle(cx, cy, def.range * TILE);
      }
    }
    const sel = this.ctx.selected;
    if (sel && sel.hp > 0) {
      this.selGfx.lineStyle(1, 0xe0b04c, 1);
      this.selGfx.strokeRect(sel.x * TILE - 1, sel.y * TILE - 1, TILE + 2, TILE + 2);
    }
  }
}

export function createGame(parent, ctx) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a1610',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    render: { pixelArt: true, antialias: false },
    scene: new KingdomScene(ctx),
  });
}
