// Mosconi Cup 2026 hub page (/mosconi-cup-2026). Facts are from the official team announcement
// (Matchroom / World Nineball Tour, Nov 15, 2026). Daily results live in content/mosconi-2026.json
// (read on each request) so they can be filled in during the event without touching this file:
//   { "days": [ { "date": "2026-11-27", "score": "USA 3 – 2 Europe", "summary": "Plain-text recap" } ] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, shareStrip } from './seo.js';
import * as D from './db.js';
import { youtubeCtaHtml, youtubeEmbedHtml, MOSCONI_PICKS_CLOSE_MS } from './social.js';

const RESULTS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'mosconi-2026.json');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const MOSCONI_PATH = '/mosconi-cup-2026';
// Promote the page (home hero + nav) until the day after the event.
export const mosconiPromoOn = (today = D.todayIso()) => today < '2026-12-01';

const USA = ['Shane Van Boening', 'Tyler Styer', 'Fedor Gorst', 'Justin Bergman', 'Skyler Woodward'];
const EUROPE = ['Francisco Sánchez Ruiz', 'Joshua Filler', 'Aleksa Pecelj', 'David Alcaide', 'Jayson Shaw'];
// Short bios (from the official team announcement and our Nov 17 research). Plain text.
const USA_BIOS = [
  ['Johan Ruijsink', 'Captain (non-playing). The Dutch coach behind the USA\'s last two wins, in 2018 and 2019, is back in charge.'],
  ['Shane Van Boening', 'A record 20th straight Mosconi Cup, and the first American to qualify this year. The iron man of the event.'],
  ['Tyler Styer', 'Two-time Mosconi Cup winner, a steady hand in doubles and team matches.'],
  ['Fedor Gorst', 'Former World Champion and world No. 1. Won the 2026 Reyes Cup and was runner-up to Carlo Biado in the 2025 world final (15-13).'],
  ['Justin Bergman', 'Part of the 2019 winning team and back after seven years. He was named for 2020 but missed it with COVID.'],
  ['Skyler Woodward', 'Two-time MVP (2018, 2019). Playing captain in 2024 and 2025, now back to just playing.']
];
const EUROPE_BIOS = [
  ['Niels Feijen', 'Captain (non-playing). A Dutch veteran of many Mosconi Cups as a player, now leading Europe from the chair.'],
  ['Francisco Sánchez Ruiz', 'Reigning US Open champion and 2026 Reyes Cup MVP. The first European to qualify this year.'],
  ['Joshua Filler', 'Six-time Mosconi Cup champion. Won the 2026 UK Open and the Reyes Cup.'],
  ['Aleksa Pecelj', 'Breakthrough 2026 with titles at the Phoenix Open and the Reyes Cup.'],
  ['David Alcaide', 'Multiple Cup winner, with World Pool Masters, European Open and Philippines Open titles.'],
  ['Jayson Shaw', 'Multiple Cup winner and two-time MVP. Captained Europe to wins in 2024 and 2025 as a player.']
];
const HISTORY = [['2025', 'Europe 11-3', 'Alexandra Palace, London'], ['2024', 'Europe 11-6', 'Caribe Royale, Orlando (this year\'s venue)'], ['2023', 'Europe 11-3', ''], ['2022', 'Europe 11-7', ''], ['2021', 'Europe 11-6', ''], ['2020', 'Europe 11-3', ''], ['2019', 'USA 11-8', 'Las Vegas (the USA\'s last win)']];
const MATCHUPS = [
  ['Shane Van Boening vs. Joshua Filler', 'The 20-time American against the six-time champion. If these two meet in singles, it could swing a session.'],
  ['Fedor Gorst vs. Francisco Sánchez Ruiz', 'Reyes Cup teammates a month ago, now on opposite sides. Two of the best players in the world right now.'],
  ['Skyler Woodward vs. Jayson Shaw', 'Two-time MVP against two-time MVP. Both just handed back the captain\'s job and can focus on playing.']
];
const STORYLINES = [
  'Seven straight, or does the streak end? Europe have won six in a row; the USA haven\'t won since 2019 and now play at home.',
  'Teammates turned rivals: Gorst (USA) and Sánchez Ruiz, Filler and Pecelj (Europe) won the 2026 Reyes Cup together a month ago.',
  'The Ruijsink effect: the captain behind the 2018 and 2019 US wins is back.',
  'Shane\'s 20th: nobody has played in more Mosconi Cups in a row.',
  'Bergman\'s comeback after seven years away, and Woodward going from captain back to player.',
  'Shaw and Filler, Europe\'s closers, against a loud American crowd over Thanksgiving weekend.',
  'Where\'s Neuhausen? Last year\'s unbeaten rookie MVP, Moritz Neuhausen, did not make the 2026 team.'
];
const DAYS = [['2026-11-27', 'Friday, Nov 27', 'Day 1'], ['2026-11-28', 'Saturday, Nov 28', 'Day 2'], ['2026-11-29', 'Sunday, Nov 29', 'Day 3'], ['2026-11-30', 'Monday, Nov 30', 'Day 4 (final day)']];
const SOURCE = 'https://www.azbilliards.com/mosconi-cup-teams-are-confirmed-europe-chase-seven-as-usa-bid-for-home-glory-live-on-espn-27-30-november/';

