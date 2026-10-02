import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { slugify, zip5, GAMES, parseDate, parseTime, parseInteger, normalizeState, clean } from './normalize.js';
import { safeUrl } from './mapping.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT, city TEXT, state TEXT, zip TEXT, phone TEXT, website TEXT,
  lat REAL, lng REAL, tables INTEGER,
  geocode_status TEXT,            -- source | census | zip | failed | NULL (not tried yet)
  geocode_tried_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  time TEXT,                      -- HH:MM or NULL
  game TEXT NOT NULL, game_raw TEXT,
  entry REAL, added REAL, race TEXT, format TEXT, player_limit INTEGER,
  level TEXT NOT NULL DEFAULT 'open',
  table_size TEXT,
  director_name TEXT, director_phone TEXT, director_email TEXT,
  registration_url TEXT, website TEXT, notes TEXT,
  flyer_url TEXT, flyer_data TEXT,
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  status TEXT NOT NULL DEFAULT 'published',   -- published | pending | removed | rejected
  verified INTEGER NOT NULL DEFAULT 0,
  hash TEXT,
  last_seen_run INTEGER,
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_t_date ON tournaments(date, status);
CREATE INDEX IF NOT EXISTS idx_t_venue ON tournaments(venue_id);
CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, mode TEXT NOT NULL,
  started_at TEXT NOT NULL, finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',     -- running | ok | error
  fetched INTEGER DEFAULT 0, inserted INTEGER DEFAULT 0, updated INTEGER DEFAULT 0,
  unchanged INTEGER DEFAULT 0, removed INTEGER DEFAULT 0, skipped INTEGER DEFAULT 0,
  message TEXT
);
CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY, last_success_at TEXT
);
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  email TEXT NOT NULL, name TEXT, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- one row per (day, visitor) so re-visits the same day don't inflate the count;
-- visitor is a salted hash, never a raw IP, so nothing identifying is stored.
CREATE TABLE IF NOT EXISTS pageviews (
  day TEXT NOT NULL, visitor TEXT NOT NULL,
  PRIMARY KEY (day, visitor)
);
CREATE INDEX IF NOT EXISTS idx_pv_day ON pageviews(day);
CREATE TABLE IF NOT EXISTS money_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  player1 TEXT NOT NULL, player2 TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '9-Ball',
  race TEXT, stakes TEXT,
  date TEXT NOT NULL, time TEXT,
  room TEXT, address TEXT, city TEXT NOT NULL, state TEXT NOT NULL,
  stream_url TEXT, notes TEXT,
  flyer_url TEXT, flyer_data TEXT,
  submitter_name TEXT, submitter_contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | published | archived
  featured INTEGER NOT NULL DEFAULT 0,
  score1 INTEGER, score2 INTEGER, winner INTEGER,  -- 1 or 2, winner set once a result is saved
  votes1 INTEGER NOT NULL DEFAULT 0, votes2 INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mm_date ON money_matches(date, status);
CREATE TABLE IF NOT EXISTS money_match_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  money_match_id INTEGER NOT NULL REFERENCES money_matches(id),
  name TEXT NOT NULL, body TEXT NOT NULL, contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mmc_match ON money_match_comments(money_match_id);

-- ---- Match Finder: players post looking-for-action, others reply privately ----
CREATE TABLE IF NOT EXISTS match_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manage_key TEXT NOT NULL,
  name TEXT NOT NULL, fargo INTEGER,
  city TEXT NOT NULL, state TEXT NOT NULL, room TEXT,
  game TEXT NOT NULL DEFAULT 'Other',
  stake_min INTEGER, stake_max INTEGER,
  date TEXT NOT NULL, until TEXT NOT NULL, time TEXT,
  contact TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- open | closed | archived
  archived_by TEXT, archived_at TEXT,
  expires_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS match_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL REFERENCES match_posts(id),
  name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS match_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL REFERENCES match_posts(id),
  name TEXT NOT NULL, body TEXT NOT NULL, contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- Staking Board: backers buy a piece of a player's action; records only ----
CREATE TABLE IF NOT EXISTS stakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manage_key TEXT NOT NULL,
  player TEXT NOT NULL, opponent TEXT,
  game TEXT NOT NULL DEFAULT '9-Ball', race TEXT,
  date TEXT NOT NULL, time TEXT,
  bet REAL NOT NULL, offered REAL NOT NULL, markup REAL NOT NULL DEFAULT 1,
  venue TEXT, city TEXT, state TEXT,
  stakeholder TEXT NOT NULL, contact TEXT, notes TEXT,
  money_match_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | open | settled | cancelled | rejected | archived
  prev_status TEXT,
  result TEXT, score TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stake_pieces (
  id INTEGER PRIMARY KEY AUTOINCREMENT, stake_id INTEGER NOT NULL REFERENCES stakes(id),
  backer TEXT NOT NULL, contact TEXT, percent REAL NOT NULL,
  paid_in INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- Calcutta Auctions: host-run player auctions, live or silent ----
CREATE TABLE IF NOT EXISTS auctions (
  code TEXT PRIMARY KEY,
  host_key TEXT NOT NULL,
  title TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'live',    -- live | silent
  min_bid REAL NOT NULL DEFAULT 20, increment REAL NOT NULL DEFAULT 5, house_cut REAL NOT NULL DEFAULT 0,
  bid_seconds INTEGER NOT NULL DEFAULT 30, reset_seconds INTEGER NOT NULL DEFAULT 15,
  starts_ms INTEGER, ends_ms INTEGER,
  payouts TEXT NOT NULL DEFAULT '50,25,15,10',
  listed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'setup',   -- setup | running | paused | done | archived
  prev_status TEXT,
  current_item INTEGER, next_at INTEGER,
  rev INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL REFERENCES auctions(code),
  name TEXT NOT NULL, seq INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',  -- waiting | open | sold | unsold
  high_bid REAL, high_bidder_token TEXT, high_bidder_name TEXT,
  ends_at INTEGER, finish INTEGER
);
CREATE TABLE IF NOT EXISTS auction_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES auction_items(id),
  token TEXT NOT NULL, name TEXT NOT NULL, amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auction_bidders (
  code TEXT NOT NULL REFERENCES auctions(code), token TEXT NOT NULL, name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (code, token)
);
CREATE TABLE IF NOT EXISTS auction_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL REFERENCES auctions(code),
  name TEXT NOT NULL, text TEXT NOT NULL, host INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- lightweight page-view analytics (page + referrer source + day) ----
CREATE TABLE IF NOT EXISTS track_events (
  day TEXT NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'Direct', visitor TEXT
);
CREATE INDEX IF NOT EXISTS idx_track_day ON track_events(day);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA);
  return db;
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export const nowIso = () => new Date().toISOString();
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function venueKey(v) {
  const addr = slugify(v.address), z = zip5(v.zip);
  if (addr && z) return `a:${addr}|${z}`;
  return `n:${slugify(v.name)}|${slugify(v.city)}|${v.state || ''}`;
}

