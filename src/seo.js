// Search-engine pages: a real, crawlable URL for every tournament, plus landing pages for
// every state, city and game (and each combination) that has tournaments. Everything here is
// plain server-rendered HTML so Google can read it without running the site's JavaScript app.
import * as D from './db.js';
import { sponsorBannerHtml } from './sponsor.js';
import { STATE_NAMES, slugify } from './normalize.js';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const GAME_SLUGS = { '9-Ball': '9-ball', '8-Ball': '8-ball', '10-Ball': '10-ball', 'One Pocket': 'one-pocket', Banks: 'banks', 'Straight Pool': 'straight-pool', 'Scotch Doubles': 'scotch-doubles' };
const GAME_BY_SLUG = Object.fromEntries(Object.entries(GAME_SLUGS).map(([g, s]) => [s, g]));
const STATE_BY_SLUG = Object.fromEntries(Object.entries(STATE_NAMES).map(([c, n]) => [slugify(n), c]));
export const stateSlug = code => slugify(STATE_NAMES[code] || code);
export const gameSlug = g => GAME_SLUGS[g] || null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const todayIso = () => D.todayIso();
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const shortDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const monthLabel = iso => { const [y, m] = iso.split('-').map(Number); return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`; };
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const gameWord = g => (g && g !== 'Other' ? g : '');

// ---- the index: every published tournament, its URL, and the facets pages are built from ----
let cache = null;
function index(db) {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const listed = D.listTournaments(db, { from: '0001-01-01', limit: 100_000 }).filter(t => t.status === 'published');
  // Collapse duplicate listings of the same event (same day, same room, same words in the name,
  // e.g. "Friday Night Friday Night 8 Ball" vs "Friday Night 8 Ball"): one page, the others redirect to it.
  const words = n => [...new Set(String(n || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean))].sort().join(' ');
  const room = v => `${slugify(String(v.name || '').replace(/['’]/g, ''))}|${slugify(v.city)}|${v.state}`;
  const firstOf = new Map(), dupeOf = new Map();
  for (const t of [...listed].sort((a, b) => a.id - b.id)) {
    const k = `${t.date}|${room(t.venue)}|${words(t.name)}`;
    if (firstOf.has(k)) dupeOf.set(t.id, firstOf.get(k)); else firstOf.set(k, t.id);
  }
  const all = listed.filter(t => !dupeOf.has(t.id));
  const bySlug = new Map(), pathById = new Map();
  for (const t of [...all].sort((a, b) => a.id - b.id)) {
    let s = baseSlug(t);
    if (bySlug.has(s)) s = `${s}-${t.id}`;             // same name, place and day: keep both addressable
    bySlug.set(s, t.id); pathById.set(t.id, `/tournament/${s}`);
  }
  for (const [dup, keep] of dupeOf) pathById.set(dup, pathById.get(keep));
  // The same pool room sometimes exists twice (slightly different address). Treat same name + city + state
  // as one room: one venue page, at the lowest id, listing all of its tournaments.
  const ROOM_GENERIC = /\b(billiards?|bar|grill|and|the|sports?|pub|lounge|club|room|pool|hall|cafe|saloon|tavern|restaurant|n)\b|[^a-z0-9 ]/g;
  const roomKey = v => { const c = String(v.name || '').toLowerCase().replace(/['’]/g, '').replace(ROOM_GENERIC, ' ').replace(/\s+/g, ' ').trim();
    return `${c || slugify(String(v.name || '').replace(/['’]/g, ''))}|${slugify(v.city)}|${v.state}`; };
  const primaryVenue = new Map(), roomIds = new Map();
  for (const t of all) { const k = roomKey(t.venue); if (!roomIds.has(k)) roomIds.set(k, new Set()); roomIds.get(k).add(t.venue.id); }
  for (const ids of roomIds.values()) { const p = Math.min(...ids); for (const id of ids) primaryVenue.set(id, p); }
  cache = { at: Date.now(), all, bySlug, pathById, byId: new Map(all.map(t => [t.id, t])), primaryVenue, featured: D.featuredIds(db) };
  return cache;
}
export function invalidate() { cache = null; }
// Every published tournament, one entry per real event (duplicate listings collapsed).
export const listedTournaments = db => index(db).all;
const venuePath = (db, v) => `/venue/${index(db).primaryVenue.get(v.id) ?? v.id}`;
const sameRoom = (db, a, b) => { const p = index(db).primaryVenue; return (p.get(a) ?? a) === (p.get(b) ?? b); };

// Readable slugs: drop apostrophes ("women's" -> "womens") and don't end a cut-off phrase on "and"/"the".
const cleanSlug = (s, words) => { const w = slugify(String(s || '').replace(/['’]/g, '')).split('-').filter(Boolean).slice(0, words);
  while (w.length > 1 && ['and', 'the', 'of', 'at', 'a', 'n'].includes(w[w.length - 1])) w.pop(); return w.join('-'); };
function baseSlug(t) {
  const v = t.venue || {};
  const name = cleanSlug(t.name, 10);
  const parts = [name];
  const venue = cleanSlug(v.name, 6);
  if (venue && !name.includes(venue) && !/^\d/.test(v.name || '')) parts.push(venue);
  const city = slugify(v.city);
  if (city && !parts.join('-').includes(city)) parts.push(city);
  if (v.state) parts.push(v.state.toLowerCase());
  const [y, m, d] = t.date.split('-').map(Number);
  parts.push(`${MONTHS[m - 1]}-${d}-${y}`);
  return parts.filter(Boolean).join('-').replace(/-+/g, '-');
}
export const tournamentPath = (db, t) => index(db).pathById.get(t.id) || `/tournament/${baseSlug(t)}-${t.id}`;
export function findTournamentBySlug(db, slug) {
  const ix = index(db);
  const id = ix.bySlug.get(slug) ?? (slug.match(/-(\d+)$/) && ix.byId.has(Number(slug.match(/-(\d+)$/)[1])) ? Number(slug.match(/-(\d+)$/)[1]) : null);
  return id != null ? ix.byId.get(id) : null;
}

// A tournament URL that no longer exists (event removed or renamed): find the closest live page so old links
// and search results land somewhere useful. Same name + room on another date first, then the room's page.
export function fallbackForSlug(db, slug) {
  const ix = index(db), today = todayIso();
  const base = slug.replace(/-(january|february|march|april|may|june|july|august|september|october|november|december)-\d{1,2}-\d{4}(-\d+)?$/, '');
  if (base !== slug && base.length >= 8) {
    const same = ix.all.filter(t => { const sl = tournamentPath(db, t).slice(12); return sl.startsWith(base + '-'); });
    const pick = same.find(t => t.date >= today) || same[same.length - 1];
    if (pick) return tournamentPath(db, pick);
  }
  let best = null;
  for (const t of ix.all) { const vs = cleanSlug(t.venue.name, 6); if (vs.length >= 5 && (base + '-').includes('-' + vs + '-') && (!best || vs.length > best[1])) best = [t.venue, vs.length]; }
  return best ? venuePath(db, best[0]) : null;
}

const cityKey = (state, city) => `${state}|${slugify(city)}`;
function facetPath({ state, city, game } = {}) {
  let p = '/tournaments';
  if (state) p += '/' + stateSlug(state);
  if (state && city) p += '/' + slugify(city);
  if (game) p += '/' + gameSlug(game);
  return p + (p === '/tournaments' ? '/' : '');
}

// Resolve /tournaments/<a>/<b>/<c> into { state, city, game } (or null if it doesn't exist).
function parseFacets(db, parts) {
  const ix = index(db);
  const out = { state: null, city: null, cityName: null, game: null };
  const p = parts.filter(Boolean).map(s => decodeURIComponent(s).toLowerCase());
  if (p.length > 3) return null;
  if (p.length && GAME_BY_SLUG[p[p.length - 1]]) out.game = GAME_BY_SLUG[p.pop()];
  if (p.length) { out.state = STATE_BY_SLUG[p.shift()]; if (!out.state) return null; }
  if (p.length) {
    const want = p.shift();
    const hit = ix.all.find(t => t.venue.state === out.state && slugify(t.venue.city) === want);
    if (!hit) return null;
    out.city = want; out.cityName = hit.venue.city;
  }
  if (p.length) return null;
  return out;
}
const matches = (t, f) => (!f.state || t.venue.state === f.state) && (!f.city || slugify(t.venue.city) === f.city) && (!f.game || t.game === f.game);

// ---- Google AdSense (Auto ads). Nothing is added until ADSENSE_CLIENT is set. ----
export const adsHead = cfg => cfg.adsenseClient
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsenseClient}" crossorigin="anonymous"></script>`
  : '';
export const adsTxt = cfg => cfg.adsenseClient
  ? `google.com, ${cfg.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
  : null;

export function privacyPage(cfg) {
  const body = `<h1>Privacy Policy</h1>
<p class="muted">Last updated: October 2026</p>
<p>Billiard Action Time ("we", "us") runs billiardactiontime.com, a directory of pool tournaments, money matches and related events. This page explains what information we collect and how it is used.</p>
<h2>Information you give us</h2>
<p>When you post a tournament, money match, staking listing, comment or Calcutta, or sign up for alerts or our newsletter, we store what you enter (for example your name or nickname, email address and any contact details you choose to share). Anything you post publicly is visible to everyone who visits the site. We use your email only to send what you asked for, and you can unsubscribe at any time.</p>
<h2>Visit counts</h2>
<p>We count page visits to see which pages are useful. We do not store IP addresses for this; visitors are counted with a temporary, anonymous daily identifier.</p>
<h2>Advertising and cookies</h2>
<p>We show ads served by Google. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the Internet.</p>
<p>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" rel="nofollow">Google Ads Settings</a>, or opt out of some third-party vendors' use of cookies for personalized advertising at <a href="https://www.aboutads.info/choices/" rel="nofollow">www.aboutads.info</a>. Learn more in <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow">How Google uses information from sites that use its services</a>.</p>
<h2>Money and wagers</h2>
<p>Billiard Action Time only lists events and keeps records. We do not take bets, hold stakes, or process any payments between players or backers.</p>
<h2>Children</h2>
<p>This site is intended for adults and is not directed to children under 13.</p>
<h2>Contact</h2>
<p>Questions about this policy or requests to remove your information: email us at <a href="mailto:billiardactiontime@gmail.com">billiardactiontime@gmail.com</a>.</p>`;
  return layout(cfg, { title: 'Privacy Policy | Billiard Action Time', description: 'How Billiard Action Time collects and uses information, including advertising cookies.', path: '/privacy', body });
}

// ---- shared page chrome ----
// Shown at the bottom of every server-rendered page: the easiest way to turn a one-time visitor into a regular.
const ALERT_CTA = `<section class="card seo-cta" style="margin:28px 0 8px;padding:18px 20px">
  <h2 class="seo-h2" style="margin-top:0">Never miss a tournament near you</h2>
  <p class="muted" style="margin:6px 0 12px">Get an email when new pool tournaments are posted in your area. Free, and you can unsubscribe any time.</p>
  <div class="actbar"><a class="btn btn-green" href="/alerts">Get Tournament Alerts</a><a class="btn btn-out" href="/this-weekend/">See This Weekend's Tournaments</a></div>
</section>`;
export function layout(cfg, { title, description, path, body, jsonld = [], noindex = false, ogImage, scripts = [] }) {
  const url = cfg.publicUrl + path;
  const ld = jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="Billiard Action Time"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(ogImage || cfg.publicUrl + '/og.png')}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:image" content="${esc(ogImage || cfg.publicUrl + '/og.png')}">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#144b2e"><meta name="google-site-verification" content="F6vvC84HY3rKsPU5LJiV4iqizZZBLCG8Rnp3LbGS8NQ">
<link rel="stylesheet" href="/styles.css"><link rel="alternate" type="application/rss+xml" title="New pool tournaments" href="/feed.xml">${ld}<script src="/share.js" defer></script>${scripts.map(src => `<script src="${esc(src)}" defer></script>`).join('')}${adsHead(cfg)}</head>
<body><a class="skip-link" href="#main">Skip to content</a><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a>
<details class="mnav"><summary aria-label="Menu">☰</summary><div class="mnav-panel">
<form action="/search" method="get" role="search" class="mnav-search"><input type="search" name="q" placeholder="Search city, room, game…" aria-label="Search tournaments"><button type="submit">Search</button></form>
<a href="/tonight/">🌙 Tonight</a><a href="/this-weekend/">🔥 This Weekend</a><a href="/near">📍 Near Me</a><a href="/tournaments/">🗺️ By State</a><a href="/pool-halls/">🏠 Pool Halls</a><a href="/big-tournaments/">🏆 Big Events</a><a href="/new/">🆕 Just Added</a><a href="/calendar">📅 Calendar</a>
<a href="/guides/">📖 Guides</a><a href="/trick-shots/">✨ Trick Shots</a><a href="/play/">🎮 Games</a><a href="/gear/">🛒 Pool Gear</a><a href="/tools/">🧰 Tools</a><a href="/money-matches/">💰 Money Matches</a><a href="/alerts">🔔 Alerts</a><a href="/directors/">🎯 For Directors</a><a class="mnav-cta" href="/post">➕ Post a Tournament</a>
</div></details>
<nav class="nav seo-nav"><a href="/tournaments/">Tournaments</a><a href="/tonight/">Tonight</a><a href="/this-weekend/">This Weekend</a><a href="/big-tournaments/">Big Events</a><a href="/guides/">Guides</a><a href="/trick-shots/">Trick Shots</a><a href="/play/">Games</a><a href="/tools/">Tools</a><a href="/money-matches/">Money Matches</a><a href="/calendar">Calendar</a><a href="/stakes">Staking Board</a><a href="/auctions">Calcutta</a><a class="cta" href="/post">Post a Tournament</a></nav></div></header>
${sponsorBannerHtml()}
<main id="main" class="wrap page seo">${body}${ALERT_CTA}</main>
${footer(cfg)}</body></html>`;
}
let footCache = null;
function footer(cfg) { return footCache ? footCache.html : ''; }
function buildFooter(db) {
  const ix = index(db), today = todayIso();
  const up = ix.all.filter(t => t.date >= today);
  const count = key => { const m = new Map(); for (const t of up) { const k = key(t); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
  const states = count(t => t.venue.state).slice(0, 12);
  const cities = count(t => t.venue.city && cityKey(t.venue.state, t.venue.city)).slice(0, 12);
  const games = count(t => gameSlug(t.game) && t.game);
  const cityName = k => { const t = up.find(x => cityKey(x.venue.state, x.venue.city) === k); return t ? `${t.venue.city}, ${t.venue.state}` : k; };
  footCache = { at: Date.now(), html: `<footer class="ftr"><div class="wrap ftr-in seo-ftr">
    <div><a class="logo on-dark" href="/"><span>Billiard <em>Action</em> Time</span></a><p class="muted">Pool &amp; billiards tournaments across the USA.</p><a href="/tournaments/">All tournaments by state</a></div>
    <div><h4>By Game</h4>${games.map(([g]) => `<a href="${facetPath({ game: g })}">${esc(g)} tournaments</a>`).join('')}</div>
    <div><h4>Top States</h4>${states.map(([s]) => `<a href="${facetPath({ state: s })}">${esc(STATE_NAMES[s] || s)}</a>`).join('')}</div>
    <div><h4>Top Cities</h4>${cities.map(([k]) => { const [s, c] = k.split('|'); return `<a href="/tournaments/${stateSlug(s)}/${c}">${esc(cityName(k))}</a>`; }).join('')}</div>
    <div><h4>Learn &amp; Play</h4><a href="/gear/">Pool gear guide</a><a href="/tonight/">Tonight</a><a href="/new/">Just added</a><a href="/pool-halls/">Pool halls</a><a href="/this-weekend/">This weekend</a><a href="/big-tournaments/">Big tournaments</a><a href="/guides/">Pool guides</a><a href="/trick-shots/">Trick shots</a><a href="/play/aim-trainer">Aim trainer game</a><a href="/guides/pool-practice-drills">Practice drills</a><a href="/tools/brackets/">Printable brackets</a><a href="/tools/payout-calculator">Payout calculator</a><a href="/tools/round-robin-generator">Round robin generator</a><a href="/tools/pool-rules-quiz">Pool rules quiz</a><a href="/post">Post a tournament</a><a href="/directors/">For directors</a></div>
  </div><p class="muted wrap ftr-links" style="padding-bottom:20px">© ${new Date().getFullYear()} Billiard Action Time · <a href="/about">About</a> · <a href="/guides/">Guides</a> · <a href="/guides/pool-terms-glossary">Glossary</a> · <a href="/trick-shots/">Trick Shots</a> · <a href="/play/">Games</a> · <a href="/tools/">Tools</a> · <a href="/tools/brackets/">Printable Brackets</a> · <a href="/gear/">Pool Gear</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy Policy</a> · <a href="mailto:billiardactiontime@gmail.com">billiardactiontime@gmail.com</a></p></footer>`, links: { states, cities, games, cityName } };
  return footCache;
}
// Crawlable links injected into the app's home page (index.html) so search engines find these pages.
export function homeLinksHtml(db) {
  const f = buildFooter(db).links;
  const a = (href, text) => `<a href="${href}">${esc(text)}</a>`;
  return `<div class="seo-home wrap"><h4>Browse pool tournaments</h4><p>
    ${f.games.map(([g]) => a(facetPath({ game: g }), `${g} tournaments`)).join(' · ')}</p><p>
    ${f.states.map(([s]) => a(facetPath({ state: s }), `${STATE_NAMES[s] || s} pool tournaments`)).join(' · ')}</p><p>
    ${f.cities.map(([k]) => { const [s, c] = k.split('|'); return a(`/tournaments/${stateSlug(s)}/${c}`, `${f.cityName(k)} pool tournaments`); }).join(' · ')}
    · <a href="/tournaments/">All states</a></p></div>`;
}

function crumbs(cfg, items) {
  const html = `<nav class="crumbs" aria-label="Breadcrumb">${items.map((c, i) => i < items.length - 1 ? `<a href="${c.path}">${esc(c.name)}</a> <span>/</span>` : `<span>${esc(c.name)}</span>`).join(' ')}</nav>`;
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: cfg.publicUrl + c.path })) };
  return { html, ld };
}

function eventLd(cfg, db, t) {
  const v = t.venue || {};
  const desc = `${gameWord(t.game) || 'Pool'} tournament at ${v.name} in ${v.city}, ${v.state}${t.entry != null ? `. ${money(t.entry)} entry` : ''}${t.added ? `, ${money(t.added)} added` : ''}.`;
  return {
    '@context': 'https://schema.org', '@type': 'SportsEvent', name: t.name, description: desc, sport: 'Pool (cue sports)',
    url: cfg.publicUrl + tournamentPath(db, t), startDate: t.time ? `${t.date}T${t.time}` : t.date,
    endDate: t.time ? (() => { const [h, m] = t.time.split(':').map(Number); return h + 5 < 24 ? `${t.date}T${String(h + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}` : `${t.date}T23:59`; })() : t.date,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [`${cfg.publicUrl}/t/${t.id}/og.png`],
    location: { '@type': 'Place', name: v.name, address: { '@type': 'PostalAddress', streetAddress: v.address || undefined, addressLocality: v.city, addressRegion: v.state, postalCode: v.zip || undefined, addressCountry: 'US' },
      ...(v.lat != null && v.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}) },
    ...(t.director?.name ? { organizer: { '@type': 'Person', name: t.director.name } } : { organizer: { '@type': 'Organization', name: v.name, url: cfg.publicUrl + venuePath(db, v) } }),
    ...(t.entry != null ? { offers: { '@type': 'Offer', price: t.entry, priceCurrency: 'USD', url: t.registrationUrl || cfg.publicUrl + tournamentPath(db, t), availability: 'https://schema.org/InStock', validFrom: t.updatedAt ? t.updatedAt.replace(' ', 'T') + 'Z' : undefined } } : {})
  };
}

// Paid "Featured" listings in a highlighted box at the top of a list page. `list` is the page's own events, so a
// featured event only shows where it belongs (its state, city, tonight, the weekend). Ends with the sales link.
function featuredBox(db, list, { max = 3, showCity = true } = {}) {
  const F = index(db).featured, today = todayIso();
  const picks = F.size ? list.filter(t => F.has(t.id) && t.date >= today).slice(0, max) : [];
  if (!picks.length) return '';
  return `<section class="feat-box" aria-label="Featured tournaments"><h2>⭐ Featured tournaments</h2>${picks.map(t => `<a class="feat-item" href="${tournamentPath(db, t)}"><b>${esc(t.name)}</b><span>${esc(longDate(t.date))}${t.time ? ' · ' + esc(fmtTime(t.time)) : ''}</span><span class="muted">${esc(t.venue.name)}${showCity ? ` · ${esc(t.venue.city)}, ${esc(t.venue.state)}` : ''}${t.entry != null ? ' · ' + money(t.entry) + ' entry' : ''}${t.added ? ' · <b>' + money(t.added) + ' added</b>' : ''}</span></a>`).join('')}
</section>`;
}

function eventRows(db, list, { showCity = true, byDay = false } = {}) {
  let month = '', html = '';
  const today = todayIso(), tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const badge = d => d === today ? '<br><span class="when-badge when-today">Tonight</span>' : d === tomorrow ? '<br><span class="when-badge">Tomorrow</span>' : '';
  const going = list.length ? D.goingCounts(db) : new Map();
  const F = index(db).featured;
  if (F.size) list = list.map((t, i) => [t, i]).sort((a, b) => a[0].date === b[0].date ? (F.has(b[0].id) - F.has(a[0].id)) || a[1] - b[1] : a[1] - b[1]).map(x => x[0]);   // featured first on its day
  for (const t of list) {
    const ml = byDay ? `${longDate(t.date)}${t.date === today ? ' · Tonight' : t.date === tomorrow ? ' · Tomorrow' : ''}` : monthLabel(t.date);
    if (ml !== month) { if (month) html += '</tbody></table></div>'; month = ml; html += `<h3 class="seo-month">${esc(ml)}</h3><div class="card seo-tbl"><table class="t"><tbody>`; }
    const v = t.venue;
    html += `<tr${F.has(t.id) ? ' class="feat-row"' : ''}${v.lat != null && v.lng != null ? ` data-lat="${v.lat}" data-lng="${v.lng}"` : ''}><td class="seo-date">${esc(shortDate(t.date))}${t.time ? `<br><small class="muted">${esc(fmtTime(t.time))}</small>` : ''}${byDay ? "" : badge(t.date)}</td>
      <td>${F.has(t.id) ? '<span class="feat-badge">⭐ Featured</span> ' : ''}<a href="${tournamentPath(db, t)}"><b>${esc(t.name)}</b></a><br><small class="muted">${esc(v.name)}${showCity ? ` · ${esc(v.city)}, ${esc(v.state)}` : ''}${gameWord(t.game) ? ' · ' + esc(t.game) : ''}${t.entry != null ? ' · ' + money(t.entry) + ' entry' : ''}${t.added ? ' · ' + money(t.added) + ' added' : ''}${going.get(t.id) ? ` · <b>👍 ${going.get(t.id)} going</b>` : ''}</small></td></tr>`;
  }
  return html + (month ? '</tbody></table></div>' : '');
}

// Guides that match a tournament's game (articles live in guides.js).
const GUIDE_FOR_GAME = { '8-Ball': ['8-ball-rules', '8-Ball rules'], '9-Ball': ['9-ball-rules', '9-Ball rules'], '10-Ball': ['10-ball-rules', '10-Ball rules'],
  'Scotch Doubles': ['scotch-doubles', 'how Scotch Doubles works'], 'One Pocket': ['one-pocket', 'One Pocket basics'], 'Straight Pool': ['straight-pool-rules', 'straight pool rules'] };
// A listing with nothing but a name, room and date: kept on the site and in every list, but left out of
// search results so the index is made of pages with real detail.
export function isThinListing(t) {
  const notes = String(t.notes || '').replace(/source:\s*[\w.-]+/gi, '').replace(/recurring[^.]*/gi, '').replace(/[\s.]+/g, ' ').trim();
  return t.entry == null && !t.added && !t.time && !t.race && !t.format && !t.registrationUrl && !t.hasFlyer && !notes && !t.venue?.address;
}

// For the admin Featured tools: resolve an id, slug or full URL to a listed tournament.
export function tournamentRef(db, ref) {
  const ix = index(db), str = String(ref ?? '').trim();
  const m = str.match(/\/tournament\/([a-z0-9-]+)/) || str.match(/^([a-z0-9-]*[a-z][a-z0-9-]*)$/);
  const t = /^\d+$/.test(str) ? ix.byId.get(Number(str)) : m ? findTournamentBySlug(db, m[1]) : null;
  return t ? { id: t.id, name: t.name, date: t.date, path: tournamentPath(db, t), t } : null;
}
// Every upcoming date of the same weekly event within `days` (for the Featured Weekly Night plan).
export function seriesWithin(db, t, days) {
  const today = todayIso(), end = new Date(Date.parse(today + 'T00:00:00Z') + days * 864e5).toISOString().slice(0, 10);
  return [t, ...seriesOf(db, t)].filter(x => x.date >= today && x.date <= end);
}

// ---- tournament page ----

// Other dates of the same event: same room, same weekday and the same name once weekday words are removed.
const nameKey = n => String(n || '').toLowerCase().replace(/\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\bnight\b|\bweekly\b|[^a-z0-9]/g, '');
function seriesOf(db, t) {
  const ix = index(db), room = ix.primaryVenue.get(t.venue.id) ?? t.venue.id, dow = new Date(t.date + 'T00:00:00Z').getUTCDay(), k = nameKey(t.name);
  return ix.all.filter(x => x.id !== t.id && (ix.primaryVenue.get(x.venue.id) ?? x.venue.id) === room && nameKey(x.name) === k && new Date(x.date + 'T00:00:00Z').getUTCDay() === dow);
}

export function tournamentPage(db, cfg, t) {
  const v = t.venue, today = todayIso(), ix = index(db);
  const ended = t.date < today;
  const path = tournamentPath(db, t);
  const where = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ');
  const g = gameWord(t.game);
  const title = `${t.name} – ${v.city}, ${v.state} ${g ? g + ' ' : ''}Tournament, ${shortDate(t.date)} ${t.date.slice(0, 4)}`;
  const description = `${g || 'Pool'} tournament at ${v.name} in ${v.city}, ${v.state} on ${longDate(t.date)}${t.time ? ' at ' + fmtTime(t.time) : ''}.${t.entry != null ? ` Entry ${money(t.entry)}.` : ''}${t.added ? ` ${money(t.added)} added.` : ''}${t.race ? ` ${t.race}.` : ''} Details, directions and more tournaments nearby.`;
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, { name: STATE_NAMES[v.state] || v.state, path: facetPath({ state: v.state }) },
    { name: v.city, path: facetPath({ state: v.state, city: v.city }) }, { name: t.name, path }]);
  const rows = [['Date', `${longDate(t.date)}${t.time ? ' at ' + fmtTime(t.time) : ''}`], ['Game', g], ['Entry fee', money(t.entry)], ['Added money', money(t.added)],
    ['Race', t.race], ['Format', t.format], ['Table size', t.tableSize], ['Player limit', t.limit], ['Director', [t.director?.name, t.director?.phone].filter(Boolean).join(' · ')]]
    .filter(r => r[1]).map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('');
  const up = ix.all.filter(x => x.date >= today && x.id !== t.id);
  const sameVenue = up.filter(x => sameRoom(db, x.venue.id, v.id)).slice(0, 8);
  const sameCity = up.filter(x => x.venue.state === v.state && slugify(x.venue.city) === slugify(v.city) && !sameRoom(db, x.venue.id, v.id)).slice(0, 8);
  const sameGameState = g ? up.filter(x => x.venue.state === v.state && x.game === t.game && slugify(x.venue.city) !== slugify(v.city)).slice(0, 8) : [];
  const mini = list => list.map(x => `<li><a href="${tournamentPath(db, x)}">${esc(x.name)}</a> <span class="muted">· ${esc(shortDate(x.date))} · ${esc(x.venue.name)}${x.venue.city !== v.city ? ', ' + esc(x.venue.city) : ''}</span></li>`).join('');
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([v.name, where].join(', '))}`;
  const body = `${bc.html}
  <article class="card">
    ${(() => {
      const series = seriesOf(db, t), nextUp = series.filter(x => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
      const weekly = series.length >= 1 ? `<span class="chip" style="margin:0 0 8px;display:inline-block">🔁 Runs every ${WEEKDAYS[(new Date(t.date + 'T00:00:00Z').getUTCDay() + 6) % 7]}</span>` : '';
      if (ended) return nextUp ? `<div class="seo-ended" style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center"><span>This date has passed, but it runs again.</span><a class="btn btn-green" href="${tournamentPath(db, nextUp)}">Next one: ${esc(shortDate(nextUp.date))} →</a></div>${weekly}` : '<p class="seo-ended">This tournament has already been played. See upcoming tournaments below.</p>';
      return weekly;
    })()}
    <h1 class="dtitle">${esc(t.name)}</h1>
    <p class="lead-muted">${esc(g || 'Pool')} tournament at <b>${esc(v.name)}</b> in ${esc(v.city)}, ${esc(STATE_NAMES[v.state] || v.state)} on <b>${esc(longDate(t.date))}</b>${t.time ? ' at ' + esc(fmtTime(t.time)) : ''}.${ended ? '' : (() => { const d = Math.round((Date.parse(t.date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
      return ` <span class="when-badge${d === 0 ? ' when-today' : ''}" style="vertical-align:middle">${d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`}</span>`; })()}</p>
    <table class="t"><tbody>${rows}</tbody></table>
    <h2 class="seo-h2">Where</h2>
    <p><b>${esc(v.name)}</b><br>${esc(where)}${v.phone ? `<br>📞 <a href="tel:${esc(String(v.phone).replace(/[^\d+]/g, ''))}">${esc(v.phone)}</a>` : ''}</p>
    <div class="actbar"><a class="btn btn-out" href="${esc(maps)}" rel="noopener" target="_blank">Directions</a>
      ${t.registrationUrl ? `<a class="btn btn-blue" href="${esc(t.registrationUrl)}" rel="noopener nofollow" target="_blank">Register</a>` : ''}
      ${t.website ? `<a class="btn btn-out" href="${esc(t.website)}" rel="noopener nofollow" target="_blank">Website</a>` : ''}
      <a class="btn btn-green" href="/#/t/${t.id}">Save / Share in the App</a>${ended ? '' : (() => { const n = D.goingCount(db, t.id); return `<button type="button" class="btn btn-out going-btn" data-going="${t.id}" data-count="${n}">👍 I'm going${n ? ` · ${n}` : ''}</button>`; })()}</div>
    ${ended ? '' : `<div class="actbar cal-bar" style="margin-top:8px"><span class="muted" style="align-self:center;font-size:14px">Add to calendar:</span><a class="btn btn-out" href="${esc(googleCalUrl(cfg, db, t))}" rel="noopener nofollow" target="_blank">Google</a><a class="btn btn-out" href="/t/${t.id}/event.ics" rel="nofollow" download>Apple / Outlook (.ics)</a></div><p class="muted" style="font-size:13.5px;margin:6px 0 0">Go every week? <a href="${venuePath(db, v)}">Subscribe to all tournaments at ${esc(v.name)}</a>.</p>`}
    ${t.hasFlyer ? `<img class="previewimg" src="/api/tournaments/${t.id}/flyer" alt="Flyer for ${esc(t.name)}" loading="lazy"><p class="muted" style="font-size:13.5px;margin:6px 0 0">Not sure what it all means? <a href="/guides/how-to-read-a-tournament-flyer">How to read a tournament flyer</a>.</p>` : ''}
    ${t.notes && !/^source:/i.test(t.notes) ? `<p style="margin-top:12px">${esc(t.notes.replace(/\s*Source:.*$/i, ''))}</p>` : ''}
    <p class="muted" style="font-size:13px;margin-top:14px">Details can change. Confirm with the room before you go. Run this event? <a href="/#/claim/${t.id}">Claim it</a> · <a href="/#/report/${t.id}">Report a problem</a></p>
  </article>
  <section class="card" style="margin-top:16px;padding:14px 18px"><h2 class="seo-h2" style="margin-top:0">New to tournaments?</h2>
    <p class="muted" style="margin:6px 0">${GUIDE_FOR_GAME[t.game] ? `Brush up on <a href="/guides/${GUIDE_FOR_GAME[t.game][0]}">${GUIDE_FOR_GAME[t.game][1]}</a>, then read ` : 'Read '}<a href="/guides/first-pool-tournament">what to expect at your first tournament</a> and <a href="/guides/double-elimination-brackets">how double-elimination brackets work</a>.</p><p class="muted" style="margin:6px 0">Warming up? Take today's <a href="/play/aim-trainer">aim trainer challenge</a> or learn a <a href="/trick-shots/">trick shot</a>.</p></section>
  ${shareBox(cfg, db, t, g)}
  ${featuredBox(db, up.filter(x => x.id !== t.id && x.venue.state === v.state), { max: 2 })}
  ${sameVenue.length ? `<section class="sec seo-sec"><h2>More at ${esc(v.name)}</h2><ul class="seo-list">${mini(sameVenue)}</ul><a href="${venuePath(db, v)}">All tournaments at ${esc(v.name)} →</a></section>` : ''}
  ${(() => {
    if (v.lat == null || v.lng == null) return '';
    const R = 3958.8, rad = Math.PI / 180, mi = (a, b) => { const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad, x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
    const end = new Date(Date.parse(today + 'T00:00:00Z') + 14 * 864e5).toISOString().slice(0, 10);
    const near = up.filter(x => x.date <= end && x.venue.lat != null && x.venue.lng != null && !sameRoom(db, x.venue.id, v.id)).map(x => [x, mi(v, x.venue)]).filter(([, d]) => d <= 40).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).slice(0, 8);
    return near.length ? `<section class="sec seo-sec"><h2>Nearby in the next 2 weeks</h2><ul class="seo-list">${near.map(([x, d]) => `<li><a href="${tournamentPath(db, x)}">${esc(x.name)}</a> <span class="muted">· ${esc(shortDate(x.date))} · ${esc(x.venue.name)}, ${esc(x.venue.city)} · ${d < 10 ? d.toFixed(1) : Math.round(d)} mi</span></li>`).join('')}</ul></section>` : '';
  })()}
  ${sameCity.length ? `<section class="sec seo-sec"><h2>More pool tournaments in ${esc(v.city)}</h2><ul class="seo-list">${mini(sameCity)}</ul><a href="${facetPath({ state: v.state, city: v.city })}">All ${esc(v.city)} tournaments →</a></section>` : ''}
  ${sameGameState.length ? `<section class="sec seo-sec"><h2>${esc(g)} tournaments elsewhere in ${esc(STATE_NAMES[v.state] || v.state)}</h2><ul class="seo-list">${mini(sameGameState)}</ul><a href="${facetPath({ state: v.state, game: t.game })}">All ${esc(g)} tournaments in ${esc(STATE_NAMES[v.state] || v.state)} →</a></section>` : ''}
  <section class="sec seo-sec"><div class="chips">
    <a class="chip" href="${facetPath({ state: v.state })}">${esc(STATE_NAMES[v.state] || v.state)} tournaments</a>
    <a class="chip" href="${facetPath({ state: v.state, city: v.city })}">${esc(v.city)} tournaments</a>
    ${g && gameSlug(t.game) ? `<a class="chip" href="${facetPath({ state: v.state, city: v.city, game: t.game })}">${esc(g)} in ${esc(v.city)}</a><a class="chip" href="${facetPath({ game: t.game })}">${esc(g)} tournaments nationwide</a>` : ''}
  </div></section>`;
  return layout(cfg, { title, description, path, body, jsonld: [eventLd(cfg, db, t), bc.ld], ogImage: `${cfg.publicUrl}/t/${t.id}/og.png`, noindex: isThinListing(t), scripts: ['/going.js'] });
}

function shareBox(cfg, db, t, g) {
  const url = cfg.publicUrl + tournamentPath(db, t), v = t.venue;
  const text = `${t.added ? money(t.added) + ' added ' : ''}${g || 'Pool'} tournament: ${t.name} at ${v.name}, ${v.city}, ${v.state} on ${shortDate(t.date)}${t.entry != null ? `. ${money(t.entry)} entry` : ''}.`;
  const u = encodeURIComponent(url), tx = encodeURIComponent(text);
  return `<section id="share" class="card share-box" data-share-url="${esc(url)}" data-share-title="${esc(t.name)}" data-share-text="${esc(text)}" data-share-card="/t/${t.id}/card-square.png">
    <div class="share-grid"><details class="share-peek"><summary>🖼️ Preview the share graphic</summary><img class="share-preview" src="/t/${t.id}/card-square.png" alt="Share card for ${esc(t.name)}" width="1080" height="1080" loading="lazy"></details>
    <div><h2 class="seo-h2" style="margin-top:0">Share this tournament</h2>
    <p class="muted">Post it and help fill the bracket. The link shows this graphic automatically on Facebook, TikTok, X and in texts.</p>
    <div class="actbar"><button type="button" class="btn btn-green" data-share="native" hidden>Share…</button>
      <a class="btn btn-blue" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${u}">Facebook</a>
      <a class="btn btn-out" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${u}&amp;text=${tx}">X</a>
      <a class="btn btn-out" href="sms:?&amp;body=${tx}%20${u}">Text</a>
      <button type="button" class="btn btn-out" data-share="copy">Copy Link</button></div>
    <p class="muted" style="margin:14px 0 6px;font-size:14px">Download the graphic:</p>
    <div class="actbar"><a class="btn btn-out btn-sm" href="/t/${t.id}/card-square.png?download" download>Square post (Instagram / Facebook)</a>
      <a class="btn btn-out btn-sm" href="/t/${t.id}/card-story.png?download" download>Tall (TikTok / Reels / Stories)</a>
      <a class="btn btn-out btn-sm" href="/t/${t.id}/og.png?download" download>Wide</a></div></div></div>
  </section>`;
}

// ---- landing pages: /tournaments/, /tournaments/<state>[/<city>][/<game>], /tournaments/<game> ----

// "At a glance" numbers for a listing page, worked out from its own upcoming events.
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function glanceHtml(list, where, rooms, showGame) {
  if (list.length < 5) return '';
  const top = (arr) => { const m = new Map(); for (const k of arr) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
  const nights = top(list.map(t => DOW[new Date(t.date + 'T00:00:00Z').getUTCDay()]));
  const games = top(list.map(t => t.game && t.game !== 'Other' && String(t.game).replace(/^(\d+)[\s-]*Ball$/i, '$1-Ball').replace(/^8-Ball Scotch Doubles$|^9-Ball Scotch Doubles$/i, 'Scotch Doubles')));
  const fees = list.map(t => t.entry).filter(n => n != null && n > 0).sort((a, b) => a - b);
  const median = fees.length >= 3 ? fees[Math.floor(fees.length / 2)] : null;
  const added = list.filter(t => t.added > 0).length;
  const tiles = [
    ['Busiest night', nights[0] ? `${nights[0][0]}s` : '', nights[0] ? `${nights[0][1]} of ${list.length} events` : ''],
    showGame && games[0] ? ['Most played', games[0][0], `${Math.round(games[0][1] * 100 / list.length)}% of events`] : null,
    median != null ? ['Typical entry', '$' + median, `from $${fees[0]} to $${fees[fees.length - 1]}`] : null,
    ['Pool rooms', String(rooms), added ? `${added} added-money event${added > 1 ? 's' : ''}` : 'with upcoming events']
  ].filter(Boolean);
  return `<section class="glance" aria-label="At a glance"><h2 class="glance-h">${esc(where)} at a glance</h2><div class="glance-grid">${tiles.map(([k, v, sub]) => `<div><small>${k}</small><b>${esc(v)}</b><span>${esc(sub)}</span></div>`).join('')}</div></section>`;
}

// Plain-English answers built from the listings, for state and city pages. Returns { html, ld } or null.
function faqFor(db, upcoming, where, scope) {
  if (upcoming.length < 5) return null;
  const today = todayIso(), ix = index(db);
  const tally = arr => { const m = new Map(); for (const k of arr) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
  const tonight = upcoming.filter(t => t.date === today);
  const nights = tally(upcoming.map(t => DOW[new Date(t.date + 'T00:00:00Z').getUTCDay()]));
  const fees = upcoming.map(t => t.entry).filter(n => n != null && n > 0).sort((a, b) => a - b);
  const rooms = new Map();
  for (const t of upcoming) { const k = ix.primaryVenue.get(t.venue.id) ?? t.venue.id; const r = rooms.get(k) || { v: t.venue, n: 0 }; r.n++; rooms.set(k, r); }
  const topRooms = [...rooms.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  const big = upcoming.filter(t => t.added > 0).sort((a, b) => b.added - a.added)[0];
  const qa = [];
  qa.push([`Is there a pool tournament tonight in ${where}?`, tonight.length
    ? `Yes. ${plural(tonight.length, 'tournament')} ${tonight.length === 1 ? 'is' : 'are'} listed for tonight, including <a href="${tournamentPath(db, tonight[0])}">${esc(tonight[0].name)}</a> at ${esc(tonight[0].venue.name)}. See the full list on the <a href="${scope.tonight}">tonight page</a>.`
    : `Nothing is listed for tonight yet. The next one is <a href="${tournamentPath(db, upcoming[0])}">${esc(upcoming[0].name)}</a> on ${esc(longDate(upcoming[0].date))}.`]);
  if (nights[0]) qa.push([`What night has the most pool tournaments in ${where}?`, `${nights[0][0]}s, with ${nights[0][1]} of the ${upcoming.length} upcoming events.${nights[1] ? ` ${nights[1][0]}s are next with ${nights[1][1]}.` : ''}`]);
  if (fees.length >= 3) qa.push([`How much does it cost to enter a pool tournament in ${where}?`, `Most entry fees are around ${money(fees[Math.floor(fees.length / 2)])}. They range from ${money(fees[0])} to ${money(fees[fees.length - 1])}. Many weekly tournaments also charge a small table fee, so check each listing.`]);
  if (topRooms.length) qa.push([`Which pool halls in ${where} run the most tournaments?`, topRooms.map(r => `<a href="${venuePath(db, r.v)}">${esc(r.v.name)}</a> (${plural(r.n, 'upcoming event')})`).join(', ') + '.']);
  if (big) qa.push([`What is the biggest upcoming pool tournament in ${where}?`, `<a href="${tournamentPath(db, big)}">${esc(big.name)}</a> at ${esc(big.venue.name)} on ${esc(longDate(big.date))}, with ${money(big.added)} added.`]);
  qa.push([`How do I get my tournament listed?`, `Post it free on the <a href="/post">post a tournament</a> page. Weekly events can be posted for several weeks at once.`]);
  const strip = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return {
    html: `<section class="sec seo-sec faq"><h2>Questions about pool tournaments in ${esc(where)}</h2>${qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</section>`,
    ld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) }
  };
}

export function listingPage(db, cfg, parts) {
  const f = parts.length ? parseFacets(db, parts) : { state: null, city: null, game: null };
  if (!f) return null;
  if (!f.state && !f.game) return statesIndexPage(db, cfg);
  const ix = index(db), today = todayIso();
  const inScope = ix.all.filter(t => matches(t, f));
  const upcoming = inScope.filter(t => t.date >= today);
  const past = inScope.filter(t => t.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const stateName = f.state ? STATE_NAMES[f.state] : '';
  const place = f.city ? `${f.cityName}, ${stateName}` : stateName;
  const g = f.game || '';
  const h1 = `${g ? g + ' ' : ''}Pool Tournaments${place ? ' in ' + place : ' Nationwide'}`;
  const path = facetPath({ state: f.state, city: f.cityName, game: f.game });
  const venues = new Map();
  for (const t of upcoming) { const k = ix.primaryVenue.get(t.venue.id) ?? t.venue.id; venues.set(k, { v: venues.get(k)?.v || t.venue, n: (venues.get(k)?.n || 0) + 1 }); }
  const next = upcoming[0];
  const entries = upcoming.map(t => t.entry).filter(n => n != null);
  const intro = upcoming.length
    ? `There ${upcoming.length === 1 ? 'is' : 'are'} <b>${plural(upcoming.length, `upcoming ${g ? g + ' ' : ''}pool tournament`)}</b>${place ? ` in ${esc(place)}` : ' across the US'} at ${plural(venues.size, 'pool room')}. The next one is <a href="${tournamentPath(db, next)}">${esc(next.name)}</a> at ${esc(next.venue.name)}${f.city ? '' : ` in ${esc(next.venue.city)}`} on ${esc(longDate(next.date))}.${entries.length ? (Math.min(...entries) === Math.max(...entries) ? ` Entry is ${money(entries[0])}.` : ` Entry fees run from ${money(Math.min(...entries))} to ${money(Math.max(...entries))}.`) : ''} Listings update every day.`
    : `No upcoming ${g ? g + ' ' : ''}tournaments are listed${place ? ' in ' + esc(place) : ''} right now. New events are added every day. Check back, browse nearby below, or <a href="/post">post one for free</a>.`;
  const description = upcoming.length
    ? `${plural(upcoming.length, `upcoming ${g ? g + ' ' : ''}pool tournament`)}${place ? ' in ' + place : ' in the US'}: dates, pool halls, entry fees and added money. Next: ${next.name} on ${shortDate(next.date)}. Updated daily.`
    : `Find ${g ? g + ' ' : ''}pool tournaments${place ? ' in ' + place : ''}: dates, pool halls and entry fees, updated daily.`;
  const title = `${h1} (${upcoming.length ? plural(upcoming.length, 'Upcoming Event') : 'Updated Daily'}) | Billiard Action Time`;
  const trail = [{ name: 'Tournaments', path: '/tournaments/' }];
  if (f.state) trail.push({ name: stateName, path: facetPath({ state: f.state }) });
  if (f.city) trail.push({ name: f.cityName, path: facetPath({ state: f.state, city: f.cityName }) });
  if (g) trail.push({ name: g, path });
  const bc = crumbs(cfg, trail);

  // "browse further" links: only to pages that actually have upcoming events
  const upAll = ix.all.filter(t => t.date >= today);
  const tally = (list, key) => { const m = new Map(); for (const t of list) { const k = key(t); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
  const scopeNoGame = upAll.filter(t => matches(t, { ...f, game: null }));
  const gameLinks = tally(scopeNoGame, t => gameSlug(t.game) && t.game).filter(([gg]) => gg !== f.game)
    .map(([gg, n]) => `<a class="chip" href="${facetPath({ state: f.state, city: f.cityName, game: gg })}">${esc(gg)}${place ? ' in ' + esc(f.cityName || stateName) : ''} (${n})</a>`).join('');
  const cityLinks = f.state && !f.city ? tally(upAll.filter(t => matches(t, { state: f.state, game: f.game })), t => t.venue.city)
    .slice(0, 60).map(([c, n]) => `<a class="chip" href="${facetPath({ state: f.state, city: c, game: f.game })}">${esc(c)} (${n})</a>`).join('') : '';
  const stateLinks = !f.state ? tally(upAll.filter(t => matches(t, { game: f.game })), t => t.venue.state)
    .map(([s, n]) => `<a class="chip" href="${facetPath({ state: s, game: f.game })}">${esc(STATE_NAMES[s] || s)} (${n})</a>`).join('') : '';
  const up1 = f.game && (f.state || f.city) ? `<a class="chip" href="${facetPath({ state: f.state, city: f.cityName })}">All games${place ? ' in ' + esc(f.cityName || stateName) : ''}</a>` : '';
  const upState = f.city ? `<a class="chip" href="${facetPath({ state: f.state, game: f.game })}">${g ? esc(g) + ' in ' : 'All of '}${esc(stateName)}</a>` : '';

  const faq = f.state && !g ? faqFor(db, upcoming, f.cityName || stateName, { tonight: tonightPath(f.state) }) : null;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: upcoming.length,
    itemListElement: upcoming.slice(0, 100).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: cfg.publicUrl + tournamentPath(db, t), name: t.name })) };
  const body = `${bc.html}
  <div class="pagehead"><h1>${esc(h1)}</h1><p>${intro}</p>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-blue" href="/search?${new URLSearchParams({ ...(f.state ? { state: f.state } : {}), ...(f.cityName ? { city: f.cityName } : {}), ...(f.game ? { game: f.game } : {}) })}">Search &amp; Filter</a>
    <button type="button" class="btn btn-gold" data-near-sort hidden>📍 Sort by Distance</button><a class="btn btn-out" href="/alerts">Get Alerts</a><a class="btn btn-out" href="/post">Post a Tournament</a>${f.state && !f.city && !f.game ? `<a class="btn btn-gold" href="${tonightPath(f.state)}">Tonight in ${esc(stateName)}</a><a class="btn btn-out" href="${hallsPath(f.state)}">Pool Halls in ${esc(stateName)}</a><a class="btn btn-gold" href="${weekendPath(f.state)}">This Weekend in ${esc(stateName)}</a>` : !f.state && !f.city ? `<a class="btn btn-gold" href="/this-weekend/">This Weekend</a>` : ''}</div></div>
  ${glanceHtml(upcoming, place ? (f.cityName || stateName) : 'Nationwide', venues.size, !g)}
  ${f.city ? weeklyScheduleHtml(db, inScope, { showCity: false, title: `Weekly ${g ? g + ' ' : ''}tournaments in ${f.cityName}` }) : ''}
  ${f.state && !f.city && !f.game && upcoming.length ? (() => { const feed = `${cfg.publicUrl}${facetPath({ state: f.state })}/calendar.ics`.replace(/\/\/calendar/, '/calendar'), webcal = feed.replace(/^https?:/, 'webcal:');
    return `<p class="muted cal-sub" style="margin:0 0 14px">📅 <b>Subscribe:</b> get every ${esc(stateName)} tournament in your calendar, updated automatically: <a href="${esc(webcal)}">Apple / iPhone</a> · <a href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener nofollow">Google</a></p>`; })() : ''}
  ${featuredBox(db, upcoming, { showCity: !f.city })}
  ${upcoming.length ? eventRows(db, upcoming.slice(0, 300), { showCity: !f.city }) : ''}
  ${upcoming.length > 300 ? `<p class="muted">Showing the next 300. <a href="/search">Search for more</a>.</p>` : ''}
  ${venues.size ? `<section class="sec seo-sec"><h2>Pool rooms${place ? ' in ' + esc(f.cityName || stateName) : ''} running ${g ? esc(g) + ' ' : ''}tournaments</h2><ul class="seo-list seo-cols">${[...venues.values()].sort((a, b) => b.n - a.n).slice(0, 60)
    .map(({ v, n }) => `<li><a href="${venuePath(db, v)}">${esc(v.name)}</a> <span class="muted">· ${esc(v.city)}, ${esc(v.state)} · ${plural(n, 'event')}</span></li>`).join('')}</ul></section>` : ''}
  ${cityLinks ? `<section class="sec seo-sec"><h2>${g ? esc(g) + ' tournaments' : 'Tournaments'} by city in ${esc(stateName)}</h2><div class="chips">${cityLinks}</div></section>` : ''}
  ${stateLinks ? `<section class="sec seo-sec"><h2>${g ? esc(g) + ' tournaments' : 'Tournaments'} by state</h2><div class="chips">${stateLinks}</div></section>` : ''}
  ${gameLinks || up1 || upState ? `<section class="sec seo-sec"><h2>Browse by game</h2><div class="chips">${up1}${upState}${gameLinks}</div></section>` : ''}
  ${past.length ? `<section class="sec seo-sec"><h2>Recent ${g ? esc(g) + ' ' : ''}tournaments${place ? ' in ' + esc(f.cityName || stateName) : ''}</h2><ul class="seo-list">${past.map(t => `<li><a href="${tournamentPath(db, t)}">${esc(t.name)}</a> <span class="muted">· ${esc(shortDate(t.date))} ${t.date.slice(0, 4)} · ${esc(t.venue.name)}</span></li>`).join('')}</ul></section>` : ''}
  ${faq ? faq.html : ''}`;
  return layout(cfg, { title, description, path, body, jsonld: [bc.ld, ...(upcoming.length ? [itemList] : []), ...(faq ? [faq.ld] : [])], noindex: !upcoming.length, scripts: ['/near-sort.js'] });
}


// US tile map: one square per state, shaded by number of upcoming tournaments, each linking to its state page.
const TILES = { AK: [0, 0], ME: [11, 0], WI: [6, 1], VT: [10, 1], NH: [11, 1], WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], MI: [7, 2], NY: [9, 2], MA: [10, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3], RI: [11, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5], OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6], HI: [0, 7], TX: [4, 7], FL: [9, 7] };
function stateTileMap(counts) {
  const max = Math.max(1, ...counts.values()), S = 46, G = 4;
  const shade = n => !n ? 'var(--surface2)' : ['#cfe8d6', '#9fd1ad', '#5fb37a', '#2f8f52', '#14683a'][Math.min(4, Math.floor(Math.sqrt(n / max) * 5))];
  const ink = n => !n ? 'var(--muted)' : Math.min(4, Math.floor(Math.sqrt(n / max) * 5)) >= 3 ? '#fff' : '#0f1b2d';
  const tiles = Object.entries(TILES).map(([st, [x, y]]) => {
    const n = counts.get(st) || 0, name = STATE_NAMES[st] || st, X = x * (S + G), Y = y * (S + G);
    const inner = `<rect x="${X}" y="${Y}" width="${S}" height="${S}" rx="6" fill="${shade(n)}" stroke="var(--line)"/><text x="${X + S / 2}" y="${Y + 21}" text-anchor="middle" font-size="16" font-weight="700" fill="${ink(n)}" font-family="Arial">${st}</text><text x="${X + S / 2}" y="${Y + 38}" text-anchor="middle" font-size="14" fill="${ink(n)}" font-family="Arial">${n || ''}</text><title>${esc(name)}: ${n} upcoming</title>`;
    return n && STATE_NAMES[st] ? `<a href="${facetPath({ state: st })}" aria-label="${esc(name)}: ${n} upcoming tournaments">${inner}</a>` : `<g opacity=".75">${inner}</g>`;
  }).join('');
  const W = 12 * (S + G), H = 8 * (S + G);
  return `<figure class="card statemap" style="padding:14px;margin:0 0 16px"><svg viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="Map of upcoming pool tournaments by state" style="width:100%;height:auto;display:block;max-width:640px;margin:0 auto">${tiles}</svg>
  <figcaption class="muted" style="text-align:center;font-size:13px;margin-top:6px">Darker = more upcoming tournaments. Tap a state to see them.</figcaption></figure>`;
}

function statesIndexPage(db, cfg) {
  const ix = index(db), today = todayIso();
  const up = ix.all.filter(t => t.date >= today);
  const counts = new Map();
  for (const t of up) counts.set(t.venue.state, (counts.get(t.venue.state) || 0) + 1);
  const gameCounts = new Map();
  for (const t of up) if (gameSlug(t.game)) gameCounts.set(t.game, (gameCounts.get(t.game) || 0) + 1);
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }]);
  const states = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  const body = `${bc.html}<div class="pagehead"><h1>Pool Tournaments by State</h1>
    <p><b>${up.length.toLocaleString('en-US')}</b> upcoming pool and billiards tournaments across ${counts.size} states, updated every day. Pick a state to see every tournament, city and pool room.</p></div>
    ${stateTileMap(counts)}
    <section class="sec seo-sec" style="padding-top:0"><h2>By game</h2><div class="chips">${[...gameCounts].sort((a, b) => b[1] - a[1]).map(([g, n]) => `<a class="chip" href="${facetPath({ game: g })}">${esc(g)} (${n})</a>`).join('')}</div></section>
    <div class="card"><ul class="statelist">${states.map(([c, n]) => counts.get(c) ? `<li><a href="${facetPath({ state: c })}">${esc(n)}</a> <span class="muted">(${counts.get(c)})</span></li>` : `<li><span class="muted">${esc(n)} (0)</span></li>`).join('')}</ul></div>`;
  return layout(cfg, { title: 'Pool Tournaments by State – Find Billiards Tournaments Near You | Billiard Action Time', path: '/tournaments/',
    description: `${up.length} upcoming pool tournaments in ${counts.size} states. Browse 8-ball, 9-ball, 10-ball and one pocket tournaments by state and city, updated daily.`, body, jsonld: [bc.ld] });
}

// ---- venue page (kept at /venue/:id) ----

// Weekly schedule: events that repeat on the same weekday at the same room (seen at least twice in the last
// 60 days or upcoming), laid out Monday to Sunday. Returns '' when nothing repeats.
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function weeklyByDay(db, list) {
  const ix = index(db), today = todayIso(), from = new Date(Date.parse(today + 'T00:00:00Z') - 60 * 864e5).toISOString().slice(0, 10);
  const key = t => (ix.primaryVenue.get(t.venue.id) ?? t.venue.id) + '|' + new Date(t.date + 'T00:00:00Z').getUTCDay() + '|' + String(t.name).toLowerCase().replace(/\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\bnight\b|\bweekly\b|[^a-z0-9]/g, '');
  const groups = new Map();
  const DAY_RE = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
  const dayMismatch = t => { const m = String(t.name).match(DAY_RE); return m && m[1].toLowerCase() !== ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(t.date + 'T00:00:00Z').getUTCDay()]; };
  for (const t of list) { if (t.date < from || dayMismatch(t)) continue; const k = key(t); const g = groups.get(k) || { n: 0, next: null, last: t }; g.n++; if (t.date >= today && (!g.next || t.date < g.next.date)) g.next = t; groups.set(k, g); }
  const regular = [...groups.values()].filter(g => g.n >= 2 && g.next);
  if (!regular.length) return null;
  const byDay = WEEKDAYS.map(() => []);
  for (const g of regular) { const d = (new Date(g.next.date + 'T00:00:00Z').getUTCDay() + 6) % 7; byDay[d].push(g.next); }
  for (const evs of byDay) evs.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  return byDay;
}
function weeklyScheduleHtml(db, list, { showCity = true, title = 'Weekly schedule' } = {}) {
  const byDay = weeklyByDay(db, list);
  if (!byDay) return '';
  const rows = byDay.map((evs, d) => evs.length ? `<tr><th class="seo-date">${WEEKDAYS[d]}s</th><td>${evs.map(t =>
    `<div><a href="${tournamentPath(db, t)}">${esc(t.name)}</a> <span class="muted">· ${esc(t.venue.name)}${showCity ? ', ' + esc(t.venue.city) : ''}${t.time ? ' · ' + esc(fmtTime(t.time)) : ''}${t.entry != null ? ' · ' + esc(money(t.entry)) : ''}</span></div>`).join('')}</td></tr>` : '').join('');
  return `<section class="sec seo-sec"><h2>${esc(title)}</h2><p class="muted" style="margin:0 0 8px">Tournaments that run every week. Each links to the next date.</p><div class="card seo-tbl"><table class="t"><tbody>${rows}</tbody></table></div></section>`;
}

export function venuePage(db, cfg, venueId) {
  const ix = index(db), today = todayIso();
  const primary = ix.primaryVenue.get(venueId);
  if (primary == null) return null;
  if (primary !== venueId) return { redirect: `/venue/${primary}` };
  const all = ix.all.filter(t => ix.primaryVenue.get(t.venue.id) === primary);
  if (!all.length) return null;
  const v = (all.find(t => t.venue.address) || all[0]).venue;   // prefer the spelling that has a street address
  const up = all.filter(t => t.date >= today), past = all.filter(t => t.date < today).reverse().slice(0, 10);
  const path = `/venue/${venueId}`;
  const where = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ');
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, { name: STATE_NAMES[v.state] || v.state, path: facetPath({ state: v.state }) },
    { name: v.city, path: facetPath({ state: v.state, city: v.city }) }, { name: v.name, path }]);
  const place = { '@context': 'https://schema.org', '@type': 'Place', name: v.name, url: cfg.publicUrl + path,
    address: { '@type': 'PostalAddress', streetAddress: v.address || undefined, addressLocality: v.city, addressRegion: v.state, postalCode: v.zip || undefined, addressCountry: 'US' },
    ...(v.phone ? { telephone: v.phone } : {}), ...(v.lat != null && v.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}) };
  const body = `${bc.html}<div class="pagehead"><h1>${esc(v.name)}</h1><p>${esc(where)}${v.phone ? ` · 📞 <a href="tel:${esc(String(v.phone).replace(/[^\d+]/g, ''))}">${esc(v.phone)}</a>` : ''}</p>
    <p>${up.length ? `${plural(up.length, 'upcoming pool tournament')} at ${esc(v.name)} in ${esc(v.city)}, ${esc(STATE_NAMES[v.state] || v.state)}.` : `No upcoming tournaments listed at ${esc(v.name)} right now.`}</p>
    <div class="actbar"><a class="btn btn-out" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + ', ' + where)}">Directions</a><a class="btn btn-out" href="${facetPath({ state: v.state, city: v.city })}">More in ${esc(v.city)}</a></div></div>
    ${weeklyScheduleHtml(db, all, { showCity: false, title: `Weekly at ${v.name}` })}
    ${(() => {
      const all = [...hallsByState(db).values()].flat().filter(r => r.id !== primary);
      const R = 3958.8, rad = Math.PI / 180, mi = (a, b) => { const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad, x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
      const geo = v.lat != null && v.lng != null;
      const others = geo ? all.filter(r => r.v.lat != null && r.v.lng != null).map(r => [r, mi(v, r.v)]).filter(([, d]) => d <= 25).sort((a, b) => a[1] - b[1]).slice(0, 8)
        : all.filter(r => r.v.state === v.state && slugify(r.v.city) === slugify(v.city)).slice(0, 8).map(r => [r, null]);
      return others.length ? `<section class="sec seo-sec"><h2>${geo ? 'Other pool halls nearby' : `Other pool halls in ${esc(v.city)}`}</h2><ul class="seo-list">${others.map(([r, d]) => `<li><a href="${venuePath(db, r.v)}">${esc(r.v.name)}</a> <span class="muted">· ${esc(r.v.city)}${d != null ? ` · ${d < 10 ? d.toFixed(1) : Math.round(d)} mi` : ''}${roomNights(r).length ? ` · tournaments ${roomNights(r).join(', ')}` : ''}</span></li>`).join('')}</ul></section>` : ''; })()}
    ${up.length ? (() => { const feed = `${cfg.publicUrl}/venue/${venueId}/calendar.ics`, webcal = feed.replace(/^https?:/, 'webcal:');
      return `<section class="card" style="padding:14px 18px;margin-top:14px"><h2 class="seo-h2" style="margin-top:0">📅 Never miss a tournament here</h2><p class="muted" style="margin:4px 0 10px">Subscribe once and every upcoming tournament at ${esc(v.name)} shows up in your calendar, updated automatically.</p>
      <div class="actbar"><a class="btn btn-blue" href="${esc(webcal)}">iPhone / Apple Calendar</a><a class="btn btn-out" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener nofollow">Google Calendar</a><a class="btn btn-out" href="/venue/${venueId}/calendar.ics" download>Download (.ics)</a></div></section>`; })() : ''}
    ${up.length ? `<details class="card" style="padding:12px 16px;margin-top:14px"><summary style="cursor:pointer;font-weight:700">🖥️ Run this room? Show this schedule on your website</summary>
      <p class="muted" style="margin:8px 0">Paste this code into your website. It shows your next tournaments and updates automatically. Free.</p>
      <textarea readonly rows="3" style="width:100%;font:13px monospace;padding:8px;border:1px solid var(--line);border-radius:8px" aria-label="Embed code">&lt;iframe src="${esc(cfg.publicUrl)}/embed/venue/${venueId}" width="100%" height="420" style="border:0;max-width:520px" title="Tournaments at ${esc(esc(v.name))}" loading="lazy"&gt;&lt;/iframe&gt;</textarea>
      <p class="muted" style="font-size:13px;margin:6px 0 0">Dark website? Use <code>/embed/venue/${venueId}?theme=dark</code>. <a href="/embed/venue/${venueId}" target="_blank" rel="noopener">Preview</a></p>
      <p style="margin:10px 0 0">🖨️ <a href="/venue/${venueId}/poster">Print a poster of your tournament nights</a> for the wall or the front door.</p></details>` : ''}
    <p class="muted" style="margin:10px 0 0">More: <a href="${hallsPath(v.state)}">pool halls in ${esc(STATE_NAMES[v.state] || v.state)}</a> · <a href="${facetPath({ state: v.state, city: v.city })}">tournaments in ${esc(v.city)}</a> · <a href="${tonightPath(v.state)}">tonight in ${esc(STATE_NAMES[v.state] || v.state)}</a></p>
    ${up.length ? eventRows(db, up, { showCity: false }) : ''}
    ${past.length ? `<section class="sec seo-sec"><h2>Recent tournaments at ${esc(v.name)}</h2><ul class="seo-list">${past.map(t => `<li><a href="${tournamentPath(db, t)}">${esc(t.name)}</a> <span class="muted">· ${esc(shortDate(t.date))} ${t.date.slice(0, 4)}</span></li>`).join('')}</ul></section>` : ''}`;
  const nights = roomNights({ events: all.filter(t => t.date >= new Date(Date.parse(today + 'T00:00:00Z') - 90 * 864e5).toISOString().slice(0, 10)) });
  return layout(cfg, { title: nights.length ? `${v.name} – Pool Tournaments ${nights.join(', ')} · ${v.city}, ${v.state} | Billiard Action Time` : `${v.name} – Pool Tournaments in ${v.city}, ${v.state} | Billiard Action Time`, path, body,
    description: `${up.length ? plural(up.length, 'upcoming pool tournament') + ' at ' : 'Pool tournaments at '}${v.name}, ${v.city}, ${v.state}.${nights.length ? ` Weekly tournaments on ${nights.join(', ')}.` : ''} Dates, games, entry fees and directions.`,
    jsonld: [place, bc.ld], noindex: !up.length });
}

// ---- sitemap ----
export function sitemapXml(db, cfg, extra = []) {
  const ix = index(db), today = todayIso();
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const up = ix.all.filter(t => t.date >= today);
  const urls = new Map();
  const add = (path, lastmod, pri) => { if (!urls.has(path)) urls.set(path, { lastmod, pri }); };
  add('/', today, '1.0'); add('/tournaments/', today, '0.9');
  const facets = new Set();
  for (const t of up) {
    const s = t.venue.state, c = t.venue.city, g = gameSlug(t.game) ? t.game : null;
    if (!STATE_NAMES[s]) continue;
    facets.add(JSON.stringify({ state: s })); if (c) facets.add(JSON.stringify({ state: s, city: c }));
    if (g) { facets.add(JSON.stringify({ game: g })); facets.add(JSON.stringify({ state: s, game: g })); if (c) facets.add(JSON.stringify({ state: s, city: c, game: g })); }
  }
  for (const f of facets) { const o = JSON.parse(f); add(facetPath(o), today, o.city ? '0.6' : o.state ? '0.8' : '0.8'); }
  for (const t of ix.all) if (t.date >= cutoff && !isThinListing(t)) add(tournamentPath(db, t), (t.updatedAt || today).slice(0, 10), t.date >= today ? '0.7' : '0.3');
  for (const id of new Set(up.map(t => ix.primaryVenue.get(t.venue.id) ?? t.venue.id))) add(`/venue/${id}`, today, '0.5');
  const wk = weekendRange(today);
  add('/this-weekend/', today, '0.9');
  add('/tonight/', today, '0.9'); add('/new/', today, '0.7'); add('/pool-halls/', today, '0.8');
  for (const st of hallsByState(db).keys()) add(hallsPath(st), today, '0.7');
  const week = new Date(Date.parse(today + 'T00:00:00Z') + 7 * 864e5).toISOString().slice(0, 10);
  for (const st of new Set(up.filter(t => t.date <= week).map(t => t.venue.state))) if (STATE_NAMES[st]) add(tonightPath(st), today, '0.6');
  add('/big-tournaments/', today, '0.9');
  for (const st of new Set(up.filter(t => t.date >= wk.from && t.date <= wk.to).map(t => t.venue.state))) if (STATE_NAMES[st]) add(weekendPath(st), today, '0.7');
  for (const e of extra) add(e.path, e.lastmod || today, e.pri || '0.6');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(([p, u]) =>
    `<url><loc>${esc(cfg.publicUrl + p)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>`;
}

export function ensureFooter(db) { if (!footCache || Date.now() - footCache.at > 300_000) buildFooter(db); }
export const legacyStatePath = code => facetPath({ state: code });


// Turns phone numbers, emails and Facebook/Messenger links in text into tap-to-contact links.
// Everything else stays plain text (so spam links don't become clickable).
const CONTACT_RE = /((?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.com|fb\.me|m\.me|messenger\.com)\/[^\s<>"']+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b)/gi;
export function linkContacts(text) {
  const s = String(text ?? ''); let out = '', last = 0;
  for (const m of s.matchAll(CONTACT_RE)) {
    out += esc(s.slice(last, m.index)); last = m.index + m[0].length;
    const href = m[1] ? (/^https?:/i.test(m[1]) ? m[1] : 'https://' + m[1]) : m[2] ? 'mailto:' + m[2] : 'tel:' + m[3].replace(/[^\d+]/g, '');
    out += `<a href="${esc(href)}"${m[1] ? ' target="_blank" rel="noopener nofollow ugc"' : ''}>${esc(m[0])}</a>`;
  }
  return out + esc(s.slice(last));
}

// ---- shareable Match Finder post: /match/<id> ----
// A real page (not an app hash link) so Facebook, X and texts show who's looking for action.
// Posts expire within days, so these pages are kept out of search results.
export function matchStakes(p) {
  return p.stakeMin != null && p.stakeMax != null ? (p.stakeMin === p.stakeMax ? money(p.stakeMin) : `${money(p.stakeMin)}–${money(p.stakeMax)}`)
    : p.stakeMin != null ? `${money(p.stakeMin)}+` : p.stakeMax != null ? `Up to ${money(p.stakeMax)}` : 'Stakes open';
}
export function matchPage(cfg, p, comments) {
  const game = p.game === 'Other' ? 'any game' : p.game;
  const when = (p.until !== p.date ? `${shortDate(p.date)} – ${shortDate(p.until)}` : shortDate(p.date)) + (p.time ? ' · ' + fmtTime(p.time) : '');
  const open = p.status === 'open' && p.expiresMs > Date.now();
  const title = `${p.name} is looking for ${game} action in ${p.city}, ${p.state}`;
  const description = `${matchStakes(p)} · ${when}${p.room ? ' at ' + p.room : ''}. Want it? Tap I'm In on Billiard Action Time.`;
  const app = `/#/matches/${p.id}`;
  const body = `<div class="crumbs"><a href="/matches">Match Finder</a> / ${esc(p.name)}</div>
  <h1>Looking for a Match</h1>
  ${open ? '' : `<p class="seo-ended">${p.status === 'closed' ? 'This player found a match. The post is closed.' : 'This post has ended.'}</p>`}
  <article class="card matchcard"><div class="stake-top"><b class="match-name">${esc(p.name)}</b>${p.fargo ? `<span class="chip b">Fargo ${p.fargo}</span>` : ''}</div>
    <ul class="match-facts"><li><span aria-hidden="true">📍</span> ${esc(p.city)}, ${esc(p.state)}${p.room ? ' · ' + esc(p.room) : ''}</li>
    <li><span aria-hidden="true">🎱</span> ${esc(p.game === 'Other' ? 'Any game' : p.game)}</li><li><span aria-hidden="true">💰</span> ${esc(matchStakes(p))}</li>
    <li><span aria-hidden="true">📅</span> ${esc(when)}</li></ul>
    ${p.note ? `<p class="match-note">“${linkContacts(p.note)}”</p>` : ''}
    ${p.contact ? `<p>Reach them: <b>${linkContacts(p.contact)}</b></p>` : ''}
    <div class="actbar"><a class="btn btn-green" href="${app}">${open ? "I'm In" : 'See Details'}</a><a class="btn btn-gold" href="/matches">Find More Action</a></div></article>
  <h2 class="seo-h2">Comments (${comments.length})</h2>
  ${comments.length ? `<div class="mcomments">${comments.map(c => `<div class="mcomment"><b>${esc(c.name)}</b><p>${linkContacts(c.body)}</p>${c.contact ? `<p class="mcontact">📞 ${linkContacts(c.contact)}</p>` : ''}</div>`).join('')}</div>` : '<p class="muted">No comments yet.</p>'}
  <p><a class="btn btn-out" href="/#/matches/${p.id}?c=1">Add a Comment</a></p>
  <p class="stake-note">Match Finder only connects players. Billiard Action Time never takes, holds or pays out money. You must be 18+ and follow the laws where you play.</p>`;
  return layout(cfg, { title, description, path: `/match/${p.id}`, body, noindex: true });
}


// ---- "This Weekend" pages: /this-weekend/ and /this-weekend/<state>/ ----
// One link that always shows the coming Friday–Sunday. Made to be posted in Facebook groups every week:
// the address never changes, the list does, and the preview card says what's on.
export function weekendRange(today = todayIso()) {
  const [y, m, d] = today.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d)), dow = t.getUTCDay();          // 0 Sun … 6 Sat
  const iso = dt => dt.toISOString().slice(0, 10), add = n => new Date(t.getTime() + n * 86_400_000);
  if (dow === 5 || dow === 6 || dow === 0) return { from: today, to: iso(add(dow === 0 ? 0 : 7 - dow)) };   // Fri–Sun: through Sunday
  return { from: iso(add(5 - dow)), to: iso(add(7 - dow)) };                                                 // Mon–Thu: the coming Fri–Sun
}
export const weekendPath = state => state ? `/this-weekend/${stateSlug(state)}/` : '/this-weekend/';
const rangeLabel = ({ from, to }) => from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;

export function weekendPage(db, cfg, stateSlugPart) {
  const state = stateSlugPart ? STATE_BY_SLUG[String(stateSlugPart).toLowerCase()] : null;
  if (stateSlugPart && !state) return null;
  const ix = index(db), today = todayIso(), wk = weekendRange(today);
  const inState = t => !state || t.venue.state === state;
  const list = ix.all.filter(t => t.date >= wk.from && t.date <= wk.to && inState(t)).sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
  const soon = list.length ? [] : ix.all.filter(t => t.date >= today && inState(t)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 40);
  const stateName = state ? STATE_NAMES[state] : '';
  const where = stateName ? ` in ${stateName}` : '';
  const h1 = `Pool Tournaments This Weekend${where}`;
  const path = weekendPath(state);
  const big = list.filter(t => t.added || (t.entry != null && t.entry >= 50)).sort((a, b) => (b.added || 0) - (a.added || 0) || (b.entry || 0) - (a.entry || 0)).slice(0, 3);
  const games = [...new Set(list.map(t => gameWord(t.game)).filter(Boolean))];
  const intro = list.length
    ? `<b>${plural(list.length, 'pool tournament')}</b>${where || ' across the US'} this weekend (${esc(rangeLabel(wk))})${games.length ? `: ${esc(games.slice(0, 4).join(', '))}` : ''}.${big.length ? ` Biggest: ${big.map(t => `<a href="${tournamentPath(db, t)}">${esc(t.name)}</a> (${esc(t.venue.city)}${t.added ? ', ' + money(t.added) + ' added' : t.entry != null ? ', ' + money(t.entry) + ' entry' : ''})`).join('; ')}.` : ''} This page updates every day, so the same link always shows the coming weekend.`
    : `Nothing is listed${where} for this weekend (${esc(rangeLabel(wk))}) yet. Here is what's coming up next. Running an event? <a href="/post">Post it free</a>.`;
  const title = `${h1} (${rangeLabel(wk)})${list.length ? ` – ${plural(list.length, 'Event')}` : ''} | Billiard Action Time`;
  const description = list.length
    ? `${plural(list.length, 'pool tournament')}${where || ' in the US'} this weekend, ${rangeLabel(wk)}. Times, pool halls, entry fees and added money. Updated daily.`
    : `Pool tournaments${where} this weekend and coming up next: dates, pool halls and entry fees. Updated daily.`;
  const url = cfg.publicUrl + path, u = encodeURIComponent(url + '?utm_source=share');
  const shareText = list.length ? `${plural(list.length, 'pool tournament')}${where} this weekend (${rangeLabel(wk)})` : `Pool tournaments${where}`;
  const tx = encodeURIComponent(shareText);
  const states = !state ? (() => { const m = new Map(); for (const t of list) m.set(t.venue.state, (m.get(t.venue.state) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); })() : [];
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, ...(state ? [{ name: 'This Weekend', path: '/this-weekend/' }, { name: stateName, path }] : [{ name: 'This Weekend', path }])]);
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: list.length,
    itemListElement: list.slice(0, 100).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: cfg.publicUrl + tournamentPath(db, t), name: t.name })) };
  const body = `${bc.html}
  <div class="pagehead"><h1>${esc(h1)}</h1><p>${intro}</p>
    <div class="actbar" style="margin-top:12px"><button type="button" class="btn btn-gold" data-near-sort hidden>📍 Sort by Distance</button><a class="btn btn-gold" href="${tonightPath(state)}">Tonight${esc(where)}</a>${state ? `<a class="btn btn-blue" href="${facetPath({ state })}">All ${esc(stateName)} Tournaments</a><a class="btn btn-out" href="/this-weekend/">Whole Country</a>` : `<a class="btn btn-blue" href="/tournaments/">Browse by State</a>`}<a class="btn btn-out" href="/calendar">Calendar</a></div></div>
  ${states.length ? `<section class="sec seo-sec" style="padding-top:0"><h2>This weekend by state</h2><div class="chips">${states.map(([s, n]) => `<a class="chip" href="${weekendPath(s)}">${esc(STATE_NAMES[s] || s)} (${n})</a>`).join('')}</div></section>` : ''}
  ${featuredBox(db, list)}
  ${list.length ? eventRows(db, list.slice(0, 400), { showCity: true, byDay: true }) : soon.length ? `<h2 class="seo-h2">Coming up next${where}</h2>${eventRows(db, soon, { showCity: true })}` : ''}
  <section class="card share-box" data-share-url="${esc(url)}" data-share-title="${esc(h1)}" data-share-text="${esc(shareText)}">
    <h2 class="seo-h2" style="margin-top:0">Share this weekend's list</h2>
    <p class="muted">Post this link in your pool group. It always shows the coming weekend, so you can share the same link every week.</p>
    <div class="actbar"><button type="button" class="btn btn-green" data-share="native" hidden>Share…</button>
      <a class="btn btn-blue" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${u}">Facebook</a>
      <a class="btn btn-out" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${u}&amp;text=${tx}">X</a>
      <a class="btn btn-out" href="sms:?&amp;body=${tx}%20${u}">Text</a>
      <button type="button" class="btn btn-out" data-share="copy">Copy Link</button></div>
  </section>`;
  return layout(cfg, { title, description, path, body, jsonld: [bc.ld, ...(list.length ? [itemList] : [])], noindex: !list.length && !soon.length, scripts: ['/near-sort.js'], ogImage: listCardUrl(cfg, 'weekend', state) });
}

// Plain-HTML heading and intro for the home page. The app replaces it once it loads; search engines
// and link previews read it as-is.
export function homeIntroHtml(db) {
  const ix = index(db), today = todayIso(), wk = weekendRange(today);
  const up = ix.all.filter(t => t.date >= today);
  const weekend = up.filter(t => t.date >= wk.from && t.date <= wk.to).length;
  const states = new Set(up.map(t => t.venue.state)).size;
  const f = buildFooter(db).links;
  return `<section class="pagehead"><h1>Find Pool Tournaments Near You</h1>
  <p>Billiard Action Time lists <b>${plural(up.length, 'upcoming pool tournament')}</b> in ${plural(states, 'state')}: weekly 8-Ball and 9-Ball nights, added-money opens, One Pocket and Scotch Doubles events, with dates, pool halls and entry fees. Listings update every day.</p>
  <div class="actbar"><a class="btn btn-gold" href="/this-weekend/">This Weekend (${weekend})</a><a class="btn btn-gold" href="/big-tournaments/">Big Events</a><a class="btn btn-blue" href="/tournaments/">Browse by State</a><a class="btn btn-out" href="/calendar">Calendar</a><a class="btn btn-out" href="/alerts">Get Alerts</a><a class="btn btn-out" href="/guides/">Guides</a></div>
  <p class="muted" style="margin-top:12px">Popular: ${f.states.slice(0, 8).map(([s]) => `<a href="${facetPath({ state: s })}">${esc(STATE_NAMES[s] || s)}</a>`).join(' · ')}</p></section>`;
}


// ---- /big-tournaments/: added-money and bigger-entry events for the next two months ----
const BIG_NAME = /annual|classic|championship|memorial|\bcup\b|shootout|state open|\bopen\b.*(9|10|8)-?ball|\bstop \d|tour\b|invitational/i;
export const isBigEvent = t => !!t.added || (t.entry != null && t.entry >= 50) || BIG_NAME.test(t.name);
export function bigTournamentsPage(db, cfg) {
  const ix = index(db), today = todayIso();
  const [y, m, d] = today.split('-').map(Number);
  const until = new Date(Date.UTC(y, m - 1, d) + 62 * 86_400_000).toISOString().slice(0, 10);
  const list = ix.all.filter(t => t.date >= today && t.date <= until && isBigEvent(t)).sort((a, b) => a.date.localeCompare(b.date));
  const states = (() => { const mm = new Map(); for (const t of list) mm.set(t.venue.state, (mm.get(t.venue.state) || 0) + 1); return [...mm].sort((a, b) => b[1] - a[1]); })();
  const top = [...list].sort((a, b) => (b.added || 0) - (a.added || 0) || (b.entry || 0) - (a.entry || 0)).slice(0, 3);
  const h1 = 'Biggest Upcoming Pool Tournaments';
  const intro = list.length
    ? `<b>${plural(list.length, 'bigger tournament')}</b> in the next two months: added-money events, opens, championships, tour stops and events with entry fees of $50 or more.${top.length ? ` Headliners: ${top.map(t => `<a href="${tournamentPath(db, t)}">${esc(t.name)}</a> (${esc(t.venue.city)}, ${esc(t.venue.state)})`).join('; ')}.` : ''} Updated every day.`
    : 'No bigger tournaments are listed for the next two months yet. Check back soon.';
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, { name: 'Biggest Upcoming', path: '/big-tournaments/' }]);
  const body = `${bc.html}
  <div class="pagehead"><h1>${h1}</h1><p>${intro}</p>
    <div class="actbar" style="margin-top:12px"><button type="button" class="btn btn-gold" data-near-sort hidden>📍 Sort by Distance</button><a class="btn btn-gold" href="/this-weekend/">This Weekend</a><a class="btn btn-blue" href="/tournaments/">Browse by State</a><a class="btn btn-out" href="/alerts">Get Alerts</a></div></div>
  ${states.length ? `<section class="sec seo-sec" style="padding-top:0"><h2>By state</h2><div class="chips">${states.map(([st, n]) => `<a class="chip" href="${facetPath({ state: st })}">${esc(STATE_NAMES[st] || st)} (${n})</a>`).join('')}</div></section>` : ''}
  ${featuredBox(db, list)}
  ${list.length ? eventRows(db, list) : ''}
  <section class="card" style="margin-top:16px;padding:14px 18px"><h2 class="seo-h2" style="margin-top:0">Running a big event?</h2>
    <p class="muted" style="margin:6px 0">List it free and it shows up here, on its state page and in our weekly email. <a href="/post">Post a tournament →</a> Planning payouts? Try the <a href="/tools/payout-calculator">payout calculator</a>.</p><p class="muted" style="margin:6px 0">Planning a trip? See the <a href="/guides/major-pool-events-calendar">major pool events of the season</a>: Derby City Classic, league nationals in Las Vegas, Super Billiards Expo and more.</p></section>`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: list.length,
    itemListElement: list.slice(0, 100).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: cfg.publicUrl + tournamentPath(db, t), name: t.name })) };
  return layout(cfg, { title: `${h1} (Next 60 Days) | Billiard Action Time`, description: `${plural(list.length, 'bigger pool tournament')} coming up across the US: added-money events, opens, championships and tour stops, with dates, rooms and entry fees. Updated daily.`,
    path: '/big-tournaments/', body, jsonld: [bc.ld, ...(list.length ? [itemList] : [])], noindex: !list.length , scripts: ['/near-sort.js'], ogImage: listCardUrl(cfg, 'big') });
}

