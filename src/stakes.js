// Staking Board: records of who is backing whom. No money is held or moved by the site.
import crypto from 'node:crypto';
import { tx, todayIso } from './db.js';
import { GAMES, normalizeState, parseDate, parseTime, clean } from './normalize.js';

const round2 = n => Math.round(n * 100) / 100;
const hashKey = k => crypto.createHash('sha256').update(String(k)).digest('hex');

// Cost of a piece and what it returns if the player wins a heads-up match:
// a backer with p% of the action puts up p% of the bet (times the markup) and,
// on a win, gets back p% of both sides' money (the stake plus the winnings).
export function pieceMath(bet, markup, percent) {
  const cost = round2(bet * (percent / 100) * markup);
  const returnIfWon = round2(bet * 2 * (percent / 100));
  return { cost, returnIfWon };
}

export function validateStake(b) {
  if (!b || typeof b !== 'object') return { error: 'Missing match details' };
  const s = (v, n) => clean(v).slice(0, n);
  const num = v => (v === '' || v == null ? NaN : Number(v));
  const player = s(b.player, 60);
  if (!player) return { error: "Player's name is required" };
  const date = parseDate(b.date);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (!date || date < yesterday) return { error: 'Enter a match date that is today or later' };
  const bet = num(b.bet);
  if (!Number.isFinite(bet) || bet < 1 || bet > 1_000_000) return { error: 'Enter the amount bet a side ($1 or more)' };
  const offered = num(b.offered);
  if (!Number.isFinite(offered) || offered < 1 || offered > 100) return { error: 'Percent for sale must be between 1 and 100' };
  let markup = b.markup === '' || b.markup == null ? 1 : num(b.markup);
  if (!Number.isFinite(markup) || markup < 1 || markup > 2) return { error: 'Markup must be between 1.0 and 2.0' };
  const stakeholder = s(b.stakeholder, 80);
  if (!stakeholder) return { error: 'Name who is holding the stake money' };
  return {
    value: {
      player, opponent: s(b.opponent, 60) || null, game: GAMES.includes(b.game) ? b.game : 'Other', race: s(b.race, 40) || null,
      bet: round2(bet), offered: Math.round(offered), markup: round2(markup), date, time: parseTime(b.time),
      venue: s(b.venue, 120) || null, city: s(b.city, 80) || null, state: normalizeState(b.state) || null,
      stakeholder, contact: s(b.contact, 120) || null, notes: s(b.notes, 500) || null
    }
  };
}

