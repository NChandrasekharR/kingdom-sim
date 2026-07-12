import { RES_INFO, MERCHANT, ROAD_MERCHANT_FACTOR } from '../config.js';
import { logEvent } from './events.js';

const TRADABLE = ['food', 'wood', 'stone', 'ore', 'iron', 'bread'];

export function tradeTick(state, rand) {
  const m = state.merchant;
  m.timer--;
  if (m.status === 'away' && m.timer <= 0) {
    m.status = 'here';
    m.timer = MERCHANT.stay;
    m.visits++;
    m.prices = {};
    for (const r of TRADABLE) {
      m.prices[r] = RES_INFO[r].base * (0.65 + rand());
    }
    logEvent(state, 'A merchant caravan has arrived at your gates.', 'trade');
  } else if (m.status === 'here' && m.timer <= 0) {
    m.status = 'away';
    m.timer = MERCHANT.awayMin + Math.floor(rand() * (MERCHANT.awayMax - MERCHANT.awayMin));
    // markets and roads shorten the wait
    if (state.buildings.some((b) => b.type === 'market' && b.hp > 0)) {
      m.timer = Math.floor(m.timer * 0.7);
    }
    const roads = state.buildings.filter((b) => b.type === 'road' && b.hp > 0).length;
    m.timer = Math.floor(m.timer * Math.max(0.6, 1 - roads * ROAD_MERCHANT_FACTOR));
    logEvent(state, 'The merchant caravan departs.', 'trade');
  }
}

export function sellPrice(state, r) { return state.merchant.prices[r] || 0; }
export function buyPrice(state, r) { return (state.merchant.prices[r] || 0) * MERCHANT.markup; }

export function sell(state, r, qty) {
  const m = state.merchant;
  if (m.status !== 'here' || !TRADABLE.includes(r)) return false;
  qty = Math.min(qty, Math.floor(state.res[r]));
  if (qty <= 0) return false;
  const gain = sellPrice(state, r) * qty;
  state.res[r] -= qty;
  state.res.gold += gain;
  // flooding the market drops the price
  m.prices[r] *= Math.max(0.55, 1 - qty * 0.006);
  return true;
}

export function buy(state, r, qty) {
  const m = state.merchant;
  if (m.status !== 'here' || !TRADABLE.includes(r)) return false;
  const cost = buyPrice(state, r) * qty;
  if (state.res.gold < cost) return false;
  state.res.gold -= cost;
  state.res[r] += qty;
  m.prices[r] *= 1 + qty * 0.004;
  return true;
}
