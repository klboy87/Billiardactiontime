// Free calculators for tournament directors and players (/tools/...). The page text is server-rendered
// so it reads well without JavaScript; public/tools.js does the math in the browser.
import { layout } from './seo.js';

export const TOOLS = [
  { slug: 'payout-calculator', title: 'Pool Tournament Payout Calculator',
    desc: 'Enter players, entry fee, greens fee and added money to get the prize pool and a fair payout for each place. Free, works on your phone.' },
  { slug: 'fargo-race-calculator', title: 'Fargo Race Calculator for Handicapped Matches',
    desc: 'Enter two FargoRate ratings and see fair handicapped races, with each player\'s chance to win the match.' }
];

const crumbs = (name) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/tools/">Tools</a> <span>/</span> <span>${name}</span></nav>`;
const appLd = (cfg, t) => ({ '@context': 'https://schema.org', '@type': 'WebApplication', name: t.title, description: t.desc, url: `${cfg.publicUrl}/tools/${t.slug}`,
  applicationCategory: 'SportsApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } });
const FIELD = 'style="display:block;width:100%;max-width:220px;padding:8px;font-size:16px;margin-top:4px"';

export function toolsIndexPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Tools</span></nav>
  <div class="pagehead"><h1>Free Pool Tournament Tools</h1><p>Calculators for tournament directors and players. Free, no sign-up, and they work on your phone at the table.</p></div>
  <ul style="list-style:none;padding:0;display:grid;gap:14px">${TOOLS.map(t => `<li class="card" style="padding:14px 18px"><a href="/tools/${t.slug}"><b>${t.title}</b></a><br><span class="muted">${t.desc}</span></li>`).join('')}
  <li class="card" style="padding:14px 18px"><a href="/auctions"><b>Online Calcutta Auction</b></a><br><span class="muted">Run a Calcutta from everyone's phones: live bidding, buy-backs and automatic payouts.</span></li></ul>
  <p>Looking for how-tos? See our <a href="/guides/">guides</a> on brackets, payouts, handicaps and game rules.</p>`;
  return layout(cfg, { title: 'Free Pool Tournament Tools: Payout & Fargo Race Calculators | Billiard Action Time', description: 'Free calculators for pool tournament directors and players: payout calculator, Fargo handicap race calculator and an online Calcutta auction.', path: '/tools/', body });
}

export function toolPage(cfg, slug) {
  const t = TOOLS.find(x => x.slug === slug);
  if (!t) return null;
  let tool = '', about = '';
  if (slug === 'payout-calculator') {
    tool = `<form id="payoutForm" class="card" style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
      <label>Players<input ${FIELD} type="number" name="players" min="2" max="512" value="16" inputmode="numeric"></label>
      <label>Entry fee ($)<input ${FIELD} type="number" name="entry" min="0" step="1" value="20" inputmode="decimal"></label>
      <label>Greens fee per player ($)<input ${FIELD} type="number" name="greens" min="0" step="1" value="0" inputmode="decimal"></label>
      <label>Added money ($)<input ${FIELD} type="number" name="added" min="0" step="1" value="0" inputmode="decimal"></label>
      <label>House / director cut (%)<input ${FIELD} type="number" name="cut" min="0" max="50" step="1" value="0" inputmode="decimal"></label>
      <label>Places paid<select ${FIELD} name="places"><option value="auto">Automatic</option>${[2, 3, 4, 5, 6, 7, 8, 12, 16].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
    </form>
    <div id="payoutOut" class="card" style="padding:16px 18px;margin-top:14px" aria-live="polite"><p class="muted">Turn on JavaScript to use the calculator, or see the <a href="/guides/pool-tournament-payouts">payout chart</a>.</p></div>`;
    about = `<h2>How the calculator works</h2>
    <p>The prize pool is every player's entry fee minus the greens fee the room keeps, plus any added money, minus the house or director cut if you set one. "Automatic" pays about one place for every eight players (at least two places), using splits that most local tournaments use. Amounts are rounded to whole dollars and any leftover dollars go to first place.</p>
    <p>In a <a href="/guides/double-elimination-brackets">double-elimination bracket</a>, players knocked out in the same round tie, so places like 5th–6th or 7th–8th usually pay the same amount. Always announce the payout before the first match. More detail in our <a href="/guides/pool-tournament-payouts">payout guide</a>.</p>`;
  } else {
    tool = `<form id="raceForm" class="card" style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
      <label>Player A rating<input ${FIELD} type="number" name="a" min="100" max="900" value="600" inputmode="numeric"></label>
      <label>Player B rating<input ${FIELD} type="number" name="b" min="100" max="900" value="500" inputmode="numeric"></label>
      <label>Lower player races to<select ${FIELD} name="base">${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    </form>
    <div id="raceOut" class="card" style="padding:16px 18px;margin-top:14px" aria-live="polite"><p class="muted">Turn on JavaScript to use the calculator.</p></div>`;
    about = `<h2>How the calculator works</h2>
    <p>FargoRate ratings are built so that a <b>100-point difference means the higher-rated player wins about two games for every one</b> the lower-rated player wins. From the two ratings, the calculator works out each player's chance of winning a single game, then the chance of winning a whole race. It suggests the race for the stronger player that brings the match closest to an even 50/50.</p>
    <p>Real matches depend on the game, the table and the day, so treat the numbers as a starting point. Many rooms use a printed chart; this gives you the same idea for any two ratings. Learn more in our <a href="/guides/fargo-ratings-handicaps">Fargo and handicaps guide</a>.</p>
    <p class="muted">FargoRate is a trademark of its owners. This calculator is an independent tool and is not affiliated with FargoRate.</p>`;
  }
  const body = `${crumbs(t.title)}
  <div class="pagehead"><h1>${t.title}</h1><p>${t.desc}</p></div>
  ${tool}
  <article class="card" style="padding:18px 20px;margin-top:16px;line-height:1.65">${about}</article>
  <p style="margin-top:14px"><a href="/tools/">All tools</a> · <a href="/guides/">Guides</a> · <a href="/post">Post your tournament free</a></p>`;
  return layout(cfg, { title: `${t.title} | Billiard Action Time`, description: t.desc, path: `/tools/${t.slug}`, body, jsonld: [appLd(cfg, t)], scripts: ['/tools.js'] });
}
