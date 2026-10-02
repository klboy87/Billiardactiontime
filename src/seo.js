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
  const roomKey = v => `${slugify(String(v.name || '').replace(/['’]/g, ''))}|${slugify(v.city)}|${v.state}`;
  const primaryVenue = new Map(), roomIds = new Map();
  for (const t of all) { const k = roomKey(t.venue); if (!roomIds.has(k)) roomIds.set(k, new Set()); roomIds.get(k).add(t.venue.id); }
  for (const ids of roomIds.values()) { const p = Math.min(...ids); for (const id of ids) primaryVenue.set(id, p); }
  cache = { at: Date.now(), all, bySlug, pathById, byId: new Map(all.map(t => [t.id, t])), primaryVenue };
  return cache;
}
export function invalidate() { cache = null; }
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
<p>Questions about this policy or requests to remove your information: <a href="mailto:klboy87@gmail.com">klboy87@gmail.com</a>.</p>`;
  return layout(cfg, { title: 'Privacy Policy | Billiard Action Time', description: 'How Billiard Action Time collects and uses information, including advertising cookies.', path: '/privacy', body });
}

// ---- shared page chrome ----
export function layout(cfg, { title, description, path, body, jsonld = [], noindex = false, ogImage }) {
  const url = cfg.publicUrl + path;
  const ld = jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="Billiard Action Time"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(ogImage || cfg.publicUrl + '/og.png')}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:image" content="${esc(ogImage || cfg.publicUrl + '/og.png')}">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#144b2e"><meta name="google-site-verification" content="F6vvC84HY3rKsPU5LJiV4iqizZZBLCG8Rnp3LbGS8NQ">
<link rel="stylesheet" href="/styles.css">${ld}<script src="/share.js" defer></script>${adsHead(cfg)}</head>
<body><header class="hdr"><div class="wrap hdr-in"><a class="logo" href="/"><span>Billiard <em>Action</em> Time</span></a>
<nav class="nav seo-nav"><a href="/tournaments/">Tournaments</a><a href="/money-matches/">Money Matches</a><a href="/#/calendar">Calendar</a><a href="/#/stakes">Staking Board</a><a href="/#/auctions">Calcutta</a><a class="cta" href="/#/post">Post a Tournament</a></nav></div></header>
${sponsorBannerHtml()}
<main class="wrap page seo">${body}</main>
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
  </div><p class="muted wrap" style="padding-bottom:20px">© ${new Date().getFullYear()} Billiard Action Time · <a href="/privacy">Privacy Policy</a></p></footer>`, links: { states, cities, games, cityName } };
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
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [`${cfg.publicUrl}/t/${t.id}/og.png`],
    location: { '@type': 'Place', name: v.name, address: { '@type': 'PostalAddress', streetAddress: v.address || undefined, addressLocality: v.city, addressRegion: v.state, postalCode: v.zip || undefined, addressCountry: 'US' },
      ...(v.lat != null && v.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}) },
    ...(t.director?.name ? { organizer: { '@type': 'Person', name: t.director.name } } : { organizer: { '@type': 'Organization', name: v.name } }),
    ...(t.entry != null ? { offers: { '@type': 'Offer', price: t.entry, priceCurrency: 'USD', url: t.registrationUrl || cfg.publicUrl + tournamentPath(db, t), availability: 'https://schema.org/InStock', validFrom: t.updatedAt ? t.updatedAt.replace(' ', 'T') + 'Z' : undefined } } : {})
  };
}

function eventRows(db, list, { showCity = true } = {}) {
  let month = '', html = '';
  for (const t of list) {
    const ml = monthLabel(t.date);
    if (ml !== month) { if (month) html += '</tbody></table></div>'; month = ml; html += `<h3 class="seo-month">${esc(ml)}</h3><div class="card seo-tbl"><table class="t"><tbody>`; }
    const v = t.venue;
    html += `<tr><td class="seo-date">${esc(shortDate(t.date))}${t.time ? `<br><small class="muted">${esc(fmtTime(t.time))}</small>` : ''}</td>
      <td><a href="${tournamentPath(db, t)}"><b>${esc(t.name)}</b></a><br><small class="muted">${esc(v.name)}${showCity ? ` · ${esc(v.city)}, ${esc(v.state)}` : ''}${gameWord(t.game) ? ' · ' + esc(t.game) : ''}${t.entry != null ? ' · ' + money(t.entry) + ' entry' : ''}${t.added ? ' · ' + money(t.added) + ' added' : ''}</small></td></tr>`;
  }
  return html + (month ? '</tbody></table></div>' : '');
}

