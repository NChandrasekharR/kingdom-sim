import { BUILDINGS, RESOURCES, RES_INFO, TICK_MS, SOLDIER, T, MAP, MERCENARY, GARRISON } from '../config.js';
import { iconDataURL, buildingIconURL, PALETTE } from '../game/sprites.js';
import { on, emit } from '../core/events.js';
import { currentSeason, currentYear, makeSim } from '../core/sim.js';
import { territorySize } from '../core/territory.js';
import { demolish, clearSave, saveGame, createState } from '../core/state.js';
import { recruitSoldier, dismissSoldier, hireMercenaries, dismissMercenaries, mercCount, mercUpkeepRate, rallyToKeep, payTribute, refuseTribute, armedReserve, garrisonPost, assignGarrisons } from '../core/raids.js';
import { marchOnCamp, resolveCampChoice } from '../core/camp.js';
import { countMasters, isMaster } from '../core/villagers.js';
import { outputMult, depositInReach } from '../core/economy.js';
import { sell, buy, sellPrice, buyPrice, buyCapacity, buyRemaining } from '../core/trade.js';
import { getProgress, CROWN_NAMES } from '../core/win.js';
import { activeCounsel, dismissTutorial } from '../core/tutorial.js';
import { pron } from '../core/names.js';

const TRADABLE = ['food', 'wood', 'stone', 'ore', 'iron', 'bread'];
const MINI_COLORS = {
  [T.WATER]: '#3a6a8e', [T.PLAINS]: '#8aa957', [T.FOREST]: '#4f7a3a',
  [T.HILLS]: '#9a8f72', [T.MOUNTAIN]: '#8d8578', [T.ORE]: '#d9a441',
};

