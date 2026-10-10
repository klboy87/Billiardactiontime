// Real addresses for the app's sections (/calendar, /matches, ...). The browser app used to live only
// under "#/..." links, which search engines treat as one page. The server now answers these paths with
// the app shell plus a page-specific title, description, canonical link and a plain-HTML heading, so each
// section can be found in search and shared on its own.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SITE_TITLE = 'Billiard Action Time — Find Pool Tournaments Near You';
export const SITE_DESC = 'Find pool and billiards tournaments near you. Browse by state and city, get alerts for new tournaments, and find venues that run leagues and events.';

// key = first path segment. noindex: useful to visitors but not worth a search result.
export const APP_PAGES = {
  search: { title: 'Search Pool Tournaments by City, Game & Date', h1: 'Search pool tournaments', desc: 'Search upcoming pool tournaments by city, state, venue, game and date. 8-Ball, 9-Ball, 10-Ball and One Pocket events updated daily.' },
  calendar: { title: 'Pool Tournament Calendar – This Week & Upcoming', h1: 'Pool tournament calendar', desc: 'Day-by-day calendar of upcoming pool and billiards tournaments across the USA. See what is on this week and plan the month ahead.' },
  games: { title: 'Pool Tournaments by Game: 8-Ball, 9-Ball, 10-Ball, One Pocket', h1: 'Pool tournaments by game', desc: 'Find 8-Ball, 9-Ball, 10-Ball, One Pocket, Banks and Scotch Doubles tournaments near you.' },
  venues: { title: 'Pool Halls & Bars That Run Tournaments', h1: 'Pool halls and venues', desc: 'Pool halls, billiard rooms and bars that host weekly and monthly pool tournaments, with their upcoming events.' },
  near: { title: 'Pool Tournaments Near Me', h1: 'Pool tournaments near you', desc: 'Find pool tournaments near your location, sorted by distance, with dates, entry fees and directions.' },
  results: { title: 'Past Pool Tournaments & Results', h1: 'Past pool tournaments', desc: 'Recent pool tournaments across the USA: where they were held, games played and results when available.' },
  matches: { title: 'Match Finder – Find Pool Action & Money Games Near You', h1: 'Match Finder', desc: 'Looking for a game? Post what you play, your stakes and where, and find players looking for pool action near you.' },
  stakes: { title: 'Pool Staking Board – Back Players & Sell Action', h1: 'Staking board', desc: 'Pool players post their action for upcoming tournaments and money matches. Find players to back or sell a piece of your own action.' },
  auctions: { title: 'Free Online Calcutta Auction for Pool Tournaments', h1: 'Calcutta auctions', desc: 'Run a pool tournament Calcutta online for free: live bidding from phones, automatic pot and payout math, shareable auction room.' },
  post: { title: 'Post a Pool Tournament for Free', h1: 'Post a pool tournament', desc: 'List your pool tournament for free. It gets its own page, shows up in state and city listings and is easy to share on Facebook.' },
  scan: { title: 'Tournament Flyer Scanner – Post a Pool Tournament From a Flyer', h1: 'Flyer scanner', desc: 'Snap a photo of a pool tournament flyer and we fill in the details for you. Post it in seconds.' },
  alerts: { title: 'Pool Tournament Alerts by Email', h1: 'Get tournament alerts', desc: 'Get an email when new pool tournaments are posted near you.' },
  newsletter: { title: 'Billiard Action Time Newsletter', h1: 'Newsletter', desc: 'Weekly pool tournament roundup: the biggest upcoming events, added-money tournaments and money matches.' },
  scout: { title: 'Tournament Scout', h1: 'Tournament scout', desc: 'Scout upcoming pool tournaments by field size, entry fee and added money.', noindex: true },
  account: { title: 'My Account', h1: 'My account', desc: SITE_DESC, noindex: true },
  claim: { title: 'Claim a Tournament', h1: 'Claim a tournament', desc: 'Run this tournament? Claim it to edit the details.', noindex: true },
  report: { title: 'Report a Problem', h1: 'Report a problem', desc: SITE_DESC, noindex: true }
};

export function appPageFor(pathname) {
  const m = String(pathname).match(/^\/([a-z]+)\/?$/);
  return m && Object.hasOwn(APP_PAGES, m[1]) ? { key: m[1], ...APP_PAGES[m[1]] } : null;
}

// Fills the app shell (index.html) for one page: title, description, canonical, structured data and
// a plain-HTML heading + intro inside <main> that the app replaces once it loads.
export function fillShell(html, cfg, page, { homeIntro = '' } = {}) {
  const url = cfg.publicUrl + (page ? `/${page.key}` : '/');
  const title = page ? `${page.title} | Billiard Action Time` : SITE_TITLE;
  const desc = page ? page.desc : SITE_DESC;
  const ld = page ? '' : `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', '@id': cfg.publicUrl + '/#website', url: cfg.publicUrl + '/', name: 'Billiard Action Time',
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: cfg.publicUrl + '/search?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
      { '@type': 'Organization', '@id': cfg.publicUrl + '/#org', name: 'Billiard Action Time', url: cfg.publicUrl + '/', logo: cfg.publicUrl + '/icons/icon-512.png', email: 'billiardactiontime@gmail.com' }
    ] }).replace(/</g, '\\u003c')}</script>`;
  const head = `<link rel="canonical" href="${esc(url)}">${page?.noindex ? '<meta name="robots" content="noindex,follow">' : ''}<meta property="og:url" content="${esc(url)}">${ld}`;
  const intro = page
    ? `<div class="pagehead"><h1>${esc(page.h1)}</h1><p>${esc(page.desc)}</p></div>`
    : homeIntro;
  return html
    .split(SITE_TITLE).join(title)
    .split(SITE_DESC).join(desc)
    .replace('<!--HEAD_EXTRA-->', head)
    .replace('<main id="app" class="wrap page"></main>', `<main id="app" class="wrap page">${intro}</main>`);
}