// Start times (late November: ET = UTC-5, CET = UTC+1).
const START_TIMES = [['Eastern (ET)', '1:00 PM'], ['Central (CT)', '12:00 PM'], ['Pacific (PT)', '10:00 AM'], ['UK (GMT)', '6:00 PM'], ['Central Europe (CET)', '7:00 PM']];
// FAQ shown on the hub and as FAQPage structured data: [question, plain-text answer, optional HTML answer].
export function mosconiFaq(orderOut = false) {
  return [
    ['What time does the Mosconi Cup start?', 'Play starts at 1:00 PM ET (10:00 AM PT, 6:00 PM GMT) every day from Friday, November 27 to Monday, November 30, 2026.'],
    ['How can I watch the Mosconi Cup in the US?', 'Every session streams live on ESPN+ (in the ESPN App on phones and connected TVs) and on WNT TV, the World Nineball Tour streaming service. Broadcasters for other countries have not been announced yet.'],
    ['What is the Mosconi Cup format?', 'Five players from the USA face five from Europe in nine-ball singles, doubles and team matches. Each match is a race to 5 racks worth one point, and the first team to 11 points wins the Cup.'],
    ['When did Team USA last win the Mosconi Cup?', 'Team USA last won in 2019 in Las Vegas, 11-8, under captain Johan Ruijsink, who leads the team again in 2026. Europe have won every Cup since.'],
    ['Why is it called the Mosconi Cup?', 'It is named after Willie Mosconi, the American straight pool legend. Our straight pool (14.1) rules guide explains the game he made famous.', 'It is named after Willie Mosconi, the American straight pool legend. <a href="/blog/straight-pool-14-1-rules-explained-for-beginners">Straight pool rules explained →</a>'],
    orderOut
      ? ['Is the Mosconi Cup 2026 order of play out?', 'Yes. The order of play is listed at the top of this page.', 'Yes. See the <a href="#order-of-play">order of play</a> at the top of this page.']
      : ['Is the Mosconi Cup 2026 order of play out?', 'Not yet. We will add it to this page as soon as Matchroom publishes it.', 'Not yet. We will add it to the <a href="#order-of-play">order of play row</a> at the top of this page as soon as Matchroom publishes it.']
  ];
}

