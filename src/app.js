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
import { readFlyer, readMoneyMatchFlyer } from './scan.js';
import { placesPayload, citiesForState, statesList } from './places.js';
import { renderSiteCard, renderTournamentCard } from './ogcard.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
// script-src/frame-src/connect-src are widened (beyond just 'self') to let Google AdSense load its
// scripts and ad iframes -- without this the ads would silently fail to render under our strict CSP.
const CSP = "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "script-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.googletagservices.com https://adservice.google.com https://*.google.com; " +
  "frame-src https://googleads.g.doubleclick.net https://*.doubleclick.net https://*.googlesyndication.com https://www.google.com https://*.google.com; " +
  "connect-src 'self' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
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

function moneyMatchPage(m, comments, base) {
  const where = [m.room, m.address, m.city, m.state].filter(Boolean).join(', ');
  const desc = `${m.player1} vs ${m.player2}${m.stakes ? ` — ${m.stakes} on the line` : ''}. ${m.game}${m.race ? `, race to ${m.race}` : ''} on ${m.date}${m.city ? ` in ${m.city}, ${m.state}` : ''}.`;
  const total = m.votes1 + m.votes2;
  const pct = n => (total ? Math.round(n / total * 100) : 0);
  const resultLine = m.winner
    ? `<p class="dtitle" style="font-size:20px">🏆 ${esc(m.winner === 1 ? m.player1 : m.player2)} beat ${esc(m.winner === 1 ? m.player2 : m.player1)} ${m.score1}–${m.score2}</p>` : '';
  const commentRows = comments.map(c => `<div class="card" style="margin-bottom:10px"><b>${esc(c.name)}</b> <small class="muted">${esc((c.createdAt || '').slice(0, 16).replace('T', ' '))}</small><p style="margin:6px 0 0">${esc(c.body)}</p></div>`).join('')
    || '<p class="muted">No comments yet. Start the conversation.</p>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.player1)} vs ${esc(m.player2)} — Money Match | Billiard Action Time</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base)}${esc(m.path)}"><meta property="og:title" content="${esc(m.player1)} vs ${esc(m.player2)}"><meta property="og:description" content="${esc(desc)}">
${m.flyerUrl ? `<meta property="og:image" content="${esc(m.flyerUrl)}">` : ''}
<link rel="stylesheet" href="/styles.css"></head>
<body><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a></div></header>
<main class="wrap page"><div class="card">
<h1 class="dtitle">💰 ${esc(m.player1)} <em>vs</em> ${esc(m.player2)}</h1>
${resultLine}
<table class="t"><tbody>
<tr><th>Date</th><td>${esc(m.date)}${m.time ? ' at ' + esc(m.time) : ''}</td></tr>
<tr><th>Game</th><td>${esc(m.game)}${m.race ? ' · Race to ' + esc(m.race) : ''}</td></tr>
${m.stakes ? `<tr><th>On the Line</th><td>${esc(m.stakes)}</td></tr>` : ''}
${where ? `<tr><th>Where</th><td>${esc(where)}</td></tr>` : ''}
${m.streamUrl ? `<tr><th>Livestream</th><td><a href="${esc(m.streamUrl)}" target="_blank" rel="noopener">${esc(m.streamUrl)}</a></td></tr>` : ''}
</tbody></table>
${m.notes ? `<p>${esc(m.notes)}</p>` : ''}
<p class="stake-note">Billiard Action Time lists this match for fans. It never takes, holds or pays out money.</p>

<h2 id="vote" class="dtitle" style="font-size:20px;margin-top:20px">Who Ya Got?</h2>
<div class="actbar" id="mmVoteBar">
  <button type="button" class="btn btn-blue" data-vote="1">${esc(m.player1)} (${m.votes1} · ${pct(m.votes1)}%)</button>
  <button type="button" class="btn btn-out" data-vote="2">${esc(m.player2)} (${m.votes2} · ${pct(m.votes2)}%)</button>
</div>
<p class="muted" id="mmVoteMsg" style="font-size:13px"></p>

<h2 class="dtitle" style="font-size:20px;margin-top:20px">Comments (${comments.length})</h2>
<div id="mmComments">${commentRows}</div>
<form id="mmCommentForm" style="margin-top:12px">
  <div class="fg"><label>Your name *</label><input name="name" required maxlength="40"></div>
  <div class="fg"><label>Comment *</label><textarea name="body" required maxlength="500" rows="3"></textarea></div>
  <div id="mmCommentMsg"></div>
  <button class="btn btn-green" type="submit">Post Comment</button>
</form>
</div></main>
<script>
(function(){
  var id = ${JSON.stringify(m.id)};
  document.getElementById('mmVoteBar').addEventListener('click', function(e){
    var b = e.target.closest('[data-vote]'); if (!b) return;
    fetch('/api/money-matches/' + id + '/vote', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pick: Number(b.dataset.vote) }) })
      .then(function(r){ return r.json(); })
      .then(function(d){ document.getElementById('mmVoteMsg').textContent = 'Thanks for voting!'; })
      .catch(function(){ document.getElementById('mmVoteMsg').textContent = 'Could not record your vote.'; });
  });
  document.getElementById('mmCommentForm').addEventListener('submit', function(e){
    e.preventDefault();
    var f = e.target, data = { name: f.name.value, body: f.body.value };
    fetch('/api/money-matches/' + id + '/comments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
      .then(function(r){ if (!r.ok) throw new Error(); return r.json(); })
      .then(function(){ location.reload(); })
      .catch(function(){ document.getElementById('mmCommentMsg').textContent = 'Could not post your comment.'; });
  });
})();
</script>
</body></html>`;
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
  // and the same person only counts once per day. Writes are batched in memory and flushed to
  // SQLite on a timer (never inline on a request) because node:sqlite is synchronous and a
  // disk write on every page load would stall the whole server's event loop.
  const pendingViews = new Map();
  function trackVisit(req) {
    try {
      const day = D.todayIso();
      const visitor = sha(clientIp(req) + '|' + day + '|' + (cfg.adminToken || 'bat-salt')).toString('hex').slice(0, 32);
      pendingViews.set(day + '|' + visitor, [day, visitor]);
    } catch {}
  }
  function flushPageviews() {
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

    // ---- money matches (fan challenge matches; records only, never handles money) ----
    if (m === 'GET' && p === '/api/money-matches') {
      return json(req, res, 200, D.listMoneyMatchesPublic(db), { 'Cache-Control': 'public, max-age=60' });
    }
    if (m === 'POST' && p === '/api/money-matches/scan') {
      if (!cfg.anthropicKey) return json(req, res, 501, { error: 'Flyer reading is not set up on this site' });
      if (limited(clientIp(req) + ':mmscan')) return json(req, res, 429, { error: 'Too many flyers. Try again in an hour.' });
      const b = await readJson(req);
      if (!b || typeof b.image !== 'string' || b.image.length > 2_000_000) return json(req, res, 400, { error: 'Send a flyer image under 2 MB' });
      try { return json(req, res, 200, { fields: await readMoneyMatchFlyer(b.image, cfg, { fetchFn }) }); }
      catch (e) { return json(req, res, 502, { error: e.message }); }
    }
    if (m === 'GET' && (x = p.match(/^\/api\/money-matches\/(\d+)\/flyer$/))) {
      const data = D.getMoneyMatchFlyer(db, Number(x[1]));
      const mm = data && data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!mm) return json(req, res, 404, { error: 'No flyer' });
      return send(req, res, 200, Buffer.from(mm[2], 'base64'), { 'Content-Type': mm[1], 'Cache-Control': 'public, max-age=3600' });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/money-matches\/(\d+)$/))) {
      const isAdmin = tokenOk(req, cfg.adminToken);
      const match = D.getMoneyMatch(db, x[1], { includeHidden: isAdmin });
      return match ? json(req, res, 200, { match }) : json(req, res, 404, { error: 'Match not found' });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/money-matches\/(\d+)\/vote$/))) {
      const b = await readJson(req);
      const counts = D.voteMoneyMatch(db, Number(x[1]), Number(b?.pick));
      return counts ? json(req, res, 200, counts) : json(req, res, 400, { error: 'pick must be 1 or 2' });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/money-matches\/(\d+)\/comments$/))) {
      if (limited(clientIp(req) + ':mmcomment')) return json(req, res, 429, { error: 'Too many comments. Try again later.' });
      const b = await readJson(req);
      const name = clean(b?.name).slice(0, 40), body = clean(b?.body).slice(0, 500), contact = clean(b?.contact).slice(0, 120) || null;
      if (!name || !body) return json(req, res, 400, { error: 'Name and comment are required' });
      const match = D.getMoneyMatch(db, Number(x[1]));
      if (!match) return json(req, res, 404, { error: 'Match not found' });
      D.addMoneyMatchComment(db, Number(x[1]), { name, body, contact });
      return json(req, res, 201, { ok: true, comments: D.listMoneyMatchComments(db, Number(x[1])) });
    }
    if (m === 'POST' && p === '/api/money-matches') {
      if (limited(clientIp(req) + ':mm')) return json(req, res, 429, { error: 'Too many submissions. Try again in an hour.' });
      const v = D.validateMoneyMatch(await readJson(req));
      if (v.error) return json(req, res, 400, { error: v.error });
      const published = tokenOk(req, cfg.adminToken);
      const { id, slug } = D.createMoneyMatch(db, v.value, v.flyer, { published });
      return json(req, res, 201, { id, slug, status: published ? 'published' : 'pending', path: `/money-match/${slug}` });
    }

    if (p.startsWith('/api/admin/money-matches')) {
      admin(req);
      if (m === 'GET' && p === '/api/admin/money-matches') return json(req, res, 200, { matches: D.listMoneyMatchesAdmin(db) });
      if ((x = p.match(/^\/api\/admin\/money-matches\/(\d+)$/)) && m === 'PUT') {
        const b = await readJson(req), patch = {};
        for (const k of ['player1', 'player2', 'game', 'race', 'stakes', 'date', 'time', 'room', 'address', 'city', 'state', 'streamUrl', 'notes']) if (k in b) patch[k] = clean(b[k]).slice(0, 600) || null;
        if (patch.date) { const d = parseDate(patch.date); if (!d) return json(req, res, 400, { error: 'Invalid date' }); patch.date = d; }
        if (patch.state) patch.state = normalizeState(patch.state);
        let flyer = null;
        if (b.flyer && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(b.flyer) && b.flyer.length <= 2_000_000) flyer = b.flyer;
        const ok = D.updateMoneyMatch(db, Number(x[1]), patch, flyer);
        if (!ok) return json(req, res, 404, { error: 'Match not found' });
        return json(req, res, 200, { match: D.getMoneyMatch(db, Number(x[1]), { includeHidden: true }) });
      }
      if ((x = p.match(/^\/api\/admin\/money-matches\/(\d+)\/(publish|archive|repost|feature|unfeature|purge)$/)) && m === 'POST') {
        const id = Number(x[1]), act = x[2];
        if (act === 'purge') { D.purgeMoneyMatch(db, id); return json(req, res, 200, { ok: true }); }
        if (act === 'feature' || act === 'unfeature') { const ok = D.setMoneyMatchFeatured(db, id, act === 'feature'); return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Match not found' }); }
        const status = (act === 'repost' || act === 'publish') ? 'published' : act;
        const ok = D.setMoneyMatchStatus(db, id, status);
        return json(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Match not found' });
      }
      if ((x = p.match(/^\/api\/admin\/money-matches\/(\d+)\/result$/)) && m === 'POST') {
        const b = await readJson(req);
        const ok = D.setMoneyMatchResult(db, Number(x[1]), b || {});
        return json(req, res, ok ? 200 : 400, ok ? { ok: true } : { error: 'Enter both scores' });
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    // ---- lightweight page/referrer analytics beacon ----
    if (m === 'POST' && p === '/api/track') {
      try { const b = await readJson(req); D.recordTrackEvent(db, { page: clean(b?.page).slice(0, 60), ref: clean(b?.ref).slice(0, 300), utm: clean(b?.utm).slice(0, 40) }); } catch {}
      return json(req, res, 204, '');
    }

    // ================= MATCH FINDER =================
    if (m === 'GET' && p === '/api/matches') {
      return json(req, res, 200, { posts: D.listMatchPostsPublic(db) }, { 'Cache-Control': 'public, max-age=30' });
    }
    if (m === 'POST' && p === '/api/matches') {
      if (limited(clientIp(req) + ':match')) return json(req, res, 429, { error: 'Too many posts. Try again later.' });
      const b = await readJson(req);
      const name = clean(b?.name).slice(0, 40), city = clean(b?.city).slice(0, 60), state = normalizeState(b?.state);
      const date = parseDate(b?.date), until = parseDate(b?.until);
      if (!name) return json(req, res, 400, { error: 'Your name is required' });
      if (!city || !state) return json(req, res, 400, { error: 'City and state are required' });
      if (!date || !until) return json(req, res, 400, { error: 'Pick a start and end date' });
      if (until < date) return json(req, res, 400, { error: 'The end date is before the start date' });
      let expiresMs = parseInteger(b?.expiresMs);
      const fallback = new Date(until + 'T09:00:00Z').getTime() + 86_400_000;
      if (!expiresMs || expiresMs < Date.now() || expiresMs > Date.now() + 70 * 86_400_000) expiresMs = fallback;
      const v = {
        name, fargo: parseInteger(b?.fargo), city, state, room: clean(b?.room).slice(0, 80) || null,
        game: GAMES.includes(b?.game) ? b.game : 'Other', stakeMin: parseInteger(b?.stakeMin), stakeMax: parseInteger(b?.stakeMax),
        date, until, time: parseTime(b?.time), contact: clean(b?.contact).slice(0, 120) || null, note: clean(b?.note).slice(0, 280) || null, expiresMs
      };
      const { id, manageKey } = D.createMatchPost(db, v);
      return json(req, res, 201, { id, manageKey });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/matches\/(\d+)$/))) {
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const post = D.getMatchPost(db, Number(x[1]), { key, isAdmin });
      return post ? json(req, res, 200, post) : json(req, res, 404, { error: 'This post is gone.' });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/matches\/(\d+)\/reply$/))) {
      if (limited(clientIp(req) + ':mreply')) return json(req, res, 429, { error: 'Too many replies. Try again later.' });
      const b = await readJson(req);
      const name = clean(b?.name).slice(0, 40), contact = clean(b?.contact).slice(0, 80), message = clean(b?.message).slice(0, 280) || null;
      if (!name || !contact) return json(req, res, 400, { error: 'Your name and contact are required' });
      const post = D.getMatchPostRaw(db, Number(x[1]));
      if (!post) return json(req, res, 404, { error: 'This post is gone.' });
      D.addMatchReply(db, Number(x[1]), { name, contact, message });
      return json(req, res, 201, { ok: true });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/matches\/(\d+)\/(close|reopen|delete)$/))) {
      const id = Number(x[1]), act = x[2];
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const row = D.getMatchPostRaw(db, id);
      if (!row) return json(req, res, 404, { error: 'This post is gone.' });
      if (!isAdmin && key !== row.manage_key) return json(req, res, 403, { error: 'Not authorized' });
      const ok = act === 'delete' ? D.setMatchStatus(db, id, 'archived', { archivedBy: isAdmin ? 'admin' : 'player' })
        : D.setMatchStatus(db, id, act === 'close' ? 'closed' : 'open');
      return json(req, res, ok ? 200 : 404, { ok });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/matches\/(\d+)\/comment$/))) {
      if (limited(clientIp(req) + ':mcomment')) return json(req, res, 429, { error: 'Too many comments. Try again later.' });
      const b = await readJson(req);
      const name = clean(b?.name).slice(0, 40), body = clean(b?.body).slice(0, 500), contact = clean(b?.contact).slice(0, 120) || null;
      if (!name || !body) return json(req, res, 400, { error: 'Name and comment are required' });
      const post = D.getMatchPostRaw(db, Number(x[1]));
      if (!post) return json(req, res, 404, { error: 'This post is gone.' });
      D.addMatchComment(db, Number(x[1]), { name, body, contact });
      return json(req, res, 201, { ok: true, comments: D.listMatchComments(db, Number(x[1])) });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/matches\/(\d+)\/comments\/(\d+)\/delete$/))) {
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const row = D.getMatchPostRaw(db, Number(x[1]));
      if (!row) return json(req, res, 404, { error: 'This post is gone.' });
      if (!isAdmin && key !== row.manage_key) return json(req, res, 403, { error: 'Not authorized' });
      D.deleteMatchComment(db, Number(x[2]));
      return json(req, res, 200, { comments: D.listMatchComments(db, Number(x[1])) });
    }
    if (p.startsWith('/api/admin/matches')) {
      admin(req);
      if (m === 'GET' && p === '/api/admin/matches') return json(req, res, 200, { posts: D.listMatchPostsAdmin(db) });
      if ((x = p.match(/^\/api\/admin\/matches\/(\d+)\/(archive|repost|purge)$/)) && m === 'POST') {
        const id = Number(x[1]), act = x[2];
        const ok = act === 'archive' ? D.setMatchStatus(db, id, 'archived', { archivedBy: 'admin' }) : act === 'repost' ? D.repostMatch(db, id) : (D.purgeMatchPost(db, id) || true);
        return json(req, res, ok ? 200 : 404, { ok: !!ok });
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    // ================= STAKING BOARD =================
    if (m === 'GET' && p === '/api/stakes') {
      return json(req, res, 200, D.listStakesPublic(db), { 'Cache-Control': 'public, max-age=30' });
    }
    if (m === 'POST' && p === '/api/stakes') {
      if (limited(clientIp(req) + ':stake')) return json(req, res, 429, { error: 'Too many submissions. Try again later.' });
      const b = await readJson(req);
      const player = clean(b?.player).slice(0, 60), stakeholder = clean(b?.stakeholder).slice(0, 80);
      const date = parseDate(b?.date), bet = parseMoney(b?.bet), offered = parseMoney(b?.offered);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      if (!player) return json(req, res, 400, { error: 'Your name is required' });
      if (!date || date < yesterday) return json(req, res, 400, { error: 'Enter a date that is today or later' });
      if (!bet || bet <= 0) return json(req, res, 400, { error: 'Enter what the bet is a side' });
      if (!offered || offered < 1 || offered > 100) return json(req, res, 400, { error: 'Enter a percent for sale between 1 and 100' });
      if (!stakeholder) return json(req, res, 400, { error: 'Enter who is holding the stake money' });
      const v = {
        player, opponent: clean(b?.opponent).slice(0, 60) || null, game: GAMES.includes(b?.game) ? b.game : '9-Ball',
        race: clean(b?.race).slice(0, 40) || null, date, time: parseTime(b?.time), bet, offered,
        markup: Math.min(2, Math.max(1, parseMoney(b?.markup) || 1)), venue: clean(b?.venue).slice(0, 120) || null,
        city: clean(b?.city).slice(0, 80) || null, state: normalizeState(b?.state) || null, stakeholder,
        contact: clean(b?.contact).slice(0, 120) || null, notes: clean(b?.notes).slice(0, 500) || null,
        moneyMatchId: b?.moneyMatchId ? parseInteger(b.moneyMatchId) : null
      };
      const { id, manageKey } = D.createStake(db, v);
      return json(req, res, 201, { id, manageKey });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/stakes\/(\d+)$/))) {
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const s = D.getStake(db, Number(x[1]), { key, isAdmin });
      return s ? json(req, res, 200, s) : json(req, res, 404, { error: 'Match not found.' });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/stakes\/(\d+)\/pieces$/))) {
      const s = D.getStakeRaw(db, Number(x[1]));
      if (!s) return json(req, res, 404, { error: 'Match not found.' });
      if (s.status !== 'open') return json(req, res, 400, { error: 'This match is not open for backers' });
      const b = await readJson(req);
      const backer = clean(b?.backer).slice(0, 60), percent = parseMoney(b?.percent);
      if (!backer) return json(req, res, 400, { error: 'Your name is required' });
      const sold = D.getStakePieces(db, s.id).reduce((t, p) => t + p.percent, 0);
      const remaining = s.offered - sold;
      if (!percent || percent < 1 || percent > remaining) return json(req, res, 400, { error: `Enter a percent between 1 and ${remaining}` });
      D.addStakePiece(db, s.id, { backer, contact: clean(b?.contact).slice(0, 120) || null, percent });
      return json(req, res, 201, { ok: true });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/stakes\/(\d+)\/result$/))) {
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const s = D.getStakeRaw(db, Number(x[1]));
      if (!s) return json(req, res, 404, { error: 'Match not found.' });
      if (!isAdmin && key !== s.manage_key) return json(req, res, 403, { error: 'Not authorized' });
      const b = await readJson(req);
      const ok = D.setStakeResult(db, Number(x[1]), { result: b?.result, score: clean(b?.score).slice(0, 20) || null });
      return json(req, res, ok ? 200 : 400, { ok });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/stakes\/(\d+)\/allpaid$/))) {
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const s = D.getStakeRaw(db, Number(x[1]));
      if (!s) return json(req, res, 404, { error: 'Match not found.' });
      if (!isAdmin && key !== s.manage_key) return json(req, res, 403, { error: 'Not authorized' });
      D.setAllPiecesPaid(db, s.id, s.status === 'settled' && s.result === 'won');
      return json(req, res, 200, { ok: true });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/stakes\/(\d+)\/pieces\/(\d+)\/(paid|unpaid|paidin|unpaidin|remove)$/))) {
      const key = req.headers['x-manage-key'] || '', isAdmin = tokenOk(req, cfg.adminToken);
      const s = D.getStakeRaw(db, Number(x[1]));
      if (!s) return json(req, res, 404, { error: 'Match not found.' });
      if (!isAdmin && key !== s.manage_key) return json(req, res, 403, { error: 'Not authorized' });
      const act = x[3], pieceId = Number(x[2]);
      if (act === 'remove') D.removeStakePiece(db, pieceId);
      else D.setStakePiecePaid(db, pieceId, act.includes('in') ? 'paidin' : 'paid', act.startsWith('paid'));
      return json(req, res, 200, { ok: true });
    }
    if (p.startsWith('/api/admin/stakes')) {
      admin(req);
      if (m === 'GET' && p === '/api/admin/stakes/pending') return json(req, res, 200, { stakes: D.listStakesAdminPending(db) });
      if (m === 'GET' && p === '/api/admin/stakes/all') return json(req, res, 200, D.listStakesAdminAll(db));
      if ((x = p.match(/^\/api\/admin\/stakes\/(\d+)\/(approve|reject|archive|repost|purge)$/)) && m === 'POST') {
        const id = Number(x[1]), act = x[2];
        const ok = act === 'approve' ? D.setStakeStatus(db, id, 'open') : act === 'reject' ? D.setStakeStatus(db, id, 'rejected')
          : act === 'archive' ? D.setStakeStatus(db, id, 'archived') : act === 'repost' ? D.repostStake(db, id) : (D.purgeStake(db, id) || true);
        return json(req, res, ok ? 200 : 404, { ok: !!ok });
      }
      return json(req, res, 404, { error: 'Not found' });
    }

    // ================= CALCUTTA AUCTIONS =================
    if (m === 'GET' && p === '/api/auctions') {
      return json(req, res, 200, { auctions: D.listAuctionsPublic(db) }, { 'Cache-Control': 'public, max-age=15' });
    }
    if (m === 'POST' && p === '/api/auctions') {
      if (limited(clientIp(req) + ':auction')) return json(req, res, 429, { error: 'Too many auctions. Try again later.' });
      const b = await readJson(req);
      const title = clean(b?.title).slice(0, 100);
      const mode = b?.mode === 'silent' ? 'silent' : 'live';
      const items = String(b?.items || '').slice(0, 5000); // keep newlines -- one player per line
      if (!title) return json(req, res, 400, { error: 'Auction name is required' });
      if (!items.split('\n').map(s => s.trim()).filter(Boolean).length) return json(req, res, 400, { error: 'Add at least one player' });
      if (mode === 'silent' && !parseInteger(b?.endsMs)) return json(req, res, 400, { error: 'Pick when bidding ends' });
      const v = {
        title, mode, minBid: Math.max(1, parseMoney(b?.minBid) || 20), increment: Math.max(1, parseMoney(b?.increment) || 5),
        houseCut: Math.min(50, Math.max(0, parseMoney(b?.houseCut) || 0)), bidSeconds: Math.min(300, Math.max(10, parseInteger(b?.bidSeconds) || 30)),
        resetSeconds: Math.min(120, Math.max(5, parseInteger(b?.resetSeconds) || 15)), startsMs: parseInteger(b?.startsMs) || null,
        endsMs: parseInteger(b?.endsMs) || null, payouts: clean(b?.payouts) || '50,25,15,10', items, listed: !!b?.listed
      };
      const { code, hostKey } = D.createAuction(db, v);
      return json(req, res, 201, { code, hostKey });
    }
    if (m === 'GET' && (x = p.match(/^\/api\/auctions\/([A-Z0-9]+)$/))) {
      const code = x[1];
      const a = D.getAuctionRaw(db, code);
      if (!a) return json(req, res, 404, { error: 'Auction not found. Check the code.' });
      const rev = url.searchParams.get('rev');
      const token = req.headers['x-bidder'] || '', hostKey = req.headers['x-host-key'] || '';
      const fresh = D.tickAuction(db, code);
      if (rev != null && String(fresh.rev) === rev) return json(req, res, 200, { unchanged: true, serverNow: Date.now(), rev: fresh.rev });
      return json(req, res, 200, D.auctionState(db, code, { token, hostKey }));
    }
    if (m === 'POST' && (x = p.match(/^\/api\/auctions\/([A-Z0-9]+)\/join$/))) {
      const code = x[1];
      if (!D.getAuctionRaw(db, code)) return json(req, res, 404, { error: 'Auction not found' });
      const b = await readJson(req);
      const name = clean(b?.name).slice(0, 30);
      if (!name) return json(req, res, 400, { error: 'Enter a name' });
      const token = D.joinAuction(db, code, name);
      return json(req, res, 201, { token, bidder: { name } });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/auctions\/([A-Z0-9]+)\/bid$/))) {
      const code = x[1];
      if (!D.getAuctionRaw(db, code)) return json(req, res, 404, { error: 'Auction not found' });
      D.tickAuction(db, code);
      const b = await readJson(req);
      const token = req.headers['x-bidder'] || '';
      const r = D.placeBid(db, code, token, Number(b?.itemId), Number(b?.amount));
      return r.error ? json(req, res, 400, { error: r.error }) : json(req, res, 200, { ok: true });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/auctions\/([A-Z0-9]+)\/chat$/))) {
      const code = x[1];
      const a = D.getAuctionRaw(db, code);
      if (!a) return json(req, res, 404, { error: 'Auction not found' });
      const token = req.headers['x-bidder'] || '', hostKey = req.headers['x-host-key'] || '';
      const isHost = !!hostKey && hostKey === a.host_key;
      const bidderName = D.getBidderName(db, code, token);
      if (!isHost && !bidderName) return json(req, res, 403, { error: 'Join the auction first' });
      const b = await readJson(req);
      const text = clean(b?.text).slice(0, 300);
      if (!text) return json(req, res, 400, { error: 'Type a message' });
      D.addAuctionChat(db, code, { name: isHost ? 'Host' : bidderName, text, host: isHost });
      return json(req, res, 201, { ok: true });
    }
    if (m === 'POST' && (x = p.match(/^\/api\/auctions\/([A-Z0-9]+)\/host$/))) {
      const code = x[1];
      const a = D.getAuctionRaw(db, code);
      if (!a) return json(req, res, 404, { error: 'Auction not found' });
      const hostKey = req.headers['x-host-key'] || '';
      if (!hostKey || hostKey !== a.host_key) return json(req, res, 403, { error: 'Not authorized' });
      D.tickAuction(db, code);
      const b = await readJson(req);
      const r = D.hostAction(db, code, b?.action, b || {});
      return r.error ? json(req, res, 400, { error: r.error }) : json(req, res, 200, { ok: true });
    }
    if (p.startsWith('/api/admin/auctions')) {
      admin(req);
      if (m === 'GET' && p === '/api/admin/auctions') return json(req, res, 200, { auctions: D.listAuctionsAdmin(db) });
      if ((x = p.match(/^\/api\/admin\/auctions\/([A-Z0-9]+)\/(delete|restore|purge)$/)) && m === 'POST') {
        const code = x[1], act = x[2];
        const ok = act === 'delete' ? D.hostAction(db, code, 'delete').ok : act === 'restore' ? D.restoreAuction(db, code) : (D.purgeAuction(db, code) || true);
        return json(req, res, ok ? 200 : 404, { ok: !!ok });
      }
      return json(req, res, 404, { error: 'Not found' });
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
      if (m === 'GET' && p === '/api/admin/pageviews') { flushPageviews(); return json(req, res, 200, D.pageviewCounts(db)); }
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
    if (m === 'GET' && (x = p.match(/^\/money-match\/([a-z0-9-]+)$/))) {
      trackVisit(req);
      const match = D.getMoneyMatch(db, x[1]);
      if (!match) return send(req, res, 404, '<h1>Money match not found</h1>', { 'Content-Type': 'text/html; charset=utf-8' });
      const comments = D.listMoneyMatchComments(db, match.id);
      return send(req, res, 200, moneyMatchPage(match, comments, cfg.publicUrl), { 'Content-Type': 'text/html; charset=utf-8' });
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
      const published = D.listTournaments(db, { from: '0001-01-01', limit: 50000 }).filter(t => t.status === 'published');
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
  server.flushPageviews = flushPageviews;
  return server;
}