// ---- tournament page ----
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
    ${ended ? '<p class="seo-ended">This tournament has already been played. See upcoming tournaments below.</p>' : ''}
    <h1 class="dtitle">${esc(t.name)}</h1>
    <p class="lead-muted">${esc(g || 'Pool')} tournament at <b>${esc(v.name)}</b> in ${esc(v.city)}, ${esc(STATE_NAMES[v.state] || v.state)} on <b>${esc(longDate(t.date))}</b>${t.time ? ' at ' + esc(fmtTime(t.time)) : ''}.</p>
    <table class="t"><tbody>${rows}</tbody></table>
    <h2 class="seo-h2">Where</h2>
    <p><b>${esc(v.name)}</b><br>${esc(where)}${v.phone ? `<br>${esc(v.phone)}` : ''}</p>
    <div class="actbar"><a class="btn btn-out" href="${esc(maps)}" rel="noopener" target="_blank">Directions</a>
      ${t.registrationUrl ? `<a class="btn btn-blue" href="${esc(t.registrationUrl)}" rel="noopener nofollow" target="_blank">Register</a>` : ''}
      ${t.website ? `<a class="btn btn-out" href="${esc(t.website)}" rel="noopener nofollow" target="_blank">Website</a>` : ''}
      <a class="btn btn-green" href="/#/t/${t.id}">Save / Share in the App</a></div>
    ${t.hasFlyer ? `<img class="previewimg" src="/api/tournaments/${t.id}/flyer" alt="Flyer for ${esc(t.name)}" loading="lazy">` : ''}
    ${t.notes && !/^source:/i.test(t.notes) ? `<p style="margin-top:12px">${esc(t.notes.replace(/\s*Source:.*$/i, ''))}</p>` : ''}
    <p class="muted" style="font-size:13px;margin-top:14px">Details can change. Confirm with the room before you go. Run this event? <a href="/#/claim/${t.id}">Claim it</a> · <a href="/#/report/${t.id}">Report a problem</a></p>
  </article>
  ${shareBox(cfg, db, t, g)}
  ${sameVenue.length ? `<section class="sec seo-sec"><h2>More at ${esc(v.name)}</h2><ul class="seo-list">${mini(sameVenue)}</ul><a href="${venuePath(db, v)}">All tournaments at ${esc(v.name)} →</a></section>` : ''}
  ${sameCity.length ? `<section class="sec seo-sec"><h2>More pool tournaments in ${esc(v.city)}</h2><ul class="seo-list">${mini(sameCity)}</ul><a href="${facetPath({ state: v.state, city: v.city })}">All ${esc(v.city)} tournaments →</a></section>` : ''}
  ${sameGameState.length ? `<section class="sec seo-sec"><h2>${esc(g)} tournaments elsewhere in ${esc(STATE_NAMES[v.state] || v.state)}</h2><ul class="seo-list">${mini(sameGameState)}</ul><a href="${facetPath({ state: v.state, game: t.game })}">All ${esc(g)} tournaments in ${esc(STATE_NAMES[v.state] || v.state)} →</a></section>` : ''}
  <section class="sec seo-sec"><div class="chips">
    <a class="chip" href="${facetPath({ state: v.state })}">${esc(STATE_NAMES[v.state] || v.state)} tournaments</a>
    <a class="chip" href="${facetPath({ state: v.state, city: v.city })}">${esc(v.city)} tournaments</a>
    ${g && gameSlug(t.game) ? `<a class="chip" href="${facetPath({ state: v.state, city: v.city, game: t.game })}">${esc(g)} in ${esc(v.city)}</a><a class="chip" href="${facetPath({ game: t.game })}">${esc(g)} tournaments nationwide</a>` : ''}
  </div></section>`;
  return layout(cfg, { title, description, path, body, jsonld: [eventLd(cfg, db, t), bc.ld], ogImage: `${cfg.publicUrl}/t/${t.id}/og.png` });
}

function shareBox(cfg, db, t, g) {
  const url = cfg.publicUrl + tournamentPath(db, t), v = t.venue;
  const text = `${t.added ? money(t.added) + ' added ' : ''}${g || 'Pool'} tournament: ${t.name} at ${v.name}, ${v.city}, ${v.state} on ${shortDate(t.date)}${t.entry != null ? `. ${money(t.entry)} entry` : ''}.`;
  const u = encodeURIComponent(url), tx = encodeURIComponent(text);
  return `<section id="share" class="card share-box" data-share-url="${esc(url)}" data-share-title="${esc(t.name)}" data-share-text="${esc(text)}" data-share-card="/t/${t.id}/card-square.png">
    <div class="share-grid"><img class="share-preview" src="/t/${t.id}/card-square.png" alt="Share card for ${esc(t.name)}" width="1080" height="1080" loading="lazy">
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
    : `No upcoming ${g ? g + ' ' : ''}tournaments are listed${place ? ' in ' + esc(place) : ''} right now. New events are added every day. Check back, browse nearby below, or <a href="/#/post">post one for free</a>.`;
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

  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: upcoming.length,
    itemListElement: upcoming.slice(0, 100).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: cfg.publicUrl + tournamentPath(db, t), name: t.name })) };
  const body = `${bc.html}
  <div class="pagehead"><h1>${esc(h1)}</h1><p>${intro}</p>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-blue" href="/#/search?${new URLSearchParams({ ...(f.state ? { state: f.state } : {}), ...(f.cityName ? { city: f.cityName } : {}), ...(f.game ? { game: f.game } : {}) })}">Search &amp; Filter</a>
    <a class="btn btn-out" href="/#/alerts">Get Alerts</a><a class="btn btn-out" href="/#/post">Post a Tournament</a></div></div>
  ${upcoming.length ? eventRows(db, upcoming.slice(0, 300), { showCity: !f.city }) : ''}
  ${upcoming.length > 300 ? `<p class="muted">Showing the next 300. <a href="/#/search">Search for more</a>.</p>` : ''}
  ${venues.size ? `<section class="sec seo-sec"><h2>Pool rooms${place ? ' in ' + esc(f.cityName || stateName) : ''} running ${g ? esc(g) + ' ' : ''}tournaments</h2><ul class="seo-list seo-cols">${[...venues.values()].sort((a, b) => b.n - a.n).slice(0, 60)
    .map(({ v, n }) => `<li><a href="${venuePath(db, v)}">${esc(v.name)}</a> <span class="muted">· ${esc(v.city)}, ${esc(v.state)} · ${plural(n, 'event')}</span></li>`).join('')}</ul></section>` : ''}
  ${cityLinks ? `<section class="sec seo-sec"><h2>${g ? esc(g) + ' tournaments' : 'Tournaments'} by city in ${esc(stateName)}</h2><div class="chips">${cityLinks}</div></section>` : ''}
  ${stateLinks ? `<section class="sec seo-sec"><h2>${g ? esc(g) + ' tournaments' : 'Tournaments'} by state</h2><div class="chips">${stateLinks}</div></section>` : ''}
  ${gameLinks || up1 || upState ? `<section class="sec seo-sec"><h2>Browse by game</h2><div class="chips">${up1}${upState}${gameLinks}</div></section>` : ''}
  ${past.length ? `<section class="sec seo-sec"><h2>Recent ${g ? esc(g) + ' ' : ''}tournaments${place ? ' in ' + esc(f.cityName || stateName) : ''}</h2><ul class="seo-list">${past.map(t => `<li><a href="${tournamentPath(db, t)}">${esc(t.name)}</a> <span class="muted">· ${esc(shortDate(t.date))} ${t.date.slice(0, 4)} · ${esc(t.venue.name)}</span></li>`).join('')}</ul></section>` : ''}`;
  return layout(cfg, { title, description, path, body, jsonld: [bc.ld, ...(upcoming.length ? [itemList] : [])], noindex: !upcoming.length });
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
    <section class="sec seo-sec" style="padding-top:0"><h2>By game</h2><div class="chips">${[...gameCounts].sort((a, b) => b[1] - a[1]).map(([g, n]) => `<a class="chip" href="${facetPath({ game: g })}">${esc(g)} (${n})</a>`).join('')}</div></section>
    <div class="card"><ul class="statelist">${states.map(([c, n]) => counts.get(c) ? `<li><a href="${facetPath({ state: c })}">${esc(n)}</a> <span class="muted">(${counts.get(c)})</span></li>` : `<li><span class="muted">${esc(n)} (0)</span></li>`).join('')}</ul></div>`;
  return layout(cfg, { title: 'Pool Tournaments by State – Find Billiards Tournaments Near You | Billiard Action Time', path: '/tournaments/',
    description: `${up.length} upcoming pool tournaments in ${counts.size} states. Browse 8-ball, 9-ball, 10-ball and one pocket tournaments by state and city, updated daily.`, body, jsonld: [bc.ld] });
}

// ---- venue page (kept at /venue/:id) ----
export function venuePage(db, cfg, venueId) {
  const ix = index(db), today = todayIso();
  const primary = ix.primaryVenue.get(venueId);
  if (primary == null) return null;
  if (primary !== venueId) return { redirect: `/venue/${primary}` };
  const all = ix.all.filter(t => ix.primaryVenue.get(t.venue.id) === primary);
  if (!all.length) return null;
  const v = all[0].venue;
  const up = all.filter(t => t.date >= today), past = all.filter(t => t.date < today).reverse().slice(0, 10);
  const path = `/venue/${venueId}`;
  const where = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ');
  const bc = crumbs(cfg, [{ name: 'Tournaments', path: '/tournaments/' }, { name: STATE_NAMES[v.state] || v.state, path: facetPath({ state: v.state }) },
    { name: v.city, path: facetPath({ state: v.state, city: v.city }) }, { name: v.name, path }]);
  const place = { '@context': 'https://schema.org', '@type': 'Place', name: v.name, url: cfg.publicUrl + path,
    address: { '@type': 'PostalAddress', streetAddress: v.address || undefined, addressLocality: v.city, addressRegion: v.state, postalCode: v.zip || undefined, addressCountry: 'US' },
    ...(v.phone ? { telephone: v.phone } : {}), ...(v.lat != null && v.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}) };
  const body = `${bc.html}<div class="pagehead"><h1>${esc(v.name)}</h1><p>${esc(where)}${v.phone ? ' · ' + esc(v.phone) : ''}</p>
    <p>${up.length ? `${plural(up.length, 'upcoming pool tournament')} at ${esc(v.name)} in ${esc(v.city)}, ${esc(STATE_NAMES[v.state] || v.state)}.` : `No upcoming tournaments listed at ${esc(v.name)} right now.`}</p>
    <div class="actbar"><a class="btn btn-out" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + ', ' + where)}">Directions</a><a class="btn btn-out" href="${facetPath({ state: v.state, city: v.city })}">More in ${esc(v.city)}</a></div></div>
    ${up.length ? eventRows(db, up, { showCity: false }) : ''}
    ${past.length ? `<section class="sec seo-sec"><h2>Recent tournaments at ${esc(v.name)}</h2><ul class="seo-list">${past.map(t => `<li><a href="${tournamentPath(db, t)}">${esc(t.name)}</a> <span class="muted">· ${esc(shortDate(t.date))} ${t.date.slice(0, 4)}</span></li>`).join('')}</ul></section>` : ''}`;
  return layout(cfg, { title: `${v.name} – Pool Tournaments in ${v.city}, ${v.state} | Billiard Action Time`, path, body,
    description: `${up.length ? plural(up.length, 'upcoming pool tournament') + ' at ' : 'Pool tournaments at '}${v.name}, ${v.city}, ${v.state}. Dates, games and entry fees.`,
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
  for (const t of ix.all) if (t.date >= cutoff) add(tournamentPath(db, t), (t.updatedAt || today).slice(0, 10), t.date >= today ? '0.7' : '0.3');
  for (const id of new Set(up.map(t => ix.primaryVenue.get(t.venue.id) ?? t.venue.id))) add(`/venue/${id}`, today, '0.5');
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
  const body = `<div class="crumbs"><a href="/#/matches">Match Finder</a> / ${esc(p.name)}</div>
  <h1>Looking for a Match</h1>
  ${open ? '' : `<p class="seo-ended">${p.status === 'closed' ? 'This player found a match. The post is closed.' : 'This post has ended.'}</p>`}
  <article class="card matchcard"><div class="stake-top"><b class="match-name">${esc(p.name)}</b>${p.fargo ? `<span class="chip b">Fargo ${p.fargo}</span>` : ''}</div>
    <ul class="match-facts"><li><span aria-hidden="true">📍</span> ${esc(p.city)}, ${esc(p.state)}${p.room ? ' · ' + esc(p.room) : ''}</li>
    <li><span aria-hidden="true">🎱</span> ${esc(p.game === 'Other' ? 'Any game' : p.game)}</li><li><span aria-hidden="true">💰</span> ${esc(matchStakes(p))}</li>
    <li><span aria-hidden="true">📅</span> ${esc(when)}</li></ul>
    ${p.note ? `<p class="match-note">“${linkContacts(p.note)}”</p>` : ''}
    ${p.contact ? `<p>Reach them: <b>${linkContacts(p.contact)}</b></p>` : ''}
    <div class="actbar"><a class="btn btn-green" href="${app}">${open ? "I'm In" : 'See Details'}</a><a class="btn btn-gold" href="/#/matches">Find More Action</a></div></article>
  <h2 class="seo-h2">Comments (${comments.length})</h2>
  ${comments.length ? `<div class="mcomments">${comments.map(c => `<div class="mcomment"><b>${esc(c.name)}</b><p>${linkContacts(c.body)}</p>${c.contact ? `<p class="mcontact">📞 ${linkContacts(c.contact)}</p>` : ''}</div>`).join('')}</div>` : '<p class="muted">No comments yet.</p>'}
  <p><a class="btn btn-out" href="/#/matches/${p.id}?c=1">Add a Comment</a></p>
  <p class="stake-note">Match Finder only connects players. Billiard Action Time never takes, holds or pays out money. You must be 18+ and follow the laws where you play.</p>`;
  return layout(cfg, { title, description, path: `/match/${p.id}`, body, noindex: true });
}