// "Pick the winner" box: picks close when play starts (1 PM ET, Nov 27); the % bar shows once there are enough picks.
export const PICKS_CLOSE_MS = MOSCONI_PICKS_CLOSE_MS;
export const PICKS_MIN_FOR_BAR = 20;
export const picksOpen = (now = Date.now()) => now < PICKS_CLOSE_MS;
export function pickBarHtml(stats) {
  if (!stats || stats.total < PICKS_MIN_FOR_BAR) return '';
  const eu = Math.round(stats.europe * 100 / stats.total), us = 100 - eu;
  return `<div class="pick-bar" aria-label="Fan picks"><p style="margin:0 0 6px"><b>${eu}% pick Europe</b> · <b>${us}% pick USA</b> <span class="muted">(${stats.total} picks)</span></p>
    <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:#ddd"><span style="width:${eu}%;background:#1f4fa3"></span><span style="width:${us}%;background:#b22234"></span></div></div>`;
}
// "Get each day's result by email" box next to Pick the winner. Joins the normal daily email list, tagged
// campaign "mosconi" so signups from here can be compared with other signups. Hidden after the final day (Nov 30).
const MOSCONI_EMAIL_END_MS = Date.UTC(2026, 11, 1, 5, 0, 0);
export function mosconiEmailBoxHtml(now = Date.now()) {
  if (now >= MOSCONI_EMAIL_END_MS) return '';
  return `<section class="card seo-cta" id="results-by-email" style="margin:18px 0;padding:16px 20px">
    <h2 class="seo-h2" style="margin-top:0">📬 Get each day's Mosconi Cup result by email</h2>
    <p class="muted" style="margin:6px 0 10px">One email each morning, Nov 28 to Dec 1, with the day's score at the top. It's our free daily pool email; unsubscribe any time.</p>
    <form class="sub-form" data-sub data-source="mosconi" action="/alerts" method="get"><input type="email" name="email" required placeholder="you@email.com" aria-label="Your email" autocomplete="email"> <button class="btn btn-blue btn-sm" type="submit">Send me the results</button></form>
    <p class="sub-msg" aria-live="polite"></p></section>`;
}
function pickBoxHtml(stats, now = Date.now()) {
  const bar = pickBarHtml(stats);
  if (!picksOpen(now)) return `<section class="card seo-cta" id="pick-the-winner" style="margin:18px 0;padding:20px"><h2 class="seo-h2" style="margin-top:0">🏆 Fan picks</h2>
    <p class="muted" style="margin:6px 0 12px">Picks closed when play started on Friday, Nov 27.</p>${bar}</section>`;
  const opts = [...Array(11).keys()].map(i => `<option value="${i}"${i === 7 ? ' selected' : ''}>11–${i}</option>`).join('');
  return `<section class="card seo-cta" id="pick-the-winner" style="margin:18px 0;padding:20px;border:2px solid #1f4fa3">
    <h2 class="seo-h2" style="margin-top:0">🏆 Pick the winner</h2>
    <p class="muted" style="margin:6px 0 12px">Who takes the Mosconi Cup 2026, and by how much? Just for fun, no prizes. Picks close when play starts, 1 PM ET on Friday, Nov 27.</p>
    <form class="pick-form" data-pick action="#pick-the-winner" method="get">
      <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:6px">Winner</legend>
        <label style="margin-right:16px"><input type="radio" name="team" value="europe" required> Europe</label>
        <label><input type="radio" name="team" value="usa"> USA</label></fieldset>
      <label style="display:block;margin-bottom:10px"><b>Final score</b> (winner first) <select name="loser" aria-label="Final score">${opts}</select></label>
      <label style="display:block;margin-bottom:10px"><b>Email</b> <span class="muted">(optional, to get the daily results)</span><br><input type="email" name="email" placeholder="you@email.com" autocomplete="email" style="max-width:320px;width:100%"></label>
      <button class="btn btn-blue" type="submit">Submit my pick</button></form>
    <p class="pick-msg" aria-live="polite" style="margin:10px 0 0"></p>
    <div data-pick-bar>${bar}</div>
    <p class="muted" style="font-size:12px;margin:8px 0 0">One pick per visitor; you can change it until picks close. An email you add joins our free daily email (unsubscribe any time, see our <a href="/privacy">privacy policy</a>).</p></section>`;
}

