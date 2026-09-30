// Money Matches: big challenge matches (e.g. "10-Ball, race to 21, $10,000+ on the line").
// Anyone can submit one (usually by uploading the flyer); the admin approves it before it shows.
// Fans can vote on who they think wins and leave comments; the admin enters the final score.
// The site only lists the match. It never takes, holds or pays out money.
import crypto from 'node:crypto';
import { GAMES, normalizeState, parseDate, parseTime, clean, slugify } from './normalize.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS money_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  player1 TEXT NOT NULL, player2 TEXT NOT NULL,
  game TEXT NOT NULL, race INTEGER, stakes TEXT, stakes_amount INTEGER,
  date TEXT NOT NULL, time TEXT,
  city TEXT NOT NULL, state TEXT NOT NULL, room TEXT, address TEXT,
  stream_url TEXT, notes TEXT,
  flyer_data TEXT,
  submitter_name TEXT, submitter_contact TEXT,        -- private: only the admin sees these
  status TEXT NOT NULL DEFAULT 'pending',             -- pending | published | archived
  prev_status TEXT, archived_at TEXT,
  featured INTEGER NOT NULL DEFAULT 0,                -- "Money Match of the Week"
  winner INTEGER, score1 INTEGER, score2 INTEGER,     -- winner: 1 or 2
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mm_status ON money_matches(status, date);
CREATE TABLE IF NOT EXISTS mm_votes (
  match_id INTEGER NOT NULL REFERENCES money_matches(id), voter TEXT NOT NULL, pick INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (match_id, voter)
);
CREATE TABLE IF NOT EXISTS mm_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL REFERENCES money_matches(id),
  name TEXT NOT NULL, body TEXT NOT NULL, contact TEXT, deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mm_comments ON mm_comments(match_id, deleted);
`;

// Today's date on Michigan time (the site's home time zone).
export function todayLocal(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(now)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const safeUrl = v => { const s = clean(v).slice(0, 300); if (!s) return null; try { const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
const FLYER_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function validate(b, { requireFlyerFormat = true } = {}) {
  if (!b || typeof b !== 'object') return { error: 'Missing match details' };
  const s = (v, n) => clean(v).slice(0, n);
  const player1 = s(b.player1, 60), player2 = s(b.player2, 60);
  if (!player1 || !player2) return { error: "Enter both players' names" };
  const date = parseDate(b.date);
  if (!date) return { error: 'Enter the match date' };
  const city = s(b.city, 80), state = normalizeState(b.state);
  if (!city || !state) return { error: 'Enter the city and state' };
  const race = b.race === '' || b.race == null ? null : Math.round(Number(String(b.race).replace(/[^\d]/g, '')));
  if (race != null && !(race >= 1 && race <= 999)) return { error: 'Race should be a number, like 21' };
  let stakes = s(b.stakes, 40);
  const amount = Number((stakes.match(/[\d,]+(\.\d+)?\s*k?/i) || [''])[0].replace(/,/g, '').replace(/k$/i, '000')) || null;
  if (stakes && /^\d[\d,]*\+?$/.test(stakes)) stakes = '$' + stakes;          // "10,000+" -> "$10,000+"
  let flyer = null;
  if (b.flyer) {
    if (typeof b.flyer !== 'string' || (requireFlyerFormat && !FLYER_RE.test(b.flyer))) return { error: 'The flyer must be a PNG, JPG, WebP or GIF image' };
    if (b.flyer.length > 2_800_000) return { error: 'The flyer image is too large' };
    flyer = b.flyer;
  }
  return {
    value: {
      player1, player2, game: GAMES.includes(b.game) ? b.game : 'Other', race, stakes: stakes || null, stakesAmount: amount,
      date, time: parseTime(b.time), city, state, room: s(b.room, 120) || null, address: s(b.address, 160) || null,
      streamUrl: safeUrl(b.streamUrl), notes: s(b.notes, 600) || null,
      submitterName: s(b.submitterName, 80) || null, submitterContact: s(b.submitterContact, 120) || null
    },
    flyer
  };
}

function makeSlug(db, v, id) {
  const [y, m, d] = v.date.split('-');
  const base = slugify(`${v.player1} vs ${v.player2} ${v.game === 'Other' ? '' : v.game} ${v.city} ${v.state} ${['', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][+m]} ${+d} ${y}`).slice(0, 150);
  const taken = db.prepare('SELECT id FROM money_matches WHERE slug=? AND id<>?').get(base, id);
  return taken ? `${base}-${id}` : base;
}

export function create(db, v, flyer, { status = 'pending' } = {}) {
  const r = db.prepare(`INSERT INTO money_matches (player1,player2,game,race,stakes,stakes_amount,date,time,city,state,room,address,stream_url,notes,flyer_data,submitter_name,submitter_contact,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.player1, v.player2, v.game, v.race, v.stakes, v.stakesAmount, v.date, v.time, v.city, v.state,
    v.room, v.address, v.streamUrl, v.notes, flyer, v.submitterName, v.submitterContact, status);
  const id = Number(r.lastInsertRowid);
  db.prepare('UPDATE money_matches SET slug=? WHERE id=?').run(makeSlug(db, v, id), id);
  return id;
}