export function createStake(db, v) {
  const key = crypto.randomBytes(18).toString('base64url');
  const r = db.prepare(`INSERT INTO stakes (player,opponent,game,race,bet,offered,markup,date,time,venue,city,state,stakeholder,contact,notes,manage_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.player, v.opponent, v.game, v.race, v.bet, v.offered, v.markup, v.date, v.time,
    v.venue, v.city, v.state, v.stakeholder, v.contact, v.notes, hashKey(key));
  return { id: Number(r.lastInsertRowid), key };
}

export function manageKeyOk(db, id, key) {
  if (!key) return false;
  const row = db.prepare('SELECT manage_hash FROM stakes WHERE id=?').get(id);
  if (!row) return false;
  const a = Buffer.from(row.manage_hash), b = Buffer.from(hashKey(key));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function shapeStake(row, pieces, { privateView = false } = {}) {
  const sold = round2(pieces.reduce((n, p) => n + Number(p.percent), 0));
  return {
    id: row.id, player: row.player, opponent: row.opponent, game: row.game, race: row.race,
    bet: row.bet, offered: row.offered, markup: row.markup, date: row.date, time: row.time,
    venue: row.venue, city: row.city, state: row.state, stakeholder: row.stakeholder, contact: row.contact, notes: row.notes,
    status: row.status, result: row.result, score: row.score, createdAt: row.created_at,
    sold, remaining: round2(Math.max(0, row.offered - sold)),
    pieces: pieces.map(p => ({
      id: p.id, backer: p.backer, percent: p.percent, paid: !!p.paid, createdAt: p.created_at,
      ...pieceMath(row.bet, row.markup, p.percent),
      ...(privateView ? { contact: p.contact } : {})
    }))
  };
}

const piecesFor = (db, id) => db.prepare('SELECT * FROM stake_pieces WHERE stake_id=? ORDER BY id').all(id);

export function getStake(db, id, { privateView = false } = {}) {
  const row = db.prepare('SELECT * FROM stakes WHERE id=?').get(id);
  return row ? shapeStake(row, piecesFor(db, id), { privateView }) : null;
}

// The public board: open matches (not yet played) plus settled ones from the last 60 days.
export function listBoard(db, today = todayIso()) {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const open = db.prepare(`SELECT * FROM stakes WHERE status='open' AND date >= ? ORDER BY date, time`).all(
    new Date(Date.parse(today + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10));
  const settled = db.prepare(`SELECT * FROM stakes WHERE status='settled' AND date >= ? ORDER BY date DESC, id DESC LIMIT 50`).all(since);
  const shape = r => shapeStake(r, piecesFor(db, r.id));
  return { open: open.map(shape), settled: settled.map(shape) };
}

export function listPendingStakes(db) {
  return db.prepare(`SELECT * FROM stakes WHERE status='pending' ORDER BY id DESC LIMIT 100`).all().map(r => shapeStake(r, piecesFor(db, r.id), { privateView: true }));
}

export function setStakeStatus(db, id, status) {
  return db.prepare("UPDATE stakes SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id).changes > 0;
}

export function claimPiece(db, id, b) {
  const backer = clean(b?.backer).slice(0, 60);
  if (!backer) return { status: 400, error: 'Enter your name' };
  const percent = Number(b?.percent);
  if (!Number.isFinite(percent) || percent < 1 || Math.round(percent) !== percent) return { status: 400, error: 'Pick a whole percent, 1 or more' };
  const contact = clean(b?.contact).slice(0, 120) || null;
  return tx(db, () => {
    const row = db.prepare('SELECT * FROM stakes WHERE id=?').get(id);
    if (!row || row.status !== 'open') return { status: 404, error: 'This match is not taking backers' };
    const sold = db.prepare('SELECT COALESCE(SUM(percent),0) n FROM stake_pieces WHERE stake_id=?').get(id).n;
    const left = row.offered - sold;
    if (percent > left) return { status: 409, error: left > 0 ? `Only ${left}% is left` : 'This match is sold out' };
    const r = db.prepare('INSERT INTO stake_pieces (stake_id, backer, percent, contact) VALUES (?,?,?,?)').run(id, backer, percent, contact);
    return { status: 201, pieceId: Number(r.lastInsertRowid), ...pieceMath(row.bet, row.markup, percent) };
  });
}

export function recordResult(db, id, b) {
  const result = b?.result;
  if (result === 'cancelled') return setStakeStatus(db, id, 'cancelled') ? { ok: true } : { error: 'Not found' };
  if (result !== 'won' && result !== 'lost') return { error: 'Choose Won, Lost or Cancelled' };
  const score = clean(b?.score).slice(0, 20) || null;
  const r = db.prepare("UPDATE stakes SET status='settled', result=?, score=?, updated_at=datetime('now') WHERE id=? AND status IN ('open','settled')").run(result, score, id);
  return r.changes ? { ok: true } : { error: 'This match has not been approved yet' };
}

export function setPiecePaid(db, stakeId, pieceId, paid) {
  return db.prepare('UPDATE stake_pieces SET paid=? WHERE id=? AND stake_id=?').run(paid ? 1 : 0, pieceId, stakeId).changes > 0;
}
export function removePiece(db, stakeId, pieceId) {
  return db.prepare('DELETE FROM stake_pieces WHERE id=? AND stake_id=?').run(pieceId, stakeId).changes > 0;
}
