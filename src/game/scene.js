import Phaser from 'phaser';
import { MAP, T, TICK_MS, BUILDINGS } from '../config.js';
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

    // New Kingdom: the state object was reset in place to a fresh realm — repaint
    // the new terrain, drop stale building sprites, recenter on the new keep.
    on('new-game', () => {
      this.paintTerrain();
      for (const [, img] of this.buildingSprites) img.destroy();
      this.buildingSprites.clear();
      this.arrows.length = 0;
      const nkeep = this.ctx.state.buildings.find((b) => b.type === 'keep');
      if (nkeep) cam.centerOn(nkeep.x * TILE, nkeep.y * TILE);
      this.ctx.state.territoryDirty = true;
      this.ctx.state.buildingsDirty = true;
    });

    this.textures.get('terrain').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get('overlay').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  paintTerrain() {
    const { state } = this.ctx;
    const N = MAP.size;
    // reuse the canvas texture if it exists (repaint on New Kingdom), else make it
    const tex = this.textures.exists('terrain')
      ? this.textures.get('terrain')
      : this.textures.createCanvas('terrain', WORLD, WORLD);
    const c = tex.getContext();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
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
          // two chunky tree blobs
          for (let tr = 0; tr < 2; tr++) {
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
        img = this.add.image(0, 0, `b-${b.type}`).setDepth(b.type === 'road' ? 550 : 600 + b.y);
        const size = b.type === 'keep' ? 16 : b.type === 'road' ? TILE : 12;
        img.setDisplaySize(size, size);
        this.buildingSprites.set(b.id, img);
      }
      img.setPosition(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2 - (b.type === 'road' ? 0 : 2));
      // breached walls read as dark rubble; other damage tints red under half HP
      img.setTint(b.breached ? 0x6b5a4a : b.hp < b.maxHp * 0.5 ? 0xff8877 : 0xffffff);
      img.setAlpha(state.claimed[idx(b.x, b.y)] ? 1 : 0.55);
    }
    for (const [id, img] of this.buildingSprites) {
      if (!seen.has(id)) { img.destroy(); this.buildingSprites.delete(id); }
    }
    state.buildingsDirty = false;
  }

  drawUnits(alpha) {
    const { state } = this.ctx;
    const units = [];
    for (const s of state.soldiers) units.push({ u: s, key: 'u-soldier' });
    for (const r of state.raid.raiders) units.push({ u: r, key: 'u-raider' });

    while (this.unitPool.length < units.length) {
      const img = this.add.image(0, 0, 'u-raider').setDepth(910);
      img.setDisplaySize(6, 6);
      this.unitLayer.add(img);
      this.unitPool.push(img);
    }
    for (let i = 0; i < this.unitPool.length; i++) {
      const img = this.unitPool[i];
      if (i >= units.length) { img.setVisible(false); continue; }
      const { u, key } = units[i];
      if (img.texture.key !== key) img.setTexture(key);
      img.setVisible(true);
      const x = (u.px + (u.x - u.px) * alpha) * TILE + TILE / 2;
      const y = (u.py + (u.y - u.py) * alpha) * TILE + TILE / 2;
      img.setPosition(x, y);
      img.setDisplaySize(6, 6);
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
    });
    this.input.on('pointermove', (p) => {
      const wp = cam.getWorldPoint(p.x, p.y);
      this.hoverTile = { x: Math.floor(wp.x / TILE), y: Math.floor(wp.y / TILE) };
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
          if (d < ud) { ud = d; unit = s; kind = 'soldier'; }
        }
        for (const r of st.raid.raiders) {
          const d = Math.hypot(r.x + 0.5 - wx, r.y + 0.5 - wy);
          if (d < ud) { ud = d; unit = r; kind = 'raider'; }
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

    if (state.territoryDirty) this.redrawOverlay();
    if (state.buildingsDirty) this.syncBuildings();

    const alpha = Math.min(1, this.acc / TICK_MS);
    this.drawUnits(state.speed > 0 ? alpha : 1);

    // placement ghost
    if (this.ctx.placement && this.hoverTile) {
      const { x, y } = this.hoverTile;
      const isRoad = this.ctx.placement === 'road';
      this.ghost.setTexture(`b-${this.ctx.placement}`);
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
