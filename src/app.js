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
import { renderSiteCard, renderTournamentCard } from './ogcard.js';

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

// ---- server-rendered tournament page (for search engines and link previews) ----
function tournamentPage(t, base) {
  const v = t.venue, where = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ');
  const money = n => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
  const desc = `${t.game} tournament at ${v.name} in ${v.city}, ${v.state} on ${t.date}${t.entry != null ? `. ${money(t.entry)} entry` : ''}${t.added ? `, ${money(t.added)} added` : ''}.`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'SportsEvent', name: t.name, startDate: t.time ? `${t.date}T${t.time}` : t.date,
    eventStatus: 'https://schema.org/EventScheduled', sport: 'Pool',
    location: { '@type': 'Place', name: v.name, address: { '@type': 'PostalAddress', streetAddress: v.address || undefined, addressLocality: v.city, addressRegion: v.state, postalCode: v.zip || undefined, addressCountry: 'US' } },
    ...(t.entry != null ? { offers: { '@type': 'Offer', price: t.entry, priceCurrency: 'USD' } } : {})
  };
  const rows = [['Date', t.date + (t.time ? ' at ' + t.time : '')], ['Venue', `${v.name}, ${where}`], ['Game', t.game], ['Entry', money(t.entry)], ['Added money', money(t.added)], ['Race', t.race], ['Format', t.format], ['Table Size', t.tableSize], ['Player/Team Limit', t.limit]]
    .filter(r => r[1]).map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.name)} | ${esc(v.city)}, ${esc(v.state)} ${esc(t.game)} Tournament</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base)}/t/${t.id}"><meta property="og:title" content="${esc(t.name)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:image" content="${esc(base)}/t/${t.id}/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(base)}/t/${t.id}/og.png">
<link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script></head>
<body><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a></div></header>
<main class="wrap page"><div class="card"><h1 class="dtitle">${esc(t.name)}</h1><p class="muted">${esc(desc)}</p><table class="t"><tbody>${rows}</tbody></table>
<p style="margin-top:16px"><a class="btn btn-blue" href="/#/t/${t.id}">Open full details</a></p></div></main></body></html>`;
}

function venuePage(v, tournaments, base) {
  const where = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ');
  const desc = `Upcoming pool tournaments at ${v.name} in ${v.city}, ${v.state}.`;
  const rows = tournaments.map(t => `<tr><td><a href="/t/${t.id}">${esc(t.name)}</a></td><td>${esc(t.date)}${t.time ? ' ' + esc(t.time) : ''}</td><td>${esc(t.game)}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(v.name)} | ${esc(v.city)}, ${esc(v.state)} Pool Tournaments</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base)}/venue/${v.id}"><meta property="og:title" content="${esc(v.name)}"><meta property="og:description" content="${esc(desc)}">
<link rel="stylesheet" href="/styles.css"></head>
<body><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a></div></header>
<main class="wrap page"><div class="card"><h1 class="dtitle">${esc(v.name)}</h1><p class="muted">${esc(where)}</p>
${rows ? `<table class="t"><thead><tr><th>Tournament</th><th>Date</th><th>Game</th></tr></thead><tbody>${rows}</tbody></table>`
  : `<p class="muted">No upcoming tournaments listed right now.</p>`}
<p style="margin-top:16px"><a class="btn btn-blue" href="/#/venue/${v.id}">Open full details</a></p></div></main></body></html>`;
}

function statePage(code, name, tournaments, base) {
  const desc = `${tournaments.length} upcoming pool tournament${tournaments.length === 1 ? '' : 's'} in ${name}. Browse dates, venues, entry fees and games.`;
  const rows = tournaments.map(t => `<tr><td><a href="/t/${t.id}">${esc(t.name)}</a></td><td>${esc(t.date)}</td><td>${esc(t.venue.name)}, ${esc(t.venue.city)}</td><td>${esc(t.game)}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pool Tournaments in ${esc(name)} | Billiard Action Time</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base)}/state/${esc(code.toLowerCase())}"><meta property="og:title" content="Pool Tournaments in ${esc(name)}"><meta property="og:description" content="${esc(desc)}">
<link rel="stylesheet" href="/styles.css"></head>
<body><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a></div></header>
<main class="wrap page"><div class="card"><h1 class="dtitle">Pool Tournaments in ${esc(name)}</h1><p class="muted">${esc(desc)}</p>
${rows ? `<table class="t"><thead><tr><th>Tournament</th><th>Date</th><th>Venue</th><th>Game</th></tr></thead><tbody>${rows}</tbody></table>`
  : `<p class="muted">No tournaments posted in ${esc(name)} yet. <a href="/#/post">Be the first to post one</a>.</p>`}
<p style="margin-top:16px"><a class="btn btn-blue" href="/#/search?state=${esc(code)}">Open full search &amp; filters</a></p></div></main></body></html>`;
}

function statesIndexPage(counts, base) {
  const rows = statesList().map(s => `<li><a href="/state/${s.code.toLowerCase()}">${esc(s.name)}</a> <span class="muted">(${counts.get(s.code) || 0})</span></li>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Browse Pool Tournaments by State | Billiard Action Time</title><meta name="description" content="Find pool tournaments by state across the US.">