export function update(db, id, v, flyer) {
  const r = db.prepare(`UPDATE money_matches SET player1=?,player2=?,game=?,race=?,stakes=?,stakes_amount=?,date=?,time=?,city=?,state=?,room=?,address=?,stream_url=?,notes=?,
    ${flyer ? 'flyer_data=?,' : ''} updated_at=datetime('now') WHERE id=?`)
    .run(...[v.player1, v.player2, v.game, v.race, v.stakes, v.stakesAmount, v.date, v.time, v.city, v.state, v.room, v.address, v.streamUrl, v.notes], ...(flyer ? [flyer] : []), id);
  if (r.changes) db.prepare('UPDATE money_matches SET slug=? WHERE id=?').run(makeSlug(db, v, id), id);
  return r.changes > 0;
}

const COLS = `id,slug,player1,player2,game,race,stakes,stakes_amount,date,time,city,state,room,address,stream_url,notes,status,prev_status,archived_at,featured,
  winner,score1,score2,created_at,updated_at,submitter_name,submitter_contact,(flyer_data IS NOT NULL) has_flyer,
  (SELECT COUNT(*) FROM mm_votes v WHERE v.match_id=money_matches.id) votes,
  (SELECT COUNT(*) FROM mm_comments c WHERE c.match_id=money_matches.id AND c.deleted=0) comments`;
function shape(r, { admin = false } = {}, today = todayLocal()) {
  if (!r) return null;
  const done = r.winner != null;
  return {
    id: r.id, slug: r.slug, player1: r.player1, player2: r.player2, game: r.game, race: r.race, stakes: r.stakes, stakesAmount: r.stakes_amount,
    date: r.date, time: r.time, city: r.city, state: r.state, room: r.room, address: r.address, streamUrl: r.stream_url, notes: r.notes,
    status: r.status, featured: !!r.featured, hasFlyer: !!r.has_flyer, flyerUrl: r.has_flyer ? `/money-match-flyer/${r.id}.img?v=${encodeURIComponent(r.updated_at)}` : null,
    winner: r.winner, score1: r.score1, score2: r.score2, votes: r.votes, comments: r.comments, updatedAt: r.updated_at,
    upcoming: !done && r.date >= today, isToday: !done && r.date === today, path: `/money-match/${r.slug}`,
    ...(admin ? { prevStatus: r.prev_status, archivedAt: r.archived_at, submitterName: r.submitter_name, submitterContact: r.submitter_contact, createdAt: r.created_at } : {})
  };
}

export const get = (db, id, opts) => shape(db.prepare(`SELECT ${COLS} FROM money_matches WHERE id=?`).get(id), opts);
export const getBySlug = (db, slug) => shape(db.prepare(`SELECT ${COLS} FROM money_matches WHERE slug=?`).get(slug));

// Published matches: upcoming (soonest first) and results (latest first).
export function listPublic(db, today = todayLocal()) {
  const rows = db.prepare(`SELECT ${COLS} FROM money_matches WHERE status='published' ORDER BY date, COALESCE(time,'99:99'), id`).all().map(r => shape(r, {}, today));
  return { upcoming: rows.filter(m => m.upcoming), results: rows.filter(m => !m.upcoming).reverse() };
}

// The match to put on the home page: the featured one if it's still upcoming, else the next one.
export function spotlight(db, today = todayLocal()) {
  const { upcoming } = listPublic(db, today);
  return upcoming.find(m => m.featured) || upcoming[0] || null;
}

export function adminList(db) {
  return db.prepare(`SELECT ${COLS} FROM money_matches ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 ELSE 2 END, date DESC, id DESC LIMIT 500`).all().map(r => shape(r, { admin: true }));
}

export const getFlyer = (db, id) => (db.prepare("SELECT flyer_data FROM money_matches WHERE id=? AND status<>'archived'").get(id) || {}).flyer_data || null;

export function publish(db, id) {
  return db.prepare("UPDATE money_matches SET status='published', updated_at=datetime('now') WHERE id=? AND status='pending'").run(id).changes > 0;
}
export function setFeatured(db, id, on) {
  if (on) db.prepare('UPDATE money_matches SET featured=0 WHERE featured=1').run();
  return db.prepare("UPDATE money_matches SET featured=?, updated_at=datetime('now') WHERE id=?").run(on ? 1 : 0, id).changes > 0;
}
export function setResult(db, id, b) {
  if (b?.clear) return db.prepare("UPDATE money_matches SET winner=NULL, score1=NULL, score2=NULL, updated_at=datetime('now') WHERE id=?").run(id).changes > 0;
  const s1 = Math.round(Number(b?.score1)), s2 = Math.round(Number(b?.score2));
  if (!(s1 >= 0 && s1 <= 999 && s2 >= 0 && s2 <= 999)) return { error: 'Enter both scores' };
  if (s1 === s2) return { error: 'The scores are tied. Who won?' };
  const winner = s1 > s2 ? 1 : 2;
  return db.prepare("UPDATE money_matches SET winner=?, score1=?, score2=?, featured=0, updated_at=datetime('now') WHERE id=?").run(winner, s1, s2, id).changes > 0;
}
export function archive(db, id) {
  return db.prepare("UPDATE money_matches SET prev_status=status, status='archived', featured=0, archived_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND status<>'archived'").run(id).changes > 0;
}
export function repost(db, id) {
  return db.prepare("UPDATE money_matches SET status=CASE WHEN prev_status='pending' THEN 'pending' ELSE 'published' END, prev_status=NULL, archived_at=NULL, updated_at=datetime('now') WHERE id=? AND status='archived'").run(id).changes > 0;
}
export function purge(db, id) {
  if (!db.prepare("SELECT 1 FROM money_matches WHERE id=? AND status='archived'").get(id)) return false;
  db.prepare('DELETE FROM mm_votes WHERE match_id=?').run(id);
  db.prepare('DELETE FROM mm_comments WHERE match_id=?').run(id);
  db.prepare('UPDATE stakes SET money_match_id=NULL WHERE money_match_id=?').run(id);
  db.prepare('DELETE FROM money_matches WHERE id=?').run(id);
  return true;
}