export function upsertVenue(db, v) {
  const key = venueKey(v);
  const row = db.prepare('SELECT * FROM venues WHERE key=?').get(key);
  if (!row) {
    const hasGeo = v.lat != null && v.lng != null;
    const r = db.prepare(`INSERT INTO venues (key,name,address,city,state,zip,phone,website,lat,lng,tables,geocode_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(key, v.name, v.address || null, v.city || null, v.state || null, v.zip || null,
      v.phone || null, v.website || null, hasGeo ? v.lat : null, hasGeo ? v.lng : null, v.tables ?? null, hasGeo ? 'source' : null);
    return Number(r.lastInsertRowid);
  }
  const hasGeo = v.lat != null && v.lng != null;
  db.prepare(`UPDATE venues SET name=?, address=COALESCE(?,address), city=COALESCE(?,city), state=COALESCE(?,state), zip=COALESCE(?,zip),
      phone=COALESCE(?,phone), website=COALESCE(?,website), tables=COALESCE(?,tables),
      lat=CASE WHEN ? THEN ? ELSE lat END, lng=CASE WHEN ? THEN ? ELSE lng END,
      geocode_status=CASE WHEN ? THEN 'source' ELSE geocode_status END,
      updated_at=datetime('now') WHERE id=?`)
    .run(v.name, v.address || null, v.city || null, v.state || null, v.zip || null, v.phone || null, v.website || null, v.tables ?? null,
      hasGeo ? 1 : 0, v.lat, hasGeo ? 1 : 0, v.lng, hasGeo ? 1 : 0, row.id);
  return row.id;
}

const FIELDS = ['name', 'date', 'time', 'game', 'gameRaw', 'entry', 'added', 'race', 'format', 'playerLimit', 'level', 'tableSize',
  'directorName', 'directorPhone', 'directorEmail', 'registrationUrl', 'website', 'notes', 'flyerUrl'];
const COLS = { gameRaw: 'game_raw', playerLimit: 'player_limit', tableSize: 'table_size', directorName: 'director_name',
  directorPhone: 'director_phone', directorEmail: 'director_email', registrationUrl: 'registration_url', flyerUrl: 'flyer_url' };
const col = f => COLS[f] || f;

export function contentHash(t, venueId) {
  const o = FIELDS.map(f => t[f] ?? null);
  o.push(venueId);
  return crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');
}

// Insert or update one mapped record from a sync source. Returns 'inserted' | 'updated' | 'unchanged' | 'removed'.
export function upsertSourceTournament(db, source, t, { runId, verified }) {
  const venueId = upsertVenue(db, t.venue);
  const externalId = t.externalId || 'auto:' + crypto.createHash('sha1').update(`${t.name}|${t.date}|${venueKey(t.venue)}`).digest('hex').slice(0, 16);
  const hash = contentHash(t, venueId);
  const row = db.prepare('SELECT id, hash, status FROM tournaments WHERE source=? AND external_id=?').get(source, externalId);

  if (!row) {
    db.prepare(`INSERT INTO tournaments (source, external_id, ${FIELDS.map(col).join(',')}, venue_id, status, verified, hash, last_seen_run, source_updated_at)
      VALUES (?,?,${FIELDS.map(() => '?').join(',')},?,?,?,?,?,?)`)
      .run(source, externalId, ...FIELDS.map(f => t[f] ?? null), venueId, t.removed ? 'removed' : 'published', verified ? 1 : 0, hash, runId ?? null, t.updatedAt);
    return t.removed ? 'removed' : 'inserted';
  }
  if (row.status === 'rejected') { // an admin rejected it: keep it hidden
    db.prepare('UPDATE tournaments SET last_seen_run=? WHERE id=?').run(runId ?? null, row.id);
    return 'unchanged';
  }
  if (t.removed) {
    db.prepare("UPDATE tournaments SET status='removed', last_seen_run=?, updated_at=datetime('now') WHERE id=?").run(runId ?? null, row.id);
    return row.status === 'removed' ? 'unchanged' : 'removed';
  }
  const restored = row.status === 'removed';
  if (row.hash === hash && !restored) {
    db.prepare('UPDATE tournaments SET last_seen_run=? WHERE id=?').run(runId ?? null, row.id);
    return 'unchanged';
  }
  db.prepare(`UPDATE tournaments SET ${FIELDS.map(f => col(f) + '=?').join(',')}, venue_id=?, status='published', verified=?, hash=?, last_seen_run=?,
      source_updated_at=?, updated_at=datetime('now') WHERE id=?`)
    .run(...FIELDS.map(f => t[f] ?? null), venueId, verified ? 1 : 0, hash, runId ?? null, t.updatedAt, row.id);
  return 'updated';
}

// Visitor-submitted tournaments start as "pending" until an admin approves them.
export function createLocalTournament(db, t, flyerData) {
  const venueId = upsertVenue(db, t.venue);
  const hash = contentHash(t, venueId);
  const r = db.prepare(`INSERT INTO tournaments (source, external_id, ${FIELDS.map(col).join(',')}, flyer_data, venue_id, status, verified, hash)
    VALUES ('local', ?, ${FIELDS.map(() => '?').join(',')}, ?, ?, 'pending', 0, ?)`)
    .run(crypto.randomUUID(), ...FIELDS.map(f => t[f] ?? null), flyerData || null, venueId, hash);
  return Number(r.lastInsertRowid);
}

const SELECT = `SELECT t.*, v.name AS v_name, v.address AS v_address, v.city AS v_city, v.state AS v_state, v.zip AS v_zip,
  v.phone AS v_phone, v.website AS v_website, v.lat AS v_lat, v.lng AS v_lng, v.tables AS v_tables
  FROM tournaments t JOIN venues v ON v.id = t.venue_id`;

export function shape(r) {
  return {
    id: r.id, name: r.name, date: r.date, time: r.time, game: r.game, gameRaw: r.game_raw,
    entry: r.entry, added: r.added, race: r.race, format: r.format, limit: r.player_limit, level: r.level, tableSize: r.table_size,
    director: { name: r.director_name, phone: r.director_phone, email: r.director_email },
    registrationUrl: r.registration_url, website: r.website, notes: r.notes,
    flyerUrl: r.flyer_url, hasFlyer: !!r.flyer_data, verified: !!r.verified, status: r.status, source: r.source,
    updatedAt: r.updated_at,
    venue: { id: r.venue_id, name: r.v_name, address: r.v_address, city: r.v_city, state: r.v_state, zip: r.v_zip, phone: r.v_phone,
      website: r.v_website, lat: r.v_lat, lng: r.v_lng, tables: r.v_tables }
  };
}

export function listTournaments(db, { from = todayIso(), to = '9999-12-31', state = '', limit = 20000 } = {}) {
  const rows = db.prepare(`${SELECT} WHERE t.status IN ('published','pending') AND t.date >= ? AND t.date <= ?
    AND (? = '' OR v.state = ?) ORDER BY t.date, COALESCE(t.time,'99:99'), t.id LIMIT ?`).all(from, to, state, state, limit);
  return rows.map(shape);
}

// Past-tournament archive: published events that already happened, newest first.
export function listPastTournaments(db, { state = '', limit = 30, offset = 0 } = {}) {
  const rows = db.prepare(`${SELECT} WHERE t.status = 'published' AND t.date < ?
    AND (? = '' OR v.state = ?) ORDER BY t.date DESC, COALESCE(t.time,'99:99') DESC, t.id DESC LIMIT ? OFFSET ?`)
    .all(todayIso(), state, state, limit, offset);
  return rows.map(shape);
}
export function countPastTournaments(db, { state = '' } = {}) {
  return db.prepare(`SELECT COUNT(*) n FROM tournaments t JOIN venues v ON v.id = t.venue_id
    WHERE t.status = 'published' AND t.date < ? AND (? = '' OR v.state = ?)`).get(todayIso(), state, state).n;
}

export function getTournament(db, id, { includeHidden = false } = {}) {
  const r = db.prepare(`${SELECT} WHERE t.id = ?`).get(id);
  if (!r) return null;
  if (!includeHidden && !['published', 'pending'].includes(r.status)) return null;
  return shape(r);
}

export function getFlyer(db, id) {
  const r = db.prepare("SELECT flyer_data FROM tournaments WHERE id=? AND status IN ('published','pending')").get(id);
  return r ? r.flyer_data : null;
}

export function listPending(db) {
  return db.prepare(`${SELECT} WHERE t.status='pending' ORDER BY t.created_at DESC LIMIT 200`).all().map(shape);
}

export function setStatus(db, id, status, verified) {
  const r = db.prepare("UPDATE tournaments SET status=?, verified=COALESCE(?,verified), updated_at=datetime('now') WHERE id=?")
    .run(status, verified ?? null, id);
  return r.changes > 0;
}

const EDITABLE = { name: 'name', date: 'date', time: 'time', game: 'game', entry: 'entry', added: 'added', race: 'race', format: 'format', notes: 'notes' };
export function editTournament(db, id, patch) {
  const sets = [], vals = [];
  for (const [k, c] of Object.entries(EDITABLE)) if (k in patch) { sets.push(`${c}=?`); vals.push(patch[k]); }
  if (!sets.length) return false;
  const r = db.prepare(`UPDATE tournaments SET ${sets.join(',')}, updated_at=datetime('now') WHERE id=?`).run(...vals, id);
  return r.changes > 0;
}

export function summary(db) {
  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  return {
    published: one("SELECT COUNT(*) n FROM tournaments WHERE status='published'"),
    upcoming: one("SELECT COUNT(*) n FROM tournaments WHERE status IN ('published','pending') AND date >= ?", todayIso()),
    pending: one("SELECT COUNT(*) n FROM tournaments WHERE status='pending'"),
    removed: one("SELECT COUNT(*) n FROM tournaments WHERE status='removed'"),
    venues: one('SELECT COUNT(*) n FROM venues'),
    venuesWithoutCoordinates: one('SELECT COUNT(*) n FROM venues WHERE lat IS NULL'),
    subscribers: one('SELECT COUNT(*) n FROM subscribers'),
    recentRuns: db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 10').all(),
    claims: db.prepare(`SELECT c.id, c.email, c.name, c.created_at, c.tournament_id, t.name AS tournament FROM claims c JOIN tournaments t ON t.id=c.tournament_id
      WHERE c.status='new' ORDER BY c.id DESC LIMIT 20`).all(),
    reports: db.prepare(`SELECT r.id, r.message, r.created_at, r.tournament_id, t.name AS tournament FROM reports r JOIN tournaments t ON t.id=r.tournament_id
      WHERE r.status='new' ORDER BY r.id DESC LIMIT 20`).all()
  };
}

export function addClaim(db, tournamentId, email, name) {
  db.prepare('INSERT INTO claims (tournament_id, email, name) VALUES (?,?,?)').run(tournamentId, email, name || null);
}
export function addReport(db, tournamentId, message) {
  db.prepare('INSERT INTO reports (tournament_id, message) VALUES (?,?)').run(tournamentId, message);
}
export function addSubscriber(db, email) {
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email);
}
export function resolveItem(db, table, id) {
  if (!['claims', 'reports'].includes(table)) return false;
  return db.prepare(`UPDATE ${table} SET status='done' WHERE id=?`).run(id).changes > 0;
}

// ---- site visit counts (privacy-friendly: day + salted-hash visitor id, no IPs stored) ----
// Writes are batched by the caller (see trackVisit/flushPageviews in app.js) -- SQLite writes
// are synchronous and block Node's single event loop thread, so we never want one on the hot
// path of every page request. This bulk form is what the periodic flush actually calls.
export function recordPageview(db, day, visitor) {
  db.prepare('INSERT OR IGNORE INTO pageviews (day, visitor) VALUES (?,?)').run(day, visitor);
}
export function recordPageviewsBulk(db, entries) {
  if (!entries.length) return;
  tx(db, () => {
    const stmt = db.prepare('INSERT OR IGNORE INTO pageviews (day, visitor) VALUES (?,?)');
    for (const [day, visitor] of entries) stmt.run(day, visitor);
  });
}
export function pageviewCounts(db, todayStr = todayIso()) {
  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  const daysAgo = n => { const d = new Date(todayStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  return {
    daily: one('SELECT COUNT(*) n FROM pageviews WHERE day = ?', todayStr),
    weekly: one('SELECT COUNT(DISTINCT visitor) n FROM pageviews WHERE day >= ?', daysAgo(6)),
    monthly: one('SELECT COUNT(DISTINCT visitor) n FROM pageviews WHERE day >= ?', daysAgo(29)),
    total: one('SELECT COUNT(DISTINCT visitor) n FROM pageviews'),
    traffic: trafficSummary(db, todayStr)
  };
}

// ---- lightweight referrer/page analytics behind the /api/track beacon ----
const PAGE_LABELS = { '/': 'Home', '/search': 'Find Tournaments', '/states': 'By State', '/games': 'By Game', '/calendar': 'Calendar',
  '/venues': 'Venues', '/results': 'Past Tournaments', '/post': 'Post a Tournament', '/scan': 'Flyer Scanner', '/alerts': 'Alerts',
  '/account': 'My Account', '/money': 'Money Matches', '/stakes': 'Staking Board', '/auctions': 'Calcutta Auctions', '/matches': 'Match Finder' };
function sourceFromRef(ref, utm) {
  if (utm) return utm.slice(0, 40);
  if (!ref) return 'Direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    if (/google\./.test(host)) return 'Google';
    if (/facebook\.com|fb\.me/.test(host)) return 'Facebook';
    if (/instagram\.com/.test(host)) return 'Instagram';
    if (/t\.co|twitter\.com|x\.com/.test(host)) return 'X / Twitter';
    if (/billiardactiontime\.com/.test(host)) return 'Internal';
    return host;
  } catch { return 'Direct'; }
}
export function recordTrackEvent(db, { page, ref, utm }) {
  const day = todayIso(), source = sourceFromRef(ref, utm);
  const pagePart = '/' + String(page || '').replace(/^#?\/?/, '').split('?')[0];
  db.prepare('INSERT INTO track_events (day, page, source) VALUES (?,?,?)').run(day, pagePart, source);
}
function trafficSummary(db, todayStr, days = 30) {
  const since = (() => { const d = new Date(todayStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (days - 1)); return d.toISOString().slice(0, 10); })();
  const sources = db.prepare('SELECT source, COUNT(*) visitors FROM track_events WHERE day >= ? GROUP BY source ORDER BY visitors DESC LIMIT 10').all(since);
  const pagesRaw = db.prepare('SELECT page, COUNT(*) views FROM track_events WHERE day >= ? GROUP BY page ORDER BY views DESC LIMIT 10').all(since);
  const pages = pagesRaw.map(p => ({ label: PAGE_LABELS[p.page] || p.page, views: p.views }));
  const daily = db.prepare('SELECT day, COUNT(*) visitors FROM track_events WHERE day >= ? GROUP BY day ORDER BY day').all(since);
  const visitors = db.prepare('SELECT COUNT(*) n FROM track_events WHERE day >= ?').get(since).n;
  return { days, sources, pages, daily, visitors };
}

// Distinct city/state pairs that actually have a venue on file, so the city dropdown
// can include real places even before they have a tournament -- see places.js for the rest.
export function venueCities(db) {
  return db.prepare(`SELECT DISTINCT city, state FROM venues WHERE city IS NOT NULL AND city <> '' AND state IS NOT NULL AND state <> ''`).all();
}

// ---- money matches (fan-facing challenge matches; records only, the site never touches cash) ----
function mmSlugBase(player1, player2, date) {
  return `${slugify(player1)}-vs-${slugify(player2)}-${date}`.replace(/-+/g, '-');
}
function mmUniqueSlug(db, base) {
  let slug = base, n = 2;
  while (db.prepare('SELECT 1 FROM money_matches WHERE slug=?').get(slug)) slug = `${base}-${n++}`;
  return slug;
}

export function shapeMoneyMatch(r, commentCount = 0) {
  const today = todayIso();
  return {
    id: r.id, path: `/money-match/${r.slug}`, slug: r.slug,
    player1: r.player1, player2: r.player2, game: r.game, race: r.race, stakes: r.stakes,
    date: r.date, time: r.time, room: r.room, address: r.address, city: r.city, state: r.state,
    streamUrl: r.stream_url, notes: r.notes, flyerUrl: r.flyer_data ? `/api/money-matches/${r.id}/flyer` : null, hasFlyer: !!r.flyer_data,
    submitterName: r.submitter_name, submitterContact: r.submitter_contact,
    status: r.status, featured: !!r.featured, upcoming: r.date >= today, isToday: r.date === today,
    score1: r.score1, score2: r.score2, winner: r.winner || null,
    votes1: r.votes1, votes2: r.votes2, votes: r.votes1 + r.votes2, comments: commentCount,
    updatedAt: r.updated_at
  };
}

export function validateMoneyMatch(b) {
  if (!b || typeof b !== 'object') return { error: 'Missing match details' };
  const s = (v, n) => clean(v).slice(0, n);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const player1 = s(b.player1, 60), player2 = s(b.player2, 60), date = parseDate(b.date);
  if (!player1 || !player2) return { error: 'Both player names are required' };
  if (!date || date < yesterday) return { error: 'Enter a date that is today or later' };
  const city = s(b.city, 80), state = normalizeState(b.state);
  if (!city || !state) return { error: 'City and state are required' };
  let flyer = null;
  if (b.flyer) {
    if (typeof b.flyer !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(b.flyer)) return { error: 'Flyer must be a PNG, JPG, WebP or GIF image' };
    if (b.flyer.length > 2_000_000) return { error: 'Flyer image is too large (2 MB max)' };
    flyer = b.flyer;
  }
  return {
    flyer,
    value: {
      player1, player2, game: GAMES.includes(b.game) ? b.game : '9-Ball', race: s(b.race, 10) || null, stakes: s(b.stakes, 40) || null,
      date, time: parseTime(b.time), room: s(b.room, 120) || null, address: s(b.address, 160) || null, city, state,
      streamUrl: safeUrl ? safeUrl(b.streamUrl) : (s(b.streamUrl, 300) || null), notes: s(b.notes, 600) || null,
      submitterName: s(b.submitterName, 80) || null, submitterContact: s(b.submitterContact, 120) || null
    }
  };
}

export function createMoneyMatch(db, v, flyerData, { published = false } = {}) {
  const slug = mmUniqueSlug(db, mmSlugBase(v.player1, v.player2, v.date));
  const r = db.prepare(`INSERT INTO money_matches
    (slug, player1, player2, game, race, stakes, date, time, room, address, city, state, stream_url, notes, flyer_data, submitter_name, submitter_contact, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(slug, v.player1, v.player2, v.game, v.race, v.stakes, v.date, v.time, v.room, v.address, v.city, v.state,
      v.streamUrl, v.notes, flyerData || null, v.submitterName, v.submitterContact, published ? 'published' : 'pending');
  return { id: Number(r.lastInsertRowid), slug };
}

function mmCommentCounts(db) {
  const rows = db.prepare('SELECT money_match_id, COUNT(*) n FROM money_match_comments GROUP BY money_match_id').all();
  return new Map(rows.map(r => [r.money_match_id, r.n]));
}

export function listMoneyMatchesPublic(db) {
  const rows = db.prepare("SELECT * FROM money_matches WHERE status=? ORDER BY date, COALESCE(time,'99:99'), id").all('published');
  const counts = mmCommentCounts(db);
  const all = rows.map(r => shapeMoneyMatch(r, counts.get(r.id) || 0));
  const today = todayIso();
  const upcoming = all.filter(m => m.date >= today && !m.winner);
  const results = all.filter(m => m.winner).sort((a, b) => b.date.localeCompare(a.date));
  const featured = upcoming.find(m => m.featured);
  const spotlight = featured || upcoming[0] || null;
  return { spotlight, upcoming, results };
}

export function listMoneyMatchesAdmin(db) {
  const rows = db.prepare("SELECT * FROM money_matches ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 ELSE 2 END, date DESC, id DESC").all();
  const counts = mmCommentCounts(db);
  return rows.map(r => shapeMoneyMatch(r, counts.get(r.id) || 0));
}

export function getMoneyMatchRaw(db, idOrSlug) {
  const bySlug = typeof idOrSlug === 'string' && !/^\d+$/.test(idOrSlug);
  return bySlug ? db.prepare('SELECT * FROM money_matches WHERE slug=?').get(idOrSlug)
    : db.prepare('SELECT * FROM money_matches WHERE id=?').get(Number(idOrSlug));
}

export function getMoneyMatch(db, idOrSlug, { includeHidden = false } = {}) {
  const r = getMoneyMatchRaw(db, idOrSlug);
  if (!r) return null;
  if (!includeHidden && r.status !== 'published') return null;
  const counts = mmCommentCounts(db);
  return shapeMoneyMatch(r, counts.get(r.id) || 0);
}

export function getMoneyMatchFlyer(db, id) {
  const r = db.prepare('SELECT flyer_data FROM money_matches WHERE id=?').get(id);
  return r ? r.flyer_data : null;
}

const MM_EDITABLE = { player1: 'player1', player2: 'player2', game: 'game', race: 'race', stakes: 'stakes', date: 'date', time: 'time',
  room: 'room', address: 'address', city: 'city', state: 'state', streamUrl: 'stream_url', notes: 'notes' };
export function updateMoneyMatch(db, id, patch, flyerData) {
  const sets = [], vals = [];
  for (const [k, c] of Object.entries(MM_EDITABLE)) if (k in patch) { sets.push(`${c}=?`); vals.push(patch[k]); }
  if (flyerData) { sets.push('flyer_data=?'); vals.push(flyerData); }
  if (!sets.length) return false;
  const r = db.prepare(`UPDATE money_matches SET ${sets.join(',')}, updated_at=datetime('now') WHERE id=?`).run(...vals, id);
  return r.changes > 0;
}

export function setMoneyMatchStatus(db, id, status) {
  return db.prepare("UPDATE money_matches SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id).changes > 0;
}
export function setMoneyMatchFeatured(db, id, featured) {
  return db.prepare("UPDATE money_matches SET featured=?, updated_at=datetime('now') WHERE id=?").run(featured ? 1 : 0, id).changes > 0;
}
export function setMoneyMatchResult(db, id, { score1, score2, clear } = {}) {
  if (clear) return db.prepare("UPDATE money_matches SET score1=NULL, score2=NULL, winner=NULL, updated_at=datetime('now') WHERE id=?").run(id).changes > 0;
  const s1 = parseInteger(score1), s2 = parseInteger(score2);
  if (s1 == null || s2 == null) return false;
  const winner = s1 === s2 ? null : (s1 > s2 ? 1 : 2);
  return db.prepare("UPDATE money_matches SET score1=?, score2=?, winner=?, updated_at=datetime('now') WHERE id=?").run(s1, s2, winner, id).changes > 0;
}
export function purgeMoneyMatch(db, id) {
  tx(db, () => {
    db.prepare('DELETE FROM money_match_comments WHERE money_match_id=?').run(id);
    db.prepare('DELETE FROM money_matches WHERE id=?').run(id);
  });
  return true;
}
export function voteMoneyMatch(db, id, pick) {
  if (pick !== 1 && pick !== 2) return null;
  db.prepare(`UPDATE money_matches SET votes${pick}=votes${pick}+1 WHERE id=?`).run(id);
  return db.prepare('SELECT votes1, votes2 FROM money_matches WHERE id=?').get(id);
}
export function addMoneyMatchComment(db, moneyMatchId, { name, body, contact }) {
  const r = db.prepare('INSERT INTO money_match_comments (money_match_id, name, body, contact) VALUES (?,?,?,?)').run(moneyMatchId, name, body, contact || null);
  return Number(r.lastInsertRowid);
}
export function listMoneyMatchComments(db, moneyMatchId) {
  return db.prepare('SELECT * FROM money_match_comments WHERE money_match_id=? ORDER BY id').all(moneyMatchId)
    .map(c => ({ id: c.id, name: c.name, body: c.body, contact: c.contact, createdAt: c.created_at }));
}
export function deleteMoneyMatchComment(db, commentId) {
  return db.prepare('DELETE FROM money_match_comments WHERE id=?').run(commentId).changes > 0;
}

// ---- Match Finder (players posting they're looking for action) ----
function shapeMatch(r, { replyCount = 0, commentCount = 0, canManage = false } = {}) {
  return {
    id: r.id, name: r.name, fargo: r.fargo, city: r.city, state: r.state, room: r.room, game: r.game,
    stakeMin: r.stake_min, stakeMax: r.stake_max, date: r.date, until: r.until, time: r.time,
    contact: r.contact, note: r.note, status: r.status, archivedBy: r.archived_by, archivedAt: r.archived_at,
    expiresMs: r.expires_ms, replyCount, commentCount, canManage
  };
}
export function createMatchPost(db, v) {
  const manageKey = crypto.randomUUID();
  const r = db.prepare(`INSERT INTO match_posts (manage_key, name, fargo, city, state, room, game, stake_min, stake_max, date, until, time, contact, note, expires_ms)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(manageKey, v.name, v.fargo, v.city, v.state, v.room, v.game, v.stakeMin, v.stakeMax, v.date, v.until, v.time, v.contact, v.note, v.expiresMs);
  return { id: Number(r.lastInsertRowid), manageKey };
}
function matchCounts(db) {
  const r = new Map(db.prepare('SELECT match_id, COUNT(*) n FROM match_replies GROUP BY match_id').all().map(x => [x.match_id, x.n]));
  const c = new Map(db.prepare('SELECT match_id, COUNT(*) n FROM match_comments GROUP BY match_id').all().map(x => [x.match_id, x.n]));
  return { r, c };
}
export function listMatchPostsPublic(db) {
  const rows = db.prepare("SELECT * FROM match_posts WHERE status='open' AND expires_ms > ? ORDER BY id DESC").all(Date.now());
  const { r, c } = matchCounts(db);
  return rows.map(row => shapeMatch(row, { replyCount: r.get(row.id) || 0, commentCount: c.get(row.id) || 0 }));
}
export function listMatchPostsAdmin(db) {
  const rows = db.prepare('SELECT * FROM match_posts ORDER BY id DESC').all();
  const { r, c } = matchCounts(db);
  return rows.map(row => shapeMatch(row, { replyCount: r.get(row.id) || 0, commentCount: c.get(row.id) || 0 }));
}
export function getMatchPostRaw(db, id) { return db.prepare('SELECT * FROM match_posts WHERE id=?').get(id); }
export function getMatchPost(db, id, { key = '', isAdmin = false } = {}) {
  const row = getMatchPostRaw(db, id);
  if (!row) return null;
  const canManage = isAdmin || (!!key && key === row.manage_key);
  const { r, c } = matchCounts(db);
  const shaped = shapeMatch(row, { replyCount: r.get(row.id) || 0, commentCount: c.get(row.id) || 0, canManage });
  shaped.replies = canManage ? db.prepare('SELECT * FROM match_replies WHERE match_id=? ORDER BY id').all(id)
    .map(x => ({ id: x.id, name: x.name, contact: x.contact, message: x.message, createdAt: x.created_at })) : [];
  shaped.comments = db.prepare('SELECT * FROM match_comments WHERE match_id=? ORDER BY id').all(id)
    .map(x => ({ id: x.id, name: x.name, body: x.body, contact: x.contact, createdAt: x.created_at }));
  return shaped;
}
export function addMatchReply(db, id, { name, contact, message }) {
  db.prepare('INSERT INTO match_replies (match_id, name, contact, message) VALUES (?,?,?,?)').run(id, name, contact, message || null);
}
export function setMatchStatus(db, id, status, { archivedBy } = {}) {
  if (status === 'archived') return db.prepare("UPDATE match_posts SET status='archived', archived_by=?, archived_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(archivedBy || null, id).changes > 0;
  return db.prepare("UPDATE match_posts SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id).changes > 0;
}
export function repostMatch(db, id) {
  const row = getMatchPostRaw(db, id);
  if (!row) return false;
  const today = todayIso();
  if (row.expires_ms <= Date.now()) {
    const endOfDay = (() => { const [y, m, d] = today.split('-').map(Number); return new Date(y, m - 1, d + 1, 3, 0, 0).getTime(); })();
    return db.prepare("UPDATE match_posts SET status='open', archived_by=NULL, archived_at=NULL, date=?, until=?, expires_ms=?, updated_at=datetime('now') WHERE id=?")
      .run(today, today, endOfDay, id).changes > 0;
  }
  return db.prepare("UPDATE match_posts SET status='open', archived_by=NULL, archived_at=NULL, updated_at=datetime('now') WHERE id=?").run(id).changes > 0;
}
export function purgeMatchPost(db, id) {
  tx(db, () => {
    db.prepare('DELETE FROM match_replies WHERE match_id=?').run(id);
    db.prepare('DELETE FROM match_comments WHERE match_id=?').run(id);
    db.prepare('DELETE FROM match_posts WHERE id=?').run(id);
  });
  return true;
}
export function addMatchComment(db, matchId, { name, body, contact }) {
  db.prepare('INSERT INTO match_comments (match_id, name, body, contact) VALUES (?,?,?,?)').run(matchId, name, body, contact || null);
}
export function listMatchComments(db, matchId) {
  return db.prepare('SELECT * FROM match_comments WHERE match_id=? ORDER BY id').all(matchId)
    .map(c => ({ id: c.id, name: c.name, body: c.body, contact: c.contact, createdAt: c.created_at }));
}
export function deleteMatchComment(db, commentId) {
  return db.prepare('DELETE FROM match_comments WHERE id=?').run(commentId).changes > 0;
}

// ---- Staking Board ----
function shapeStake(r, pieces, canManage) {
  const sold = pieces.reduce((s, p) => s + p.percent, 0);
  return {
    id: r.id, player: r.player, opponent: r.opponent, game: r.game, race: r.race, date: r.date, time: r.time,
    bet: r.bet, offered: r.offered, markup: r.markup, sold, remaining: Math.max(0, r.offered - sold),
    venue: r.venue, city: r.city, state: r.state, stakeholder: r.stakeholder, contact: r.contact, notes: r.notes,
    moneyMatchId: r.money_match_id, status: r.status, prevStatus: r.prev_status, result: r.result, score: r.score,
    canManage, pieces: pieces.map(p => ({ id: p.id, backer: p.backer, contact: canManage ? p.contact : undefined, percent: p.percent,
      cost: round2(r.bet * p.percent / 100 * r.markup), returnIfWon: round2(r.bet * 2 * p.percent / 100), paidIn: !!p.paid_in, paid: !!p.paid }))
  };
}
const round2 = n => Math.round(n * 100) / 100;
export function createStake(db, v) {
  const manageKey = crypto.randomUUID();
  const r = db.prepare(`INSERT INTO stakes (manage_key, player, opponent, game, race, date, time, bet, offered, markup, venue, city, state, stakeholder, contact, notes, money_match_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(manageKey, v.player, v.opponent, v.game, v.race, v.date, v.time, v.bet, v.offered, v.markup, v.venue, v.city, v.state, v.stakeholder, v.contact, v.notes, v.moneyMatchId);
  return { id: Number(r.lastInsertRowid), manageKey };
}
export function getStakeRaw(db, id) { return db.prepare('SELECT * FROM stakes WHERE id=?').get(id); }
export function getStakePieces(db, id) { return db.prepare('SELECT * FROM stake_pieces WHERE stake_id=? ORDER BY id').all(id); }
export function getStake(db, id, { key = '', isAdmin = false } = {}) {
  const row = getStakeRaw(db, id);
  if (!row) return null;
  const canManage = isAdmin || (!!key && key === row.manage_key);
  return shapeStake(row, getStakePieces(db, id), canManage);
}
export function listStakesPublic(db) {
  const rows = db.prepare("SELECT * FROM stakes WHERE status IN ('open','settled') ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, date DESC, id DESC").all();
  const open = rows.filter(r => r.status === 'open').map(r => shapeStake(r, getStakePieces(db, r.id), false));
  const settled = rows.filter(r => r.status === 'settled').slice(0, 30).map(r => shapeStake(r, getStakePieces(db, r.id), false));
  return { open, settled };
}
export function listStakesAdminPending(db) {
  return db.prepare("SELECT * FROM stakes WHERE status='pending' ORDER BY id DESC").all().map(r => shapeStake(r, getStakePieces(db, r.id), true));
}
export function listStakesAdminAll(db) {
  const rows = db.prepare("SELECT * FROM stakes WHERE status NOT IN ('pending','archived') ORDER BY id DESC").all();
  const archived = db.prepare("SELECT * FROM stakes WHERE status='archived' ORDER BY id DESC").all();
  return { posts: rows.map(r => shapeStake(r, getStakePieces(db, r.id), true)), archived: archived.map(r => shapeStake(r, getStakePieces(db, r.id), true)) };
}
export function setStakeStatus(db, id, status) {
  if (status === 'archived') {
    const row = getStakeRaw(db, id); if (!row) return false;
    return db.prepare("UPDATE stakes SET status='archived', prev_status=?, updated_at=datetime('now') WHERE id=?").run(row.status, id).changes > 0;
  }
  return db.prepare("UPDATE stakes SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id).changes > 0;
}
export function repostStake(db, id) {
  const row = getStakeRaw(db, id); if (!row) return false;
  return db.prepare("UPDATE stakes SET status=COALESCE(prev_status,'open'), prev_status=NULL, updated_at=datetime('now') WHERE id=?").run(id).changes > 0;
}
export function purgeStake(db, id) {
  tx(db, () => { db.prepare('DELETE FROM stake_pieces WHERE stake_id=?').run(id); db.prepare('DELETE FROM stakes WHERE id=?').run(id); });
  return true;
}
export function addStakePiece(db, stakeId, { backer, contact, percent }) {
  db.prepare('INSERT INTO stake_pieces (stake_id, backer, contact, percent) VALUES (?,?,?,?)').run(stakeId, backer, contact, percent);
}
export function setStakePiecePaid(db, pieceId, field, value) {
  const col = field === 'paidin' ? 'paid_in' : 'paid';
  return db.prepare(`UPDATE stake_pieces SET ${col}=? WHERE id=?`).run(value ? 1 : 0, pieceId).changes > 0;
}
export function removeStakePiece(db, pieceId) { return db.prepare('DELETE FROM stake_pieces WHERE id=?').run(pieceId).changes > 0; }
export function setAllPiecesPaid(db, stakeId, won) {
  const col = won ? 'paid' : 'paid_in';
  db.prepare(`UPDATE stake_pieces SET ${col}=1 WHERE stake_id=?`).run(stakeId);
  return true;
}
export function setStakeResult(db, id, { result, score }) {
  if (result === 'cancelled') return db.prepare("UPDATE stakes SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(id).changes > 0;
  if (!['won', 'lost'].includes(result)) return false;
  return db.prepare("UPDATE stakes SET status='settled', result=?, score=?, updated_at=datetime('now') WHERE id=?").run(result, score || null, id).changes > 0;
}

// ---- Calcutta Auctions ----
const AUCTION_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
function genAuctionCode(db) {
  let code;
  do { code = Array.from({ length: 6 }, () => AUCTION_CODE_CHARS[Math.floor(Math.random() * AUCTION_CODE_CHARS.length)]).join(''); }
  while (db.prepare('SELECT 1 FROM auctions WHERE code=?').get(code));
  return code;
}
function bumpRev(db, code) { db.prepare("UPDATE auctions SET rev=rev+1, updated_at=datetime('now') WHERE code=?").run(code); }

export function createAuction(db, v) {
  const code = genAuctionCode(db), hostKey = crypto.randomUUID();
  db.prepare(`INSERT INTO auctions (code, host_key, title, mode, min_bid, increment, house_cut, bid_seconds, reset_seconds, starts_ms, ends_ms, payouts, listed)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(code, hostKey, v.title, v.mode, v.minBid, v.increment, v.houseCut, v.bidSeconds, v.resetSeconds, v.startsMs, v.endsMs, v.payouts, v.listed ? 1 : 0);
  const items = v.items.split('\n').map(s => s.trim()).filter(Boolean);
  items.forEach((name, i) => db.prepare('INSERT INTO auction_items (code, name, seq) VALUES (?,?,?)').run(code, name, i));
  return { code, hostKey };
}

export function getAuctionRaw(db, code) { return db.prepare('SELECT * FROM auctions WHERE code=?').get(code); }
export function getAuctionItems(db, code) { return db.prepare('SELECT * FROM auction_items WHERE code=? ORDER BY seq').all(code); }

// Reconciles time-based state (clocks expiring, scheduled start) -- called before every read
// and after every mutation, since there is no background worker/timer process here.
export function tickAuction(db, code) {
  const a = getAuctionRaw(db, code);
  if (!a || a.status === 'archived' || a.status === 'done') return a;
  const now = Date.now();
  let changed = false;
  if (a.status === 'setup' && a.mode === 'silent' && a.starts_ms && now >= a.starts_ms) {
    openAllSilentItems(db, code, a); changed = true;
  }
  const items = getAuctionItems(db, code);
  if (a.mode === 'silent' && (a.status === 'running')) {
    for (const it of items) {
      if (it.status === 'open' && it.ends_at && now >= it.ends_at) {
        closeItem(db, it, it.high_bid != null ? 'sold' : 'unsold'); changed = true;
      }
    }
    const fresh = getAuctionItems(db, code);
    if (fresh.length && fresh.every(it => it.status === 'sold' || it.status === 'unsold')) {
      db.prepare("UPDATE auctions SET status='done', updated_at=datetime('now') WHERE code=?").run(code); changed = true;
    }
  }
  if (a.mode === 'live' && a.status === 'running') {
    const cur = a.current_item ? items.find(i => i.id === a.current_item) : null;
    if (cur && cur.status === 'open' && cur.ends_at && now >= cur.ends_at) {
      closeItem(db, cur, cur.high_bid != null ? 'sold' : 'unsold');
      db.prepare('UPDATE auctions SET current_item=NULL, next_at=? WHERE code=?').run(now + 4000, code);
      changed = true;
    } else if (!a.current_item && a.next_at && now >= a.next_at) {
      changed = advanceLiveAuction(db, code) || changed;
    }
  }
  if (changed) bumpRev(db, code);
  return getAuctionRaw(db, code);
}
function closeItem(db, item, status) {
  db.prepare('UPDATE auction_items SET status=? WHERE id=?').run(status, item.id);
}
function openAllSilentItems(db, code, a) {
  db.prepare("UPDATE auctions SET status='running', updated_at=datetime('now') WHERE code=?").run(code);
  db.prepare("UPDATE auction_items SET status='open', ends_at=? WHERE code=? AND status='waiting'").run(a.ends_ms, code);
}
function advanceLiveAuction(db, code) {
  const a = getAuctionRaw(db, code);
  const next = db.prepare("SELECT * FROM auction_items WHERE code=? AND status='waiting' ORDER BY seq LIMIT 1").get(code);
  if (!next) { db.prepare("UPDATE auctions SET status='done', current_item=NULL, next_at=NULL, updated_at=datetime('now') WHERE code=?").run(code); return true; }
  const endsAt = Date.now() + a.bid_seconds * 1000;
  db.prepare("UPDATE auction_items SET status='open', ends_at=? WHERE id=?").run(endsAt, next.id);
  db.prepare('UPDATE auctions SET current_item=?, next_at=NULL, updated_at=datetime(\'now\') WHERE code=?').run(next.id, code);
  return true;
}

export function joinAuction(db, code, name) {
  const token = crypto.randomUUID();
  db.prepare('INSERT INTO auction_bidders (code, token, name) VALUES (?,?,?)').run(code, token, name);
  bumpRev(db, code);
  return token;
}
export function getBidderName(db, code, token) {
  if (!token) return null;
  const r = db.prepare('SELECT name FROM auction_bidders WHERE code=? AND token=?').get(code, token);
  return r ? r.name : null;
}

export function placeBid(db, code, token, itemId, amount) {
  const bidderName = getBidderName(db, code, token);
  if (!bidderName) return { error: 'Join the auction with your name first' };
  const a = getAuctionRaw(db, code);
  const item = db.prepare('SELECT * FROM auction_items WHERE id=? AND code=?').get(itemId, code);
  if (!a || !item) return { error: 'Player not found' };
  if (a.status !== 'running' || item.status !== 'open') return { error: 'Bidding is not open for this player' };
  if (a.mode === 'live' && a.current_item !== item.id) return { error: 'This is not the player currently up for bid' };
  const minNext = item.high_bid != null ? item.high_bid + a.increment : a.min_bid;
  if (!(amount >= minNext)) return { error: `Bid at least $${minNext}` };
  db.prepare('INSERT INTO auction_bids (item_id, token, name, amount) VALUES (?,?,?,?)').run(item.id, token, bidderName, amount);
  let endsAt = item.ends_at;
  if (endsAt && endsAt - Date.now() <= a.reset_seconds * 1000) endsAt = Date.now() + a.reset_seconds * 1000;
  db.prepare('UPDATE auction_items SET high_bid=?, high_bidder_token=?, high_bidder_name=?, ends_at=? WHERE id=?').run(amount, token, bidderName, endsAt, item.id);
  bumpRev(db, code);
  return { ok: true };
}

export function addAuctionChat(db, code, { name, text, host }) {
  db.prepare('INSERT INTO auction_chat (code, name, text, host) VALUES (?,?,?,?)').run(code, name, text, host ? 1 : 0);
  bumpRev(db, code);
}

export function hostAction(db, code, action, extra = {}) {
  const a = getAuctionRaw(db, code);
  if (!a) return { error: 'Auction not found' };
  const items = getAuctionItems(db, code);
  if (action === 'start') {
    if (a.mode === 'silent') openAllSilentItems(db, code, a);
    else { db.prepare("UPDATE auctions SET status='running', updated_at=datetime('now') WHERE code=?").run(code); advanceLiveAuction(db, code); }
  } else if (action === 'pause') {
    db.prepare("UPDATE auctions SET status='paused', updated_at=datetime('now') WHERE code=?").run(code);
  } else if (action === 'resume') {
    const cur = a.current_item ? items.find(i => i.id === a.current_item) : null;
    if (cur) db.prepare('UPDATE auction_items SET ends_at=? WHERE id=?').run(Date.now() + a.bid_seconds * 1000, cur.id);
    db.prepare("UPDATE auctions SET status='running', updated_at=datetime('now') WHERE code=?").run(code);
  } else if (action === 'sell' || action === 'pass') {
    const cur = a.current_item ? items.find(i => i.id === a.current_item) : null;
    if (cur) {
      closeItem(db, cur, action === 'sell' && cur.high_bid != null ? 'sold' : 'unsold');
      db.prepare('UPDATE auctions SET current_item=NULL, next_at=? WHERE code=?').run(Date.now() + 4000, code);
    }
  } else if (action === 'next') {
    db.prepare('UPDATE auctions SET next_at=? WHERE code=?').run(Date.now() - 1, code);
    advanceLiveAuction(db, code);
  } else if (action === 'end') {
    for (const it of items) if (it.status === 'open') closeItem(db, it, it.high_bid != null ? 'sold' : 'unsold');
    for (const it of items) if (it.status === 'waiting') closeItem(db, it, 'unsold');
    db.prepare("UPDATE auctions SET status='done', current_item=NULL, next_at=NULL, updated_at=datetime('now') WHERE code=?").run(code);
  } else if (action === 'delete') {
    db.prepare("UPDATE auctions SET status='archived', prev_status=?, updated_at=datetime('now') WHERE code=?").run(a.status, code);
  } else if (action === 'setend') {
    db.prepare('UPDATE auctions SET ends_ms=?, updated_at=datetime(\'now\') WHERE code=?').run(extra.endsMs, code);
    db.prepare("UPDATE auction_items SET ends_at=? WHERE code=? AND status='open'").run(extra.endsMs, code);
  } else if (action === 'add') {
    const names = String(extra.items || '').split('\n').map(s => s.trim()).filter(Boolean);
    const maxSeq = db.prepare('SELECT COALESCE(MAX(seq),-1) m FROM auction_items WHERE code=?').get(code).m;
    names.forEach((name, i) => {
      const seq = maxSeq + 1 + i;
      if (a.mode === 'silent' && a.status === 'running') db.prepare("INSERT INTO auction_items (code, name, seq, status, ends_at) VALUES (?,?,?,'open',?)").run(code, name, seq, a.ends_ms);
      else db.prepare('INSERT INTO auction_items (code, name, seq) VALUES (?,?,?)').run(code, name, seq);
    });
  } else if (action === 'remove') {
    db.prepare("DELETE FROM auction_items WHERE id=? AND code=? AND status='waiting'").run(extra.itemId, code);
  } else if (action === 'finish') {
    db.prepare('UPDATE auction_items SET finish=? WHERE id=? AND code=?').run(extra.finish ? Number(extra.finish) : null, extra.itemId, code);
  } else return { error: 'Unknown action' };
  bumpRev(db, code);
  return { ok: true };
}

export function restoreAuction(db, code) {
  const a = getAuctionRaw(db, code); if (!a) return false;
  return db.prepare("UPDATE auctions SET status=COALESCE(prev_status,'setup'), prev_status=NULL, updated_at=datetime('now') WHERE code=?").run(code).changes > 0;
}
export function purgeAuction(db, code) {
  tx(db, () => {
    db.prepare('DELETE FROM auction_bids WHERE item_id IN (SELECT id FROM auction_items WHERE code=?)').run(code);
    db.prepare('DELETE FROM auction_items WHERE code=?').run(code);
    db.prepare('DELETE FROM auction_bidders WHERE code=?').run(code);
    db.prepare('DELETE FROM auction_chat WHERE code=?').run(code);
    db.prepare('DELETE FROM auctions WHERE code=?').run(code);
  });
  return true;
}

export function listAuctionsPublic(db) {
  const rows = db.prepare("SELECT * FROM auctions WHERE listed=1 AND status != 'archived' ORDER BY created_at DESC").all();
  return rows.map(a => shapeAuctionSummary(db, a));
}
export function listAuctionsAdmin(db) {
  const rows = db.prepare('SELECT * FROM auctions ORDER BY created_at DESC').all();
  return rows.map(a => shapeAuctionSummary(db, a));
}
function shapeAuctionSummary(db, a) {
  const items = getAuctionItems(db, a.code);
  const pot = items.filter(i => i.status === 'sold').reduce((s, i) => s + i.high_bid, 0);
  const bidders = db.prepare('SELECT COUNT(*) n FROM auction_bidders WHERE code=?').get(a.code).n;
  return { code: a.code, title: a.title, mode: a.mode, status: a.status, prevStatus: a.prev_status, players: items.length, bidders,
    pot, startsMs: a.starts_ms, endsMs: a.ends_ms, listed: !!a.listed };
}

export function auctionState(db, code, { token = '', hostKey = '' } = {}) {
  const a = tickAuction(db, code);
  if (!a) return null;
  const items = getAuctionItems(db, code);
  const isHost = !!hostKey && hostKey === a.host_key;
  const bidderName = getBidderName(db, code, token);
  const payouts = String(a.payouts).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const soldItems = items.filter(i => i.status === 'sold');
  const pot = soldItems.reduce((s, i) => s + i.high_bid, 0);
  const net = round2(pot * (1 - a.house_cut / 100));
  const placePay = payouts.map(p => round2(net * p / 100));
  const finished = soldItems.filter(i => i.finish).sort((x, y) => x.finish - y.finish);
  const payoutByItem = new Map(finished.map((i, idx) => [i.id, placePay[i.finish - 1] ?? null]));
  const ownerMap = new Map();
  for (const i of soldItems) {
    const key = i.high_bidder_name;
    if (!ownerMap.has(key)) ownerMap.set(key, { name: key, players: 0, spent: 0, won: 0 });
    const o = ownerMap.get(key);
    o.players++; o.spent += i.high_bid; o.won += payoutByItem.get(i.id) || 0;
  }
  const shapedItems = items.map(i => ({
    id: i.id, name: i.name, status: i.status, minNext: i.high_bid != null ? i.high_bid + a.increment : a.min_bid,
    highBid: i.high_bid, highBidder: i.high_bidder_name, mine: !!token && i.high_bidder_token === token,
    endsAt: i.ends_at, finish: i.finish, payout: payoutByItem.get(i.id) || null
  }));
  const currentBids = a.current_item ? db.prepare('SELECT name, amount FROM auction_bids WHERE item_id=? ORDER BY id DESC LIMIT 10').all(a.current_item) : [];
  const chat = db.prepare('SELECT * FROM auction_chat WHERE code=? ORDER BY id').all(code).map(c => ({ name: c.name, text: c.text, host: !!c.host }));
  const bidders = db.prepare('SELECT COUNT(*) n FROM auction_bidders WHERE code=?').get(code).n;
  return {
    rev: a.rev, serverNow: Date.now(),
    auction: { code: a.code, title: a.title, mode: a.mode, minBid: a.min_bid, increment: a.increment, houseCut: a.house_cut,
      bidSeconds: a.bid_seconds, resetSeconds: a.reset_seconds, startsMs: a.starts_ms, endsMs: a.ends_ms, payouts, status: a.status,
      currentItem: a.current_item, nextAt: a.next_at },
    pot, net, placePay, items: shapedItems, bidders, currentBids, chat,
    owners: [...ownerMap.values()].sort((x, y) => y.spent - x.spent),
    you: bidderName ? { name: bidderName } : null, host: isHost
  };
}
