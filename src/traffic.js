// Turns what a visitor's browser tells us into the plain labels the admin dashboard shows:
// which page they viewed and where they came from. Only these labels are stored.

// Known crawlers, uptime checkers, scanners and scripts. Real browsers never send these.
const BOT_UA = /bot|crawl|spider|slurp|scan|check|monitor|preview|fetch|curl|wget|python|go-http|node|axios|okhttp|java\/|libwww|httpclient|headless|phantom|lighthouse|pagespeed|facebookexternalhit|embedly|leakix|censys|zgrab|masscan|nmap/i;
export function isBot(ua) {
  const s = String(ua || '').trim();
  return !s || s.length < 20 || BOT_UA.test(s);
}

// Pages the site's browser app can report. Anything else is dropped, so a stranger can't
// fill the dashboard with junk labels.
export const PAGES = {
  home: 'Home', search: 'Search', states: 'Browse by State', calendar: 'Calendar', near: 'Near Me',
  tournament: 'Tournament Details', venues: 'Venues', venue: 'Venue Details', post: 'Post a Tournament',
  scan: 'Flyer Scanner', claim: 'Claim a Tournament', report: 'Report a Problem', alerts: 'Alerts',
  newsletter: 'Newsletter', account: 'My Account', games: 'Games', results: 'Results', scout: 'Scout',
  stakes: 'Staking Board', stake: 'Staking Match', 'stake-post': 'Post Your Action',
  matches: 'Match Finder', 'match-post': 'Match Finder: Post', 'match-view': 'Match Finder: Post Details',
  auctions: 'Calcutta Auctions', 'auction-new': 'Create an Auction', 'auction-room': 'Auction Room',
  // server-rendered pages (what Google and shared links open first)
  'tournament-page': 'Tournament Page (from search/links)', 'state-page': 'State Page (from search/links)',
  'states-page': 'All States Page', 'venue-page': 'Venue Page (from search/links)',
  'match-page': 'Match Finder Post (shared link)'
};
const ROUTE_TO_PAGE = { '': 'home', t: 'tournament' };
export function pageFromHash(route) {
  const parts = String(route || '').replace(/^#?\/?/, '').split('?')[0].split('/');
  const first = parts[0].toLowerCase();
  if (first === 'stakes' && parts[1]) return parts[1] === 'new' ? 'stake-post' : 'stake';
  if (first === 'matches' && parts[1]) return parts[1] === 'new' ? 'match-post' : 'match-view';
  if (first === 'auctions' && parts[1] === 'new') return 'auction-new';
  if (first === 'a' && parts[1]) return 'auction-room';
  const key = ROUTE_TO_PAGE[first] ?? first;
  return key in PAGES && key !== 'admin' ? key : null;
}

const SOURCES = [
  [/^mail\.google\.|^outlook\.|^mail\.yahoo\.|^mail\.|webmail/, 'Email'],
  [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)yahoo\./, 'Yahoo'], [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'], [/^(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
  [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'], [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'], [/(^|\.)(substack\.com|beehiiv\.com|mailchi\.mp|list-manage\.com|convertkit\.com|kit\.com)$/, 'Newsletter'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'ChatGPT'], [/(^|\.)claude\.ai$/, 'Claude'], [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)findtourneys\.com$/, 'FindTourneys'], [/(^|\.)azbilliards\.com$/, 'AZBilliards']
];
const UTM = { newsletter: 'Newsletter', email: 'Newsletter', fb: 'Facebook', facebook: 'Facebook', ig: 'Instagram', instagram: 'Instagram', twitter: 'X (Twitter)', x: 'X (Twitter)', google: 'Google', tiktok: 'TikTok', youtube: 'YouTube', reddit: 'Reddit', sms: 'Text Message', text: 'Text Message' };

// utm_source (a tag you add to your own links) wins, then the referring site, then clues in
// the browser itself (Facebook's and Instagram's in-app browsers usually hide the referrer).
export function classifySource({ ref, utm, ua, ownHosts = [] } = {}) {
  const tag = String(utm || '').toLowerCase().replace(/[^a-z0-9 _.-]/g, '').trim().slice(0, 40);
  if (tag) return UTM[tag] || tag.replace(/(^|[\s_-])\w/g, c => c.toUpperCase());
  let host = '';
  try { host = new URL(String(ref || '')).hostname.toLowerCase(); } catch {}
  host = host.replace(/^(www|m|l|lm|mobile)\./, '');
  if (host && !ownHosts.some(h => host === h || host.endsWith('.' + h))) {
    for (const [re, label] of SOURCES) if (re.test(host)) return label;
    return host.slice(0, 60);
  }
  const agent = String(ua || '');
  if (/FBAN|FBAV|FB_IAB/.test(agent)) return 'Facebook';
  if (/Instagram/.test(agent)) return 'Instagram';
  return 'Direct / Unknown';
}