// "Watch parties": halls/bars showing the Cup submit here (saved, never auto-published); only rows the
// owner approves in the admin dashboard are listed. The form closes when the event ends.
export const WATCH_DAYS = [['fri', 'Fri Nov 27'], ['sat', 'Sat Nov 28'], ['sun', 'Sun Nov 29'], ['mon', 'Mon Nov 30']];
const WATCH_CLOSE_MS = Date.UTC(2026, 11, 1, 5, 0, 0);
export const watchPartyOpen = (now = Date.now()) => now < WATCH_CLOSE_MS;
const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
// Validates a submission. Returns { error } or { value: {hall, city, state, days, link, email, subscribe} }.
export function cleanWatchParty(b = {}) {
  const hall = oneLine(b.hall, 100), city = oneLine(b.city, 60), state = oneLine(b.state, 30);
  if (!hall || !city || !state) return { error: 'Add the hall name, city and state' };
  const picked = new Set((Array.isArray(b.days) ? b.days : String(b.days || '').split(',')).map(d => String(d).trim().toLowerCase()));
  const days = WATCH_DAYS.filter(([k]) => picked.has(k)).map(([, label]) => label).join(', ');
  if (!days) return { error: 'Pick at least one day' };
  let link = oneLine(b.link, 300);
  if (link) {
    if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
    try { const u = new URL(link); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw 0; link = u.href; } catch { return { error: 'Check the link (or leave it blank)' }; }
  }
  const email = oneLine(b.email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Check your email address (or leave it blank)' };
  return { value: { hall, city, state, days, link: link || null, email: email || null, subscribe: !!email && (b.subscribe === true || b.subscribe === 'on' || b.subscribe === '1') } };
}
function watchPartiesHtml(approved = [], now = Date.now()) {
  const list = approved.length
    ? `<ul class="seo-list">${approved.map(w => `<li><b>${w.link ? `<a href="${esc(w.link)}" rel="noopener nofollow ugc" target="_blank">${esc(w.hall)}</a>` : esc(w.hall)}</b>, ${esc(w.city)}, ${esc(w.state)} <span class="muted">(${esc(w.days)})</span></li>`).join('')}</ul>`
    : '<p class="muted">No watch parties listed yet. Is your hall or bar showing it? Add it below.</p>';
  const days = WATCH_DAYS.map(([k, label]) => `<label style="margin-right:12px;white-space:nowrap"><input type="checkbox" name="days" value="${k}"> ${label}</label>`).join('');
  const form = !watchPartyOpen(now) ? '' : `<div class="card seo-cta" id="watch-party" style="margin:14px 0 0;padding:18px;border:2px solid #c9a227">
    <h3 style="margin:0">📺 Hosting a Mosconi Cup watch party?</h3>
    <p class="muted" style="margin:6px 0 12px">Pool halls and bars showing the Cup: tell us and we'll list you here for fans nearby. Free. We check every listing before it goes up.</p>
    <form class="wp-form" data-watch-party action="#watch-party" method="get" style="display:grid;gap:8px;max-width:420px">
      <input name="hall" required maxlength="100" placeholder="Hall or bar name" aria-label="Hall or bar name">
      <div style="display:flex;gap:8px"><input name="city" required maxlength="60" placeholder="City" aria-label="City" style="flex:2;min-width:0"><input name="state" required maxlength="30" placeholder="State" aria-label="State" style="flex:1;min-width:0"></div>
      <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:4px">Which days?</legend>${days}</fieldset>
      <input name="link" maxlength="300" placeholder="Website or Facebook page (optional)" aria-label="Website or Facebook page">
      <input name="email" type="email" maxlength="200" placeholder="Your email (optional)" aria-label="Your email" autocomplete="email">
      <label style="font-size:14px"><input type="checkbox" name="subscribe" value="1"> Also send me the free daily email (Mosconi recaps, tournaments near me)</label>
      <button class="btn btn-green" type="submit">Submit my watch party</button></form>
    <p class="wp-msg" aria-live="polite" style="margin:10px 0 0"></p>
    <p class="muted" style="font-size:12px;margin:6px 0 0">Your email is never shown on the site. See our <a href="/privacy">privacy policy</a>.</p></div>`;
  return `<section class="sec seo-sec" id="watch-parties"><h2>Mosconi Cup watch parties</h2>
    <p>Want to watch with a crowd? These pool halls and bars told us they're showing the Mosconi Cup (play starts 1 PM ET each day). Call ahead to confirm.</p>${list}${form}</section>`;
}

function readJson() { try { return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) || {}; } catch { return {}; } }
// Order of play: set "orderOfPlay" (plain text) in content/mosconi-2026.json when Matchroom publishes it.
// Optional "youtubeId" (our channel only) + "youtubeTitle"/"youtubeCredit" in content/mosconi-2026.json shows a click-to-load video.
const mosconiVideo = () => { const j = readJson(); return youtubeEmbedHtml(j.youtubeId, j.youtubeTitle || 'Mosconi Cup 2026', j.youtubeCredit || ''); };
const orderOfPlay = () => { const o = readJson().orderOfPlay; return typeof o === 'string' && o.trim() ? o.trim() : ''; };

