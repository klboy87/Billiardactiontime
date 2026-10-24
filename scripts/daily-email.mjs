// Builds the daily subscriber email: two picks (new articles first, then a rotating mix of
// practice drills and guides) plus a link to tonight's tournaments. Run by the nightly update:
//   node scripts/daily-email.mjs            -> prints {subject, html, text, picks} as JSON
//   node scripts/daily-email.mjs --commit   -> same, and records the picks in data/daily-email-state.json
//   --picks a,b,c   send these slugs instead of the rotation     --intro   add the welcome note
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { GUIDES } from '../src/guides.js';
import { SHOTS } from '../src/trickshots.js';

const SITE = 'https://billiardactiontime.com';
const STATE = new URL('../data/daily-email-state.json', import.meta.url);
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const items = [
  ...GUIDES.map(g => ({ slug: g.slug, path: `/guides/${g.slug}`, title: g.title, desc: g.desc, kind: 'guide' })),
  ...SHOTS.map(s => ({ slug: s.slug, path: `/trick-shots/${s.slug}`, title: s.title, desc: s.desc, kind: 'drill' }))
];
const bySlug = new Map(items.map(i => [i.slug, i]));
// Skill-building guides count as drills, so each email can pair something to practice with something to read.
const DRILLY = /drill|practice|training|stroke|position|aim|bank|kick|break|draw|routine|stance|stop-shot|scratch|combination|cut-shot|bridge|chalk|safety|patterns|english|jump|masse|film|dominant-eye|mistakes/;
const isDrill = i => i.kind === 'drill' || DRILLY.test(i.slug);

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { known: items.map(i => i.slug), queue: [], sent: [], log: [] };
// Anything published since the last run jumps the line, newest last-added first in the order it appears.
for (const i of items) if (!state.known.includes(i.slug)) { state.known.push(i.slug); if (!state.queue.includes(i.slug)) state.queue.push(i.slug); }

function choose() {
  if (opt('--picks')) return opt('--picks').split(',').map(s => s.trim()).filter(s => bySlug.has(s));
  const picks = state.queue.filter(s => bySlug.has(s)).slice(0, 2);
  const fresh = want => items.find(i => !state.sent.includes(i.slug) && !picks.includes(i.slug) && isDrill(i) === want);
  for (const want of [true, false]) {
    if (picks.length >= 2) break;
    let next = fresh(want) || fresh(!want);
    if (!next) { state.sent = []; next = fresh(want) || fresh(!want); }
    if (next) picks.push(next.slug);
  }
  return picks;
}

const picks = choose();
const chosen = picks.map(s => bySlug.get(s));
const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Detroit' });
const link = (path, tag) => `${SITE}${path}?utm_source=newsletter&utm_medium=email&utm_content=${tag}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const intro = flag('--intro');
const introText = 'Welcome to the new Billiard Action Time daily email. Every day we send two things worth your time: a new article or a practice drill, plus a quick way to find a tournament near you. Here is what we published this week.';

const subject = chosen.length === 1 ? chosen[0].title
  : intro ? `New on Billiard Action Time: ${chosen[0].title.split(':')[0]} and more`
  : `${chosen[0].title.split(':')[0]} + ${chosen[1].title.split(':')[0]}`;

const card = (i, n) => `<tr><td style="padding:14px 0;border-top:1px solid #e5e7eb">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#15803d;font-weight:700">${isDrill(i) ? 'Practice drill' : 'Read'}</p>
<p style="margin:0 0 6px;font-size:18px;font-weight:700"><a href="${link(i.path, 'pick' + (n + 1))}" style="color:#111827;text-decoration:none">${esc(i.title)}</a></p>
<p style="margin:0 0 8px;color:#4b5563;line-height:1.5">${esc(i.desc)}</p>
<a href="${link(i.path, 'pick' + (n + 1))}" style="color:#1d4ed8;font-weight:700">Read it &rarr;</a></td></tr>`;

const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827">
<p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#1d4ed8">🎱 Billiard Action Time</p>
<p style="margin:0 0 14px;color:#6b7280;font-size:13px">${esc(date)}</p>
${intro ? `<p style="line-height:1.5">${esc(introText)}</p>` : '<p style="line-height:1.5">Your two picks for today:</p>'}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${chosen.map(card).join('')}</table>
<p style="margin:18px 0;padding:12px 14px;background:#f0fdf4;border-radius:8px;line-height:1.5">🏆 <b>Want to play tonight?</b> <a href="${link('/tonight/', 'tonight')}" style="color:#15803d;font-weight:700">See every tournament near you tonight</a> or <a href="${link('/this-weekend/', 'weekend')}" style="color:#15803d;font-weight:700">this weekend</a>.</p>
<p style="line-height:1.5">See you at the table,<br>The Billiard Action Time team</p>
<p style="font-size:12px;color:#6b7280;line-height:1.5">You're getting this because you signed up at billiardactiontime.com. Don't want these emails? Just reply "unsubscribe" and we'll take you off the list.</p></div>`;

const text = [
  'Billiard Action Time', date, '',
  intro ? introText : 'Your two picks for today:', '',
  ...chosen.flatMap((i, n) => [`${isDrill(i) ? 'PRACTICE DRILL' : 'READ'}: ${i.title}`, i.desc, link(i.path, 'pick' + (n + 1)), '']),
  `Want to play tonight? ${link('/tonight/', 'tonight')}`, '',
  'See you at the table,', 'The Billiard Action Time team', '',
  'Don\'t want these emails? Just reply "unsubscribe" and we\'ll take you off the list.'
].join('\n');

if (flag('--commit')) {
  state.queue = state.queue.filter(s => !picks.includes(s));
  state.sent = [...new Set([...state.sent, ...picks])];
  state.log = [...state.log, { date: new Date().toISOString().slice(0, 10), picks }].slice(-60);
  writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
}
process.stdout.write(JSON.stringify({ subject, picks, html, text }, null, 2) + '\n');
