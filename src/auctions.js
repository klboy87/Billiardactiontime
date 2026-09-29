// Calcutta-style auctions (live one-at-a-time, or silent with every player open at once).
// Records only: the site never takes, holds or pays out money.
import crypto from 'node:crypto';
import { tx } from './db.js';
import { clean } from './normalize.js';

const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const round2 = n => Math.round(n * 100) / 100;
const PAUSE_BETWEEN_MS = 6000;   // live mode: show "SOLD" for a moment before the next player opens
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(db) {
  for (let i = 0; i < 20; i++) {
    let c = '';
    for (const b of crypto.randomBytes(6)) c += CODE_CHARS[b % CODE_CHARS.length];
    if (!db.prepare('SELECT 1 FROM auctions WHERE code=?').get(c)) return c;
  }
  throw new Error('Could not make an auction code');
}

export function parsePayouts(text) {
  const nums = String(text ?? '').split(/[^0-9.]+/).filter(Boolean).map(Number).filter(n => n > 0).slice(0, 32);
  const total = nums.reduce((a, b) => a + b, 0);
  if (total > 100.001) return { error: 'Payout percentages add up to more than 100' };
  return { value: nums.map(round2) };
}

function parseItems(text) {
  return String(text ?? '').split(/\r?\n/).map(l => clean(l).slice(0, 80)).filter(Boolean).slice(0, 256);
}

export function validateAuction(b) {
  if (!b || typeof b !== 'object') return { error: 'Missing auction details' };
  const title = clean(b.title).slice(0, 100);
  if (!title) return { error: 'Give the auction a name' };
  const mode = b.mode === 'silent' ? 'silent' : 'live';
  const n = (v, d) => (v === '' || v == null ? d : Number(v));
  const minBid = n(b.minBid, 5), inc = n(b.increment, 5), bidSec = Math.round(n(b.bidSeconds, 30));
  const resetSec = Math.round(n(b.resetSeconds, 15)), silentMin = Math.round(n(b.silentMinutes, 60)), cut = n(b.houseCut, 0);
  if (!(minBid >= 1 && minBid <= 100000)) return { error: 'Opening bid must be between $1 and $100,000' };
  if (!(inc >= 1 && inc <= 10000)) return { error: 'Bid increment must be between $1 and $10,000' };
  if (!(bidSec >= 10 && bidSec <= 300)) return { error: 'Clock per player must be 10 to 300 seconds' };
  if (!(resetSec >= 5 && resetSec <= 120)) return { error: 'Late-bid reset must be 5 to 120 seconds' };
  if (!(silentMin >= 5 && silentMin <= 10080)) return { error: 'Silent auction length must be 5 minutes to 7 days' };
  if (!(cut >= 0 && cut <= 50)) return { error: 'House cut must be 0 to 50%' };
  const payouts = parsePayouts(b.payouts || '50,25,15,10');
  if (payouts.error) return payouts;
  const items = parseItems(b.items);
  if (!items.length) return { error: 'Add at least one player (one per line)' };
  return {
    value: {
      title, mode, startsAt: clean(b.startsAt).slice(0, 30) || null, listed: b.listed ? 1 : 0,
      minBid: round2(minBid), increment: round2(inc), bidSeconds: bidSec, resetSeconds: resetSec, silentMinutes: silentMin,
      houseCut: round2(cut), payouts: payouts.value, items
    }
  };
}

