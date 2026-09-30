import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { slugify, zip5 } from './normalize.js';

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
-- which page each visitor viewed and where they came from, one row per (day, visitor, page).
-- Same privacy rules as pageviews: visitor is the salted daily hash, no IPs stored.
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL, visitor TEXT NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY (day, visitor, page)
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
-- Staking Board: players offer pieces of their action; backers claim pieces. The site only keeps
-- the record -- money is held by the named stakeholder and paid between people off the site.
CREATE TABLE IF NOT EXISTS stakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL, opponent TEXT, game TEXT NOT NULL, race TEXT,
  bet REAL NOT NULL,              -- amount a side
  offered REAL NOT NULL,          -- % of the player's action for sale
  markup REAL NOT NULL DEFAULT 1,
  date TEXT NOT NULL, time TEXT,
  venue TEXT, city TEXT, state TEXT,
  stakeholder TEXT, contact TEXT, notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | open | settled | cancelled | rejected
  result TEXT, score TEXT,                  -- won | lost, and e.g. "11-7"
  manage_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stakes_status ON stakes(status, date);
CREATE TABLE IF NOT EXISTS stake_pieces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stake_id INTEGER NOT NULL REFERENCES stakes(id),
  backer TEXT NOT NULL, percent REAL NOT NULL,
  contact TEXT,                   -- private: only the poster and admin see it
  paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pieces_stake ON stake_pieces(stake_id);
-- Calcutta / live auctions. Records only: no money is taken or paid out by the site.
CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, starts_at TEXT,
  mode TEXT NOT NULL DEFAULT 'live',          -- live (one player at a time) | silent (all at once)
  status TEXT NOT NULL DEFAULT 'setup',       -- setup | running | paused | done
  listed INTEGER NOT NULL DEFAULT 0,
  min_bid REAL NOT NULL DEFAULT 5, increment REAL NOT NULL DEFAULT 5,
  bid_seconds INTEGER NOT NULL DEFAULT 30,    -- live: clock for each player
  reset_seconds INTEGER NOT NULL DEFAULT 15,  -- a late bid pushes the clock back up to this
  silent_minutes INTEGER NOT NULL DEFAULT 60,
  house_cut REAL NOT NULL DEFAULT 0, payouts TEXT NOT NULL DEFAULT '[]',
  current_item INTEGER, paused_left_ms INTEGER, next_at INTEGER,
  host_hash TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, auction_id INTEGER NOT NULL REFERENCES auctions(id),
  name TEXT NOT NULL, note TEXT, sort INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',     -- waiting | open | sold | unsold
  ends_at INTEGER, high_bid REAL, high_bidder INTEGER, finish INTEGER
);
CREATE INDEX IF NOT EXISTS idx_aitems ON auction_items(auction_id, sort);
CREATE TABLE IF NOT EXISTS auction_bidders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, auction_id INTEGER NOT NULL REFERENCES auctions(id),
  name TEXT NOT NULL, name_key TEXT NOT NULL, token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (auction_id, name_key)
);
CREATE TABLE IF NOT EXISTS auction_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT, auction_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
  bidder_id INTEGER NOT NULL, amount REAL NOT NULL, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_abids ON auction_bids(item_id, id);
CREATE TABLE IF NOT EXISTS auction_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT, auction_id INTEGER NOT NULL,
  name TEXT NOT NULL, host INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_achat ON auction_chat(auction_id, id);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA);
  // Columns added after launch: add them to databases created before they existed.
  for (const sql of ['ALTER TABLE auctions ADD COLUMN ends_ms INTEGER', 'ALTER TABLE auctions ADD COLUMN starts_ms INTEGER']) {
    try { db.exec(sql); } catch { /* already there */ }
  }
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
    total: one('SELECT COUNT(DISTINCT visitor) n FROM pageviews')
  };
}

// ---- page + traffic-source tracking (fed by the browser beacon at /api/track) ----
export function recordVisitsBulk(db, entries) {
  if (!entries.length) return;
  tx(db, () => {
    const stmt = db.prepare('INSERT OR IGNORE INTO visits (day, visitor, page, source) VALUES (?,?,?,?)');
    for (const [day, visitor, page, source] of entries) stmt.run(day, visitor, page, source);
  });
}
export function visitBreakdown(db, { days = 30, dailyDays = 14, todayStr = todayIso() } = {}) {
  const daysAgo = n => { const d = new Date(todayStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const since = daysAgo(days - 1), dailySince = daysAgo(dailyDays - 1);
  // A visitor's source is the one on their first recorded page that day, so a person who
  // arrives from Google and clicks around five pages counts once for Google, not five times.
  const firstSource = `SELECT day, visitor, MIN(rowid) r FROM visits WHERE day >= ? GROUP BY day, visitor`;
  const sources = db.prepare(`SELECT v.source, COUNT(*) visitors FROM visits v JOIN (${firstSource}) f ON v.rowid = f.r
    GROUP BY v.source ORDER BY visitors DESC LIMIT 25`).all(since);
  const pages = db.prepare(`SELECT page, COUNT(*) views FROM visits WHERE day >= ? GROUP BY page ORDER BY views DESC LIMIT 25`).all(since);
  const dailyRows = db.prepare(`SELECT day, COUNT(DISTINCT visitor) visitors FROM visits WHERE day >= ? GROUP BY day`).all(dailySince);
  const byDay = new Map(dailyRows.map(r => [r.day, Number(r.visitors)]));
  const daily = [];
  for (let i = dailyDays - 1; i >= 0; i--) { const d = daysAgo(i); daily.push({ day: d, visitors: byDay.get(d) || 0 }); }
  const visitors = db.prepare(`SELECT COUNT(*) n FROM (SELECT DISTINCT day, visitor FROM visits WHERE day >= ?)`).get(since).n;
  return {
    days, visitors: Number(visitors),
    sources: sources.map(r => ({ source: r.source, visitors: Number(r.visitors) })),
    pages: pages.map(r => ({ page: r.page, views: Number(r.views) })),
    daily
  };
}

// Distinct city/state pairs that actually have a venue on file, so the city dropdown
// can include real places even before they have a tournament -- see places.js for the rest.
export function venueCities(db) {
  return db.prepare(`SELECT DISTINCT city, state FROM venues WHERE city IS NOT NULL AND city <> '' AND state IS NOT NULL AND state <> ''`).all();
}
