import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as D from './db.js';
import { GAMES, TABLE_SIZES, normalizeState, parseDate, parseTime, parseMoney, parseInteger, clean, detectLevel, zip5 } from './normalize.js';
import { safeUrl } from './mapping.js';
import { ingest, runSync } from './sync.js';
import { geocodePending } from './geocode.js';
import { readFlyer } from './scan.js';
import { placesPayload, citiesForState, statesList } from './places.js';
import { renderShareCard, renderSiteShareCard } from './sharecard.js';

// Drawing a card takes a fraction of a second, so keep the most recent ones in memory.
const cardCache = new Map();
function cachedCard(key, make) {
  if (cardCache.has(key)) { const v = cardCache.get(key); cardCache.delete(key); cardCache.set(key, v); return v; }
  const png = make();
  cardCache.set(key, png);
  if (cardCache.size > 300) cardCache.delete(cardCache.keys().next().value);
  return png;
}
import { isBot, pageFromHash, classifySource, PAGES } from './traffic.js';
import * as S from './stakes.js';
import * as A from './auctions.js';
import * as SEO from './seo.js';
import * as M from './matches.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
const CSP = "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': CSP };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
function tokenOk(req, expected) {
  if (!expected) return false;
  const m = String(req.headers.authorization || '').match(/^Bearer (.+)$/);
  return !!m && crypto.timingSafeEqual(sha(m[1]), sha(expected));
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

async function readJson(req, limit = 3_000_000) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Request is too large');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); } catch { throw new HttpError(400, 'Body must be valid JSON'); }
}

function send(req, res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const h = { ...SECURITY, ...headers };
  if (buf.length > 1024 && /gzip/.test(req.headers['accept-encoding'] || '') && /json|text|javascript|svg/.test(h['Content-Type'] || '')) {
    res.writeHead(status, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    return res.end(zlib.gzipSync(buf));
  }
  res.writeHead(status, h);
  res.end(buf);
}
const json = (req, res, status, obj, headers = {}) => send(req, res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

// ---- visitor submissions -------------------------------------------------
export function validateSubmission(b) {
  if (!b || typeof b !== 'object') return { error: 'Missing tournament details' };
  const s = (v, n) => clean(v).slice(0, n);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const name = s(b.name, 120), venueName = s(b.venue?.name, 120), date = parseDate(b.date);
  if (!name) return { error: 'Tournament name is required' };
  if (!date || date < yesterday) return { error: 'Enter a date that is today or later' };
  if (!venueName) return { error: 'Venue name is required' };
  const state = normalizeState(b.venue?.state), city = s(b.venue?.city, 80);
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
      name, date, time: parseTime(b.time), game: GAMES.includes(b.game) ? b.game : 'Other', gameRaw: null,
      entry: parseMoney(b.entry), added: parseMoney(b.added), race: s(b.race, 40) || null, format: s(b.format, 60) || null,
      playerLimit: parseInteger(b.limit), level: detectLevel(name), tableSize: TABLE_SIZES.includes(b.tableSize) ? b.tableSize : null,
      directorName: s(b.director?.name, 80) || null, directorPhone: s(b.director?.phone, 30) || null, directorEmail: s(b.director?.email, 120) || null,
      registrationUrl: safeUrl(b.registrationUrl), website: safeUrl(b.website), notes: s(b.notes, 1000) || null, flyerUrl: null,
      venue: { name: venueName, address: s(b.venue?.address, 120), city, state, zip: zip5(b.venue?.zip), phone: s(b.venue?.phone, 30) || null, lat: null, lng: null, tables: null }
    }
  };
}

