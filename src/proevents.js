// /pro-events: upcoming pro pool events with dates, venue, format and where to watch.
// Data lives in content/pro-events.json (read on each request), so it can be updated without
// touching this file. Events drop off the day after their end date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, shareStrip } from './seo.js';
import * as D from './db.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'pro-events.json');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const PRO_EVENTS_PATH = '/pro-events';
const safeUrl = u => (typeof u === 'string' && /^(https:\/\/|\/)/.test(u) ? u : '');

export function proEvents(today = D.todayIso()) {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return (Array.isArray(j.events) ? j.events : [])
      .filter(e => e && e.name && ISO.test(e.start || '') && ISO.test(e.end || e.start) && (e.end || e.start) >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
  } catch { return []; }
}

const md = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
function dateRange(e) {
  const end = e.end || e.start, y = e.start.slice(0, 4);
  if (end === e.start) return `${md(e.start)}, ${y}`;
  return e.start.slice(0, 7) === end.slice(0, 7) ? `${md(e.start)}–${Number(end.slice(8))}, ${y}` : `${md(e.start)} – ${md(end)}, ${y}`;
}
const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

export function proEventsPage(cfg) {
  const today = D.todayIso(), list = proEvents(today);
  const card = e => {
    const live = e.start <= today && (e.end || e.start) >= today;
    const name = safeUrl(e.link) ? `<a href="${esc(e.link)}">${esc(e.name)}</a>` : esc(e.name);
    const watch = safeUrl(e.watchUrl) ? `<a href="${esc(e.watchUrl)}" rel="noopener nofollow" target="_blank">${esc(e.watch)}</a>` : esc(e.watch || 'To be announced');
    return `<section class="card" style="margin:0 0 12px;padding:14px 18px">
      <h2 style="margin:0 0 6px;font-size:1.2em">${name}${live ? ' <span class="live">ON NOW</span>' : ''}</h2>
      <table class="t"><tbody>
        <tr><th>Dates</th><td>${esc(dateRange(e))}${e.startTime ? ` · play starts ${esc(fmtTime(e.startTime))} ET` : ''}</td></tr>
        <tr><th>Venue</th><td>${esc(e.venue || '')}${e.city ? `, ${esc(e.city)}` : ''}</td></tr>
        ${e.format ? `<tr><th>Format</th><td>${esc(e.format)}</td></tr>` : ''}
        <tr><th>Where to watch</th><td>${watch}</td></tr>
      </tbody></table>
      ${safeUrl(e.source) ? `<p class="muted" style="font-size:13px;margin:6px 0 0">Source: <a href="${esc(e.source)}" rel="noopener nofollow" target="_blank">${esc(e.organizer || 'organizer')}</a>. Dates can change; check before you travel.</p>` : ''}
    </section>`;
  };
  const signup = `<section class="card seo-cta" style="margin:18px 0;padding:20px;border:2px solid #c9a227">
    <h2 class="seo-h2" style="margin-top:0">📬 Weekly pro pool schedule by email</h2>
    <p class="muted" style="margin:6px 0 12px">Get our free email with what's on in pro pool and where to watch it, plus tournaments near you. Unsubscribe any time.</p>
    <form class="sub-form" data-sub action="/alerts" method="get"><input type="email" name="email" required placeholder="you@email.com" aria-label="Your email" autocomplete="email"><button class="btn btn-green" type="submit">Send Me the Schedule</button></form><p class="sub-msg" aria-live="polite"></p></section>`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/big-tournaments/">Big Events</a> <span>/</span> <span>Pro Events</span></nav>
  <h1 class="dtitle">Pro Pool Events: Schedule and Where to Watch</h1>
  <p class="lead-muted">The next big professional pool events, with dates, venues, formats and where each one streams. Updated as organizers confirm details.</p>
  ${list.length ? list.map(card).join('') : '<p class="muted">No upcoming pro events listed right now. Check back soon.</p>'}
  ${signup}
  <section class="sec seo-sec"><h2>More big pool events</h2><p>Want to play, not just watch? See the <a href="/big-tournaments/">biggest added-money tournaments</a> coming up across the US, what's on <a href="/this-weekend/">this weekend</a>, and the <a href="/guides/major-pool-events-calendar">major pool events calendar</a>.</p></section>
  ${shareStrip(cfg, PRO_EVENTS_PATH, 'Pro pool events: schedule and where to watch', 'Upcoming pro pool events with dates, venues and streams.')}`;
  const tz = '-05:00';
  const jsonld = list.map(e => ({ '@context': 'https://schema.org', '@type': 'SportsEvent', name: e.name, sport: 'Pool (cue sports)',
    startDate: e.startTime ? `${e.start}T${e.startTime}:00${tz}` : e.start, endDate: e.end || e.start,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    ...(e.format ? { description: e.format } : {}),
    url: safeUrl(e.link) ? (e.link.startsWith('/') ? cfg.publicUrl + e.link : e.link) : cfg.publicUrl + PRO_EVENTS_PATH,
    location: { '@type': 'Place', name: e.venue || e.city, address: e.city || '' },
    ...(e.organizer ? { organizer: { '@type': 'Organization', name: e.organizer, ...(safeUrl(e.source).startsWith('https') ? { url: new URL(e.source).origin } : {}) } } : {}) }));
  return layout(cfg, { title: 'Pro Pool Events 2026: Schedule & Where to Watch | Billiard Action Time',
    description: `Upcoming pro pool events with dates, venues, formats and where to watch${list.length ? `: ${list.slice(0, 3).map(e => e.name.replace(/ \(.*\)$/, '')).join(', ')} and more` : ''}.`,
    path: PRO_EVENTS_PATH, body, jsonld });
}