export function createAuction(db, v) {
  const hostKey = crypto.randomBytes(18).toString('base64url');
  return tx(db, () => {
    const code = newCode(db);
    const r = db.prepare(`INSERT INTO auctions (code,title,starts_at,mode,listed,min_bid,increment,bid_seconds,reset_seconds,silent_minutes,house_cut,payouts,host_hash)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, v.title, v.startsAt, v.mode, v.listed, v.minBid, v.increment, v.bidSeconds,
      v.resetSeconds, v.silentMinutes, v.houseCut, JSON.stringify(v.payouts), hash(hostKey));
    const id = Number(r.lastInsertRowid);
    const ins = db.prepare('INSERT INTO auction_items (auction_id, name, sort) VALUES (?,?,?)');
    v.items.forEach((name, i) => ins.run(id, name, i + 1));
    return { code, hostKey };
  });
}

export const getAuction = (db, code) => db.prepare('SELECT * FROM auctions WHERE code=?').get(String(code || '').toUpperCase());
export const isHost = (a, key) => !!(a && key && eq(a.host_hash, hash(key)));
export function bidderFor(db, a, token) {
  if (!a || !token) return null;
  return db.prepare('SELECT id, name FROM auction_bidders WHERE auction_id=? AND token_hash=?').get(a.id, hash(token)) || null;
}
const bump = (db, id) => db.prepare('UPDATE auctions SET rev = rev + 1 WHERE id=?').run(id);

function openNext(db, a, now) {
  const next = db.prepare("SELECT id FROM auction_items WHERE auction_id=? AND status='waiting' ORDER BY sort, id LIMIT 1").get(a.id);
  if (!next) {
    db.prepare("UPDATE auctions SET status='done', current_item=NULL, next_at=NULL WHERE id=?").run(a.id);
    return;
  }
  db.prepare("UPDATE auction_items SET status='open', ends_at=? WHERE id=?").run(now + a.bid_seconds * 1000, next.id);
  db.prepare('UPDATE auctions SET current_item=?, next_at=NULL WHERE id=?').run(next.id, a.id);
}
function closeItem(db, itemId, forceUnsold = false) {
  const it = db.prepare('SELECT high_bid FROM auction_items WHERE id=?').get(itemId);
  const sold = !forceUnsold && it && it.high_bid != null;
  db.prepare('UPDATE auction_items SET status=?, ends_at=NULL WHERE id=?').run(sold ? 'sold' : 'unsold', itemId);
}

// Moves the clock forward: closes players whose time ran out and opens the next one.
// Called on every read and write, so no background timer is needed.
export function tick(db, a, now = Date.now()) {
  if (!a || a.status !== 'running') return a;
  let changed = false;
  tx(db, () => {
    if (a.mode === 'silent') {
      const expired = db.prepare("SELECT id FROM auction_items WHERE auction_id=? AND status='open' AND ends_at <= ?").all(a.id, now);
      for (const it of expired) closeItem(db, it.id);
      if (expired.length) changed = true;
      if (!db.prepare("SELECT 1 FROM auction_items WHERE auction_id=? AND status IN ('open','waiting')").get(a.id)) {
        db.prepare("UPDATE auctions SET status='done' WHERE id=?").run(a.id); changed = true;
      }
    } else {
      const cur = a.current_item ? db.prepare('SELECT * FROM auction_items WHERE id=?').get(a.current_item) : null;
      if (cur && cur.status === 'open' && cur.ends_at <= now) {
        closeItem(db, cur.id);
        db.prepare('UPDATE auctions SET next_at=? WHERE id=?').run(now + PAUSE_BETWEEN_MS, a.id);
        changed = true;
      } else if ((!cur || cur.status !== 'open') && a.next_at && a.next_at <= now) {
        openNext(db, a, now); changed = true;
      }
    }
    if (changed) bump(db, a.id);
  });
  return changed ? db.prepare('SELECT * FROM auctions WHERE id=?').get(a.id) : a;
}

export function join(db, a, name) {
  const n = clean(name).slice(0, 30);
  if (!n) return { status: 400, error: 'Enter a name to bid under' };
  const token = crypto.randomBytes(18).toString('base64url');
  try {
    const r = db.prepare('INSERT INTO auction_bidders (auction_id, name, name_key, token_hash) VALUES (?,?,?,?)').run(a.id, n, n.toLowerCase(), hash(token));
    bump(db, a.id);
    return { status: 201, token, bidder: { id: Number(r.lastInsertRowid), name: n } };
  } catch { return { status: 409, error: 'That name is taken in this auction. Try another.' }; }
}

export function minNext(a, item) { return item.high_bid == null ? a.min_bid : round2(item.high_bid + a.increment); }

export function placeBid(db, a, bidder, itemId, amount, now = Date.now()) {
  if (a.status !== 'running') return { status: 409, error: a.status === 'paused' ? 'The auction is paused' : 'The auction is not running' };
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0 || amt > 10_000_000) return { status: 400, error: 'Enter a valid amount' };
  return tx(db, () => {
    const it = db.prepare('SELECT * FROM auction_items WHERE id=? AND auction_id=?').get(itemId, a.id);
    if (!it || it.status !== 'open' || it.ends_at <= now) return { status: 409, error: 'Bidding on this player has closed' };
    if (a.mode === 'live' && a.current_item !== it.id) return { status: 409, error: 'This player is not up right now' };
    if (it.high_bidder === bidder.id) return { status: 409, error: "You're already the high bidder" };
    const need = minNext(a, it);
    if (amt < need) return { status: 409, error: `Bid at least $${need.toLocaleString('en-US')}` };
    const reset = now + a.reset_seconds * 1000;
    db.prepare('UPDATE auction_items SET high_bid=?, high_bidder=?, ends_at=? WHERE id=?').run(amt, bidder.id, Math.max(it.ends_at, reset), it.id);
    db.prepare('INSERT INTO auction_bids (auction_id, item_id, bidder_id, amount, at) VALUES (?,?,?,?,?)').run(a.id, it.id, bidder.id, amt, now);
    bump(db, a.id);
    return { status: 201, ok: true };
  });
}

export function postChat(db, a, name, isHostMsg, text, now = Date.now()) {
  const t = clean(text).slice(0, 300);
  if (!t) return { status: 400, error: 'Type a message' };
  db.prepare('INSERT INTO auction_chat (auction_id, name, host, text, at) VALUES (?,?,?,?,?)').run(a.id, name, isHostMsg ? 1 : 0, t, now);
  bump(db, a.id);
  return { status: 201, ok: true };
}

// Host controls.
export function hostAction(db, a, action, b = {}, now = Date.now()) {
  const res = tx(db, () => {
    switch (action) {
      case 'start': {
        if (a.status !== 'setup') return { error: 'Already started' };
        if (!db.prepare('SELECT 1 FROM auction_items WHERE auction_id=?').get(a.id)) return { error: 'Add players first' };
        db.prepare("UPDATE auctions SET status='running' WHERE id=?").run(a.id);
        if (a.mode === 'silent') {
          db.prepare("UPDATE auction_items SET status='open', ends_at=? WHERE auction_id=? AND status='waiting'").run(now + a.silent_minutes * 60_000, a.id);
        } else openNext(db, { ...a, status: 'running' }, now);
        return { ok: true };
      }
      case 'pause': {
        if (a.status !== 'running' || a.mode !== 'live') return { error: 'Only a running live auction can be paused' };
        const cur = a.current_item ? db.prepare('SELECT * FROM auction_items WHERE id=?').get(a.current_item) : null;
        const left = cur && cur.status === 'open' ? Math.max(5000, cur.ends_at - now) : null;
        db.prepare("UPDATE auctions SET status='paused', paused_left_ms=?, next_at=NULL WHERE id=?").run(left, a.id);
        return { ok: true };
      }
      case 'resume': {
        if (a.status !== 'paused') return { error: 'Not paused' };
        const cur = a.current_item ? db.prepare('SELECT * FROM auction_items WHERE id=?').get(a.current_item) : null;
        if (cur && cur.status === 'open') db.prepare('UPDATE auction_items SET ends_at=? WHERE id=?').run(now + Math.max(10000, a.paused_left_ms || 0), cur.id);
        db.prepare("UPDATE auctions SET status='running', paused_left_ms=NULL, next_at=? WHERE id=?").run(cur && cur.status === 'open' ? null : now + 3000, a.id);
        return { ok: true };
      }
      case 'sell': case 'pass': {
        if (a.mode !== 'live' || !a.current_item) return { error: 'No player is up' };
        const cur = db.prepare('SELECT * FROM auction_items WHERE id=?').get(a.current_item);
        if (cur.status !== 'open') return { error: 'This player is already closed' };
        closeItem(db, cur.id, action === 'pass');
        if (a.status === 'running') db.prepare('UPDATE auctions SET next_at=? WHERE id=?').run(now + PAUSE_BETWEEN_MS, a.id);
        return { ok: true };
      }
      case 'next': {
        if (a.mode !== 'live' || a.status !== 'running') return { error: 'The auction is not running' };
        const cur = a.current_item ? db.prepare('SELECT status FROM auction_items WHERE id=?').get(a.current_item) : null;
        if (cur && cur.status === 'open') return { error: 'Sell or pass the current player first' };
        openNext(db, a, now);
        return { ok: true };
      }
      case 'end': {
        const open = db.prepare("SELECT id FROM auction_items WHERE auction_id=? AND status='open'").all(a.id);
        for (const it of open) closeItem(db, it.id);
        db.prepare("UPDATE auction_items SET status='unsold' WHERE auction_id=? AND status='waiting'").run(a.id);
        db.prepare("UPDATE auctions SET status='done', next_at=NULL WHERE id=?").run(a.id);
        return { ok: true };
      }
      case 'add': {
        if (a.status === 'done') return { error: 'The auction is over' };
        const names = parseItems(b.items);
        if (!names.length) return { error: 'Type at least one name' };
        let sort = db.prepare('SELECT COALESCE(MAX(sort),0) n FROM auction_items WHERE auction_id=?').get(a.id).n;
        const silentOpen = a.mode === 'silent' && a.status !== 'setup';
        const endsAt = silentOpen ? (db.prepare("SELECT MAX(ends_at) n FROM auction_items WHERE auction_id=? AND status='open'").get(a.id).n || now + a.silent_minutes * 60_000) : null;
        const ins = db.prepare('INSERT INTO auction_items (auction_id, name, sort, status, ends_at) VALUES (?,?,?,?,?)');
        for (const n of names) ins.run(a.id, n, ++sort, silentOpen ? 'open' : 'waiting', endsAt);
        return { ok: true };
      }
      case 'remove': {
        const r = db.prepare("DELETE FROM auction_items WHERE id=? AND auction_id=? AND status='waiting'").run(Number(b.itemId), a.id);
        return r.changes ? { ok: true } : { error: 'Only players not yet auctioned can be removed' };
      }
      case 'finish': {
        const place = b.finish === '' || b.finish == null ? null : Math.round(Number(b.finish));
        if (place != null && !(place >= 1 && place <= 256)) return { error: 'Finish must be a place like 1, 2, 3' };
        const r = db.prepare('UPDATE auction_items SET finish=? WHERE id=? AND auction_id=?').run(place, Number(b.itemId), a.id);
        return r.changes ? { ok: true } : { error: 'Player not found' };
      }
      case 'delete': {
        for (const t of ['auction_bids', 'auction_chat', 'auction_items', 'auction_bidders']) db.prepare(`DELETE FROM ${t} WHERE auction_id=?`).run(a.id);
        db.prepare('DELETE FROM auctions WHERE id=?').run(a.id);
        return { ok: true, deleted: true };
      }
      default: return { error: 'Unknown action' };
    }
  });
  if (res.ok && !res.deleted) bump(db, a.id);
  return res;
}

// Everything a viewer needs to draw the room.
export function roomState(db, a, { you = null, host = false, now = Date.now() } = {}) {
  const names = new Map(db.prepare('SELECT id, name FROM auction_bidders WHERE auction_id=?').all(a.id).map(r => [r.id, r.name]));
  const payouts = JSON.parse(a.payouts || '[]');
  const items = db.prepare('SELECT * FROM auction_items WHERE auction_id=? ORDER BY sort, id').all(a.id);
  const pot = round2(items.filter(i => i.status === 'sold').reduce((s, i) => s + i.high_bid, 0));
  const net = round2(pot * (1 - a.house_cut / 100));
  const placePay = payouts.map(p => round2(net * p / 100));
  const shaped = items.map(i => ({
    id: i.id, name: i.name, sort: i.sort, status: i.status, endsAt: i.ends_at, highBid: i.high_bid,
    highBidder: i.high_bidder ? names.get(i.high_bidder) || '?' : null, mine: !!(you && i.high_bidder === you.id),
    finish: i.finish, payout: i.status === 'sold' && i.finish && placePay[i.finish - 1] ? placePay[i.finish - 1] : 0,
    minNext: minNext(a, i)
  }));
  const bidRows = (itemId, limit) => db.prepare('SELECT bidder_id, amount, at FROM auction_bids WHERE item_id=? ORDER BY id DESC LIMIT ?').all(itemId, limit)
    .map(b => ({ name: names.get(b.bidder_id) || '?', amount: b.amount, at: b.at }));
  const owners = new Map();
  for (const i of shaped) if (i.status === 'sold') {
    const o = owners.get(i.highBidder) || { name: i.highBidder, players: 0, spent: 0, won: 0 };
    o.players++; o.spent = round2(o.spent + i.highBid); o.won = round2(o.won + i.payout); owners.set(i.highBidder, o);
  }
  return {
    rev: a.rev, serverNow: now,
    auction: {
      code: a.code, title: a.title, startsAt: a.starts_at, mode: a.mode, status: a.status, listed: !!a.listed,
      minBid: a.min_bid, increment: a.increment, bidSeconds: a.bid_seconds, resetSeconds: a.reset_seconds,
      silentMinutes: a.silent_minutes, houseCut: a.house_cut, payouts, currentItem: a.current_item, nextAt: a.next_at,
      pausedLeftMs: a.paused_left_ms
    },
    items: shaped,
    currentBids: a.current_item ? bidRows(a.current_item, 15) : [],
    recentBids: db.prepare('SELECT item_id, bidder_id, amount, at FROM auction_bids WHERE auction_id=? ORDER BY id DESC LIMIT 20').all(a.id)
      .map(b => ({ item: items.find(i => i.id === b.item_id)?.name || '?', name: names.get(b.bidder_id) || '?', amount: b.amount, at: b.at })),
    chat: db.prepare('SELECT name, host, text, at FROM auction_chat WHERE auction_id=? ORDER BY id DESC LIMIT 60').all(a.id).reverse()
      .map(c => ({ name: c.name, host: !!c.host, text: c.text, at: c.at })),
    bidders: names.size, pot, net, placePay,
    owners: [...owners.values()].sort((x, y) => y.spent - x.spent),
    you, host
  };
}

export function listedAuctions(db) {
  return db.prepare(`SELECT a.code, a.title, a.starts_at, a.mode, a.status,
      (SELECT COUNT(*) FROM auction_items i WHERE i.auction_id=a.id) players,
      (SELECT COALESCE(SUM(high_bid),0) FROM auction_items i WHERE i.auction_id=a.id AND i.status='sold') pot
    FROM auctions a WHERE a.listed=1 AND (a.status <> 'done' OR a.created_at >= datetime('now','-14 days'))
    ORDER BY CASE a.status WHEN 'running' THEN 0 WHEN 'paused' THEN 0 WHEN 'setup' THEN 1 ELSE 2 END, a.id DESC LIMIT 50`).all()
    .map(r => ({ code: r.code, title: r.title, startsAt: r.starts_at, mode: r.mode, status: r.status, players: Number(r.players), pot: Number(r.pot) }));
}
