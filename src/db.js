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
    total: one('SELECT COUNT(DISTINCT visitor) n FROM pageviews')
  };
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