// ---- "Who ya got?" fan vote: one vote per device (a random id the browser keeps), changeable until a result is in.
export function tally(db, id) {
  const rows = db.prepare('SELECT pick, COUNT(*) n FROM mm_votes WHERE match_id=? GROUP BY pick').all(id);
  const p1 = rows.find(r => r.pick === 1)?.n || 0, p2 = rows.find(r => r.pick === 2)?.n || 0;
  return { p1, p2, total: p1 + p2 };
}
export const voterKey = (voter, secret) => crypto.createHash('sha256').update(String(secret) + '|' + String(voter)).digest('hex').slice(0, 32);
export function myPick(db, id, key) { return key ? (db.prepare('SELECT pick FROM mm_votes WHERE match_id=? AND voter=?').get(id, key) || {}).pick || null : null; }
export function vote(db, id, key, pick) {
  const m = db.prepare("SELECT status, winner FROM money_matches WHERE id=?").get(id);
  if (!m || m.status !== 'published') return { status: 404, error: 'Match not found' };
  if (m.winner != null) return { status: 400, error: 'Voting is closed. This match is over.' };
  if (pick !== 1 && pick !== 2) return { status: 400, error: 'Pick a player' };
  db.prepare(`INSERT INTO mm_votes (match_id, voter, pick) VALUES (?,?,?) ON CONFLICT(match_id, voter) DO UPDATE SET pick=excluded.pick`).run(id, key, pick);
  return { status: 200, ok: true };
}

// ---- comments (public; only the admin can delete)
export function listComments(db, id) {
  return db.prepare('SELECT id, name, body, contact, created_at FROM mm_comments WHERE match_id=? AND deleted=0 ORDER BY id LIMIT 500').all(id)
    .map(c => ({ id: c.id, name: c.name, body: c.body, contact: c.contact || null, createdAt: c.created_at }));
}
export function addComment(db, id, b) {
  const m = db.prepare('SELECT status FROM money_matches WHERE id=?').get(id);
  if (!m || m.status !== 'published') return { status: 404, error: 'Match not found' };
  const name = clean(b?.name).slice(0, 40), body = String(b?.body ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500);
  if (!name) return { status: 400, error: 'Enter your name' };
  if (!body) return { status: 400, error: 'Write a comment' };
  if (db.prepare('SELECT 1 FROM mm_comments WHERE match_id=? AND name=? AND body=? AND deleted=0').get(id, name, body)) return { status: 400, error: 'You already posted that' };
  db.prepare('INSERT INTO mm_comments (match_id, name, body, contact) VALUES (?,?,?,?)').run(id, name, body, clean(b?.contact).slice(0, 120) || null);
  return { status: 201, ok: true };
}
export function deleteComment(db, id, cid) {
  return db.prepare('UPDATE mm_comments SET deleted=1 WHERE id=? AND match_id=?').run(cid, id).changes > 0;
}

// ---- Staking Board posts linked to a match
export function linkedStakes(db, id) {
  return db.prepare("SELECT id, player, bet, offered, markup, status, (SELECT COALESCE(SUM(percent),0) FROM stake_pieces p WHERE p.stake_id=stakes.id) sold FROM stakes WHERE money_match_id=? AND status IN ('open','settled') ORDER BY id")
    .all(id).map(s => ({ id: s.id, player: s.player, bet: s.bet, offered: s.offered, markup: s.markup, status: s.status, sold: Math.round(s.sold * 100) / 100 }));
}

// ---- a player's page: every published match they're in
export const playerSlug = name => slugify(name);
export function playerMatches(db, slug) {
  const all = db.prepare(`SELECT ${COLS} FROM money_matches WHERE status='published' ORDER BY date DESC`).all().map(r => shape(r));
  const list = all.filter(m => playerSlug(m.player1) === slug || playerSlug(m.player2) === slug);
  const name = list.length ? (playerSlug(list[0].player1) === slug ? list[0].player1 : list[0].player2) : null;
  return { name, matches: list };
}
