// Match Finder: players post that they're looking for action (where, what game, what stakes,
// when), and other players answer "I'm in". Replies go privately to the poster. The site only
// connects players; it never takes, holds or pays out money.
import crypto from 'node:crypto';
import { GAMES, normalizeState, parseDate, parseTime, clean } from './normalize.js';

const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const DAY = 86_400_000;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS match_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, room TEXT,
  game TEXT NOT NULL, stake_min REAL, stake_max REAL, fargo INTEGER,
  date TEXT NOT NULL, until TEXT NOT NULL, time TEXT,     -- local dates the poster picked
  expires_ms INTEGER NOT NULL,                              -- end of the poster's last day
  contact TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'open',                      -- open | closed | archived (deleted; admin can repost or purge)
  manage_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_match_open ON match_posts(status, expires_ms);
CREATE TABLE IF NOT EXISTS match_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES match_posts(id),
  name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_match_replies ON match_replies(post_id);
CREATE TABLE IF NOT EXISTS match_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES match_posts(id),
  name TEXT NOT NULL, body TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_match_comments ON match_comments(post_id, deleted);
`;

export function validatePost(b, now = Date.now()) {
  if (!b || typeof b !== 'object') return { error: 'Missing details' };
  const s = (v, n) => clean(v).slice(0, n);
  const name = s(b.name, 40);
  if (!name) return { error: 'Enter the name or nickname players know you by' };
  const city = s(b.city, 60), state = normalizeState(b.state);
  if (!city || !state) return { error: 'Enter your city and state' };
  const game = GAMES.includes(b.game) ? b.game : 'Other';
  const num = v => (v === '' || v == null ? null : Math.round(Number(v)));
  const min = num(b.stakeMin), max = num(b.stakeMax);
  if ((min != null && !(min >= 1 && min <= 1_000_000)) || (max != null && !(max >= 1 && max <= 1_000_000))) return { error: 'Enter stakes in whole dollars' };
  if (min != null && max != null && max < min) return { error: 'The top of your stake range is lower than the bottom' };
  const fargo = num(b.fargo);
  if (fargo != null && !(fargo >= 100 && fargo <= 900)) return { error: 'Fargo rating should be between 100 and 900' };
  const date = parseDate(b.date), until = parseDate(b.until) || date;
  const expires = Math.round(Number(b.expiresMs));
  if (!date) return { error: 'Pick a start date' };
  if (!until) return { error: 'Pick an end date' };
  if (until < date) return { error: 'The end date is before the start date' };
  if (!(expires > now && expires < now + 62 * DAY)) return { error: 'Pick a day within the next two months' };
  return { value: { name, city, state, room: s(b.room, 80) || null, game, stakeMin: min, stakeMax: max, fargo, date, until, time: parseTime(b.time),
    expiresMs: expires, contact: s(b.contact, 80) || null, note: s(b.note, 280) || null } };
}

export function createPost(db, v) {
  const key = crypto.randomBytes(18).toString('base64url');
  const r = db.prepare(`INSERT INTO match_posts (name,city,state,room,game,stake_min,stake_max,fargo,date,until,time,expires_ms,contact,note,manage_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.name, v.city, v.state, v.room, v.game, v.stakeMin, v.stakeMax, v.fargo, v.date, v.until, v.time,
    v.expiresMs, v.contact, v.note, hash(key));
  return { id: Number(r.lastInsertRowid), manageKey: key };
}

export function canManage(db, id, key) {
  const row = db.prepare('SELECT manage_hash FROM match_posts WHERE id=?').get(id);
  return !!(row && key && eq(row.manage_hash, hash(key)));
}

const shape = (r, replies = null) => ({
  id: r.id, name: r.name, city: r.city, state: r.state, room: r.room, game: r.game, stakeMin: r.stake_min, stakeMax: r.stake_max, fargo: r.fargo,
  date: r.date, until: r.until, time: r.time, expiresMs: r.expires_ms, contact: r.contact, note: r.note, status: r.status, createdAt: r.created_at,
  prevStatus: r.prev_status || null, archivedBy: r.archived_by || null, archivedAt: r.archived_at || null,
  replyCount: r.reply_count ?? undefined, commentCount: r.comment_count ?? 0, ...(replies ? { replies } : {})
});

export function listOpen(db, now = Date.now()) {
  return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM match_replies r WHERE r.post_id=p.id) reply_count, (SELECT COUNT(*) FROM match_comments c WHERE c.post_id=p.id AND c.deleted=0) comment_count FROM match_posts p
    WHERE p.status='open' AND p.expires_ms > ? ORDER BY p.date, COALESCE(p.time,'99:99'), p.id DESC LIMIT 500`).all(now).map(r => shape(r));
}

export function getPost(db, id, { withReplies = false } = {}) {
  const r = db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM match_replies r WHERE r.post_id=p.id) reply_count, (SELECT COUNT(*) FROM match_comments c WHERE c.post_id=p.id AND c.deleted=0) comment_count FROM match_posts p WHERE p.id=?`).get(id);
  if (!r) return null;
  const replies = withReplies ? db.prepare('SELECT id, name, contact, message, created_at FROM match_replies WHERE post_id=? ORDER BY id DESC').all(id)
    .map(x => ({ id: x.id, name: x.name, contact: x.contact, message: x.message, createdAt: x.created_at })) : null;
  return shape(r, replies);
}