// "Play it near you" box for guide pages: the next few upcoming tournaments of one game, nationwide.
export function upcomingGameHtml(db, game, n = 6) {
  const slug = gameSlug(game), today = todayIso();
  if (!slug) return '';
  const end = new Date(Date.parse(today + 'T00:00:00Z') + 45 * 864e5).toISOString().slice(0, 10);
  const pool = index(db).all.filter(t => t.date >= today && t.date <= end && gameSlug(t.game) === slug && !isThinListing(t));
  const list = [...pool.filter(isBigEvent), ...pool.filter(t => !isBigEvent(t))].slice(0, n).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return '';
  return `<section class="sec seo-sec"><h2>Upcoming ${esc(game)} tournaments</h2><ul class="seo-list">${list.map(t => `<li><a href="${tournamentPath(db, t)}">${esc(t.name)}</a> <span class="muted">· ${esc(shortDate(t.date))} · ${esc(t.venue.city)}, ${esc(t.venue.state)}</span></li>`).join('')}</ul><a href="${facetPath({ game })}">All ${esc(game)} tournaments →</a> · <a href="/near">Near me →</a></section>`;
}

// Calendar file for one tournament. Times are "floating" (no time zone), so they show at the listed local
// time wherever the player is. Without a start time it is an all-day event.
export function tournamentIcs(cfg, db, t) {
  const v = t.venue, d = t.date.replace(/-/g, ''), e = x => String(x || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
  const next = new Date(Date.parse(t.date + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const when = t.time ? [`DTSTART:${d}T${t.time.replace(':', '')}00`, 'DURATION:PT5H'] : [`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`];
  const url = cfg.publicUrl + tournamentPath(db, t);
  const info = [gameWord(t.game) ? gameWord(t.game) + ' tournament' : 'Pool tournament', t.entry != null ? 'Entry ' + money(t.entry) : '', t.added ? money(t.added) + ' added' : '', 'Confirm details with the room before you go', url].filter(Boolean).join('. ');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Billiard Action Time//Tournaments//EN', 'CALSCALE:GREGORIAN', ...icsEvent(t, when, e, url, info, v), 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
function icsEvent(t, when, e, url, info, v) {
  return ['BEGIN:VEVENT', `UID:tournament-${t.id}@billiardactiontime.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, ...when,
    `SUMMARY:${e(t.name)}`, `LOCATION:${e([v.name, v.address, v.city, v.state, v.zip].filter(Boolean).join(', '))}`, `DESCRIPTION:${e(info)}`, `URL:${url}`,
    ...(t.time ? ['BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Pool tournament in 2 hours', 'END:VALARM'] : []), 'END:VEVENT'];
}
// Subscribable calendar of every upcoming tournament at one pool room (/venue/<id>/calendar.ics).
export function venueIcs(cfg, db, venueId) {
  const ix = index(db), today = todayIso(), primary = ix.primaryVenue.get(venueId);
  if (primary == null) return null;
  const list = ix.all.filter(t => (ix.primaryVenue.get(t.venue.id) ?? t.venue.id) === primary && t.date >= today).slice(0, 200);
  const name = list[0]?.venue.name || ix.all.find(t => ix.primaryVenue.get(t.venue.id) === primary)?.venue.name || 'Pool room';
  return calendarFeed(cfg, db, list, `${name} tournaments`);
}
// Subscribable calendar of every upcoming tournament in a state (/tournaments/<state>/calendar.ics).
export function stateIcs(cfg, db, slugPart) {
  const st = STATE_BY_SLUG[String(slugPart || '').toLowerCase()];
  if (!st) return null;
  const today = todayIso(), list = index(db).all.filter(t => t.venue.state === st && t.date >= today).slice(0, 400);
  return calendarFeed(cfg, db, list, `${STATE_NAMES[st]} pool tournaments`);
}
function calendarFeed(cfg, db, list, calName) {
  const lines = [];
  for (const t of list) {
    const v = t.venue, d = t.date.replace(/-/g, ''), e = x => String(x || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
    const next = new Date(Date.parse(t.date + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    const when = t.time ? [`DTSTART:${d}T${t.time.replace(':', '')}00`, 'DURATION:PT5H'] : [`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`];
    const url = cfg.publicUrl + tournamentPath(db, t);
    const info = [gameWord(t.game) ? gameWord(t.game) + ' tournament' : 'Pool tournament', t.entry != null ? 'Entry ' + money(t.entry) : '', 'Confirm details with the room before you go', url].filter(Boolean).join('. ');
    lines.push(...icsEvent(t, when, e, url, info, v));
  }
  const esc2 = x => String(x || '').replace(/[\\;,]/g, c => '\\' + c);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Billiard Action Time//Pool Room Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc2(calName)}`, 'X-PUBLISHED-TTL:PT12H', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', ...lines, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
function googleCalUrl(cfg, db, t) {
  const v = t.venue, d = t.date.replace(/-/g, '');
  let dates;
  if (t.time) { const [h, m] = t.time.split(':').map(Number), end = h + 5; const pad = n => String(n).padStart(2, '0');
    dates = `${d}T${pad(h)}${pad(m)}00/${end < 24 ? d + 'T' + pad(end) + pad(m) + '00' : d + 'T235900'}`; }
  else dates = `${d}/${new Date(Date.parse(t.date + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '')}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: t.name, dates, location: [v.name, v.address, v.city, v.state].filter(Boolean).join(', '), details: `${cfg.publicUrl}${tournamentPath(db, t)}` });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

// "Pool tournaments tonight" (/tonight/ and /tonight/<state>/): today's events, with tomorrow as a fallback.
export const tonightPath = state => state ? `/tonight/${stateSlug(state)}/` : '/tonight/';
export function tonightPage(db, cfg, stateSlugPart) {
  const state = stateSlugPart ? STATE_BY_SLUG[String(stateSlugPart).toLowerCase()] : null;
  if (stateSlugPart && !state) return null;
  const ix = index(db), today = todayIso(), tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const inState = t => !state || t.venue.state === state;
  const byTime = (a, b) => String(a.time || '99').localeCompare(String(b.time || '99')) || a.venue.state.localeCompare(b.venue.state) || a.venue.city.localeCompare(b.venue.city);
  const list = ix.all.filter(t => t.date === today && inState(t)).sort(byTime);
  const next = ix.all.filter(t => t.date === tomorrow && inState(t)).sort(byTime);
  const stateName = state ? STATE_NAMES[state] : '', where = stateName ? ` in ${stateName}` : '';
  const dayName = longDate(today).split(',')[0];
  const h1 = `Pool Tournaments Tonight${where}`;
  const path = tonightPath(state);
  const games = (() => { const m = new Map(); for (const t of list) { const g = gameWord(t.game); if (g) m.set(g, (m.get(g) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); })();
  const intro = list.length
    ? `<b>${plural(list.length, 'pool tournament')}</b>${where || ' across the US'} tonight, ${esc(longDate(today))}${games.length ? `: ${games.slice(0, 4).map(([g, n]) => `${esc(g)} (${n})`).join(', ')}` : ''}. Most weekly events start between 6 and 8 pm, so call the room to confirm sign-up time.`
    : `Nothing is listed${where} for tonight (${esc(longDate(today))}). ${next.length ? `Here's tomorrow's list.` : `See what's coming up this weekend.`}`;
  const states = !state ? (() => { const m = new Map(); for (const t of list) m.set(t.venue.state, (m.get(t.venue.state) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); })() : [];
  const title = `${h1} (${dayName}${list.length ? `, ${plural(list.length, 'Event')}` : ''}) | Billiard Action Time`;
  const description = list.length
    ? `${plural(list.length, 'pool tournament')}${where || ' in the US'} tonight, ${longDate(today)}: weekly 8-Ball and 9-Ball nights, pool halls, entry fees and directions. Updated daily.`
    : `Pool tournaments${where} tonight and tomorrow: weekly 8-Ball and 9-Ball nights, pool halls and entry fees. Updated daily.`;
  const url = cfg.publicUrl + path, u = encodeURIComponent(url + '?utm_source=share');
  const shareText = list.length ? `${plural(list.length, 'pool tournament')}${where} tonight` : `Pool tournaments${where} tonight`, tx = encodeURIComponent(shareText);
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, ...(state ? [{ name: 'Tonight', path: '/tonight/' }, { name: stateName, path }] : [{ name: 'Tonight', path }])]);
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: list.length,
    itemListElement: list.slice(0, 100).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: cfg.publicUrl + tournamentPath(db, t), name: t.name })) };
  const body = `${bc.html}
  <div class="pagehead"><h1>${esc(h1)}</h1><p>${intro}</p>
    <div class="actbar" style="margin-top:12px"><button type="button" class="btn btn-gold" data-near-sort hidden>📍 Sort by Distance</button><a class="btn btn-gold" href="/near" data-near-fallback>📍 Closest to Me</a><a class="btn btn-blue" href="${weekendPath(state)}">This Weekend${esc(where)}</a>${state ? `<a class="btn btn-out" href="/tonight/">Whole Country</a>` : `<a class="btn btn-out" href="/alerts">Get Alerts</a>`}</div></div>
  ${states.length ? `<section class="sec seo-sec" style="padding-top:0"><h2>Tonight by state</h2><div class="chips">${states.map(([s, n]) => `<a class="chip" href="${tonightPath(s)}">${esc(STATE_NAMES[s] || s)} (${n})</a>`).join('')}</div></section>` : ''}
  ${state && list.length > 3 ? (() => { const m = new Map(); for (const t of list) m.set(t.venue.city, (m.get(t.venue.city) || 0) + 1);
    return `<section class="sec seo-sec" style="padding-top:0"><h2>Tonight by city</h2><div class="chips">${[...m].sort((a, b) => b[1] - a[1]).map(([c, n]) => `<a class="chip" href="${facetPath({ state, city: c })}">${esc(c)} (${n})</a>`).join('')}</div></section>`; })() : ''}
  ${featuredBox(db, [...list, ...next])}
  ${list.length ? eventRows(db, list.slice(0, 400), { showCity: true }) : ''}
  ${next.length ? `<section class="sec seo-sec"><h2>Tomorrow${esc(where)} (${esc(shortDate(tomorrow))})</h2>${eventRows(db, next.slice(0, list.length ? 25 : 200), { showCity: true })}${list.length && next.length > 25 ? `<p class="muted">And ${next.length - 25} more tomorrow.</p>` : ''}</section>` : ''}
  <section class="card share-box" data-share-url="${esc(url)}" data-share-title="${esc(h1)}" data-share-text="${esc(shareText)}">
    <h2 class="seo-h2" style="margin-top:0">Looking for a game tonight?</h2>
    <p class="muted">Share this link with your pool friends. It always shows tonight's list, so the same link works every day.</p>
    <div class="actbar"><button type="button" class="btn btn-green" data-share="native" hidden>Share…</button>
      <a class="btn btn-blue" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${u}">Facebook</a>
      <a class="btn btn-out" href="sms:?&amp;body=${tx}%20${u}">Text</a>
      <button type="button" class="btn btn-out" data-share="copy">Copy Link</button></div>
  </section>`;
  return layout(cfg, { title, description, path, body, jsonld: [bc.ld, ...(list.length ? [itemList] : [])], noindex: !list.length && !next.length, scripts: ['/near-sort.js'], ogImage: listCardUrl(cfg, 'tonight', state) });
}

// "Just added" (/new/): upcoming tournaments first listed in the last 7 days, newest first, grouped by day.
export function recentlyAdded(db, days = 7) {
  const today = todayIso(), since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  return index(db).all.filter(t => t.date >= today && t.createdAt && t.createdAt >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.date.localeCompare(b.date));
}
export function newTournamentsPage(db, cfg) {
  const list = recentlyAdded(db, 7);
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, { name: 'Just added', path: '/new/' }]);
  const byDay = new Map();
  for (const t of list) { const d = t.createdAt.slice(0, 10); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(t); }
  const big = list.filter(isBigEvent).slice(0, 3);
  const body = `${bc.html}
  <div class="pagehead"><h1>Just Added: New Pool Tournaments</h1>
    <p>${list.length ? `<b>${plural(list.length, 'upcoming tournament')}</b> added in the last 7 days.${big.length ? ` Including ${big.map(t => `<a href="${tournamentPath(db, t)}">${esc(t.name)}</a>`).join(', ')}.` : ''}` : 'No new tournaments in the last 7 days. Check back soon: we add new events every day.'} New listings are added every day from pool rooms, directors and players.</p>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-gold" href="/alerts">Get Alerts by Email</a><a class="btn btn-out" href="/feed.xml">RSS Feed</a><a class="btn btn-out" href="/post">Post a Tournament</a></div></div>
  ${[...byDay].map(([d, ts]) => `<section class="sec seo-sec" style="padding-top:8px"><h2>Added ${esc(longDate(d))}</h2>${eventRows(db, ts, { showCity: true })}</section>`).join('')}`;
  return layout(cfg, { title: `New Pool Tournaments Added This Week${list.length ? ` (${list.length})` : ''} | Billiard Action Time`,
    description: `${list.length ? plural(list.length, 'new pool tournament') + ' added this week' : 'Newly added pool tournaments'}: weekly nights, opens and added-money events across the US. Updated daily.`,
    path: '/new/', body, jsonld: [bc.ld], noindex: !list.length });
}
export function rssFeed(db, cfg) {
  const items = recentlyAdded(db, 14).slice(0, 100);
  const x = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const rfc = s => new Date(s.replace(' ', 'T') + 'Z').toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Billiard Action Time: New Pool Tournaments</title><link>${x(cfg.publicUrl)}/new/</link>
<atom:link href="${x(cfg.publicUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
<description>Newly listed pool and billiards tournaments across the US.</description><language>en-us</language>
${items.map(t => { const u = cfg.publicUrl + tournamentPath(db, t), v = t.venue, g = gameWord(t.game);
  return `<item><title>${x(`${t.name} – ${v.city}, ${v.state} (${shortDate(t.date)})`)}</title><link>${x(u)}</link><guid isPermaLink="true">${x(u)}</guid><pubDate>${rfc(t.createdAt)}</pubDate>
<description>${x(`${g || 'Pool'} tournament at ${v.name}, ${v.city}, ${v.state} on ${longDate(t.date)}${t.time ? ' at ' + fmtTime(t.time) : ''}.${t.entry != null ? ' Entry ' + money(t.entry) + '.' : ''}${t.added ? ' ' + money(t.added) + ' added.' : ''}`)}</description></item>`; }).join('\n')}
</channel></rss>`;
}

// Pool hall directory (/pool-halls/ and /pool-halls/<state>/): rooms that ran or will run tournaments recently,
// grouped by city, with their weekly nights and next event.
function hallsByState(db) {
  const ix = index(db), today = todayIso(), from = new Date(Date.parse(today + 'T00:00:00Z') - 90 * 864e5).toISOString().slice(0, 10);
  const rooms = new Map();
  for (const t of ix.all) {
    if (t.date < from || !STATE_NAMES[t.venue.state]) continue;
    const id = ix.primaryVenue.get(t.venue.id) ?? t.venue.id;
    const r = rooms.get(id) || { id, v: t.venue, events: [], next: null };
    r.events.push(t); if (t.date >= today && (!r.next || t.date < r.next.date)) r.next = t;
    if (!r.v.address && t.venue.address) r.v = t.venue;
    rooms.set(id, r);
  }
  // Merge spellings of the same room in one city ("Bogies West" / "Bogies Billiards West"): compare names with
  // generic words removed; keep the record that has an address, and combine their events.
  const GENERIC = /\b(billiards?|bar|grill|and|the|sports?|pub|lounge|club|room|pool|hall|cafe|saloon|tavern|restaurant|n)\b|[^a-z0-9 ]/g;
  const core = r => `${r.v.state}|${slugify(r.v.city)}|${String(r.v.name || '').toLowerCase().replace(/['’]/g, '').replace(GENERIC, ' ').replace(/\s+/g, ' ').trim()}`;
  const merged = new Map();
  for (const r of rooms.values()) {
    const k = core(r), m = merged.get(k);
    if (!k.endsWith('|') && m) {
      const keep = m.v.address || !r.v.address ? m : r, other = keep === m ? r : m;
      keep.events = keep.events.concat(other.events);
      if (other.next && (!keep.next || other.next.date < keep.next.date)) keep.next = other.next;
      merged.set(k, keep);
    } else merged.set(k.endsWith('|') ? k + r.id : k, r);
  }
  const byState = new Map();
  for (const r of merged.values()) { const st = r.v.state; if (!byState.has(st)) byState.set(st, []); byState.get(st).push(r); }
  return byState;
}
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function roomNights(r) {
  const n = new Map();
  for (const t of r.events) { const d = new Date(t.date + 'T00:00:00Z').getUTCDay(); n.set(d, (n.get(d) || 0) + 1); }
  return [1, 2, 3, 4, 5, 6, 0].filter(d => (n.get(d) || 0) >= 2).map(d => DAYS_SHORT[d]);
}
export const hallsPath = st => st ? `/pool-halls/${stateSlug(st)}/` : '/pool-halls/';
export function poolHallsIndexPage(db, cfg) {
  const byState = hallsByState(db), total = [...byState.values()].reduce((a, l) => a + l.length, 0);
  const states = [...byState].sort((a, b) => (STATE_NAMES[a[0]] || a[0]).localeCompare(STATE_NAMES[b[0]] || b[0]));
  const bc = crumbs(cfg, [{ name: 'Pool Halls', path: '/pool-halls/' }]);
  const body = `${bc.html}<div class="pagehead"><h1>Pool Halls &amp; Bars With Pool Tournaments</h1>
    <p><b>${total.toLocaleString('en-US')}</b> pool halls, billiard rooms and bars in ${byState.size} states that run pool tournaments. Pick a state to see each room's weekly tournament nights and next event.</p></div>
    <div class="card"><ul class="statelist">${states.map(([st, l]) => `<li><a href="${hallsPath(st)}">${esc(STATE_NAMES[st] || st)}</a> <span class="muted">(${l.length})</span></li>`).join('')}</ul></div>
    <p style="margin-top:14px">Looking for a game tonight? See <a href="/tonight/">pool tournaments tonight</a> or <a href="/near">tournaments near you</a>.</p>`;
  return layout(cfg, { title: 'Pool Halls Near You That Run Tournaments, by State | Billiard Action Time', path: '/pool-halls/', body, jsonld: [bc.ld],
    description: `${total} pool halls, billiard rooms and bars that run pool tournaments, by state: weekly tournament nights, addresses and upcoming events.` });
}
export function poolHallsStatePage(db, cfg, slugPart) {
  const st = STATE_BY_SLUG[String(slugPart || '').toLowerCase()];
  if (!st) return null;
  const rooms = hallsByState(db).get(st) || [];
  if (!rooms.length) return null;
  const name = STATE_NAMES[st], byCity = new Map();
  for (const r of rooms) { const c = r.v.city || 'Other'; if (!byCity.has(c)) byCity.set(c, []); byCity.get(c).push(r); }
  const cities = [...byCity].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const bc = crumbs(cfg, [{ name: 'Pool Halls', path: '/pool-halls/' }, { name, path: hallsPath(st) }]);
  const card = r => { const nights = roomNights(r), addr = [r.v.address, r.v.city, r.v.state].filter(Boolean).join(', ');
    return `<li class="hall"><a href="${venuePath(db, r.v)}"><b>${esc(r.v.name)}</b></a><br><span class="muted">${esc(addr)}</span> <a class="muted" style="font-size:13px" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent([r.v.name, addr].join(', '))}" target="_blank" rel="noopener">Directions</a>
      ${nights.length ? `<br><span class="hall-nights">🔁 Tournaments: ${nights.join(', ')}</span>` : ''}
      ${r.next ? `<br><span class="muted">Next: <a href="${tournamentPath(db, r.next)}">${esc(r.next.name)}</a> · ${esc(shortDate(r.next.date))}</span>` : ''}</li>`; };
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: `Pool halls in ${name}`, numberOfItems: rooms.length,
    itemListElement: rooms.slice(0, 200).map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: cfg.publicUrl + venuePath(db, r.v), name: r.v.name })) };
  const body = `${bc.html}<div class="pagehead"><h1>Pool Halls in ${esc(name)} With Tournaments</h1>
    <p><b>${plural(rooms.length, 'pool hall')}</b> and bars in ${esc(name)} that run pool tournaments, in ${plural(byCity.size, 'city', 'cities')}. Each shows its regular tournament nights and next event.</p>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-blue" href="${facetPath({ state: st })}">${esc(name)} Tournaments</a><a class="btn btn-gold" href="${tonightPath(st)}">Tonight in ${esc(name)}</a><a class="btn btn-out" href="/pool-halls/">All States</a></div></div>
    ${cities.length > 4 ? `<p class="chips">${cities.map(([c, l]) => `<a class="chip" href="#city-${slugify(c)}">${esc(c)} (${l.length})</a>`).join('')}</p>` : ''}
    ${cities.map(([c, l]) => `<section class="sec seo-sec" id="city-${slugify(c)}" style="padding-top:12px"><h2>${esc(c)}</h2><ul class="hall-list">${l.sort((a, b) => (b.next ? 1 : 0) - (a.next ? 1 : 0) || a.v.name.localeCompare(b.v.name)).map(card).join('')}</ul></section>`).join('')}
    <p class="muted" style="margin-top:16px">Run a pool room that's missing? <a href="/post">Post your tournament free</a> and your room is added.</p>`;
  return layout(cfg, { title: `Pool Halls in ${name} With Pool Tournaments (${rooms.length}) | Billiard Action Time`, path: hallsPath(st), body, jsonld: [bc.ld, ld],
    description: `${rooms.length} pool halls and bars in ${name} that run pool tournaments: addresses, weekly tournament nights and upcoming events in ${cities.slice(0, 4).map(([c]) => c).join(', ')} and more.` });
}

// Compact share strip for content pages (guides, trick shots); share.js wires the native-share and copy buttons.
export function shareStrip(cfg, path, title, text) {
  const url = cfg.publicUrl + path, u = encodeURIComponent(url + '?utm_source=share'), tx = encodeURIComponent(text || title);
  return `<div class="share-box share-strip" data-share-url="${esc(url)}" data-share-title="${esc(title)}" data-share-text="${esc(text || title)}">
  <span class="muted">Share this:</span><button type="button" class="btn btn-green btn-sm" data-share="native" hidden>Share…</button>
  <a class="btn btn-blue btn-sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${u}">Facebook</a>
  <a class="btn btn-out btn-sm" href="sms:?&amp;body=${tx}%20${u}">Text</a>
  <button type="button" class="btn btn-out btn-sm" data-share="copy">Copy Link</button></div>`;
}

// Embeddable widget (/embed/venue/<id>): a room's next tournaments for its own website. No scripts; links open
// on Billiard Action Time in a new tab.
export function venueEmbed(cfg, db, venueId, dark = false) {
  const ix = index(db), today = todayIso(), primary = ix.primaryVenue.get(venueId);
  if (primary == null) return null;
  const all = ix.all.filter(t => (ix.primaryVenue.get(t.venue.id) ?? t.venue.id) === primary);
  if (!all.length) return null;
  const v = all[0].venue, up = all.filter(t => t.date >= today).slice(0, 8);
  const c = dark ? { bg: '#0e2033', fg: '#e8eef7', mute: '#9bacc2', line: '#1f3856', link: '#7cc0ff' } : { bg: '#ffffff', fg: '#0f1b2d', mute: '#56677e', line: '#d8e0ec', link: '#1559bd' };
  const u = path => `${cfg.publicUrl}${path}${path.includes('?') ? '&' : '?'}utm_source=embed&utm_content=venue-${primary}`;
  const rows = up.map(t => `<li><span class="d">${esc(shortDate(t.date))}${t.time ? '<br>' + esc(fmtTime(t.time)) : ''}</span><span><a href="${esc(u(tournamentPath(db, t)))}" target="_blank" rel="noopener">${esc(t.name)}</a><br><small>${[gameWord(t.game), t.entry != null ? money(t.entry) + ' entry' : '', t.added ? money(t.added) + ' added' : ''].filter(Boolean).map(esc).join(' · ')}</small></span></li>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tournaments at ${esc(v.name)}</title>
<style>html,body{height:100%}body{margin:0;font:15px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;background:${c.bg};color:${c.fg}}.w{padding:12px 14px;box-sizing:border-box;height:100%;display:flex;flex-direction:column}h1{font-size:17px;margin:0 0 8px}ul{flex:1;overflow:auto;min-height:0}
ul{list-style:none;margin:0;padding:0}li{display:flex;gap:12px;padding:8px 0;border-top:1px solid ${c.line}}.d{flex:0 0 74px;font-weight:700;font-size:13px}a{color:${c.link};font-weight:600;text-decoration:none}a:hover{text-decoration:underline}
small{color:${c.mute}}.f{margin-top:8px;padding-top:8px;border-top:1px solid ${c.line};font-size:12px;color:${c.mute}}.f a{font-weight:400}</style></head>
<body><div class="w"><h1>Upcoming tournaments at ${esc(v.name)}</h1>${up.length ? `<ul>${rows}</ul>` : `<p>No upcoming tournaments listed right now.</p>`}
<div class="f"><a href="${esc(u(venuePath(db, v)))}" target="_blank" rel="noopener">Full schedule</a> · <a href="${esc(u('/alerts'))}" target="_blank" rel="noopener">Get alerts</a> · Powered by <a href="${esc(u('/'))}" target="_blank" rel="noopener">Billiard Action Time</a></div></div></body></html>`;
}

// Printable wall poster for a pool room: weekly nights in big type, the next dates, and where to find more.
export function venuePoster(cfg, db, venueId) {
  const ix = index(db), today = todayIso(), primary = ix.primaryVenue.get(venueId);
  if (primary == null) return null;
  const all = ix.all.filter(t => (ix.primaryVenue.get(t.venue.id) ?? t.venue.id) === primary);
  if (!all.length) return null;
  const v = (all.find(t => t.venue.address) || all[0]).venue, byDay = weeklyByDay(db, all);
  const wkey = t => new Date(t.date + 'T00:00:00Z').getUTCDay() + '|' + String(t.name).toLowerCase();
  const weekly = new Set(byDay ? byDay.flat().map(wkey) : []);
  const up = all.filter(t => t.date >= today && !weekly.has(wkey(t))).slice(0, byDay ? 6 : 10);
  const host = cfg.publicUrl.replace(/^https?:\/\//, '');
  const line = t => `${esc(t.name)}<small>${[t.time ? fmtTime(t.time) : '', gameWord(t.game), t.entry != null ? money(t.entry) + ' entry' : '', t.added ? money(t.added) + ' added' : ''].filter(Boolean).map(esc).join(' · ')}</small>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Poster: Tournaments at ${esc(v.name)}</title>
<style>body{margin:0;font:18px/1.35 -apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#e9edf3;color:#0f1b2d}.bar{max-width:8.5in;margin:14px auto;display:flex;gap:10px;align-items:center;padding:0 12px;flex-wrap:wrap}.bar button{font:700 16px Arial;padding:10px 18px;border-radius:8px;border:0;background:#144b2e;color:#fff;cursor:pointer}.bar a{color:#1559bd}
.pg{background:#fff;max-width:8.5in;margin:0 auto 24px;padding:.55in .6in;box-sizing:border-box;box-shadow:0 2px 12px rgba(0,0,0,.12)}h1{font-size:44px;line-height:1.05;margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px}.sub{font-size:20px;color:#3b4a5e;margin:0 0 22px}
.top{font:800 15px Arial;letter-spacing:3px;color:#144b2e;text-transform:uppercase;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:0 0 18px}th{text-align:left;vertical-align:top;width:1.7in;font-size:24px;padding:12px 10px 12px 0;color:#144b2e}td{padding:12px 0;font-size:22px;font-weight:700;border-top:2px solid #e3e8ef}th{border-top:2px solid #e3e8ef}td div+div{margin-top:8px}small{display:block;font-size:16px;font-weight:400;color:#56677e}
h2{font-size:22px;margin:18px 0 6px}ul{list-style:none;margin:0;padding:0}li{padding:8px 0;border-top:1px solid #e3e8ef;font-weight:700;font-size:19px}li b{display:inline-block;min-width:1.4in}.ft{margin-top:26px;padding-top:16px;border-top:4px solid #144b2e;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:18px}.ft b{font-size:22px}
@media (max-width:640px){.pg{padding:22px 18px}h1{font-size:30px}th{display:block;width:auto;padding:12px 0 0;font-size:20px}td{display:block;border-top:0;padding:4px 0 12px;font-size:19px}li b{min-width:0;margin-right:8px}}
@media print{body{background:#fff}.bar{display:none}.pg{box-shadow:none;margin:0;max-width:none;padding:0}@page{margin:.5in}}</style></head>
<body><div class="bar"><button type="button" data-print>🖨️ Print this poster</button><a href="${venuePath(db, v)}">← Back to ${esc(v.name)}</a></div>
<div class="pg"><p class="top">🎱 Pool tournaments</p><h1>${esc(v.name)}</h1><p class="sub">${esc([v.address, v.city, v.state].filter(Boolean).join(', '))}${v.phone ? ' · ' + esc(v.phone) : ''}</p>
${byDay ? `<table><tbody>${byDay.map((evs, d) => evs.length ? `<tr><th>${WEEKDAYS[d]}s</th><td>${evs.map(t => `<div>${line(t)}</div>`).join('')}</td></tr>` : '').join('')}</tbody></table>` : ''}
${up.length ? `<h2>${byDay ? 'Also coming up' : 'Coming up'}</h2><ul>${up.map(t => `<li><b>${esc(shortDate(t.date))}</b> ${esc(t.name)}${t.time ? ' · ' + esc(fmtTime(t.time)) : ''}</li>`).join('')}</ul>` : ''}
<div class="ft"><div>Full schedule, dates and alerts:<br><b>${esc(host)}/venue/${primary}</b></div><div style="text-align:right">Find tournaments near you:<br><b>${esc(host)}</b></div></div></div>
<script src="/print.js"></script></body></html>`;
}

// Call to action for content pages: tonight's count, with this weekend as a second option.
export function tonightCta(db) {
  const ix = index(db), today = todayIso(), wk = weekendRange(today);
  const n = ix.all.filter(t => t.date === today).length, w = ix.all.filter(t => t.date >= wk.from && t.date <= wk.to).length;
  if (!n && !w) return '';
  return `<section class="card" style="padding:14px 18px;margin-top:16px;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center"><b style="font-size:18px">🎱 Put it to work:</b>
    ${n ? `<a class="btn btn-gold" href="/tonight/">${plural(n, 'tournament')} tonight</a>` : ''}${w ? `<a class="btn btn-blue" href="/this-weekend/">${plural(w, 'tournament')} this weekend</a>` : ''}<a class="btn btn-out" href="/near">Near me</a></section>`;
}

// Text for the list-page share images (/og/list/<tonight|weekend>/<date>[/<state>].png).
export function listCardText(db, kind, stateSlugPart) {
  const state = stateSlugPart ? STATE_BY_SLUG[String(stateSlugPart).toLowerCase()] : null;
  if (stateSlugPart && !state) return null;
  const ix = index(db), today = todayIso(), inState = t => !state || t.venue.state === state, where = state ? ` in ${STATE_NAMES[state]}` : '';
  if (kind === 'big') {
    const end = new Date(Date.parse(today + 'T00:00:00Z') + 60 * 864e5).toISOString().slice(0, 10), n = ix.all.filter(t => t.date >= today && t.date <= end && isBigEvent(t)).length;
    return { headline: `${n ? n + ' ' : ''}big pool tournaments coming up`, sub: 'Added money, opens and tour stops' };
  }
  if (kind === 'tonight') {
    const n = ix.all.filter(t => t.date === today && inState(t)).length;
    return { headline: n ? `${plural(n, 'pool tournament')} tonight${where}` : `Pool tournaments tonight${where}`, sub: longDate(today) };
  }
  const wk = weekendRange(today), n = ix.all.filter(t => t.date >= wk.from && t.date <= wk.to && inState(t)).length;
  return { headline: n ? `${plural(n, 'pool tournament')} this weekend${where}` : `Pool tournaments this weekend${where}`, sub: rangeLabel(wk) };
}
export const listCardUrl = (cfg, kind, state) => `${cfg.publicUrl}/og/list/${kind}/${todayIso()}${state ? '/' + stateSlug(state) : ''}.png`;