// "Add to calendar" file: the four 1 PM ET sessions plus the Thursday fan press conference.
// Times in UTC (ET is UTC-5 in late November). End times are approximate.
export function mosconiIcs(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ev = (uid, start, end, summary, desc) => ['BEGIN:VEVENT', `UID:${uid}@billiardactiontime.com`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${summary}`, `DESCRIPTION:${desc.replace(/,/g, '\\,')}`, 'LOCATION:Caribe Royale Resort\\, Orlando\\, FL', 'URL:https://billiardactiontime.com/mosconi-cup-2026', 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Billiard Action Time//Mosconi Cup 2026//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Mosconi Cup 2026',
    ...ev('mosconi2026-press', '20261126T200000Z', '20261126T210000Z', 'Mosconi Cup 2026 fan press conference', 'Open to fans in Palms III at the Caribe Royale (doors 2:30 PM ET). Teams USA and Europe meet the press the day before play starts.'),
    ...DAYS.flatMap(([d, label, n]) => ev(`mosconi2026-${d}`, `${d.replace(/-/g, '')}T180000Z`, `${d.replace(/-/g, '')}T230000Z`, `Mosconi Cup 2026: ${n}`,
      `USA vs Europe. Play starts 1:00 PM ET (6 PM GMT). Watch live on ESPN+ and WNT TV. Results: https://billiardactiontime.com/mosconi-cup-2026`)),
    'END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}

// Live tracker (Nov 27-30): optional "liveScore" (e.g. "Europe 3 - USA 2") and "matches"
// ([{ "date": "2026-11-27", "match": "Match 1: Singles", "players": "A vs B", "score": "5-3", "status": "Final" }])
// in content/mosconi-2026.json. Text only. The table shows the current day's matches at the top of the hub;
// the score banner shows on the home page during the four days of play.
const PLAY_FIRST = '2026-11-27', PLAY_LAST = '2026-11-30';
const liveScore = () => { const s = readJson().liveScore; return typeof s === 'string' && s.trim() ? s.trim() : ''; };
export function liveTrackerHtml(today = D.todayIso(), j = readJson()) {
  const all = (Array.isArray(j.matches) ? j.matches : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && x.match);
  if (today < PLAY_FIRST || today > PLAY_LAST || !all.length) return '';
  const rows = all.filter(x => x.date === today);
  if (!rows.length) return '';
  const score = typeof j.liveScore === 'string' ? j.liveScore.trim() : '';
  return `<section class="card" id="live" style="margin:0 0 14px;padding:14px 18px;border:2px solid #c4302b"><h2 style="margin:0 0 6px;font-size:1.2rem">🔴 Today's matches${score ? `: ${esc(score)}` : ''}</h2>
    <table class="t"><thead><tr><th>Match</th><th>Players</th><th>Score</th><th>Status</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.match)}</td><td>${esc(x.players || '')}</td><td><b>${esc(x.score || '–')}</b></td><td>${esc(x.status || '')}</td></tr>`).join('')}</tbody></table>
    <p class="muted" style="margin:6px 0 0;font-size:13px">Updated after each match. Watch live on ESPN+ and WNT TV.</p></section>`;
}
export function mosconiLiveBannerHtml(today = D.todayIso(), score = liveScore()) {
  if (today < PLAY_FIRST || today > PLAY_LAST || !score) return '';
  return `<div class="wrap"><p class="card" style="margin:12px 0 0;padding:10px 14px;border:2px solid #c4302b;font-weight:700"><a href="${MOSCONI_PATH}#live">🔴 Mosconi Cup live: ${esc(score)} →</a></p></div>`;
}

function results() {
  try {
    const j = readJson();
    return new Map((Array.isArray(j.days) ? j.days : []).filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '')).map(d => [d.date, d]));
  } catch { return new Map(); }
}

export function mosconiPage(cfg, db = null) {
  const today = D.todayIso(), res = results();
  const signup = `<section class="card seo-cta" style="margin:18px 0;padding:20px;border:2px solid #c9a227">
    <h2 class="seo-h2" style="margin-top:0">📬 Get Mosconi Cup recaps by email</h2>
    <p class="muted" style="margin:6px 0 12px">Sign up for our free daily email. During the Mosconi Cup (Nov 27–30) it carries a short recap of each day's matches, plus pool tips and tournaments near you. Unsubscribe any time.</p>
    <form class="sub-form" data-sub action="/alerts" method="get"><input type="email" name="email" required placeholder="you@email.com" aria-label="Your email" autocomplete="email"><button class="btn btn-green" type="submit">Send Me the Recaps</button></form><p class="sub-msg" aria-live="polite"></p></section>`;
  const team = (name, bios) => `<div class="card" style="flex:1;min-width:260px;padding:14px 18px"><h3 style="margin:0 0 6px">${esc(name)}</h3><ul class="seo-list" style="margin:0">${bios.map(([n, b]) => `<li><b>${esc(n)}</b>: ${esc(b)}</li>`).join('')}</ul></div>`;
  const dayRows = DAYS.map(([d, label, n]) => {
    const r = res.get(d);
    const body = r ? `${r.score ? `<b>${esc(r.score)}</b>` : ''}${r.summary ? `<br>${esc(r.summary)}` : ''}` : (d < today ? 'Results coming soon.' : 'Results will be posted here after play ends.');
    return `<tr><th>${esc(n)}<br><span class="muted" style="font-weight:400">${esc(label)}</span></th><td>${body}</td></tr>`;
  }).join('');
  const faq = mosconiFaq(!!orderOfPlay());
  const faqHtml = `<section class="sec seo-sec" id="how-to-watch"><h2>How to watch the Mosconi Cup 2026: quick answers</h2>
    <table class="t" style="max-width:520px"><caption class="muted" style="text-align:left;padding-bottom:6px">Daily start time, Fri Nov 27 – Mon Nov 30</caption><thead><tr><th>Time zone</th><th>Play starts</th></tr></thead><tbody>${START_TIMES.map(([z, t]) => `<tr><td>${esc(z)}</td><td><b>${esc(t)}</b></td></tr>`).join('')}</tbody></table>
    ${faq.map(([q, a, html]) => `<h3 style="margin:16px 0 4px;font-size:1.05rem">${esc(q)}</h3><p style="margin:0">${html || esc(a)}</p>`).join('')}</section>`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/big-tournaments/">Big Events</a> <span>/</span> <span>Mosconi Cup 2026</span></nav>
  ${liveTrackerHtml(today)}
  <article class="card">
    <h1 class="dtitle">Mosconi Cup 2026: Team USA vs. Team Europe</h1>
    <p class="lead-muted"><b>November 27–30, 2026</b> at the <b>Caribe Royale Resort, Orlando, Florida</b>. Pool's version of the Ryder Cup: five American pros against five European pros over four days. Europe are the defending champions.</p>
    <table class="t"><tbody>
      <tr><th>Dates</th><td>Friday, Nov 27 – Monday, Nov 30, 2026</td></tr>
      <tr><th>Start time</th><td><b>Play starts 1:00 PM ET each day</b> (6 PM GMT), Friday to Monday</td></tr>
      <tr id="order-of-play"><th>Order of play</th><td>${orderOfPlay() ? esc(orderOfPlay()) : 'Not announced yet. We will post it here when Matchroom publishes it.'}</td></tr>
      <tr><th>Venue</th><td>Caribe Royale Resort, Orlando, FL</td></tr>
      <tr><th>Watch (US)</th><td>Live on ESPN+ and WNT TV. Other countries: broadcasters to be announced.</td></tr>
      <tr><th>Tickets</th><td>On sale at <a href="https://worldnineballtour.com" rel="noopener nofollow" target="_blank">worldnineballtour.com</a></td></tr>
      <tr><th>Press conference</th><td>Thursday, Nov 26 (Thanksgiving), 3–4 PM ET (doors 2:30 PM), Palms III at the Caribe Royale (open to fans)</td></tr>
    </tbody></table>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-blue" href="${MOSCONI_PATH}/calendar.ics" rel="nofollow" download>📅 Add to calendar (all 4 days + press conference)</a><a class="btn btn-out" href="/pro-events">More pro events &amp; where to watch</a></div>
  </article>
  ${faqHtml}
  ${pickBoxHtml(db ? D.mosconiPickStats(db) : null)}${mosconiEmailBoxHtml()}
  ${mosconiVideo()}
  ${signup}
  ${youtubeCtaHtml('Mosconi Cup previews, highlights and pro match recaps.')}
  <section class="sec seo-sec"><h2>The teams</h2><div style="display:flex;flex-wrap:wrap;gap:12px">${team('Team USA', USA_BIOS)}${team('Team Europe', EUROPE_BIOS)}</div>
    <p class="muted" style="font-size:13px">Source: <a href="${SOURCE}" rel="noopener nofollow" target="_blank">Mosconi Cup teams confirmed (Matchroom, Nov 15, 2026)</a>.</p></section>
  <section class="sec seo-sec"><h2>Key matchups to watch</h2><p class="muted">The order of play isn't out yet, so these are the matches we'd most like to see.</p><ul class="seo-list">${MATCHUPS.map(([m, w]) => `<li><b>${esc(m)}</b>: ${esc(w)}</li>`).join('')}</ul></section>
  <section class="sec seo-sec"><h2>Storylines</h2><ul class="seo-list">${STORYLINES.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
  <section class="sec seo-sec"><h2>Mosconi Cup history: Europe's six-year streak</h2>
    <p>Europe have won the last six Mosconi Cups (2020 to 2025) and lead the all-time series. The USA last won in 2019 in Las Vegas, 11-8, under this year's captain Johan Ruijsink. In 2024 the Cup was played at this same venue, the Caribe Royale in Orlando, and Europe won 11-6.</p>
    <table class="t"><thead><tr><th>Year</th><th>Winner and score</th><th>Note</th></tr></thead><tbody>${HISTORY.map(([y, w, n]) => `<tr><td>${y}</td><td>${esc(w)}</td><td>${esc(n)}</td></tr>`).join('')}</tbody></table>
    <p class="muted" style="font-size:13px">2025 MVP: Moritz Neuhausen (Europe), unbeaten as a rookie.</p></section>
  <section class="sec seo-sec"><h2>Daily results</h2><table class="t"><tbody>${dayRows}</tbody></table></section>
  <section class="sec seo-sec"><h2>How to watch in the US</h2>
    <p><b>Play starts at 1:00 PM ET (6 PM GMT) on each of the four days, Friday Nov 27 to Monday Nov 30.</b> Every session streams live on <b>ESPN+</b> and <b>WNT TV</b> (the World Nineball Tour's streaming service). Each match is a race to 5 racks worth one point, and the first team to 11 points wins the Cup.</p></section>
  ${watchPartiesHtml(db ? D.listWatchParties(db, 'approved') : [])}
  <section class="sec seo-sec"><h2>Read before the first break</h2><ul class="seo-list">
    <li><a href="/blog/mosconi-cup-2026-teams-usa-vs-europe-lineups">Mosconi Cup 2026 teams: meet the USA and Europe lineups</a></li>
    <li><a href="/blog/how-the-mosconi-cup-works-format-explained">How the Mosconi Cup works: the format explained</a></li>
    <li><a href="/blog/nine-ball-rules-explained-before-mosconi-cup">9-Ball rules explained before the Mosconi Cup</a></li>
    <li><a href="/blog/straight-pool-14-1-rules-explained-for-beginners">Straight pool (14.1) rules explained: the game Willie Mosconi made famous</a></li>
    <li><a href="/guides/pool-news-chua-filler-mosconi-countdown-november-2026">Pool news: Chua wins at home, Filler takes $100K, Mosconi countdown</a></li>
    <li><a href="/guides/mosconi-cup-2026-preview">Mosconi Cup 2026 preview: captains, qualifying and Europe's streak</a></li>
    <li><a href="/guides/major-pool-events-calendar">Major pool events 2026–2027 calendar</a></li>
    <li><a href="/pro-events">Pro pool events after the Mosconi Cup, and where to watch them</a></li>
  </ul></section>
  <section class="sec seo-sec"><h2>Inspired to play?</h2><p>Find a 9-Ball tournament near you: <a href="/tonight/">tonight</a>, <a href="/this-weekend/">this weekend</a>, or <a href="/tournaments/florida">in Florida</a>. Black Friday is day one of the Cup, so the <a href="/gear/">pool gear guide</a> has our picks if you're shopping.</p></section>
  ${shareStrip(cfg, MOSCONI_PATH, 'Mosconi Cup 2026: teams, dates, how to watch', 'Team USA vs. Team Europe, Nov 27–30 in Orlando.')}`;
  const ld = { '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'Mosconi Cup 2026', sport: 'Pool (cue sports)',
    description: 'Team USA vs. Team Europe nine-ball team event, November 27–30, 2026, at the Caribe Royale Resort in Orlando, Florida.',
    url: cfg.publicUrl + MOSCONI_PATH, startDate: '2026-11-27T13:00:00-05:00', endDate: '2026-11-30T18:00:00-05:00',
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    image: [cfg.publicUrl + '/og.jpg'],
    location: { '@type': 'Place', name: 'Caribe Royale Resort', address: { '@type': 'PostalAddress', addressLocality: 'Orlando', addressRegion: 'FL', addressCountry: 'US' } },
    organizer: { '@type': 'Organization', name: 'Matchroom Pool', url: 'https://worldnineballtour.com' },
    competitor: [
      { '@type': 'SportsTeam', name: 'Team USA', athlete: USA.map(n => ({ '@type': 'Person', name: n })) },
      { '@type': 'SportsTeam', name: 'Team Europe', athlete: EUROPE.map(n => ({ '@type': 'Person', name: n })) }
    ] };
  return layout(cfg, { title: 'Mosconi Cup 2026: Teams, Dates, How to Watch & Daily Results | Billiard Action Time',
    description: 'Mosconi Cup 2026, Nov 27–30 at the Caribe Royale in Orlando: Team USA and Team Europe line-ups, how to watch on ESPN+ and WNT TV, and daily results.',
    path: MOSCONI_PATH, body, jsonld: [ld, { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] });
}
