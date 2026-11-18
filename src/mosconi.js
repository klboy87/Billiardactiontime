// Mosconi Cup 2026 hub page (/mosconi-cup-2026). Facts are from the official team announcement
// (Matchroom / World Nineball Tour, Nov 15, 2026). Daily results live in content/mosconi-2026.json
// (read on each request) so they can be filled in during the event without touching this file:
//   { "days": [ { "date": "2026-11-27", "score": "USA 3 – 2 Europe", "summary": "Plain-text recap" } ] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, shareStrip } from './seo.js';
import * as D from './db.js';
import { youtubeCtaHtml, youtubeEmbedHtml } from './social.js';

const RESULTS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'mosconi-2026.json');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const MOSCONI_PATH = '/mosconi-cup-2026';
// Promote the page (home hero + nav) until the day after the event.
export const mosconiPromoOn = (today = D.todayIso()) => today < '2026-12-01';

const USA = ['Shane Van Boening', 'Tyler Styer', 'Fedor Gorst', 'Justin Bergman', 'Skyler Woodward'];
const EUROPE = ['Francisco Sánchez Ruiz', 'Joshua Filler', 'Aleksa Pecelj', 'David Alcaide', 'Jayson Shaw'];
const DAYS = [['2026-11-27', 'Friday, Nov 27', 'Day 1'], ['2026-11-28', 'Saturday, Nov 28', 'Day 2'], ['2026-11-29', 'Sunday, Nov 29', 'Day 3'], ['2026-11-30', 'Monday, Nov 30', 'Day 4 (final day)']];
const SOURCE = 'https://www.azbilliards.com/mosconi-cup-teams-are-confirmed-europe-chase-seven-as-usa-bid-for-home-glory-live-on-espn-27-30-november/';

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
    ...ev('mosconi2026-press', '20261126T200000Z', '20261126T210000Z', 'Mosconi Cup 2026 fan press conference', 'Open to fans at the Caribe Royale. Teams USA and Europe meet the press the day before play starts.'),
    ...DAYS.flatMap(([d, label, n]) => ev(`mosconi2026-${d}`, `${d.replace(/-/g, '')}T180000Z`, `${d.replace(/-/g, '')}T230000Z`, `Mosconi Cup 2026: ${n}`,
      `USA vs Europe. Play starts 1:00 PM ET (6 PM GMT). Watch live on ESPN+ and WNT TV. Results: https://billiardactiontime.com/mosconi-cup-2026`)),
    'END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}

function results() {
  try {
    const j = readJson();
    return new Map((Array.isArray(j.days) ? j.days : []).filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '')).map(d => [d.date, d]));
  } catch { return new Map(); }
}