// ---- the server ------------------------------------------------------------
export function createApp(db, cfg, { fetchFn = fetch, log = () => {} } = {}) {
  const hits = new Map();
  const limited = ip => {
    const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3_600_000);
    if (list.length >= 10) { hits.set(ip, list); return true; }
    list.push(now); hits.set(ip, list); return false;
  };
  // General-purpose limiter: at most `max` hits per `windowMs` for a key.
  const joinHits = new Map(), fastHits = new Map();
  function limitedBy(store, key, max, windowMs) {
    const now = Date.now(), list = (store.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) { store.set(key, list); return true; }
    list.push(now); store.set(key, list);
    if (store.size > 20_000) store.clear();
    return false;
  }
  // Behind Railway's proxy every request arrives from the proxy's own address, so the real
  // visitor IP has to come from the proxy's headers (Railway sets X-Real-IP). Without this,
  // everyone looks like the same person and the visitor counts collapse to 1 a day.
  const behindProxy = !!(process.env.TRUST_PROXY || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME);
  const clientIp = req => (behindProxy ? String(req.headers['x-real-ip'] || '').trim() || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
  const admin = req => { if (!tokenOk(req, cfg.adminToken)) throw new HttpError(cfg.adminToken ? 401 : 403, cfg.adminToken ? 'Invalid admin token' : 'Admin is disabled until ADMIN_TOKEN is set'); };
  // Privacy-friendly visit counter: hashes IP+day+secret, so nothing identifying is stored
  // and the same person only counts once per day. Writes are batched in memory and flushed to
  // SQLite on a timer (never inline on a request) because node:sqlite is synchronous and a
  // disk write on every page load would stall the whole server's event loop.
  const pendingViews = new Map();
  const visitorId = (req, day) => sha(clientIp(req) + '|' + day + '|' + (cfg.adminToken || 'bat-salt')).toString('hex').slice(0, 32);
  let ownHosts = [];
  try { ownHosts = [new URL(cfg.publicUrl).hostname.replace(/^www\./, '')]; } catch {}
  function trackVisit(req, page) {
    try {
      if (isBot(req.headers['user-agent'])) return;
      const day = D.todayIso();
      const visitor = visitorId(req, day);
      pendingViews.set(day + '|' + visitor, [day, visitor]);
      if (page) recordPage(req, day, visitor, page, { ref: req.headers.referer });
    } catch {}
  }
  // Which page, and where the visitor came from. Batched and flushed with the counts above.
  const pendingPages = new Map();
  function recordPage(req, day, visitor, page, { ref, utm } = {}) {
    const k = day + '|' + visitor + '|' + page;
    if (pendingPages.has(k) || pendingPages.size >= 50_000) return;
    pendingPages.set(k, [day, visitor, page, classifySource({ ref, utm, ua: req.headers['user-agent'], ownHosts })]);
  }
  function flushPageviews() {
    if (pendingPages.size) {
      const pages = [...pendingPages.values()];
      pendingPages.clear();
      try { D.recordVisitsBulk(db, pages); } catch (e) { log('visit flush failed: ' + (e.message || e)); }
    }
    if (!pendingViews.size) return;
    const entries = [...pendingViews.values()];
    pendingViews.clear();
    try { D.recordPageviewsBulk(db, entries); } catch (e) { log('pageview flush failed: ' + (e.message || e)); }
  }
  const pvTimer = setInterval(flushPageviews, 20_000);
  pvTimer.unref?.();

  async function syncNow() {
    const r = await runSync(db, cfg, { fetchFn, log });
    if (r.status === 'ok') await geocodePending(db, cfg, { fetchFn, log });
    return r;
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname, m = req.method;
    let x;

    if (m === 'GET' && p === '/api/health') return json(req, res, 200, { ok: true });

    if (m === 'GET' && p === '/api/config') return json(req, res, 200, { scan: !!cfg.anthropicKey });

    // Beacon the browser app sends on each page it shows: {page, ref, utm}. Only whitelisted
    // page names are kept, and bots are ignored, so this can't be used to stuff the stats.
    if (m === 'POST' && p === '/api/track') {
      const b = await readJson(req, 4000).catch(() => null);
      const page = typeof b?.page === 'string' ? pageFromHash(b.page) : null;
      if (page && !isBot(req.headers['user-agent'])) {
        const day = D.todayIso(), visitor = visitorId(req, day);
        pendingViews.set(day + '|' + visitor, [day, visitor]);
        recordPage(req, day, visitor, page, { ref: typeof b.ref === 'string' ? b.ref.slice(0, 500) : '', utm: typeof b.utm === 'string' ? b.utm : '' });
      }
      return send(req, res, 204, '');
    }

    if (m === 'GET' && p === '/api/places') {
      const state = normalizeState(url.searchParams.get('state'));
      if (url.searchParams.has('state')) {
        if (!state) return json(req, res, 400, { error: 'Unknown state' });
        return json(req, res, 200, { state, cities: citiesForState(db, cfg, state) }, { 'Cache-Control': 'public, max-age=300' });
      }
      return json(req, res, 200, placesPayload(db, cfg), { 'Cache-Control': 'public, max-age=300' });
    }

    if (m === 'POST' && p === '/api/scan') {
      if (!cfg.anthropicKey) return json(req, res, 501, { error: 'Flyer reading is not set up on this site' });
      if (limited(clientIp(req) + ':scan')) return json(req, res, 429, { error: 'Too many flyers. Try again in an hour.' });
      const b = await readJson(req);
      if (!b || typeof b.image !== 'string' || b.image.length > 2_000_000) return json(req, res, 400, { error: 'Send a flyer image under 2 MB' });
      try { return json(req, res, 200, { fields: await readFlyer(b.image, cfg, { fetchFn }) }); }
      catch (e) { return json(req, res, 502, { error: e.message }); }
    }

    if (m === 'POST' && (p === '/api/claims' || p === '/api/reports' || p === '/api/subscribe')) {
      if (limited(clientIp(req) + ':form')) return json(req, res, 429, { error: 'Too many requests. Try again later.' });
      const b = (await readJson(req)) || {};
      if (p === '/api/subscribe') {
        const email = clean(b.email).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json(req, res, 400, { error: 'Enter a valid email address' });
        D.addSubscriber(db, email);
        return json(req, res, 200, { ok: true });
      }
      const tid = Number(b.tournamentId);
      if (!D.getTournament(db, tid, { includeHidden: true })) return json(req, res, 404, { error: 'Tournament not found' });
      if (p === '/api/claims') {
        const email = clean(b.email).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(req, res, 400, { error: 'Enter a valid email address' });
        D.addClaim(db, tid, email, clean(b.name).slice(0, 80));
      } else {
        const msg = clean(b.message).slice(0, 1000);
        if (!msg) return json(req, res, 400, { error: 'Describe what is wrong' });
        D.addReport(db, tid, msg);
      }
      return json(req, res, 201, { ok: true });
    }

    if (m === 'GET' && p === '/api/tournaments') {
      const from = parseDate(url.searchParams.get('from')) || D.todayIso();
      const list = D.listTournaments(db, { from, to: parseDate(url.searchParams.get('to')) || undefined, state: normalizeState(url.searchParams.get('state')), limit: Math.min(Number(url.searchParams.get('limit')) || 20000, 50000) });
      return json(req, res, 200, { generatedAt: new Date().toISOString(), tournaments: list }, { 'Cache-Control': 'public, max-age=60' });
    }
    if (m === 'GET' && p === '/api/tournaments/past') {
      const state = normalizeState(url.searchParams.get('state'));
      const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
      const list = D.listPastTournaments(db, { state, limit, offset });
      const total = D.countPastTournaments(db, { state });
      return json(req, res, 200, { tournaments: list, total, offset, limit }, { 'Cache-Control': 'public, max-age=300' });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/tournaments\/(\d+)$/))) {
      const t = D.getTournament(db, Number(x[1]));
      return t ? json(req, res, 200, { ...t, pageUrl: t.status === 'published' ? cfg.publicUrl + SEO.tournamentPath(db, t) : null }) : json(req, res, 404, { error: 'Tournament not found' });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/tournaments\/(\d+)\/flyer$/))) {
      const data = D.getFlyer(db, Number(x[1]));
      const mm = data && data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!mm) return json(req, res, 404, { error: 'No flyer' });
      return send(req, res, 200, Buffer.from(mm[2], 'base64'), { 'Content-Type': mm[1], 'Cache-Control': 'public, max-age=3600' });
    }
    if (m === 'POST' && p === '/api/tournaments') {
      if (limited(clientIp(req))) return json(req, res, 429, { error: 'Too many submissions. Try again in an hour.' });
      const v = validateSubmission(await readJson(req));
      if (v.error) return json(req, res, 400, { error: v.error });
      const id = D.createLocalTournament(db, v.value, v.flyer);
      setImmediate(() => geocodePending(db, cfg, { fetchFn, log }).catch(() => {}));
      return json(req, res, 201, { id, status: 'pending' });
    }

    if (m === 'POST' && p === '/api/hooks/tournaments') {
      if (!tokenOk(req, cfg.webhookSecret)) return json(req, res, 401, { error: 'Invalid webhook secret' });
      const body = await readJson(req, 5_000_000);
      const records = Array.isArray(body) ? body : Array.isArray(body?.tournaments) ? body.tournaments : body ? [body] : [];
      const { counts, skips } = ingest(db, cfg, records);
      setImmediate(() => geocodePending(db, cfg, { fetchFn, log }).catch(() => {}));
      return json(req, res, 200, { ...counts, reasons: [...new Set(skips)] });
    }

    // ---- Live / Calcutta auctions ----
    if (m === 'GET' && p === '/api/auctions') return json(req, res, 200, { auctions: A.listedAuctions(db) }, { 'Cache-Control': 'no-cache' });
    if (m === 'POST' && p === '/api/auctions') {
      if (limited(clientIp(req) + ':auction')) return json(req, res, 429, { error: 'Too many auctions created. Try again in an hour.' });
      const v = A.validateAuction(await readJson(req, 50_000));
      if (v.error) return json(req, res, 400, { error: v.error });
      return json(req, res, 201, A.createAuction(db, v.value));
    }
    if ((x = p.match(/^\/api\/auctions\/([A-Za-z0-9]{4,10})(\/[a-z]+)?$/))) {
      let a = A.getAuction(db, x[1]);
      if (!a || (a.status === 'archived' && !tokenOk(req, cfg.adminToken))) return json(req, res, 404, { error: 'Auction not found. Check the code.' });
      a = A.tick(db, a);
      const rest = x[2] || '';
      const host = A.isHost(a, req.headers['x-host-key']);
      const you = A.bidderFor(db, a, req.headers['x-bidder']);
      if (m === 'GET' && rest === '') {
        const since = Number(url.searchParams.get('rev'));
        if (since && since === a.rev) return json(req, res, 200, { rev: a.rev, serverNow: Date.now(), unchanged: true }, { 'Cache-Control': 'no-store' });
        return json(req, res, 200, A.roomState(db, a, { you, host }), { 'Cache-Control': 'no-store' });
      }
      if (m === 'POST' && rest === '/join') {
        if (limitedBy(joinHits, clientIp(req), 40, 3_600_000)) return json(req, res, 429, { error: 'Too many joins. Try again later.' });
        const r = A.join(db, a, ((await readJson(req, 2000)) || {}).name);
        return json(req, res, r.status, r.error ? { error: r.error } : r);
      }
      if (m === 'POST' && rest === '/bid') {
        if (!you) return json(req, res, 401, { error: 'Join the auction to bid' });
        if (limitedBy(fastHits, 'b' + you.id, 6, 2000)) return json(req, res, 429, { error: 'Slow down a little' });
        const b = (await readJson(req, 2000)) || {};
        const r = A.placeBid(db, a, you, Number(b.itemId), b.amount);
        return json(req, res, r.status, r.error ? { error: r.error } : r);
      }
      if (m === 'POST' && rest === '/chat') {
        if (!you && !host) return json(req, res, 401, { error: 'Join the auction to chat' });
        if (limitedBy(fastHits, 'c' + (host ? 'h' + a.id : you.id), 3, 5000)) return json(req, res, 429, { error: 'Slow down a little' });
        const r = A.postChat(db, a, host ? 'Host' : you.name, host, ((await readJson(req, 2000)) || {}).text);
        return json(req, res, r.status, r.error ? { error: r.error } : r);
      }
      if (m === 'POST' && rest === '/host') {
        if (!host) return json(req, res, 403, { error: 'Only the host can do that' });
        const b = (await readJson(req, 50_000)) || {};
        const r = A.hostAction(db, a, String(b.action || ''), b);
        log(`auction ${a.code} host ${String(b.action || '').slice(0, 20)}: ${r.error || 'ok'}`);
        return json(req, res, r.error ? 400 : 200, r);
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    // ---- Match Finder ----
    if (m === 'GET' && p === '/api/matches') return json(req, res, 200, { posts: M.listOpen(db) }, { 'Cache-Control': 'no-store' });
    if (m === 'POST' && p === '/api/matches') {
      if (limitedBy(joinHits, clientIp(req) + ':match', 6, 3_600_000)) return json(req, res, 429, { error: 'Too many posts. Try again in an hour.' });
      const v = M.validatePost(await readJson(req, 10_000));
      if (v.error) return json(req, res, 400, { error: v.error });
      return json(req, res, 201, M.createPost(db, v.value));
    }
    if ((x = p.match(/^\/api\/matches\/(\d+)(\/[a-z]+)?$/))) {
      const id = Number(x[1]), rest = x[2] || '';
      const mine = tokenOk(req, cfg.adminToken) || M.canManage(db, id, req.headers['x-manage-key']);
      if (m === 'GET' && rest === '') {
        const post = M.getPost(db, id, { withReplies: mine });
        if (!post || (post.status === 'removed' && !mine)) return json(req, res, 404, { error: 'Post not found' });
        return json(req, res, 200, { ...post, canManage: mine });
      }
      if (m === 'POST' && rest === '/reply') {
        if (limitedBy(joinHits, clientIp(req) + ':mreply', 20, 3_600_000)) return json(req, res, 429, { error: 'Too many replies. Try again later.' });
        const r = M.reply(db, id, await readJson(req, 4000));
        return json(req, res, r.status, r.error ? { error: r.error } : r);
      }
      if (m === 'POST' && (rest === '/close' || rest === '/reopen')) {
        if (!mine) return json(req, res, 403, { error: 'Only the person who posted can change this' });
        return json(req, res, 200, { ok: M.setStatus(db, id, rest === '/close' ? 'closed' : 'open') });
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    // ---- Staking Board ----
    if (m === 'GET' && p === '/api/stakes') return json(req, res, 200, S.listBoard(db), { 'Cache-Control': 'no-cache' });
    if (m === 'POST' && p === '/api/stakes') {
      if (limited(clientIp(req) + ':stake')) return json(req, res, 429, { error: 'Too many posts. Try again in an hour.' });
      const v = S.validateStake(await readJson(req, 20_000));
      if (v.error) return json(req, res, 400, { error: v.error });
      const { id, key } = S.createStake(db, v.value);
      return json(req, res, 201, { id, manageKey: key, status: 'pending' });
    }
    if ((x = p.match(/^\/api\/stakes\/(\d+)(\/.*)?$/))) {
      const id = Number(x[1]), rest = x[2] || '';
      const canManage = tokenOk(req, cfg.adminToken) || S.manageKeyOk(db, id, req.headers['x-manage-key']);
      if (m === 'GET' && rest === '') {
        const st = S.getStake(db, id, { privateView: canManage });
        if (!st || (!canManage && !['open', 'settled'].includes(st.status))) return json(req, res, 404, { error: 'Match not found' });
        return json(req, res, 200, { ...st, canManage });
      }
      if (m === 'POST' && rest === '/pieces') {
        if (limited(clientIp(req) + ':piece')) return json(req, res, 429, { error: 'Too many claims. Try again in an hour.' });
        const r = S.claimPiece(db, id, await readJson(req, 5000));
        return json(req, res, r.status, r.error ? { error: r.error } : r);
      }
      if (!canManage) return json(req, res, 403, { error: 'Only the person who posted this match can change it' });
      if (m === 'POST' && rest === '/result') {
        const r = S.recordResult(db, id, await readJson(req, 5000));
        return json(req, res, r.error ? 400 : 200, r);
      }
      if (m === 'POST' && rest === '/allpaid') return json(req, res, S.markAllPaid(db, id) ? 200 : 404, { ok: true });
      if (m === 'POST' && (x = rest.match(/^\/pieces\/(\d+)\/(paid|unpaid|paidin|unpaidin|remove)$/))) {
        const pid = Number(x[1]);
        const ok = x[2] === 'remove' ? S.removePiece(db, id, pid)
          : x[2] === 'paidin' || x[2] === 'unpaidin' ? S.setPiecePaidIn(db, id, pid, x[2] === 'paidin')
          : S.setPiecePaid(db, id, pid, x[2] === 'paid');
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Piece not found' });
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    if (p.startsWith('/api/admin/')) {
      admin(req);
      if (m === 'GET' && p === '/api/admin/auctions') return json(req, res, 200, { auctions: A.allAuctions(db) });
      if ((x = p.match(/^\/api\/admin\/auctions\/([A-Za-z0-9]{4,10})\/(delete|restore|purge)$/)) && m === 'POST') {
        const a = A.getAuction(db, x[1]);
        if (!a) return json(req, res, 404, { error: 'Auction not found' });
        const ok = x[2] === 'delete' ? !A.hostAction(db, a, 'delete').error : x[2] === 'restore' ? A.restoreAuction(db, a) : A.purgeAuction(db, a);
        log(`auction ${a.code} ${x[2]} by admin: ${ok ? 'ok' : 'failed'}`);
        return json(req, res, ok ? 200 : 400, ok ? { ok: true } : { error: 'Could not do that' });
      }
      if (m === 'GET' && p === '/api/admin/matches') return json(req, res, 200, { posts: M.adminList(db) });
      if ((x = p.match(/^\/api\/admin\/matches\/(\d+)\/(remove|restore)$/)) && m === 'POST') {
        const ok = M.setStatus(db, Number(x[1]), x[2] === 'remove' ? 'removed' : 'open');
        log(`match post ${x[1]} ${x[2]} by admin`);
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Post not found' });
      }
      if (m === 'GET' && p === '/api/admin/stakes/all') return json(req, res, 200, S.adminStakes(db));
      if ((x = p.match(/^\/api\/admin\/stakes\/(\d+)\/(archive|repost|purge)$/)) && m === 'POST') {
        const sid = Number(x[1]);
        const ok = x[2] === 'archive' ? S.archiveStake(db, sid) : x[2] === 'repost' ? S.repostStake(db, sid) : S.purgeStake(db, sid);
        log(`stake ${sid} ${x[2]} by admin: ${ok ? 'ok' : 'not found'}`);
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Post not found' });
      }
      if (m === 'GET' && p === '/api/admin/stakes/pending') return json(req, res, 200, { stakes: S.listPendingStakes(db) });
      if ((x = p.match(/^\/api\/admin\/stakes\/(\d+)\/(approve|reject)$/)) && m === 'POST') {
        const ok = S.setStakeStatus(db, Number(x[1]), x[2] === 'approve' ? 'open' : 'rejected');
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Match not found' });
      }
      if (m === 'GET' && p === '/api/admin/summary') return json(req, res, 200, D.summary(db));
      if (m === 'GET' && p === '/api/admin/pageviews') {
        flushPageviews();
        const traffic = D.visitBreakdown(db);
        traffic.pages = traffic.pages.map(r => ({ ...r, label: PAGES[r.page] || r.page }));
        return json(req, res, 200, { ...D.pageviewCounts(db), traffic });
      }
      if (m === 'GET' && p === '/api/admin/pending') return json(req, res, 200, { tournaments: D.listPending(db) });
      if (m === 'POST' && p === '/api/admin/sync') return json(req, res, 200, await syncNow());
      if ((x = p.match(/^\/api\/admin\/(claims|reports)\/(\d+)\/done$/)) && m === 'POST') return json(req, res, 200, { ok: D.resolveItem(db, x[1], Number(x[2])) });
      if ((x = p.match(/^\/api\/admin\/tournaments\/(\d+)\/(approve|reject)$/)) && m === 'POST') {
        const ok = x[2] === 'approve' ? D.setStatus(db, Number(x[1]), 'published', 1) : D.setStatus(db, Number(x[1]), 'rejected');
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Tournament not found' });
      }
      if ((x = p.match(/^\/api\/admin\/tournaments\/(\d+)$/)) && m === 'PATCH') {
        const b = await readJson(req), patch = {};
        if ('name' in b) patch.name = clean(b.name).slice(0, 120);
        if ('date' in b) { patch.date = parseDate(b.date); if (!patch.date) throw new HttpError(400, 'Invalid date'); }
        if ('time' in b) patch.time = parseTime(b.time);
        if ('game' in b && GAMES.includes(b.game)) patch.game = b.game;
        if ('entry' in b) patch.entry = parseMoney(b.entry);
        if ('added' in b) patch.added = parseMoney(b.added);
        if ('race' in b) patch.race = clean(b.race).slice(0, 40) || null;
        if ('format' in b) patch.format = clean(b.format).slice(0, 60) || null;
        if ('notes' in b) patch.notes = clean(b.notes).slice(0, 1000) || null;
        return D.editTournament(db, Number(x[1]), patch) ? json(req, res, 200, { ok: true }) : json(req, res, 404, { error: 'Tournament not found' });
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    // ---- share cards (see sharecard.js): og.png = link-preview size, square = posts, story = TikTok/Stories ----
    const host = (() => { try { return new URL(cfg.publicUrl).host; } catch { return 'billiardactiontime.com'; } })();
    if ((m === 'GET' || m === 'HEAD') && p === '/og.png') {
      return send(req, res, 200, cachedCard('site', () => renderSiteShareCard(host)), { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/t\/(\d+)\/(og|card-square|card-story)\.png$/))) {
      const t = D.getTournament(db, Number(x[1]));
      if (!t) return send(req, res, 404, cachedCard('site', () => renderSiteShareCard(host)), { 'Content-Type': 'image/png' });
      const format = { og: 'landscape', 'card-square': 'square', 'card-story': 'story' }[x[2]];
      const png = cachedCard(`${t.id}|${format}|${t.updatedAt}`, () => renderShareCard(t, format, host));
      const dl = url.searchParams.has('download') ? { 'Content-Disposition': `attachment; filename="billiard-action-time-${t.id}-${format}.png"` } : {};
      return send(req, res, 200, png, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', ...dl });
    }
    // ---- search-engine pages (see seo.js) ----
    const html = (status, body, extra = {}) => send(req, res, status, body, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...extra });
    const moved = to => { res.writeHead(301, { Location: to, 'Cache-Control': 'public, max-age=86400' }); res.end(); };
    const notFoundPage = () => { SEO.ensureFooter(db); return html(404, SEO.listingPage(db, cfg, []).replace('<h1>Pool Tournaments by State</h1>', '<h1>Page not found</h1><p>That page moved or never existed. Browse tournaments by state below.</p>')); };
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tournament\/([a-z0-9-]{3,220})\/?$/))) {
      SEO.ensureFooter(db);
      const t = SEO.findTournamentBySlug(db, x[1]);
      if (!t) return notFoundPage();
      const canon = SEO.tournamentPath(db, t);
      if (canon !== '/tournament/' + x[1]) return moved(canon);
      trackVisit(req, 'tournament-page');
      return html(200, SEO.tournamentPage(db, cfg, t));
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tournaments(\/.*)?$/))) {
      if (p === '/tournaments') return moved('/tournaments/');
      SEO.ensureFooter(db);
      const parts = (x[1] || '').split('/').filter(Boolean);
      const out = SEO.listingPage(db, cfg, parts);
      if (!out) return notFoundPage();
      trackVisit(req, parts.length ? 'listing-page' : 'states-page');
      return html(200, out);
    }
    if (m === 'GET' && (x = p.match(/^\/t\/(\d+)$/))) {           // old tournament links
      const t = D.getTournament(db, Number(x[1]));
      return t && t.status === 'published' ? moved(SEO.tournamentPath(db, t)) : notFoundPage();
    }
    if (m === 'GET' && (x = p.match(/^\/venue\/(\d+)$/))) {
      SEO.ensureFooter(db);
      const out = SEO.venuePage(db, cfg, Number(x[1]));
      if (!out) return notFoundPage();
      if (out.redirect) return moved(out.redirect);
      trackVisit(req, 'venue-page');
      return html(200, out);
    }
    if (m === 'GET' && (x = p.match(/^\/state\/([a-zA-Z]{2})\/?$/))) {   // old state links
      const code = normalizeState(x[1]);
      return code ? moved(SEO.legacyStatePath(code)) : notFoundPage();
    }
    if (m === 'GET' && (p === '/state' || p === '/state/')) return moved('/tournaments/');
    if (m === 'GET' && p === '/sitemap.xml') return send(req, res, 200, SEO.sitemapXml(db, cfg), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    if (m === 'GET' && p === '/robots.txt') return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${cfg.publicUrl}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });

    if (m === 'GET' || m === 'HEAD') {
      const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
      const file = path.resolve(PUBLIC_DIR, rel);
      if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        if (rel === 'index.html' && m === 'GET') trackVisit(req);
        let body = fs.readFileSync(file);
        // Crawlable links to the state/city/game pages, so search engines can find them from the home page.
        if (rel === 'index.html') { try { body = Buffer.from(body.toString('utf8').replace('<!--SEO_LINKS-->', SEO.homeLinksHtml(db))); } catch (e) { log('seo links failed: ' + e.message); } }
        return send(req, res, 200, body, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
      }
    }
    return json(req, res, 404, { error: 'Not found' });
  }

  const server = http.createServer((req, res) => {
    route(req, res).catch(e => {
      if (e instanceof HttpError) return json(req, res, e.status, { error: e.message });
      log('request error: ' + (e.stack || e));
      json(req, res, 500, { error: 'Something went wrong' });
    });
  });
  server.syncNow = syncNow;
  server.flushPageviews = flushPageviews;
  return server;
}
