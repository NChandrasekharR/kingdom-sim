import { RES_INFO, MERCHANT, TRADE_CAP, ROAD_MERCHANT_FACTOR } from '../config.js';
import { logEvent, emit } from './events.js';

const TRADABLE = ['food', 'wood', 'stone', 'ore', 'iron', 'bread'];

// How much the caravan can SELL you this visit — the carts are finite, and
// what enlarges them is your own commerce (docks to unload at, a market to
// pile it in). Selling to the merchant is never capped.
export function buyCapacity(state) {
  const live = (t) => state.buildings.filter((b) => b.type === t && b.hp > 0).length;
  return TRADE_CAP.capBase + live('dock') * TRADE_CAP.perDock + live('market') * TRADE_CAP.perMarket;
}

// goods still available to buy before the carts run out
export function buyRemaining(state) {
  return Math.max(0, buyCapacity(state) - (state.merchant.bought || 0));
}

export function tradeTick(state, rand) {
  const m = state.merchant;
  m.timer--;
  if (m.status === 'away' && m.timer <= 0) {
    m.status = 'here';
    m.timer = MERCHANT.stay;
    m.visits++;
    m.bought = 0;        // fresh carts: the per-visit buy allowance resets
    m.prices = {};
    for (const r of TRADABLE) {
      m.prices[r] = RES_INFO[r].base * (0.65 + rand());
    }
    logEvent(state, 'A merchant caravan has arrived at your gates.', 'trade');
    emit('merchant-arrived');
  } else if (m.status === 'here' && m.timer <= 0) {
    m.status = 'away';
    m.timer = MERCHANT.awayMin + Math.floor(rand() * (MERCHANT.awayMax - MERCHANT.awayMin));
    // markets and roads shorten the wait
    if (state.buildings.some((b) => b.type === 'market' && b.hp > 0)) {
      m.timer = Math.floor(m.timer * 0.7);
    }
    const roads = state.buildings.filter((b) => (b.type === 'road' || b.type === 'bridge') && b.hp > 0).length;
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

// Returns true on a completed purchase, or a reason string the UI can show.
// Partial fills are deliberately NOT done: asking for 10 when 3 carts remain
// tells you the carts are full rather than quietly selling you 3.
export function buy(state, r, qty) {
  const m = state.merchant;
  if (m.status !== 'here' || !TRADABLE.includes(r)) return false;
  if (qty > buyRemaining(state)) {
    state.stats.buysBlocked = (state.stats.buysBlocked || 0) + 1;
    return "the caravan's carts are full — harbors would carry more";
  }
  const cost = buyPrice(state, r) * qty;
  if (state.res.gold < cost) return 'not enough gold';
  state.res.gold -= cost;
  state.res[r] += qty;
  m.bought = (m.bought || 0) + qty;
  state.stats.goodsBought = (state.stats.goodsBought || 0) + qty;
  m.prices[r] *= 1 + qty * 0.004;
  return true;
}
