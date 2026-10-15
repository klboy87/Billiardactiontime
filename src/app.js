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
import { readFlyer, readMoneyFlyer } from './scan.js';
import { placesPayload, citiesForState, statesList } from './places.js';
import { renderShareCard, renderSiteShareCard, renderHeadlineCard, moneyMatchContent } from './sharecard.js';

// Drawing a card takes a fraction of a second, so keep the most recent ones in memory.
const cardCache = new Map();
function cachedCard(key, make) {
  if (cardCache.has(key)) { const v = cardCache.get(key); cardCache.delete(key); cardCache.set(key, v); return v; }
  const png = make();
  cardCache.set(key, png);
  if (cardCache.size > 120) cardCache.delete(cardCache.keys().next().value);
  return png;
}
import { isBot, pageFromHash, classifySource, PAGES } from './traffic.js';
import * as S from './stakes.js';
import * as A from './auctions.js';
import * as SEO from './seo.js';
import * as M from './matches.js';
import * as MM from './moneymatches.js';
import * as MP from './moneypages.js';
import { sponsorBannerHtml } from './sponsor.js';
import { appPageFor, fillShell } from './apppages.js';
import { buildNewsletter } from './newsletter.js';
import * as GU from './guides.js';
import * as TL from './tools.js';
import * as BR from './brackets.js';
import * as TS from './trickshots.js';
import * as PL from './play.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
// Google AdSense needs its script hosts, ad frames and reporting endpoints; everything else stays same-origin
// (inline scripts remain blocked).
const ADS = 'https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://www.googletagservices.com https://adservice.google.com https://www.google.com https://*.gstatic.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com';
const CSP = `default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-eval' ${ADS}; frame-src ${ADS} https://*.google.com; connect-src 'self' ${ADS} https://*.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
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
  for (const k of Object.keys(h)) if (h[k] == null) delete h[k];   // a route can drop a default header (embeds drop X-Frame-Options)
  if (buf.length > 1024 && /gzip/.test(req.headers['accept-encoding'] || '') && /json|text|javascript|svg|xml/.test(h['Content-Type'] || '')) {
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
      let utm = '';
      try { utm = new URL(req.url, 'http://x').searchParams.get('utm_source') || ''; } catch {}
      if (page) recordPage(req, day, visitor, page, { ref: req.headers.referer, utm });
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

  // The app shell (index.html) for the home page (page = null) or one app section, see apppages.js.
  function shellHtml(page) {
    let body = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
      .replace('<!--SPONSOR-->', sponsorBannerHtml()).replace('<!--ADS_HEAD-->', SEO.adsHead(cfg));
    try { SEO.ensureFooter(db); body = body.replace('<!--SEO_LINKS-->', SEO.homeLinksHtml(db)); } catch (e) { log('seo links failed: ' + e.message); }
    let homeIntro = '';
    if (!page) try { homeIntro = SEO.homeIntroHtml(db); } catch (e) { log('home intro failed: ' + e.message); }
    return fillShell(body, cfg, page, { homeIntro });
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
    if ((x = p.match(/^\/api\/tournaments\/(\d+)\/going$/)) && (m === 'GET' || m === 'POST')) {
      const id = Number(x[1]), t = D.getTournament(db, id);
      if (!t || t.status !== 'published') return json(req, res, 404, { error: 'Tournament not found' });
      const voter = clean(req.headers['x-voter']).slice(0, 64);
      const key = voter.length >= 16 ? MM.voterKey(voter, cfg.adminToken || 'bat') : null;
      if (m === 'GET') return json(req, res, 200, { count: D.goingCount(db, id), mine: D.goingMine(db, id, key) }, { 'Cache-Control': 'no-store' });
      if (!key) return json(req, res, 400, { error: 'Your browser blocked this. Try again.' });
      if (t.date < D.todayIso()) return json(req, res, 400, { error: 'This tournament has already been played.' });
      if (limitedBy(joinHits, clientIp(req) + ':going', 40, 3_600_000)) return json(req, res, 429, { error: 'Too many taps from here. Try again later.' });
      const b = (await readJson(req, 500)) || {};
      return json(req, res, 200, { count: D.setGoing(db, id, key, !!b.going), mine: !!b.going }, { 'Cache-Control': 'no-store' });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/tournaments\/(\d+)\/flyer$/))) {
      const data = D.getFlyer(db, Number(x[1]));
      const mm = data && data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!mm) return json(req, res, 404, { error: 'No flyer' });
      return send(req, res, 200, Buffer.from(mm[2], 'base64'), { 'Content-Type': mm[1], 'Cache-Control': 'public, max-age=3600' });
    }
    if (m === 'POST' && p === '/api/tournaments') {
      if (limited(clientIp(req))) return json(req, res, 429, { error: 'Too many submissions. Try again in an hour.' });
      const body = await readJson(req);
      const v = validateSubmission(body);
      if (v.error) return json(req, res, 400, { error: v.error });
      // "Repeats weekly": one pending listing per week (up to 12 more), so each date gets its own page.
      const repeat = Math.max(0, Math.min(11, Number.parseInt(body?.repeatWeeks, 10) || 0));
      const ids = [];
      for (let k = 0; k <= repeat; k++) {
        const date = new Date(Date.parse(v.value.date + 'T00:00:00Z') + k * 7 * 864e5).toISOString().slice(0, 10);
        ids.push(D.createLocalTournament(db, { ...v.value, date }, v.flyer));
      }
      setImmediate(() => geocodePending(db, cfg, { fetchFn, log }).catch(() => {}));
      return json(req, res, 201, { id: ids[0], ids, count: ids.length, status: 'pending' });
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

    // ---- Money Matches ----
    if (m === 'GET' && p === '/api/money-matches') {
      const { upcoming, results } = MM.listPublic(db);
      return json(req, res, 200, { upcoming, results: results.slice(0, 100), spotlight: MM.spotlight(db) }, { 'Cache-Control': 'no-cache' });
    }
    if (m === 'POST' && p === '/api/money-matches/scan') {
      if (!cfg.anthropicKey) return json(req, res, 501, { error: 'Flyer reading is not set up on this site' });
      if (limited(clientIp(req) + ':scan')) return json(req, res, 429, { error: 'Too many flyers. Try again in an hour.' });
      const b = await readJson(req);
      if (!b || typeof b.image !== 'string' || b.image.length > 2_800_000) return json(req, res, 400, { error: 'Send a flyer image' });
      try { return json(req, res, 200, { fields: await readMoneyFlyer(b.image, cfg, { fetchFn }) }); }
      catch (e) { return json(req, res, 502, { error: e.message }); }
    }
    if (m === 'POST' && p === '/api/money-matches') {
      const isAdmin = tokenOk(req, cfg.adminToken);
      if (!isAdmin && limitedBy(joinHits, clientIp(req) + ':mmpost', 5, 3_600_000)) return json(req, res, 429, { error: 'Too many posts. Try again in an hour.' });
      const v = MM.validate(await readJson(req, 3_500_000));
      if (v.error) return json(req, res, 400, { error: v.error });
      const id = MM.create(db, v.value, v.flyer, { status: isAdmin ? 'published' : 'pending' });
      log(`money match ${id} posted${isAdmin ? ' by admin' : ' (pending review)'}`);
      const mm = MM.get(db, id);
      return json(req, res, 201, { id, status: mm.status, path: mm.path });
    }
    if ((x = p.match(/^\/api\/money-matches\/(\d+)(\/[a-z]+)?$/))) {
      const id = Number(x[1]), rest = x[2] || '';
      const isAdmin = tokenOk(req, cfg.adminToken);
      const mm = MM.get(db, id, { admin: isAdmin });
      if (!mm || (mm.status !== 'published' && !isAdmin)) return json(req, res, 404, { error: 'Match not found' });
      const voter = clean(req.headers['x-voter']).slice(0, 64);
      const key = voter.length >= 16 ? MM.voterKey(voter, cfg.adminToken || 'bat') : null;
      if (m === 'GET' && rest === '') return json(req, res, 200, { match: mm, tally: MM.tally(db, id), myPick: MM.myPick(db, id, key), comments: MM.listComments(db, id), stakes: MM.linkedStakes(db, id) }, { 'Cache-Control': 'no-store' });
      if (m === 'POST' && rest === '/vote') {
        if (!key) return json(req, res, 400, { error: 'Your browser blocked voting. Try again.' });
        if (limitedBy(joinHits, clientIp(req) + ':mmvote', 60, 3_600_000)) return json(req, res, 429, { error: 'Too many votes from here. Try again later.' });
        const b = (await readJson(req, 2000)) || {};
        const r = MM.vote(db, id, key, Number(b.pick));
        return json(req, res, r.status, r.error ? { error: r.error } : { ok: true, tally: MM.tally(db, id), myPick: Number(b.pick) });
      }
      if (m === 'POST' && rest === '/comment') {
        if (limitedBy(joinHits, clientIp(req) + ':mmcomment', 30, 3_600_000)) return json(req, res, 429, { error: 'Too many comments. Try again later.' });
        if (limitedBy(fastHits, clientIp(req) + ':mmc', 1, 5000)) return json(req, res, 429, { error: 'Slow down a little' });
        const r = MM.addComment(db, id, await readJson(req, 4000));
        return json(req, res, r.status, r.error ? { error: r.error } : { ok: true, comments: MM.listComments(db, id) });
      }
      return json(req, res, 404, { error: 'Not found' });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/money-matches\/(\d+)\/comments\/(\d+)\/delete$/))) {
      if (!tokenOk(req, cfg.adminToken)) return json(req, res, 403, { error: 'Only the site admin can delete comments' });
      return json(req, res, 200, { ok: MM.deleteComment(db, Number(x[1]), Number(x[2])), comments: MM.listComments(db, Number(x[1])) });
    }

    // ---- Match Finder ----
    if (m === 'GET' && p === '/api/matches') return json(req, res, 200, { posts: M.listOpen(db) }, { 'Cache-Control': 'no-store' });
    if (m === 'POST' && p === '/api/matches') {
      if (limitedBy(joinHits, clientIp(req) + ':match', 6, 3_600_000)) return json(req, res, 429, { error: 'Too many posts. Try again in an hour.' });
      const v = M.validatePost(await readJson(req, 10_000));
      if (v.error) return json(req, res, 400, { error: v.error });
      return json(req, res, 201, M.createPost(db, v.value));
    }
    if (m === 'POST' && (x = p.match(/^\/api\/matches\/(\d+)\/comments\/(\d+)\/delete$/))) {
      const id = Number(x[1]);
      if (!tokenOk(req, cfg.adminToken)) return json(req, res, 403, { error: 'Only the site admin can delete comments' });
      return json(req, res, 200, { ok: M.deleteComment(db, id, Number(x[2])), comments: M.listComments(db, id) });
    }
    if ((x = p.match(/^\/api\/matches\/(\d+)(\/[a-z]+)?$/))) {
      const id = Number(x[1]), rest = x[2] || '';
      const mine = tokenOk(req, cfg.adminToken) || M.canManage(db, id, req.headers['x-manage-key']);
      if (m === 'GET' && rest === '') {
        const post = M.getPost(db, id, { withReplies: mine });
        if (!post || (post.status === 'archived' && !mine)) return json(req, res, 404, { error: 'This post was deleted' });
        return json(req, res, 200, { ...post, comments: M.listComments(db, id), canManage: mine }, { 'Cache-Control': 'no-store' });
      }
      if (m === 'POST' && rest === '/reply') {
        if (limitedBy(joinHits, clientIp(req) + ':mreply', 20, 3_600_000)) return json(req, res, 429, { error: 'Too many replies. Try again later.' });
        const r = M.reply(db, id, await readJson(req, 4000));
        return json(req, res, r.status, r.error ? { error: r.error } : r);
      }
      if (m === 'POST' && rest === '/comment') {
        if (limitedBy(joinHits, clientIp(req) + ':mcomment', 30, 3_600_000)) return json(req, res, 429, { error: 'Too many comments. Try again later.' });
        if (limitedBy(fastHits, clientIp(req) + ':mc', 1, 5000)) return json(req, res, 429, { error: 'Slow down a little' });
        const r = M.addComment(db, id, await readJson(req, 4000));
        return json(req, res, r.status, r.error ? { error: r.error } : { ok: true, id: r.id, comments: M.listComments(db, id) });
      }
      if (m === 'POST' && rest === '/delete') {
        if (!mine) return json(req, res, 403, { error: 'Only the person who posted can delete this' });
        const by = tokenOk(req, cfg.adminToken) ? 'admin' : 'poster';
        const ok = M.archive(db, id, by);
        log(`match post ${id} deleted by ${by}`);
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Already deleted' });
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
      if (m === 'GET' && p === '/api/admin/money-matches') return json(req, res, 200, { matches: MM.adminList(db) });
      if ((x = p.match(/^\/api\/admin\/money-matches\/(\d+)$/)) && m === 'PUT') {
        const v = MM.validate(await readJson(req, 3_500_000));
        if (v.error) return json(req, res, 400, { error: v.error });
        return MM.update(db, Number(x[1]), v.value, v.flyer) ? json(req, res, 200, { ok: true, match: MM.get(db, Number(x[1])) }) : json(req, res, 404, { error: 'Match not found' });
      }
      if ((x = p.match(/^\/api\/admin\/money-matches\/(\d+)\/(publish|feature|unfeature|result|archive|repost|purge)$/)) && m === 'POST') {
        const id = Number(x[1]), act = x[2];
        const r = act === 'publish' ? MM.publish(db, id) : act === 'feature' ? MM.setFeatured(db, id, true) : act === 'unfeature' ? MM.setFeatured(db, id, false)
          : act === 'result' ? MM.setResult(db, id, (await readJson(req, 2000)) || {}) : act === 'archive' ? MM.archive(db, id) : act === 'repost' ? MM.repost(db, id) : MM.purge(db, id);
        if (r && r.error) return json(req, res, 400, { error: r.error });
        log(`money match ${id} ${act} by admin: ${r ? 'ok' : 'failed'}`);
        return json(req, res, r ? 200 : 400, r ? { ok: true } : { error: 'Could not do that' });
      }
      if (m === 'GET' && p === '/api/admin/matches') return json(req, res, 200, { posts: M.adminList(db) });
      if ((x = p.match(/^\/api\/admin\/matches\/(\d+)\/(archive|repost|purge)$/)) && m === 'POST') {
        const id = Number(x[1]);
        const ok = x[2] === 'archive' ? M.archive(db, id, 'admin') : x[2] === 'repost' ? M.repost(db, id) : M.purge(db, id);
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
      if (m === 'GET' && p === '/api/admin/going') return json(req, res, 200, { top: D.goingTop(db) }, { 'Cache-Control': 'no-store' });
      if (m === 'GET' && p === '/api/admin/pageviews') {
        flushPageviews();
        const traffic = D.visitBreakdown(db);
        traffic.pages = traffic.pages.map(r => ({ ...r, label: PAGES[r.page] || r.page }));
        return json(req, res, 200, { ...D.pageviewCounts(db), traffic });
      }
      if (m === 'GET' && p === '/api/admin/subscribers') return json(req, res, 200, { subscribers: D.listSubscribers(db) }, { 'Cache-Control': 'no-store' });
      if (m === 'POST' && p === '/api/admin/subscribers/remove') {
        const b = (await readJson(req)) || {};
        const ok = D.removeSubscriber(db, b.email);
        if (ok) log('subscriber removed by admin');
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'That email is not on the list' });
      }
      if (m === 'GET' && p === '/api/admin/newsletter') { SEO.ensureFooter(db); return json(req, res, 200, buildNewsletter(db, cfg), { 'Cache-Control': 'no-store' }); }
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
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/og\/list\/(tonight|weekend|big)\/\d{4}-\d{2}-\d{2}(?:\/([a-z-]{2,40}))?\.png$/))) {
      const txt = SEO.listCardText(db, x[1], x[2]);
      if (!txt) return send(req, res, 404, cachedCard('site', () => renderSiteShareCard(host)), { 'Content-Type': 'image/png' });
      const png = cachedCard(`list|${txt.headline}|${txt.sub}`, () => renderHeadlineCard(txt.headline, txt.sub, host));
      return send(req, res, 200, png, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/og\/(guides|trick-shots)\/([a-z0-9-]{2,80})\.png$/))) {
      const item = x[1] === 'guides' ? GU.GUIDES.find(g => g.slug === x[2]) : TS.SHOTS.find(t => t.slug === x[2]);
      if (!item) return send(req, res, 404, cachedCard('site', () => renderSiteShareCard(host)), { 'Content-Type': 'image/png' });
      const title = item.title.replace(/\s*\(.*?\)\s*$/, '').split(':')[0].length > 18 ? item.title.split(':')[0] : item.title.replace(/\s*\(.*?\)\s*$/, '');
      const png = cachedCard(`page|${x[1]}|${x[2]}`, () => renderHeadlineCard(title, x[1] === 'guides' ? 'Free pool guide' : 'Pool trick shot · step by step', host));
      return send(req, res, 200, png, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    }
    if ((m === 'GET' || m === 'HEAD') && p === '/og.png') {
      return send(req, res, 200, cachedCard('site', () => renderSiteShareCard(host)), { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tournaments\/([a-z-]{2,40})\/calendar\.ics$/))) {
      const out = SEO.stateIcs(cfg, db, x[1]);
      if (!out) return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(req, res, 200, out, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/embed\/venue\/(\d+)$/))) {
      const out = SEO.venueEmbed(cfg, db, Number(x[1]), url.searchParams.get('theme') === 'dark');
      const embedHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=1800', 'X-Frame-Options': null, 'X-Robots-Tag': 'noindex',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors *; base-uri 'none'; form-action 'none'" };
      return send(req, res, out ? 200 : 404, out || 'Not found', embedHeaders);
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/venue\/(\d+)\/poster\/?$/))) {
      const out = SEO.venuePoster(cfg, db, Number(x[1]));
      if (!out) return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      trackVisit(req, 'venue-poster');
      return send(req, res, 200, out, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=1800' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/venue\/(\d+)\/calendar\.ics$/))) {
      const out = SEO.venueIcs(cfg, db, Number(x[1]));
      if (!out) return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(req, res, 200, out, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/t\/(\d+)\/event\.ics$/))) {
      const t = D.getTournament(db, Number(x[1]));
      if (!t) return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(req, res, 200, SEO.tournamentIcs(cfg, db, t), { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="tournament-${t.id}.ics"`, 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' });
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
    const notFoundPage = () => { SEO.ensureFooter(db); return html(404, SEO.listingPage(db, cfg, []).replace('<h1>Pool Tournaments by State</h1>', `<h1>Page not found</h1><p>That page moved or never existed. Try a search, or jump to one of these:</p>
      <form action="/search" method="get" role="search" style="display:flex;max-width:460px;margin:12px 0"><input type="search" name="q" placeholder="Search city, room, game…" aria-label="Search tournaments" style="flex:1;min-width:0;padding:10px 12px;font-size:16px;border:1px solid var(--line);border-radius:8px 0 0 8px"><button type="submit" class="btn btn-blue" style="border-radius:0 8px 8px 0">Search</button></form>
      <div class="actbar"><a class="btn btn-gold" href="/tonight/">Tonight</a><a class="btn btn-out" href="/this-weekend/">This Weekend</a><a class="btn btn-out" href="/pool-halls/">Pool Halls</a><a class="btn btn-out" href="/guides/">Guides</a></div>`).replace('<meta name="robots"', '<meta name="x-ignore"').replace('</title>', '</title><meta name="robots" content="noindex">')); };
    // Links built from a missing value ("…/null", "…/undefined") were being crawled: send them to the page above.
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^(.*?)\/(?:null|undefined)\/?$/))) return moved(x[1] === '/tournament' ? '/tournaments/' : x[1] || '/');
    if ((m === 'GET' || m === 'HEAD') && (p === '/tournament' || p === '/tournament/')) return moved('/tournaments/');
    if ((m === 'GET' || m === 'HEAD') && (p === '/directors' || p === '/directors/')) { if (p === '/directors') return moved('/directors/'); SEO.ensureFooter(db); trackVisit(req, 'directors'); return html(200, TL.directorsPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/pool-halls' || p === '/pool-halls/')) { if (p === '/pool-halls') return moved('/pool-halls/'); SEO.ensureFooter(db); trackVisit(req, 'halls'); return html(200, SEO.poolHallsIndexPage(db, cfg), { 'Cache-Control': 'public, max-age=1800' }); }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/pool-halls\/([a-z-]{2,40})(\/)?$/))) {
      if (!x[2]) return moved(`/pool-halls/${x[1]}/`);
      SEO.ensureFooter(db);
      const out = SEO.poolHallsStatePage(db, cfg, x[1]);
      if (!out) return notFoundPage();
      trackVisit(req, 'halls-state');
      return html(200, out, { 'Cache-Control': 'public, max-age=1800' });
    }
    if ((m === 'GET' || m === 'HEAD') && (p === '/new' || p === '/new/')) { if (p === '/new') return moved('/new/'); SEO.ensureFooter(db); trackVisit(req, 'new-page'); return html(200, SEO.newTournamentsPage(db, cfg), { 'Cache-Control': 'public, max-age=600' }); }
    if ((m === 'GET' || m === 'HEAD') && p === '/feed.xml') return send(req, res, 200, SEO.rssFeed(db, cfg), { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' });
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tonight(?:\/([a-z-]{2,40}))?(\/)?$/))) {
      if (!x[2]) return moved(`/tonight/${x[1] ? x[1] + '/' : ''}`);
      SEO.ensureFooter(db);
      const out = SEO.tonightPage(db, cfg, x[1]);
      if (!out) return notFoundPage();
      trackVisit(req, 'tonight-page');
      return html(200, out, { 'Cache-Control': 'public, max-age=600' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/this-weekend(?:\/([a-z-]{2,40}))?(\/)?$/))) {
      if (!x[2]) return moved(`/this-weekend/${x[1] ? x[1] + '/' : ''}`);
      SEO.ensureFooter(db);
      const out = SEO.weekendPage(db, cfg, x[1]);
      if (!out) return notFoundPage();
      trackVisit(req, 'weekend-page');
      return html(200, out, { 'Cache-Control': 'public, max-age=600' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tournament\/([a-z0-9-]{3,220})\/?$/))) {
      SEO.ensureFooter(db);
      const t = SEO.findTournamentBySlug(db, x[1]);
      if (!t) { const to = SEO.fallbackForSlug(db, x[1]); return to ? moved(to) : notFoundPage(); }
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
    // ---- Money Match pages, flyers, calendar files and share graphics ----
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/money-match-flyer\/(\d+)\.img$/))) {
      const mm = String(MM.getFlyer(db, Number(x[1])) || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!mm) return send(req, res, 404, 'No flyer', { 'Content-Type': 'text/plain' });
      return send(req, res, 200, Buffer.from(mm[2], 'base64'), { 'Content-Type': mm[1], 'Cache-Control': 'public, max-age=86400' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/money-match\/(\d+)\/card-(og|square|story)\.png$/))) {
      const mm = MM.get(db, Number(x[1]));
      if (!mm || mm.status !== 'published') return send(req, res, 404, cachedCard('site', () => renderSiteShareCard(host)), { 'Content-Type': 'image/png' });
      const format = { og: 'landscape', square: 'square', story: 'story' }[x[2]];
      const png = cachedCard(`mm${mm.id}|${format}|${mm.updatedAt}`, () => renderShareCard(mm, format, host, moneyMatchContent(mm)));
      const dl = url.searchParams.has('download') ? { 'Content-Disposition': `attachment; filename="money-match-${mm.id}-${format}.png"` } : {};
      return send(req, res, 200, png, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', ...dl });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/money-match\/(\d+)\.ics$/))) {
      const mm = MM.get(db, Number(x[1]));
      if (!mm || mm.status !== 'published') return notFoundPage();
      return send(req, res, 200, MP.ics(cfg, mm), { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="money-match-${mm.id}.ics"` });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/money-match\/([a-z0-9-]{3,200})\/?$/))) {
      SEO.ensureFooter(db);
      const mm = MM.getBySlug(db, x[1]);
      if (!mm || mm.status !== 'published') return notFoundPage();
      trackVisit(req, 'money-page');
      return html(200, MP.matchPage(cfg, mm, { tally: MM.tally(db, mm.id), comments: MM.listComments(db, mm.id), stakes: MM.linkedStakes(db, mm.id) }), { 'Cache-Control': 'no-cache' });
    }
    if ((m === 'GET' || m === 'HEAD') && (p === '/money-matches' || p === '/money-matches/')) {
      if (p === '/money-matches') return moved('/money-matches/');
      SEO.ensureFooter(db);
      trackVisit(req, 'money-hub');
      return html(200, MP.hubPage(cfg, MM.listPublic(db)), { 'Cache-Control': 'no-cache' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/money-matches\/player\/([a-z0-9-]{1,120})\/?$/))) {
      SEO.ensureFooter(db);
      const r = MM.playerMatches(db, x[1]);
      if (!r.name) return notFoundPage();
      trackVisit(req, 'money-player');
      return html(200, MP.playerPage(cfg, x[1], r.name, r.matches));
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/match\/(\d+)\/?$/))) {   // shareable Match Finder post
      SEO.ensureFooter(db);
      const post = M.getPost(db, Number(x[1]));
      if (!post || post.status === 'archived') return notFoundPage();
      trackVisit(req, 'match-page');
      return html(200, SEO.matchPage(cfg, post, M.listComments(db, post.id)), { 'Cache-Control': 'public, max-age=60' });
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
    if (m === 'GET' && p === '/sitemap.xml') return send(req, res, 200, SEO.sitemapXml(db, cfg, (() => {
      const { upcoming, results } = MM.listPublic(db), all = [...upcoming, ...results];
      const players = new Set(all.flatMap(mm => [MM.playerSlug(mm.player1), MM.playerSlug(mm.player2)]).filter(Boolean));
      return [{ path: '/guides/', pri: '0.8' }, ...GU.GUIDES.map(g => ({ path: `/guides/${g.slug}`, pri: '0.7' })), { path: '/tools/', pri: '0.8' }, ...TL.TOOLS.map(t => ({ path: `/tools/${t.slug}`, pri: '0.8' })), { path: '/tools/brackets/', pri: '0.8' }, { path: '/directors/', pri: '0.8' }, { path: '/trick-shots/', pri: '0.8' }, ...TS.SHOTS.map(t => ({ path: `/trick-shots/${t.slug}`, pri: '0.7' })), { path: '/play/', pri: '0.6' }, { path: '/play/aim-trainer', pri: '0.8' }, { path: '/play/bank-trainer', pri: '0.7' }, { path: '/play/kick-trainer', pri: '0.7' }, { path: '/play/lag-challenge', pri: '0.7' }, { path: '/play/which-game', pri: '0.6' }, { path: '/play/practice-log', pri: '0.6' }, ...BR.BRACKET_SIZES.map(n => ({ path: `/tools/brackets/${n}`, pri: '0.7' })), { path: '/about', pri: '0.5' }, { path: '/contact', pri: '0.4' },
        { path: '/money-matches/', pri: '0.8' }, ...all.map(mm => ({ path: mm.path, lastmod: mm.updatedAt.slice(0, 10), pri: mm.upcoming ? '0.7' : '0.4' })),
        ...[...players].map(s => ({ path: `/money-matches/player/${s}`, pri: '0.4' }))];
    })()), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    if (m === 'GET' && p === '/ads.txt' && !fs.existsSync(path.join(PUBLIC_DIR, 'ads.txt'))) {  // public/ads.txt wins when present
      const txt = SEO.adsTxt(cfg);
      return txt ? send(req, res, 200, txt, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }) : json(req, res, 404, { error: 'Not found' });
    }
    if ((m === 'GET' || m === 'HEAD') && (p === '/guides' || p === '/guides/')) { if (p === '/guides') return moved('/guides/'); SEO.ensureFooter(db); trackVisit(req, 'guides'); return html(200, GU.guidesIndexPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/guides\/([a-z0-9-]{2,80})\/?$/))) {
      SEO.ensureFooter(db);
      const GAME_OF = { '8-ball-rules': '8-Ball', '9-ball-rules': '9-Ball', '10-ball-rules': '10-Ball', 'one-pocket': 'One Pocket', 'scotch-doubles': 'Scotch Doubles', 'bank-pool-rules': 'Banks', 'straight-pool-rules': 'Straight Pool', '8-ball-patterns': '8-Ball', '9-ball-strategy': '9-Ball', 'bar-rules-vs-tournament-rules': '8-Ball' };
      const out = GU.guidePage(cfg, x[1], GAME_OF[x[1]] ? SEO.upcomingGameHtml(db, GAME_OF[x[1]]) : SEO.tonightCta(db));
      if (!out) return notFoundPage();
      trackVisit(req, 'guide');
      return html(200, out);
    }
    if ((m === 'GET' || m === 'HEAD') && (p === '/big-tournaments' || p === '/big-tournaments/')) { if (p === '/big-tournaments') return moved('/big-tournaments/'); SEO.ensureFooter(db); trackVisit(req, 'big-page'); return html(200, SEO.bigTournamentsPage(db, cfg), { 'Cache-Control': 'public, max-age=600' }); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/tools' || p === '/tools/')) { if (p === '/tools') return moved('/tools/'); SEO.ensureFooter(db); trackVisit(req, 'tools'); return html(200, TL.toolsIndexPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/trick-shots' || p === '/trick-shots/')) { if (p === '/trick-shots') return moved('/trick-shots/'); SEO.ensureFooter(db); trackVisit(req, 'trick-shots'); return html(200, TS.trickShotsIndexPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/trick-shots\/([a-z0-9-]{2,80})\/?$/))) {
      SEO.ensureFooter(db);
      const out = TS.trickShotPage(cfg, x[1])?.replace('</article>\n  <section class="sec seo-sec"><h2>Next shot</h2>', '</article>' + SEO.tonightCta(db) + '\n  <section class="sec seo-sec"><h2>Next shot</h2>');
      if (!out) return notFoundPage();
      trackVisit(req, 'trick-shot');
      return html(200, out);
    }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play' || p === '/play/')) { if (p === '/play') return moved('/play/'); SEO.ensureFooter(db); trackVisit(req, 'play'); return html(200, PL.playIndexPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play/practice-log' || p === '/play/practice-log/')) { SEO.ensureFooter(db); trackVisit(req, 'practice-log'); return html(200, PL.practiceLogPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play/which-game' || p === '/play/which-game/')) { SEO.ensureFooter(db); trackVisit(req, 'which-game'); return html(200, PL.whichGamePage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play/lag-challenge' || p === '/play/lag-challenge/')) { SEO.ensureFooter(db); trackVisit(req, 'lag-challenge'); return html(200, PL.lagChallengePage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play/kick-trainer' || p === '/play/kick-trainer/')) { SEO.ensureFooter(db); trackVisit(req, 'kick-trainer'); return html(200, PL.kickTrainerPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play/bank-trainer' || p === '/play/bank-trainer/')) { SEO.ensureFooter(db); trackVisit(req, 'bank-trainer'); return html(200, PL.bankTrainerPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/play/aim-trainer' || p === '/play/aim-trainer/')) { SEO.ensureFooter(db); trackVisit(req, 'aim-trainer'); return html(200, PL.aimTrainerPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/tools/brackets' || p === '/tools/brackets/')) { if (p === '/tools/brackets') return moved('/tools/brackets/'); SEO.ensureFooter(db); trackVisit(req, 'brackets'); return html(200, BR.bracketsIndexPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tools\/brackets\/(\d{1,3})\/?$/))) {
      SEO.ensureFooter(db);
      const out = BR.bracketPage(cfg, x[1]);
      if (!out) return notFoundPage();
      trackVisit(req, 'bracket');
      return html(200, out, { 'Cache-Control': 'public, max-age=3600' });
    }
    if ((m === 'GET' || m === 'HEAD') && (x = p.match(/^\/tools\/([a-z0-9-]{2,80})\/?$/))) {
      SEO.ensureFooter(db);
      const out = TL.toolPage(cfg, x[1]);
      if (!out) return notFoundPage();
      trackVisit(req, 'tool');
      return html(200, out);
    }
    if ((m === 'GET' || m === 'HEAD') && (p === '/about' || p === '/about/')) { SEO.ensureFooter(db); trackVisit(req, 'about'); return html(200, GU.aboutPage(cfg)); }
    if ((m === 'GET' || m === 'HEAD') && (p === '/contact' || p === '/contact/')) { SEO.ensureFooter(db); trackVisit(req, 'contact'); return html(200, GU.contactPage(cfg)); }
    if (m === 'GET' && (p === '/privacy' || p === '/privacy/')) { SEO.ensureFooter(db); return send(req, res, 200, SEO.privacyPage(cfg), { 'Content-Type': 'text/html; charset=utf-8' }); }
    // Lets Chrome prefetch our pages from Google results through its privacy proxy, so clicks open faster.
    if (m === 'GET' && p === '/.well-known/traffic-advice') return send(req, res, 200, JSON.stringify([{ user_agent: 'prefetch-proxy', google_prefetch_proxy_eap: { fraction: 1.0 } }]), { 'Content-Type': 'application/trafficadvice+json', 'Cache-Control': 'public, max-age=86400' });
    // Phones and browsers ask for these at the site root regardless of the page's link tags.
    if ((m === 'GET' || m === 'HEAD') && (p === '/apple-touch-icon.png' || p === '/apple-touch-icon-precomposed.png')) return moved('/icons/apple-touch-icon.png');
    if (m === 'GET' && p === '/robots.txt') return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${cfg.publicUrl}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });

    const appPage = (m === 'GET' || m === 'HEAD') ? appPageFor(p) : null;
    if (appPage) {
      if (m === 'GET') trackVisit(req);
      return send(req, res, 200, shellHtml(appPage), { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
    }
    if (m === 'GET' || m === 'HEAD') {
      const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
      const file = path.resolve(PUBLIC_DIR, rel);
      if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        if (rel === 'index.html' && m === 'GET') trackVisit(req);
        let body = fs.readFileSync(file);
        // Crawlable links to the state/city/game pages, so search engines can find them from the home page.
        if (rel === 'index.html') body = Buffer.from(shellHtml(null));
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