export function reply(db, id, b, now = Date.now()) {
  const p = db.prepare('SELECT status, expires_ms FROM match_posts WHERE id=?').get(id);
  if (!p || p.status !== 'open' || p.expires_ms <= now) return { status: 404, error: 'This post is closed' };
  const name = clean(b?.name).slice(0, 40), contact = clean(b?.contact).slice(0, 80);
  if (!name) return { status: 400, error: 'Enter your name' };
  if (!contact) return { status: 400, error: 'Enter a phone number or handle so they can reach you' };
  db.prepare('INSERT INTO match_replies (post_id, name, contact, message) VALUES (?,?,?,?)').run(id, name, contact, clean(b?.message).slice(0, 280) || null);
  return { status: 201, ok: true };
}

// Close / reopen (found a match). Doesn't touch deleted posts.
export function setStatus(db, id, status) {
  return db.prepare("UPDATE match_posts SET status=? WHERE id=? AND status IN ('open','closed')").run(status, id).changes > 0;
}

// Delete = move to the admin's archive. by: 'poster' | 'admin'.
export function archive(db, id, by) {
  return db.prepare("UPDATE match_posts SET prev_status=status, status='archived', archived_by=?, archived_at=datetime('now') WHERE id=? AND status<>'archived'")
    .run(by, id).changes > 0;
}

// Today's date and the end of today (3 AM tomorrow) on Michigan time, for reposting a post whose dates have passed.
function detroitToday(now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, endMs: now + ((27 * 60 - mins) * 60_000) };
}

// Put an archived post back on the board. If its end date already passed, it's reposted for today.
export function repost(db, id, now = Date.now()) {
  const p = db.prepare("SELECT * FROM match_posts WHERE id=? AND status='archived'").get(id);
  if (!p) return false;
  const status = p.prev_status === 'closed' ? 'closed' : 'open';
  if (p.expires_ms > now) db.prepare('UPDATE match_posts SET status=?, prev_status=NULL, archived_by=NULL, archived_at=NULL WHERE id=?').run(status, id);
  else {
    const t = detroitToday(now);
    db.prepare("UPDATE match_posts SET status='open', prev_status=NULL, archived_by=NULL, archived_at=NULL, date=?, until=?, time=NULL, expires_ms=? WHERE id=?").run(t.iso, t.iso, t.endMs, id);
  }
  return true;
}

// Delete forever (only from the archive): the post, its private replies and its comments.
export function purge(db, id) {
  const p = db.prepare("SELECT 1 FROM match_posts WHERE id=? AND status='archived'").get(id);
  if (!p) return false;
  db.prepare('DELETE FROM match_replies WHERE post_id=?').run(id);
  db.prepare('DELETE FROM match_comments WHERE post_id=?').run(id);
  db.prepare('DELETE FROM match_posts WHERE id=?').run(id);
  return true;
}

export function adminList(db) {
  return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM match_replies r WHERE r.post_id=p.id) reply_count, (SELECT COUNT(*) FROM match_comments c WHERE c.post_id=p.id AND c.deleted=0) comment_count FROM match_posts p
    ORDER BY p.id DESC LIMIT 300`).all().map(r => shape(r));
}

// Public comments anyone can read. The poster and the site admin can delete them.
export function listComments(db, id) {
  return db.prepare('SELECT id, name, body, created_at FROM match_comments WHERE post_id=? AND deleted=0 ORDER BY id LIMIT 300').all(id)
    .map(c => ({ id: c.id, name: c.name, body: c.body, createdAt: c.created_at }));
}
export function addComment(db, id, b) {
  const p = db.prepare('SELECT status FROM match_posts WHERE id=?').get(id);
  if (!p || p.status === 'archived') return { status: 404, error: 'This post was deleted' };
  const name = clean(b?.name).slice(0, 40), body = String(b?.body ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500);
  if (!name) return { status: 400, error: 'Enter your name' };
  if (!body) return { status: 400, error: 'Write a comment' };
  const dup = db.prepare('SELECT 1 FROM match_comments WHERE post_id=? AND name=? AND body=? AND deleted=0').get(id, name, body);
  if (dup) return { status: 400, error: 'You already posted that' };
  const r = db.prepare('INSERT INTO match_comments (post_id, name, body) VALUES (?,?,?)').run(id, name, body);
  return { status: 201, ok: true, id: Number(r.lastInsertRowid) };
}
export function deleteComment(db, id, cid) {
  return db.prepare('UPDATE match_comments SET deleted=1 WHERE id=? AND post_id=?').run(cid, id).changes > 0;
}