export function mosconiPage(cfg) {
  const today = D.todayIso(), res = results();
  const signup = `<section class="card seo-cta" style="margin:18px 0;padding:20px;border:2px solid #c9a227">
    <h2 class="seo-h2" style="margin-top:0">📬 Get Mosconi Cup recaps by email</h2>
    <p class="muted" style="margin:6px 0 12px">Sign up for our free daily email. During the Mosconi Cup (Nov 27–30) it carries a short recap of each day's matches, plus pool tips and tournaments near you. Unsubscribe any time.</p>
    <form class="sub-form" data-sub action="/alerts" method="get"><input type="email" name="email" required placeholder="you@email.com" aria-label="Your email" autocomplete="email"><button class="btn btn-green" type="submit">Send Me the Recaps</button></form><p class="sub-msg" aria-live="polite"></p></section>`;
  const team = (name, captain, players) => `<div class="card" style="flex:1;min-width:240px;padding:14px 18px"><h3 style="margin:0 0 6px">${esc(name)}</h3><p class="muted" style="margin:0 0 6px">Captain: ${esc(captain)} (non-playing)</p><ul class="seo-list" style="margin:0">${players.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  const dayRows = DAYS.map(([d, label, n]) => {
    const r = res.get(d);
    const body = r ? `${r.score ? `<b>${esc(r.score)}</b>` : ''}${r.summary ? `<br>${esc(r.summary)}` : ''}` : (d < today ? 'Results coming soon.' : 'Results will be posted here after play ends.');
    return `<tr><th>${esc(n)}<br><span class="muted" style="font-weight:400">${esc(label)}</span></th><td>${body}</td></tr>`;
  }).join('');
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/big-tournaments/">Big Events</a> <span>/</span> <span>Mosconi Cup 2026</span></nav>
  <article class="card">
    <h1 class="dtitle">Mosconi Cup 2026: Team USA vs. Team Europe</h1>
    <p class="lead-muted"><b>November 27–30, 2026</b> at the <b>Caribe Royale Resort, Orlando, Florida</b>. Pool's version of the Ryder Cup: five American pros against five European pros over four days. Europe are the defending champions.</p>
    <table class="t"><tbody>
      <tr><th>Dates</th><td>Friday, Nov 27 – Monday, Nov 30, 2026</td></tr>
      <tr><th>Start time</th><td><b>Play starts 1:00 PM ET each day</b> (6 PM GMT), Friday to Monday</td></tr>
      <tr><th>Order of play</th><td>${orderOfPlay() ? esc(orderOfPlay()) : 'Not announced yet. We will post it here when Matchroom publishes it.'}</td></tr>
      <tr><th>Venue</th><td>Caribe Royale Resort, Orlando, FL</td></tr>
      <tr><th>Watch (US)</th><td>Live on ESPN+ and WNT TV. Other countries: broadcasters to be announced.</td></tr>
      <tr><th>Tickets</th><td>On sale at <a href="https://worldnineballtour.com" rel="noopener nofollow" target="_blank">worldnineballtour.com</a></td></tr>
      <tr><th>Press conference</th><td>Thursday, Nov 26, 3–4 PM ET at the Caribe Royale (open to fans)</td></tr>
    </tbody></table>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-blue" href="${MOSCONI_PATH}/calendar.ics" rel="nofollow" download>📅 Add to calendar (all 4 days + press conference)</a><a class="btn btn-out" href="/pro-events">More pro events &amp; where to watch</a></div>
  </article>
  ${mosconiVideo()}
  ${signup}
  ${youtubeCtaHtml('Mosconi Cup previews, highlights and pro match recaps.')}
  <section class="sec seo-sec"><h2>The teams</h2><div style="display:flex;flex-wrap:wrap;gap:12px">${team('Team USA', 'Johan Ruijsink', USA)}${team('Team Europe', 'Niels Feijen', EUROPE)}</div>
    <p class="muted" style="font-size:13px">Source: <a href="${SOURCE}" rel="noopener nofollow" target="_blank">Mosconi Cup teams confirmed (Matchroom, Nov 15, 2026)</a>.</p></section>
  <section class="sec seo-sec"><h2>Daily results</h2><table class="t"><tbody>${dayRows}</tbody></table></section>
  <section class="sec seo-sec"><h2>How to watch in the US</h2>
    <p><b>Play starts at 1:00 PM ET (6 PM GMT) on each of the four days, Friday Nov 27 to Monday Nov 30.</b> Every session streams live on <b>ESPN+</b> and <b>WNT TV</b> (the World Nineball Tour's streaming service). Each match is a race to 5 racks worth one point, and the first team to 11 points wins the Cup.</p></section>
  <section class="sec seo-sec"><h2>Read before the first break</h2><ul class="seo-list">
    <li><a href="/blog/how-the-mosconi-cup-works-format-explained">How the Mosconi Cup works: the format explained</a></li>
    <li><a href="/blog/nine-ball-rules-explained-before-mosconi-cup">9-Ball rules explained before the Mosconi Cup</a></li>
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
    path: MOSCONI_PATH, body, jsonld: [ld] });
}
