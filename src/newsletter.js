// The weekly email, written from the live listings: this weekend's biggest tournaments, the busiest
// states, and big events coming up. The admin page shows it ready to copy into Gmail (or any email
// program), so the owner can send it to the subscriber list with one paste.
import * as SEO from './seo.js';
import { todayIso } from './db.js';
import { STATE_NAMES } from './normalize.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n).toLocaleString('en-US');
const day = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' }); };
const md = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10); };
// Bigger prize first: added money, then entry fee.
const weight = t => (t.added || 0) * 10 + (t.entry || 0);
const isBig = t => t.added || (t.entry != null && t.entry >= 50) || /annual|classic|championship|memorial|\bcup\b|shootout|state open|\bstop \d/i.test(t.name);
const price = t => [t.added ? money(t.added) + ' added' : '', t.entry != null ? money(t.entry) + (/scotch|doubles|team/i.test(t.name) ? ' per team' : ' entry') : ''].filter(Boolean).join(', ');

export function buildNewsletter(db, cfg) {
  // Sent on a Saturday or Sunday, the email is about the coming weekend, not the one already underway.
  const today = todayIso(), dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const wk = SEO.weekendRange(dow === 6 ? addDays(today, 2) : dow === 0 ? addDays(today, 1) : today);
  const link = (path, tag = '') => `${cfg.publicUrl}${path}${path.includes('?') ? '&' : '?'}utm_source=newsletter${tag ? '&utm_content=' + tag : ''}`;
  const all = SEO.listedTournaments(db);
  const weekend = all.filter(t => t.date >= wk.from && t.date <= wk.to);
  const big = weekend.filter(isBig).sort((a, b) => weight(b) - weight(a)).slice(0, 6);
  const states = (() => { const m = new Map(); for (const t of weekend) m.set(t.venue.state, (m.get(t.venue.state) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6); })();
  const later = all.filter(t => t.date > wk.to && t.date <= addDays(wk.to, 28) && isBig(t)).sort((a, b) => a.date.localeCompare(b.date) || weight(b) - weight(a));
  const calendar = []; const seenDay = new Map();
  for (const t of later) { const n = seenDay.get(t.date) || 0; if (n < 2 && calendar.length < 5) { calendar.push(t); seenDay.set(t.date, n + 1); } }
  const shown = new Set([...big, ...calendar].map(t => t.id));
  const fresh = SEO.recentlyAdded(db, 7).filter(t => !shown.has(t.id)).sort((a, b) => weight(b) - weight(a)).slice(0, 5).sort((a, b) => a.date.localeCompare(b.date));
  const range = wk.from === wk.to ? md(wk.from) : `${md(wk.from)}–${md(wk.to)}`;
  const top = big[0];

  const subject = weekend.length
    ? `${weekend.length} pool tournaments this weekend${top ? `, plus ${top.added ? money(top.added) + ' added at ' : ''}${top.name.length > 40 ? top.venue.name : top.name}` : ''}`
    : 'Pool tournaments coming up near you';
  const preview = big.length ? big.slice(0, 3).map(t => `${t.name.length > 30 ? t.venue.name : t.name} (${t.venue.city})`).join(', ') + ' and more near you.' : 'This week on Billiard Action Time.';

  // Email programs ignore stylesheets, so everything is inline and table-based.
  const A = (href, text, style = '') => `<a href="${esc(href)}" style="color:#1d5fd1;text-decoration:none;font-weight:600;${style}">${esc(text)}</a>`;
  const H = text => `<h2 style="font:700 19px Arial,Helvetica,sans-serif;color:#0f1b2d;margin:26px 0 10px">${text}</h2>`;
  const P = (html, style = '') => `<p style="font:16px/1.5 Arial,Helvetica,sans-serif;color:#222;margin:0 0 12px;${style}">${html}</p>`;
  const btn = (href, text) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td style="background:#144b2e;border-radius:6px"><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;font:700 16px Arial,Helvetica,sans-serif;color:#fff;text-decoration:none">${esc(text)}</a></td></tr></table>`;
  const item = t => `<li style="margin:0 0 10px;font:16px/1.45 Arial,Helvetica,sans-serif;color:#222">${A(link(SEO.tournamentPath(db, t)), t.name)}<br><span style="color:#555">${esc(t.venue.name)}, ${esc(t.venue.city)}, ${esc(t.venue.state)} · ${esc(day(t.date))}${price(t) ? ' · ' + esc(price(t)) : ''}</span></li>`;

  const body = [
    P('Hey,'),
    weekend.length
      ? P(`There are <b>${weekend.length} tournaments</b> on the board this weekend (${esc(range)}). Here's what stands out.`)
      : P(`Not much is posted for this weekend (${esc(range)}) yet. Here's what's coming up.`),
    big.length ? H('🏆 Big ones this weekend') + `<ul style="padding-left:20px;margin:0 0 8px">${big.map(item).join('')}</ul>` : '',
    weekend.length ? btn(link('/this-weekend/', 'weekend'), `See all ${weekend.length} this weekend`) : '',
    P(`Looking for a game on a weeknight? ${A(link('/tonight/', 'tonight'), "See tonight's tournaments")}, any day of the week.`),
    states.length ? H('📍 Busiest states this weekend') + P(states.map(([s, n]) => A(link(SEO.weekendPath(s), 'state'), `${STATE_NAMES[s] || s} (${n})`)).join(' &nbsp;·&nbsp; ')) : '',
    calendar.length ? H('📅 Mark your calendar') + `<ul style="padding-left:20px;margin:0 0 8px">${calendar.map(item).join('')}</ul>` : '',
    fresh.length ? H('🆕 New this week') + `<ul style="padding-left:20px;margin:0 0 8px">${fresh.map(item).join('')}</ul>` + P(A(link('/new/', 'new'), 'See everything added this week →')) : '',
    H('🎯 Running a tournament?'),
    P(`Post it free and it can show up in next week's email. It gets its own page and a share graphic for Facebook. ${A(link('/post', 'post'), 'Post a tournament →')}`),
    P('Good luck out there. May your breaks be dry for the other guy.', 'margin-top:22px'),
    P('<b>Billiard Action Time</b>'),
    `<hr style="border:0;border-top:1px solid #ddd;margin:22px 0 12px">`,
    P(`Know someone who's always asking "where's a tournament this weekend?" Forward this to them. Got a tournament we missed? Just reply to this email.`, 'font-size:13px;color:#666'),
    P(`You're getting this because you signed up at ${A(link('/', 'footer'), 'billiardactiontime.com', 'font-weight:400')}. Don't want these emails? Reply with "unsubscribe" and we'll take you off the list.`, 'font-size:13px;color:#666')
  ].join('\n');

  const html = `<div style="max-width:600px;margin:0 auto;background:#fff;padding:8px 4px">
<div style="background:#0f1b2d;border-radius:8px;padding:16px 18px;margin-bottom:18px"><span style="font:800 22px Arial,Helvetica,sans-serif;color:#fff;letter-spacing:.5px">BILLIARD <span style="color:#3b8cff">ACTION</span> TIME</span><br><span style="font:14px Arial,Helvetica,sans-serif;color:#b9c4d6">This weekend's pool tournaments · ${esc(range)}</span></div>
${body}
</div>`;

  const text = [
    'Hey,', '',
    weekend.length ? `There are ${weekend.length} tournaments on the board this weekend (${range}). Here's what stands out.` : `Here's what's coming up.`, '',
    ...(big.length ? ['BIG ONES THIS WEEKEND', ...big.map(t => `- ${t.name}: ${t.venue.name}, ${t.venue.city}, ${t.venue.state}. ${day(t.date)}${price(t) ? ', ' + price(t) : ''}`), ''] : []),
    `See all of them: ${link('/this-weekend/', 'weekend')}`, '',
    ...(states.length ? ['BUSIEST STATES: ' + states.map(([s, n]) => `${STATE_NAMES[s] || s} (${n})`).join(', '), ''] : []),
    ...(calendar.length ? ['MARK YOUR CALENDAR', ...calendar.map(t => `- ${md(t.date)}: ${t.name}, ${t.venue.city}, ${t.venue.state}${price(t) ? ' (' + price(t) + ')' : ''}`), ''] : []),
    ...(fresh.length ? ['NEW THIS WEEK', ...fresh.map(t => `- ${md(t.date)}: ${t.name}, ${t.venue.city}, ${t.venue.state}`), `All new listings: ${link('/new/', 'new')}`, ''] : []),
    `Running a tournament? Post it free: ${link('/post', 'post')}`, '',
    'Billiard Action Time', '',
    'Don\'t want these emails? Reply "unsubscribe".'
  ].join('\n');

  return { subject, preview, html, text, weekend: weekend.length, range };
}