<link rel="canonical" href="${esc(base)}/state/"><link rel="stylesheet" href="/styles.css"></head>
<body><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a></div></header>
<main class="wrap page"><div class="card"><h1 class="dtitle">Browse Pool Tournaments by State</h1>
<ul class="statelist">${rows}</ul></div></main></body></html>`;
}

// ---- the server ------------------------------------------------------------
export function createApp(db, cfg, { fetchFn = fetch, log = () => {} } = {}) {
  const hits = new Map();
  const limited = ip => {
    const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3_600_000);
    if (list.length >= 10) { hits.set(ip, list); return true; }
    list.push(now); hits.set(ip, list); return false;
  };
  const clientIp = req => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
  const admin = req => { if (!tokenOk(req, cfg.adminToken)) throw new HttpError(cfg.adminToken ? 401 : 403, cfg.adminToken ? 'Invalid admin token' : 'Admin is disabled until ADMIN_TOKEN is set'); };
  // Privacy-friendly visit counter: hashes IP+day+secret, so nothing identifying is stored
  // and the same person only counts once per day.
  function trackVisit(req) {
    try {
      const day = D.todayIso();
      const visitor = sha(clientIp(req) + '|' + day + '|' + (cfg.adminToken || 'bat-salt')).toString('hex').slice(0, 32);
      D.recordPageview(db, day, visitor);
    } catch {}
  }

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
    if (m === 'GET' && (x = p.match(/^\/api\/tournaments\/(\d+)$/))) {
      const t = D.getTournament(db, Number(x[1]));
      return t ? json(req, res, 200, t) : json(req, res, 404, { error: 'Tournament not found' });
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

    if (p.startsWith('/api/admin/')) {
      admin(req);
      if (m === 'GET' && p === '/api/admin/summary') return json(req, res, 200, D.summary(db));
      if (m === 'GET' && p === '/api/admin/pageviews') return json(req, res, 200, D.pageviewCounts(db));
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

    if (m === 'GET' && p === '/og.png') {
      return send(req, res, 200, renderSiteCard(), { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    }
    if (m === 'GET' && (x = p.match(/^\/t\/(\d+)\/og\.png$/))) {
      const t = D.getTournament(db, Number(x[1]));
      if (!t) return send(req, res, 404, renderSiteCard(), { 'Content-Type': 'image/png' });
      const card = renderTournamentCard({ name: t.name, game: t.game, date: t.date, venue: t.venue?.name, city: t.venue?.city, state: t.venue?.state });
      return send(req, res, 200, card, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    }
    if (m === 'GET' && (x = p.match(/^\/t\/(\d+)$/))) {
      trackVisit(req);
      const t = D.getTournament(db, Number(x[1]));
      return t ? send(req, res, 200, tournamentPage(t, cfg.publicUrl), { 'Content-Type': 'text/html; charset=utf-8' })
        : send(req, res, 404, '<h1>Tournament not found</h1>', { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (m === 'GET' && (x = p.match(/^\/venue\/(\d+)$/))) {
      trackVisit(req);
      const all = D.listTournaments(db, { limit: 50000 }).filter(t => t.status === 'published' && Number(t.venue.id) === Number(x[1]));
      if (!all.length) return send(req, res, 404, '<h1>Venue not found</h1>', { 'Content-Type': 'text/html; charset=utf-8' });
      return send(req, res, 200, venuePage(all[0].venue, all, cfg.publicUrl), { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (m === 'GET' && (x = p.match(/^\/state\/([a-zA-Z]{2})\/?$/))) {
      trackVisit(req);
      const code = normalizeState(x[1]);
      if (!code) return send(req, res, 404, '<h1>State not found</h1>', { 'Content-Type': 'text/html; charset=utf-8' });
      const name = statesList().find(s => s.code === code)?.name || code;
      const all = D.listTournaments(db, { limit: 50000, state: code }).filter(t => t.status === 'published');
      return send(req, res, 200, statePage(code, name, all, cfg.publicUrl), { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (m === 'GET' && (p === '/state' || p === '/state/')) {
      trackVisit(req);
      const published = D.listTournaments(db, { limit: 50000 }).filter(t => t.status === 'published');
      const counts = new Map();
      for (const t of published) counts.set(t.venue.state, (counts.get(t.venue.state) || 0) + 1);
      return send(req, res, 200, statesIndexPage(counts, cfg.publicUrl), { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (m === 'GET' && p === '/sitemap.xml') {
      const published = D.listTournaments(db, { limit: 50000 }).filter(t => t.status === 'published');
      const tUrls = published.map(t => `<url><loc>${esc(cfg.publicUrl)}/t/${t.id}</loc><lastmod>${esc((t.updatedAt || '').slice(0, 10))}</lastmod></url>`).join('');
      const venueIds = new Map();
      for (const t of published) if (!venueIds.has(t.venue.id)) venueIds.set(t.venue.id, t.updatedAt);
      const vUrls = [...venueIds.entries()].map(([id, updatedAt]) => `<url><loc>${esc(cfg.publicUrl)}/venue/${id}</loc><lastmod>${esc((updatedAt || '').slice(0, 10))}</lastmod></url>`).join('');
      const stateCodes = new Set(published.map(t => t.venue.state).filter(Boolean));
      const sUrls = [...stateCodes].map(code => `<url><loc>${esc(cfg.publicUrl)}/state/${esc(code.toLowerCase())}</loc></url>`).join('');
      return send(req, res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(cfg.publicUrl)}/</loc></url><url><loc>${esc(cfg.publicUrl)}/state/</loc></url>${sUrls}${tUrls}${vUrls}</urlset>`, { 'Content-Type': 'application/xml; charset=utf-8' });
    }
    if (m === 'GET' && p === '/robots.txt') return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${cfg.publicUrl}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });

    if (m === 'GET' || m === 'HEAD') {
      const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
      const file = path.resolve(PUBLIC_DIR, rel);
      if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        if (rel === 'index.html' && m === 'GET') trackVisit(req);
        return send(req, res, 200, fs.readFileSync(file), { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
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
  return server;
}