export function buildUI(root, ctx) {
  const { state } = ctx;
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const icon = (key, cls = 'icon') => `<img class="${cls}" src="${iconDataURL(key)}" alt="${key}">`;

  // ── Top bar ──────────────────────────────────────────────────────
  const topbar = el('header', 'topbar');
  const title = el('div', 'title');
  topbar.appendChild(title);

  const resbar = el('div', 'resbar');
  const resEls = {};
  for (const r of [...RESOURCES]) {
    const chip = el('div', 'chip', `${icon(r)}<span class="amt">0</span><span class="delta"></span>`);
    chip.title = RES_INFO[r].name;
    resEls[r] = { chip, amt: chip.querySelector('.amt'), delta: chip.querySelector('.delta') };
    resbar.appendChild(chip);
  }
  const popChip = el('div', 'chip', `${icon('pop')}<span class="amt">0</span>`);
  popChip.title = 'Population / housing';
  const moraleChip = el('div', 'chip', `${icon('morale')}<span class="amt">0</span>`);
  moraleChip.title = 'Morale';
  resbar.appendChild(popChip);
  resbar.appendChild(moraleChip);
  topbar.appendChild(resbar);

  const controls = el('div', 'controls');
  const speedBtns = {};
  for (const [label, sp] of [['❚❚', 0], ['▶', 1], ['▶▶▶', 3]]) {
    const b = el('button', 'speed', label);
    b.onclick = () => { state.speed = sp; refreshSpeed(); };
    speedBtns[sp] = b;
    controls.appendChild(b);
  }
  const newBtn = el('button', 'newgame', 'New Kingdom');
  newBtn.onclick = () => {
    if (!confirm('Abandon this kingdom and found a new one?')) return;
    clearSave();
    // Reset in place: overwrite the CURRENT state object with a fresh kingdom's
    // fields, so every closure that captured `state` (this UI, the scene) sees
    // the new realm without needing a full page reload.
    const fresh = createState();
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh);
    state.speed = 1;
    state.territoryDirty = true;
    state.buildingsDirty = true;
    ctx.sim = makeSim(state);
    selected = null; selUnit = null; ctx.selected = null; ctx.placement = null;
    emit('new-game', state);   // the scene clears its sprite cache + recenters
    emit('select', null);
    emit('select-unit', null);
    emit('placement', null);
    emit('tick', state);
  };
  controls.appendChild(newBtn);
  topbar.appendChild(controls);
  function refreshSpeed() {
    for (const [sp, b] of Object.entries(speedBtns)) b.classList.toggle('active', +sp === state.speed);
  }
  refreshSpeed();

  // ── Main area: map + sidebar ─────────────────────────────────────
  const main = el('div', 'main');
  const mapWrap = el('div', 'map-wrap');
  const mapDiv = el('div', 'map');
  mapDiv.id = 'map';
  const raidBanner = el('div', 'raid-banner hidden', '⚔ RAIDERS APPROACH ⚔');
  const tributeBanner = el('div', 'tribute-banner hidden');
  const tributeText = el('span', 'tribute-text');
  const tributePayBtn = el('button', 'pay-tribute', 'Pay the tribute');
  const tributeRefuseBtn = el('button', 'refuse-tribute', 'Refuse');
  tributeRefuseBtn.title = 'Send the rider back empty-handed — the warlord marches at once.';
  tributeBanner.append(tributeText, tributePayBtn, tributeRefuseBtn);
  tributePayBtn.onclick = () => {
    const r = payTribute(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  tributeRefuseBtn.onclick = () => {
    const r = refuseTribute(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  on('tribute-demand', (d) => {
    tributeText.innerHTML = `☠ ${d.name} demands <b>${d.gold} gold</b> — pay, or ${pron(d.name).he} marches. `;
  });
  const toast = el('div', 'toast hidden');
  const selPanel = el('div', 'sel-panel hidden');
  mapWrap.append(mapDiv, raidBanner, tributeBanner, toast, selPanel);

  const sidebar = el('aside', 'sidebar');
  const mini = el('canvas', 'minimap');
  mini.width = MAP.size; mini.height = MAP.size;
  sidebar.appendChild(mini);

  // ── The Steward's Counsel: one parchment card above the tabs ─────
  // Shows the current ladder counsel; flashes just-in-time lines briefly.
  // Never gates anything — advice with a dismiss link, nothing more.
  const stewardCard = el('div', 'steward-card hidden');
  sidebar.appendChild(stewardCard);
  let jitFlash = null, jitTimer = null;
  on('counsel-jit', (line) => {
    jitFlash = line;
    clearTimeout(jitTimer);
    jitTimer = setTimeout(() => { jitFlash = null; renderSteward(); }, 9000);
    renderSteward();
  });
  on('counsel-changed', renderSteward);
  on('new-game', () => { jitFlash = null; clearTimeout(jitTimer); renderSteward(); });
  let stewardSig = null;   // rebuild the card only when its content changes
  function renderSteward() {
    const counsel = activeCounsel(state);
    const sig = counsel ? `L${counsel.stepNo}` : jitFlash ? `J:${jitFlash}` : 'none';
    if (sig === stewardSig) return;
    stewardSig = sig;
    if (counsel) {
      stewardCard.classList.remove('hidden', 'jit');
      stewardCard.innerHTML = `
        <div class="steward-head">
          <span class="steward-name">${counsel.steward}</span>
          <span class="steward-step">counsel ${counsel.stepNo} of ${counsel.total}</span>
        </div>
        <div class="steward-text">“${counsel.text}”</div>
        <button class="steward-dismiss">Dismiss the steward</button>`;
      stewardCard.querySelector('.steward-dismiss').onclick = () => {
        dismissTutorial(state);
        renderSteward();
      };
    } else if (jitFlash) {
      stewardCard.classList.remove('hidden');
      stewardCard.classList.add('jit');
      stewardCard.innerHTML = `<div class="steward-text">${jitFlash}</div>`;
    } else {
      stewardCard.classList.add('hidden');
    }
  }
  renderSteward();

  const tabs = el('div', 'tabs');
  const panels = {};
  const tabBtns = {};
  for (const name of ['Build', 'Kingdom', 'Trade', 'Chronicle']) {
    const b = el('button', 'tab', name);
    b.onclick = () => selectTab(name);
    tabBtns[name] = b;
    tabs.appendChild(b);
    panels[name] = el('div', 'panel');
  }
  sidebar.appendChild(tabs);
  for (const p of Object.values(panels)) sidebar.appendChild(p);
  function selectTab(name) {
    for (const [n, b] of Object.entries(tabBtns)) b.classList.toggle('active', n === name);
    for (const [n, p] of Object.entries(panels)) p.classList.toggle('hidden', n !== name);
  }

  main.append(mapWrap, sidebar);
  root.append(topbar, main);

  // ── Build tab ────────────────────────────────────────────────────
  const buildGrid = el('div', 'build-grid');
  const buildCards = {};
  for (const [type, def] of Object.entries(BUILDINGS)) {
    if (def.unbuildable) continue;
    const cost = Object.entries(def.cost)
      .map(([r, amt]) => `${icon(r, 'icon sm')}${amt}`)
      .join(' ');
    const card = el('button', 'build-card',
      `<img class="bicon" src="${buildingIconURL(type)}" alt="">
       <span class="bname">${def.name}</span>
       <span class="bcost">${cost || '—'}</span>`);
    card.title = def.desc;
    card.onclick = () => {
      ctx.placement = ctx.placement === type ? null : type;
      emit('placement', ctx.placement);
    };
    buildCards[type] = card;
    buildGrid.appendChild(card);
  }
  panels.Build.appendChild(buildGrid);
  panels.Build.appendChild(el('p', 'hint', 'Click a building, then click the map. Right-click or Esc to cancel. Roads and walls PAINT under a drag — sweep the line you want.'));

  on('placement', (type) => {
    for (const [t, c] of Object.entries(buildCards)) c.classList.toggle('placing', t === type);
  });

  // ── Kingdom tab ──────────────────────────────────────────────────
  const crownsEl = el('div', 'crowns');
  const crownRows = {};
  for (const [key, name] of Object.entries(CROWN_NAMES)) {
    const row = el('div', 'crown-row',
      `${icon('crown', 'icon crown-icon')}
       <div class="crown-body">
         <div class="crown-name">${name}</div>
         <div class="bar"><div class="fill"></div></div>
         <div class="crown-prog"></div>
       </div>`);
    crownRows[key] = row;
    crownsEl.appendChild(row);
  }
  panels.Kingdom.appendChild(crownsEl);
  const kStats = el('div', 'kstats');
  panels.Kingdom.appendChild(kStats);
  const recruitBtn = el('button', 'action', `Recruit soldier (${SOLDIER.cost.iron} iron — then eats 3×)`);
  recruitBtn.onclick = () => {
    const r = recruitSoldier(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  panels.Kingdom.appendChild(recruitBtn);
  const dismissBtn = el('button', 'action', 'Dismiss soldier');
  dismissBtn.onclick = () => {
    const r = dismissSoldier(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  panels.Kingdom.appendChild(dismissBtn);

  const hireBtn = el('button', 'action',
    `Hire mercenaries (${MERCENARY.hireCost.gold} gold + upkeep)`);
  hireBtn.onclick = () => {
    const r = hireMercenaries(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  panels.Kingdom.appendChild(hireBtn);
  const releaseMercBtn = el('button', 'action', 'Release mercenaries');
  releaseMercBtn.onclick = () => {
    const r = dismissMercenaries(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  panels.Kingdom.appendChild(releaseMercBtn);

  const stanceBtn = el('button', 'action');
  const stanceLabel = () => state.stance === 'sally'
    ? '⚔ Stance: Sally forth (pursue raiders anywhere)'
    : '🛡 Stance: Hold the line (fight on home ground)';
  stanceBtn.textContent = stanceLabel();
  stanceBtn.title = 'Hold the line keeps the army on claimed land, where home-ground and tower cover protect it. Sally forth pursues any raider on the map — loot recovered, blood risked.';
  stanceBtn.onclick = () => {
    state.stance = state.stance === 'sally' ? 'hold' : 'sally';
    stanceBtn.textContent = stanceLabel();
    showToast(state.stance === 'sally' ? 'The army will pursue raiders into the wilds.' : 'The army will hold the line at home.');
  };
  panels.Kingdom.appendChild(stanceBtn);

  const rallyBtn = el('button', 'action', '⟲ Rally to the keep');
  rallyBtn.title = 'Sound the horn: every soldier falls back and holds at the keep for a while.';
  rallyBtn.onclick = () => {
    const r = rallyToKeep(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  panels.Kingdom.appendChild(rallyBtn);

  // ── The warlord's camp (the opponent you build toward) ───────────
  const campBox = el('div', 'camp-box hidden');
  const campInfo = el('div', 'camp-info');
  const campBtns = el('div', 'camp-btns');
  const marchBtn = el('button', 'action march', '⚔ March on the camp');
  marchBtn.title = 'Send EVERY soldier you have against the warlord’s camp. Provisions cost food and gold; the kingdom stands thinner while they’re gone. The home-guard decision is how many you muster before you march.';
  marchBtn.onclick = () => {
    const host = state.soldiers.filter((s) => s.hp > 0).length;
    const name = state.camp?.name || 'the camp';
    if (!confirm(`March on ${name} with ${host} swords? The kingdom will stand thinner while they are gone.`)) return;
    const r = marchOnCamp(state);
    if (!r.ok) showToast(r.reason);
    render();
  };
  const viewCampBtn = el('button', 'action', '👁 View');
  viewCampBtn.onclick = () => {
    if (state.camp) emit('goto', { x: state.camp.x, y: state.camp.y });
  };
  campBtns.append(marchBtn, viewCampBtn);
  campBox.append(campInfo, campBtns);
  panels.Kingdom.appendChild(campBox);

  // ── Trade tab ────────────────────────────────────────────────────
  const merchStatus = el('div', 'merch-status');
  const tradeTable = el('div', 'trade-table');
  panels.Trade.append(merchStatus, tradeTable);
  const tradeRows = {};
  for (const r of TRADABLE) {
    const row = el('div', 'trade-row',
      `${icon(r)}<span class="price">—</span>
       <button data-act="sell" data-q="1">Sell 1</button>
       <button data-act="sell" data-q="10">×10</button>
       <button data-act="buy" data-q="1">Buy 1</button>
       <button data-act="buy" data-q="10">×10</button>`);
    row.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        const selling = b.dataset.act === 'sell';
        // sell() answers with a bare boolean; buy() answers with `true` or the
        // REASON it refused (gold, or the carts already being full)
        const res = (selling ? sell : buy)(state, r, +b.dataset.q);
        if (res !== true) {
          showToast(typeof res === 'string' ? res : selling ? 'Nothing to sell' : 'Not enough gold');
        }
        render();
      };
    });
    tradeRows[r] = row;
    tradeTable.appendChild(row);
  }

  // ── Chronicle tab ────────────────────────────────────────────────
  const logList = el('div', 'log-list');
  panels.Chronicle.appendChild(logList);
  on('log', (entry) => {
    const line = el('div', `log-line ${entry.kind}`, entry.text);
    logList.prepend(line);
    while (logList.children.length > 80) logList.lastChild.remove();
  });
  for (const e of state.log) {
    logList.prepend(el('div', `log-line ${e.kind}`, e.text));
  }

  selectTab('Build');

  // ── Selection panel ──────────────────────────────────────────────
  let selected = null;
  on('select', (b) => { selected = b; renderSelection(); });
  function renderSelection() {
    if (!selected || selected.hp <= 0) {
      if (!selUnit) selPanel.classList.add('hidden');  // a selected unit keeps the panel up
      return;
    }
    const def = BUILDINGS[selected.type];
    selPanel.classList.remove('hidden');
    const out = Math.round(outputMult(selected) * 100);
    const crew = selected.workers || [];
    const avgSkill = crew.length
      ? crew.reduce((s, v) => s + (v.skills[selected.type] || 0), 0) / crew.length : 0;
    let crewLine = def.workers
      ? ` · crew ${selected.assigned}/${def.workers}${avgSkill > 0.05 ? ` (skill ${Math.round(avgSkill * 100)}%)` : ''}`
      : '';
    if (selected.type === 'tower') {
      crewLine += selected.sacked ? ' · <span class="bad">SILENT — battered to rubble</span>'
        : selected.assigned > 0 ? ` · ${crew[0]?.name || 'a watchman'} at the post` : ' · unmanned';
    }
    // every extractor shows what the ground around it still holds
    const REACH_WORD = { lumber: 'timber', quarry: 'stone', mine: 'ore' };
    const SPENT_WORD = {
      lumber: 'the wood nearby is spent',
      quarry: 'the stone here is spent',
      mine: 'the vein is spent',
    };
    if (REACH_WORD[selected.type]) {
      if (selected.depleted) {
        crewLine += ` · <span class="bad">${SPENT_WORD[selected.type]}</span>`;
      } else {
        const near = depositInReach(state, selected);
        if (near != null && Number.isFinite(near)) {
          crewLine += ` · ${REACH_WORD[selected.type]} in reach ~${Math.round(near)}`;
        }
      }
    }
    // a Great Work shows its rise: progress, who stands on the scaffold, and
    // the staged draught (the pile a raider would love to reach)
    const gw = def.greatWork;
    if (gw) {
      if (selected.greatWorkDone) {
        crewLine += ' · <span class="good"><b>COMPLETE</b></span>';
      } else {
        const pct = Math.floor(((selected.progress || 0) / gw.workTicks) * 100);
        const crew2 = selected.workers || [];
        const masters = crew2.filter((v) => isMaster(v)).length;
        crewLine += ` · raised <b>${pct}%</b> · ${masters} master${masters === 1 ? '' : 's'} + ${crew2.length - masters} on the scaffold`;
        const staged = Object.entries(selected.staged || {})
          .filter(([, a]) => a >= 1)
          .map(([r, a]) => `${Math.floor(a)} ${r}`).join(', ');
        if (staged) crewLine += ` · staged on site: ${staged}`;
      }
    }
    // a barracks is a garrison post or part of the field army
    if (selected.type === 'barracks') {
      const held = state.soldiers.filter((so) => so.postId === selected.id && garrisonPost(state, so)).length;
      crewLine += selected.garrison
        ? ` · <b>garrison post</b> — ${held}/${SOLDIER.perBarracks} posted, holding ${GARRISON.radius} tiles around it`
        : ' · <b>field army</b> — its soldiers muster at the keep';
    }
    selPanel.innerHTML = `
      <img class="bicon" src="${buildingIconURL(selected.type)}" alt="">
      <div class="sel-info">
        <div class="sel-name">${def.name}${selected.sacked ? ' <span class="bad">— SACKED</span>' : ''}</div>
        <div class="sel-hp">HP ${Math.ceil(selected.hp)}/${def.hp} · output ${out}%${crewLine}</div>
        <div class="sel-desc">${def.desc}</div>
      </div>`;
    if (selected.type === 'barracks') {
      const g = el('button', 'post-toggle', selected.garrison ? 'Send to the field army' : 'Post a garrison here');
      g.title = selected.garrison
        ? 'Its soldiers rejoin the field army at the keep, answer every horn, and march with the host.'
        : `Four of the field army come to live here and hold the ground within ${GARRISON.radius} tiles. They stay when the host marches.`;
      g.onclick = () => {
        selected.garrison = !selected.garrison;
        if (state.raid.phase !== 'active') assignGarrisons(state);
        renderSelection();
        render();
      };
      selPanel.appendChild(g);
    }
    if (selected.type !== 'keep') {
      const d = el('button', 'demolish', 'Demolish');
      d.onclick = () => {
        demolish(state, selected.id);
        selected = null;
        ctx.selected = null;
        renderSelection();
        render();
      };
      selPanel.appendChild(d);
    }
  }

  // ── Unit inspector (soldiers, raiders) — shares selPanel ─────────────
  let selUnit = null;      // { unit, kind }
  on('select', () => { if (selUnit) { selUnit = null; } });  // building click clears a unit
  on('select-unit', (u) => { selUnit = u; selected = null; renderUnit(); });
  function renderUnit() {
    if (!selUnit || !selUnit.unit) { if (!selected) selPanel.classList.add('hidden'); return; }
    const { unit, kind } = selUnit;
    selPanel.classList.remove('hidden');
    if (kind === 'soldier') {
      const v = state.villagers.find((vl) => vl.id === unit.villagerId);
      const gone = !v || unit.hp <= 0 || !state.soldiers.includes(unit);
      if (gone) { selUnit = null; selPanel.classList.add('hidden'); return; }
      const hpPct = Math.max(0, Math.round((unit.hp / SOLDIER.hp) * 100));
      const skills = Object.entries(v.skills)
        .filter(([, s]) => s > 0.05)
        .sort((a, b) => b[1] - a[1])
        .map(([k, s]) => `${k} ${Math.round(s * 100)}%`).join(' · ') || 'green recruit';
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('soldier')}" alt="">
        <div class="sel-info">
          <div class="sel-name">${v.name} <span class="good">— soldier</span>${v.marked ? ' <span class="bad">· marked</span>' : ''}</div>
          <div class="sel-hp">HP ${Math.ceil(unit.hp)}/${SOLDIER.hp} (${hpPct}%) · skills: ${skills}${unit.exp ? ' · <b>afield with the host</b>' : (() => { const p = garrisonPost(state, unit); return p ? ` · garrison at (${p.x}, ${p.y})` : ' · field army'; })()}</div>
          <div class="sel-desc">${v.marked ? 'Marked by the burning. Nothing frightens them now — and they will never lay down the sword.' : `A subject of ${state.name} under arms.`}</div>
        </div>`;
    } else if (kind === 'merc') {
      const gone = unit.hp <= 0 || !state.soldiers.includes(unit);
      if (gone) { selUnit = null; selPanel.classList.add('hidden'); return; }
      const hpPct = Math.max(0, Math.round((unit.hp / MERCENARY.hp) * 100));
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('merc')}" alt="">
        <div class="sel-info">
          <div class="sel-name"><span class="merc-name">Mercenary</span></div>
          <div class="sel-hp">HP ${Math.ceil(unit.hp)}/${MERCENARY.hp} (${hpPct}%) · skill ${Math.round((unit.skill || 0) * 100)}%</div>
          <div class="sel-desc">A hired sword. Paid in gold; deserts if the coffers run dry.</div>
        </div>`;
    } else if (kind === 'villager') {
      const gone = !state.villagers.includes(unit);
      if (gone) { selUnit = null; selPanel.classList.add('hidden'); return; }
      const skills = Object.entries(unit.skills)
        .filter(([, s]) => s > 0.05)
        .sort((a, b) => b[1] - a[1])
        .map(([k, s]) => `${k} ${Math.round(s * 100)}%`).join(' · ') || 'unskilled hands';
      const doing = (unit.fleeing ? '<span class="bad">fleeing for the keep!</span>'
        : unit.job === 'producer' ? `working the ${unit.workType || 'fields'}`
        : unit.job === 'builder' ? 'repairing the works'
        : 'idling by the keep') + (unit.armed ? ' · <b>militia</b>' : '');
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('villager')}" alt="">
        <div class="sel-info">
          <div class="sel-name">${unit.name}</div>
          <div class="sel-hp">${doing} · skills: ${skills}</div>
          <div class="sel-desc">A subject of ${state.name}. Caught in the open in a raid, they may not come home.</div>
        </div>`;
    } else if (kind === 'warlord') {
      const c = state.camp;
      const inRaid = state.raid.raiders.includes(unit);
      const atHome = c && unit === c.warlord && c.warlord.home && !c.leaderless && !c.gone;
      if (unit.hp <= 0 || (!inRaid && !atHome)) { selUnit = null; selPanel.classList.add('hidden'); return; }
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('warlord')}" alt="">
        <div class="sel-info">
          <div class="sel-name"><span class="bad">${unit.name}</span></div>
          <div class="sel-hp">HP ${Math.ceil(unit.hp)} · ${inRaid ? `AT THE HEAD OF ${pron(unit.name).His.toUpperCase()} HOST` : `at ${pron(unit.name).his} hall in ${c.name}`}</div>
          <div class="sel-desc">${c?.avenger ? `The avenger. ${pron(unit.name).He} remembers the burning. ${pron(unit.name).He} will take no gold.` : `The warlord. Kill ${pron(unit.name).him} and ${pron(unit.name).his} line breaks — for a while.`}</div>
        </div>`;
    } else if (kind === 'garrison') {
      const c = state.camp;
      if (!c || unit.hp <= 0 || !c.garrison.includes(unit)) { selUnit = null; selPanel.classList.add('hidden'); return; }
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('raider')}" alt="">
        <div class="sel-info">
          <div class="sel-name"><span class="bad">${unit.name}</span></div>
          <div class="sel-hp">HP ${Math.ceil(unit.hp)} · guarding the camp</div>
          <div class="sel-desc">A sword sworn to ${c.warlord.name}. ${pron(unit.name).He} stands between you and the hoard.</div>
        </div>`;
    } else if (kind === 'folk') {
      const c = state.camp;
      if (!c || unit.dead || unit.escaped) { selUnit = null; selPanel.classList.add('hidden'); return; }
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('folk')}" alt="">
        <div class="sel-info">
          <div class="sel-name">${unit.name}</div>
          <div class="sel-hp">a soul of ${c.name}</div>
          <div class="sel-desc">Not a fighter. They live in the warlord's shadow — what becomes of them is your choice, if you come.</div>
        </div>`;
    } else {
      const gone = unit.hp <= 0 || !state.raid.raiders.includes(unit);
      if (gone) { selUnit = null; selPanel.classList.add('hidden'); return; }
      const mode = { march: 'marching in', loot: 'looting', flee: 'fleeing' }[unit.mode] || unit.mode;
      selPanel.innerHTML = `
        <img class="bicon" src="${iconDataURL('raider')}" alt="">
        <div class="sel-info">
          <div class="sel-name"><span class="bad">${unit.name || 'Raider'}</span></div>
          <div class="sel-hp">HP ${Math.ceil(unit.hp)} · loot ${Math.round(unit.loot)} · ${mode}</div>
          <div class="sel-desc">A brigand come to sack the realm.</div>
        </div>`;
    }
  }

  // ── Toast ────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }
  on('toast', showToast);
  on('merchant-arrived', () => showToast('🐫 A merchant caravan has arrived — see the Trade tab'));

  // ── Victory ──────────────────────────────────────────────────────
  const victory = el('div', 'victory hidden');
  mapWrap.appendChild(victory);
  on('crown', (key) => showToast(`👑 The ${CROWN_NAMES[key]} is yours!`));
  on('victory', (stats) => {
    state.speed = 0;
    refreshSpeed();
    victory.innerHTML = `
      <div class="victory-scroll">
        <div class="victory-crowns">👑 👑 👑</div>
        <h2>Sovereign of the Realm</h2>
        <p>All three crowns belong to <b>${state.name}</b>.</p>
        <p class="victory-stats">Year ${stats.year} · ${stats.pop} subjects · ${stats.territory} tiles claimed · ${stats.waves} raid${stats.waves === 1 ? '' : 's'} weathered</p>
      </div>`;
    const cont = el('button', 'action', 'Continue reigning');
    cont.onclick = () => { victory.classList.add('hidden'); state.speed = 1; refreshSpeed(); };
    const anew = el('button', 'newgame', 'Found a new kingdom');
    anew.onclick = () => { clearSave(); location.reload(); };
    const btns = el('div', 'victory-btns');
    btns.append(cont, anew);
    victory.querySelector('.victory-scroll').appendChild(btns);
    victory.classList.remove('hidden');
  });

  // ── The camp taken: the choice ───────────────────────────────────
  // At the moment of victory, standing in his camp, the game pauses and asks
  // who you are. Punish, or erase. This is the moral heart of the counter-raid.
  const choiceOverlay = el('div', 'victory choice hidden');
  mapWrap.appendChild(choiceOverlay);
  function showChoiceModal(info) {
    state.speed = 0;
    refreshSpeed();
    emit('goto', { x: info.camp.x, y: info.camp.y });
    choiceOverlay.innerHTML = `
      <div class="victory-scroll choice-scroll">
        <h2>${info.camp.name} is taken</h2>
        <p>The garrison is slain.${info.warlordSlain ? ` <b>${info.camp.warlord.name} fell at ${pron(info.camp.warlord.name).his} own hall.</b>` : info.unclaimed ? ' No warlord had yet claimed this nest — now none ever will.' : info.leaderless ? ' The camp stood leaderless — its chief already dead at your walls.' : info.wasHome === false ? ` The warlord was away — ${pron(info.camp.warlord.name).he} will return to what you leave behind.` : ''}</p>
        <p>His people cower among the tents — <b>${info.folk}</b> souls, none of them fighters.</p>
        <p>${(info.gold > 0 || info.plunder > 0)
          ? `The hoard: <b>${info.gold} gold</b> and <b>${info.plunder} goods</b> in plunder, much of it yours already — and the camp itself yields arm-rings and weapons off the dead.`
          : `The hoard is bare — but the camp itself is worth the taking: arm-rings, stores, and weapons stripped off the dead.`}</p>
        <p class="choice-ask">What is your word, sovereign?</p>
      </div>`;
    const btns = el('div', 'victory-btns choice-btns');
    const punish = el('button', 'action', 'Take back what is ours');
    punish.title = 'Reclaim the hoard, burn the war-tents, spare the folk. Years of quiet — and the spared may drift to your gates.';
    const raze = el('button', 'action raze', 'Leave nothing standing');
    raze.title = 'No camp. No people. No one left to avenge it — save the one who always escapes.';
    const decide = (choice) => {
      const r = resolveCampChoice(state, choice);
      if (!r.ok) { showToast(r.reason); return; }
      choiceOverlay.classList.add('hidden');
      state.speed = 1;
      refreshSpeed();
    };
    punish.onclick = () => decide('punish');
    raze.onclick = () => decide('massacre');
    btns.append(punish, raze);
    choiceOverlay.querySelector('.choice-scroll').appendChild(btns);
    choiceOverlay.classList.remove('hidden');
  }
  on('camp-victory', showChoiceModal);
  // a reload mid-choice must not strand the host: rebuild the modal from state
  if (state.expedition?.phase === 'choice' && state.camp) {
    showChoiceModal({
      camp: state.camp,
      warlordSlain: state.expedition.warlordSlain,
      wasHome: state.expedition.warlordWasHome,
      leaderless: state.camp.leaderless,
      folk: state.camp.folk.filter((f) => !f.dead).length,
      gold: Math.round(state.camp.ledger.gold),
      plunder: Math.round(state.camp.ledger.plunder),
    });
  }
  on('expedition-battle', ({ camp: c }) => {
    showToast(`⚔ The host falls upon ${c.name}!`);
    emit('goto', { x: c.x, y: c.y });
  });
  on('avenger-come', (c) => {
    showToast(`☠ ${c.warlord.name} has come. ${pron(c.warlord.name).He} will take no gold.`);
  });

  // ── Raid horn ────────────────────────────────────────────────────
  on('raid-warning', () => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;
      for (const [freq, t0, dur] of [[196, 0, 0.5], [147, 0.45, 0.9]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sawtooth'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now + t0);
        g.gain.exponentialRampToValueAtTime(0.12, now + t0 + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
        o.connect(g).connect(ac.destination);
        o.start(now + t0); o.stop(now + t0 + dur + 0.1);
      }
    } catch { /* audio blocked until user gesture — fine */ }
  });

  // ── Keep besieged alarm ──────────────────────────────────────────
  on('keep-besieged', () => {
    raidBanner.classList.add('besieged');   // CSS makes it flash urgent-red
    showToast('⚠ THE KEEP IS UNDER ASSAULT — rally your soldiers!');
  });
  on('keep-sacked', () => {
    showToast('☠ THE KEEP HAS FALLEN — a dark age begins.');
  });

  // ── Minimap ──────────────────────────────────────────────────────
  const miniCtx = mini.getContext('2d');
  const terrainImg = miniCtx.createImageData(MAP.size, MAP.size);
  function miniPixel(i) {
    const d = terrainImg.data;
    const hex = MINI_COLORS[state.terrain[i]];
    d[i * 4] = parseInt(hex.slice(1, 3), 16);
    d[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
    d[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
    d[i * 4 + 3] = 255;
  }
  function rebuildTerrainImg() {
    for (let i = 0; i < state.terrain.length; i++) miniPixel(i);
  }
  rebuildTerrainImg();
  on('new-game', rebuildTerrainImg);   // a fresh realm gets a fresh minimap
  on('terrain-changed', ({ x, y }) => miniPixel(y * MAP.size + x));
  mini.onclick = (ev) => {
    const rect = mini.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * MAP.size);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * MAP.size);
    emit('goto', { x, y });
  };
  function drawMinimap() {
    miniCtx.putImageData(terrainImg, 0, 0);
    const N = MAP.size;
    miniCtx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (!state.claimed[y * N + x]) miniCtx.fillRect(x, y, 1, 1);
    miniCtx.fillStyle = '#e9dfc8';
    for (const b of state.buildings) miniCtx.fillRect(b.x, b.y, 1, 1);
    // the warlord's camp: a dark-red blot in the corner of your world
    if (state.camp && !state.camp.gone) {
      miniCtx.fillStyle = state.camp.broken ? '#5a4636' : '#7e1f14';
      for (const t of state.camp.tents) miniCtx.fillRect(t.x - 1, t.y - 1, 3, 3);
    }
    // the host afield: pale dots tracking the march
    miniCtx.fillStyle = '#c8ccd4';
    for (const s of state.soldiers) {
      if (s.exp) miniCtx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
    miniCtx.fillStyle = '#ff3020';
    for (const r of state.raid.raiders) miniCtx.fillRect(Math.round(r.x), Math.round(r.y), 2, 2);
  }

  // ── Per-tick render ──────────────────────────────────────────────
  const perSec = 1000 / TICK_MS;
  function render() {
    title.innerHTML = `⚜ ${state.name} <span class="date">Year ${currentYear(state)} · ${currentSeason(state)}</span>`;

    for (const r of RESOURCES) {
      resEls[r].amt.textContent = Math.floor(state.res[r]);
      const d = state.delta[r] * perSec;
      resEls[r].delta.textContent = Math.abs(d) < 0.05 ? '' : `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
      resEls[r].delta.className = `delta ${d > 0 ? 'pos' : 'neg'}`;
    }
    popChip.querySelector('.amt').textContent = `${state.pop}/${state.popCap}`;
    popChip.classList.toggle('warn', state.starving);
    // 300/300 reads as a ceiling — say what raises it
    popChip.title = state.popCap > 0 && state.pop >= state.popCap
      ? `Population ${state.pop} / housing ${state.popCap} — every bed is taken. Each house shelters 5 more.`
      : `Population ${state.pop} / housing ${state.popCap}`;
    // surplus grain is rotting — the food chip goes moldy until it's baked away
    resEls.food.chip.classList.toggle('rot', !!state.spoiling);
    resEls.food.chip.title = state.spoiling
      ? (state.pop >= state.popCap
        ? 'Food — the surplus is ROTTING and every bed is taken. Raise houses, or bake it into bread.'
        : 'Food — the surplus is ROTTING. Bake it into bread: bread keeps.')
      : RES_INFO.food.name;
    moraleChip.querySelector('.amt').textContent = Math.round(state.morale);
    moraleChip.classList.toggle('warn', state.morale < 30);

    // build affordability
    for (const [type, card] of Object.entries(buildCards)) {
      const def = BUILDINGS[type];
      let ok = true;
      for (const [r, amt] of Object.entries(def.cost)) if (state.res[r] < amt) ok = false;
      if (def.unique && state.buildings.some((b) => b.type === type && b.hp > 0)) ok = false;
      // the ladder rises one Work at a time — the next tier grays out until
      // the one below it stands complete
      if (def.greatWork?.requires &&
          !state.buildings.some((b) => b.type === def.greatWork.requires && b.greatWorkDone)) ok = false;
      card.classList.toggle('disabled', !ok);
    }

    // crowns progress
    const prog = getProgress(state);
    for (const [key, row] of Object.entries(crownRows)) {
      const { cur, goal } = prog[key];
      const earned = state.crowns[key];
      row.classList.toggle('earned', earned);
      row.querySelector('.fill').style.width = `${Math.min(100, (cur / goal) * 100)}%`;
      row.querySelector('.crown-prog').textContent = earned ? 'Earned!'
        : key === 'ages' ? (cur > 0 ? `the High Seat rises — ${cur}%` : 'raise the High Seat')
        : `${cur} / ${goal}`;
    }

    // kingdom stats
    const jobs = { producer: 0, builder: 0, soldier: 0, idle: 0 };
    for (const v of state.villagers) jobs[v.job] = (jobs[v.job] || 0) + 1;
    const masters = countMasters(state);
    const sacked = state.buildings.filter((b) => b.sacked && b.hp > 0).length;
    const reserve = armedReserve(state).length;
    recruitBtn.textContent = reserve > 0
      ? `Muster militia (free — ${reserve} armed in reserve)`
      : `Recruit soldier (${SOLDIER.cost.iron} iron — then eats 3×)`;
    const mercs = mercCount(state);
    const mercUpkeep = mercUpkeepRate(state).toFixed(2);
    kStats.innerHTML = `
      <div class="stat"><b>${state.pop}</b> subjects — ${jobs.producer} working · ${jobs.builder} repairing · ${jobs.soldier} under arms · ${jobs.idle} idle</div>
      ${mercs > 0 ? `<div class="stat"><b class="merc-name">${mercs}</b> mercenaries under contract · <span class="bad">${mercUpkeep} gold/tick upkeep</span></div>` : ''}
      <div class="stat"><b>${masters}</b> master craftsfolk${masters > 0 ? ' (their skill dies with them)' : ''}</div>
      <div class="stat"><b>${territorySize(state)}</b> tiles of territory${sacked ? ` · <span class="bad">${sacked} sacked building${sacked > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="stat">Morale <b>${Math.round(state.morale)}</b>${state.starving ? ' · <span class="bad">STARVING</span>' : ''}</div>
      <div class="stat">${(() => {
        const r = state.raid;
        if (r.phase === 'warning') return '<span class="bad">Raiders approach!</span>';
        if (r.phase === 'active') return '<span class="bad">RAID IN PROGRESS</span>';
        if (r.stage === 2 && r.nextFromCamp && state.camp) return `<span class="bad">The war-camp stirs — ${state.camp.name} may march soon</span>`;
        if (r.stage === 1 && r.nextFromCamp && state.camp) return `<span class="bad">Raiders are massing at ${state.camp.name}</span>`;
        return `Next raid threat in ~${Math.ceil(r.timer * TICK_MS / 1000)}s`;
      })()}</div>`;

    // the warlord's camp — the opponent you build toward
    const c = state.camp;
    campBox.classList.toggle('hidden', !c);
    if (c) {
      const exp = state.expedition;
      const hoard = Math.round(c.ledger.gold + c.ledger.plunder);
      let line;
      if (exp) {
        line = exp.phase === 'march' ? `<b class="bad">The host marches on ${c.name}…</b>`
          : exp.phase === 'battle' ? `<b class="bad">BATTLE IS JOINED at ${c.name}!</b>`
          : exp.phase === 'choice' ? `<b class="bad">${c.name} is taken. They await your word.</b>`
          : exp.phase === 'massacre' ? `<b class="bad">No quarter at ${c.name}.</b>`
          : 'The host is coming home.';
      } else if (c.gone) {
        line = `${c.name} lies in ashes. The wilds are quiet. <span class="bad">Too quiet.</span>`;
      } else if (c.broken) {
        line = `${c.name} lies broken — the war-tents burned. The folk there remember your mercy.`;
      } else if (c.leaderless) {
        line = `${c.name} is leaderless — ${'a successor will rise.'}`;
      } else if (c.unclaimed) {
        line = `<b>${c.name}</b> — a nest of brigands in the wilds, no warlord yet. ~${c.garrison.length} swords, hoard ~<b>${hoard}</b>. Break it before one claims it.`;
      } else {
        line = `<b>${c.name}</b> festers in the wilds — ${c.warlord.name}${c.avenger ? ` <span class="bad">(the avenger — ${pron(c.warlord.name).he} takes no gold)</span>` : ''}, ~${c.garrison.length} swords, hoard ~<b>${hoard}</b>.`;
      }
      campInfo.innerHTML = line;
      marchBtn.classList.toggle('disabled', !!exp || c.gone || c.broken);
    }

    // trade
    const m = state.merchant;
    if (m.status === 'here') {
      // the carts are finite, and your own commerce is what enlarges them
      const cap = buyCapacity(state), left = buyRemaining(state);
      merchStatus.innerHTML = `<b>The merchant is here!</b> Departs in ${Math.ceil(m.timer * TICK_MS / 1000)}s`
        + `<br><span class="${left > 0 ? 'merch-carts' : 'merch-carts bad'}">`
        + (left > 0
          ? `Carts: ${left} of ${cap} goods left to buy`
          : `Carts full — ${cap} goods bought this visit`)
        + '</span>';
      merchStatus.className = 'merch-status here';
    } else {
      merchStatus.textContent = `Merchant returns in ~${Math.ceil(m.timer * TICK_MS / 1000)}s`
        + ` · carts hold ${buyCapacity(state)} goods`;
      merchStatus.className = 'merch-status';
    }
    for (const r of TRADABLE) {
      const row = tradeRows[r];
      row.classList.toggle('inactive', m.status !== 'here');
      row.querySelector('.price').textContent = m.status === 'here'
        ? `${sellPrice(state, r).toFixed(1)} / ${buyPrice(state, r).toFixed(1)}`
        : '—';
    }

    // a standing tribute demand replaces the raid banner (same spot, a choice
    // instead of an alarm); the demand dies when the rider leaves or is paid
    const demanding = !!state.raid.demand && state.raid.phase === 'warning';
    tributeBanner.classList.toggle('hidden', !demanding);
    raidBanner.classList.toggle('hidden', state.raid.phase === 'quiet' || demanding);
    if (state.raid.phase === 'quiet') raidBanner.classList.remove('besieged');
    raidBanner.textContent = state.raid.keepBesieged
      ? '⚠ THE KEEP IS BESIEGED ⚠'
      : state.raid.phase === 'warning' ? '⚔ RAIDERS APPROACH ⚔' : '⚔ RAID IN PROGRESS ⚔';

    renderSelection();
    renderUnit();
    renderSteward();
    drawMinimap();
  }

  on('tick', render);
  render();

  window.addEventListener('beforeunload', () => saveGame(state));

  return { mapDiv };
}
