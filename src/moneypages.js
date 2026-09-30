// Server-rendered Money Match pages (readable by Google and by Facebook/X link previews):
//   /money-matches/                 upcoming matches + results
//   /money-match/<slug>             one match: flyer, tale of the tape, fan vote, staking, share, comments
//   /money-matches/player/<slug>    every match a player has been in
import { layout, linkContacts } from './seo.js';
import { slugify } from './normalize.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n).toLocaleString('en-US');
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const shortDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

const mmGame = m => (m.game && m.game !== 'Other' ? m.game : 'Pool');
const mmWhen = m => `${longDate(m.date)}${m.time ? ' at ' + fmtTime(m.time) : ''}`;
const mmTitle = m => `${m.player1} vs ${m.player2}`;
const initials = n => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
const playerLink = name => `<a href="/money-matches/player/${esc(slugify(name))}">${esc(name)}</a>`;
const NOTE = '<p class="stake-note">Billiard Action Time lists these matches for fans. It never takes, holds or pays out money. You must be 18+ and follow the laws where you play.</p>';

function poster(m, cls = '') {
  if (m.flyerUrl) return `<img class="mm-flyer ${cls}" src="${esc(m.flyerUrl)}" alt="Flyer: ${esc(mmTitle(m))} ${esc(mmGame(m))} money match" loading="lazy">`;
  return `<div class="mm-poster ${cls}"><b>${esc(mmGame(m).toUpperCase())}</b><span>MONEY MATCH</span><i>${esc(m.player1)}</i><em>VS</em><i>${esc(m.player2)}</i></div>`;
}
export function scoreLine(m) {
  if (!m.winner) return '';
  const [w, l, ws, ls] = m.winner === 1 ? [m.player1, m.player2, m.score1, m.score2] : [m.player2, m.player1, m.score2, m.score1];
  return `🏆 <b>${esc(w)}</b> beat ${esc(l)} ${ws}–${ls}`;
}
export function card(m) {
  return `<a class="card mm-card" href="${esc(m.path)}">
    <div class="mm-thumb">${poster(m)}</div>
    <div class="mm-card-body"><b class="mm-card-title">${esc(mmTitle(m))}</b>
      <div class="mm-card-facts">🎱 ${esc(mmGame(m))}${m.race ? ` · Race to ${m.race}` : ''}${m.stakes ? `<br>💰 <b>${esc(m.stakes)}</b> on the line` : ''}<br>📅 ${esc(shortDate(m.date))}${m.time ? ' · ' + esc(fmtTime(m.time)) : ''}<br>📍 ${esc(m.city)}, ${esc(m.state)}</div>
      ${m.winner ? `<div class="mm-result-line">${scoreLine(m)}</div>` : m.isToday ? '<span class="live">TODAY</span>' : ''}</div></a>`;
}

export function matchPage(cfg, m, { tally, comments, stakes }) {
  const url = cfg.publicUrl + m.path, title = mmTitle(m);
  const where = [m.room, m.address, `${m.city}, ${m.state}`].filter(Boolean).join(', ');
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.room, m.address, m.city, m.state].filter(Boolean).join(' '))}`;
  const plainScore = scoreLine(m).replace(/<[^>]+>/g, '').replace('🏆 ', '');
  const description = `${title}: ${mmGame(m)} money match${m.race ? `, race to ${m.race}` : ''}${m.stakes ? `, ${m.stakes} on the line` : ''}. ${mmWhen(m)} in ${m.city}, ${m.state}.${m.winner ? ` Final: ${plainScore}.` : ''}`;
  const pct = n => (tally.total ? Math.round(n / tally.total * 100) : 0);
  const shareText = `${title}: ${mmGame(m)}${m.race ? `, race to ${m.race}` : ''}${m.stakes ? `, ${m.stakes} on the line` : ''}. ${shortDate(m.date)} in ${m.city}, ${m.state}.`;
  const u = encodeURIComponent(url), tx = encodeURIComponent(shareText);
  const img = `/money-match/${m.id}/card`;
  const body = `<div class="crumbs"><a href="/money-matches/">Money Matches</a> / ${esc(title)}</div>
  <div class="mm-hero">${poster(m, 'mm-hero-img')}</div>
  <section class="card mm-tape" data-mm="${m.id}" data-date="${esc(m.date)}" data-time="${esc(m.time || '')}" data-done="${m.winner ? 1 : 0}">
    <h1 class="mm-h1">${esc(mmGame(m))} Money Match</h1>
    <div class="mm-vs"><div><span class="mm-av">${esc(initials(m.player1))}</span>${playerLink(m.player1)}</div><b>VS</b><div><span class="mm-av dk">${esc(initials(m.player2))}</span>${playerLink(m.player2)}</div></div>
    ${m.winner ? `<p class="mm-final">${scoreLine(m)}</p>` : '<div class="mm-count" id="mmCount" hidden></div>'}
    <table class="mm-facts">
      <tr><td>Game</td><td>${esc(mmGame(m))}</td></tr>
      ${m.race ? `<tr><td>Race</td><td>To ${m.race}</td></tr>` : ''}
      ${m.stakes ? `<tr><td>On the line</td><td class="mm-money">${esc(m.stakes)}</td></tr>` : ''}
      <tr><td>When</td><td>${esc(mmWhen(m))}</td></tr>
      <tr><td>Where</td><td>${esc(where)}</td></tr>
      <tr><td>Watch</td><td>${m.streamUrl ? `<a href="${esc(m.streamUrl)}" target="_blank" rel="noopener nofollow">Watch the stream</a>` : '<span class="muted">Stream link posted here when announced</span>'}</td></tr>
    </table>
    ${m.notes ? `<p>${linkContacts(m.notes)}</p>` : ''}
    <div class="actbar">${m.winner ? '' : `<a class="btn btn-blue" href="/money-match/${m.id}.ics">📅 Add to Calendar</a>`}<a class="btn btn-out" href="${esc(maps)}" target="_blank" rel="noopener">📍 Directions</a>${m.streamUrl ? `<a class="btn btn-red" href="${esc(m.streamUrl)}" target="_blank" rel="noopener nofollow">▶ Watch</a>` : ''}</div>
  </section>

  <section class="card mm-poll" id="vote">
    <h2>${m.winner ? 'How the Fans Voted' : 'Who Ya Got?'}</h2>
    ${[[1, m.player1, tally.p1], [2, m.player2, tally.p2]].map(([k, n, v]) => `<button type="button" class="mm-pick" data-pick="${k}"${m.winner ? ' disabled' : ''}>
      <span class="mm-pick-top"><b>${esc(n)}</b><span data-pct="${k}">${pct(v)}%</span></span>
      <span class="mm-bar"><span class="mm-fill p${k}" data-bar="${k}" style="width:${pct(v)}%"></span></span></button>`).join('')}
    <p class="mm-poll-note"><span id="mmVotes">${tally.total.toLocaleString('en-US')} fan${tally.total === 1 ? '' : 's'} voted</span><span id="mmMine"></span>${m.winner ? '' : '<br>Tap a name to vote. Just for fun, no money involved.'}</p>
  </section>

  ${stakes.length || m.upcoming ? `<section class="card mm-stakes"><h2>🐎 Back a Player</h2>
    ${stakes.length ? stakes.map(s => { const pc = s.offered ? Math.min(100, Math.round(s.sold / s.offered * 100)) : 0; return `<a class="mm-stake" href="/#/stakes/${s.id}">
      <span class="mm-stake-top"><b>${esc(s.player)}</b><span class="chip">${Number(s.markup)}x markup</span></span>
      <span class="muted">Selling ${s.offered}% of ${money(s.bet)} a side</span>
      <span class="mm-bar light"><span class="mm-fill p1" style="width:${pc}%"></span></span><span class="muted">${pc}% of pieces sold${s.status === 'settled' ? ' · settled' : ''}</span></a>`; }).join('')
      : '<p class="muted">No one is selling pieces for this match yet.</p>'}
    ${m.upcoming ? `<a class="btn btn-green" href="/#/stakes/new?mm=${m.id}">Sell Pieces of Your Action</a>` : ''}
    <p class="stake-note" style="margin-top:10px">The Staking Board only keeps records. Billiard Action Time never holds or sends money. 18+ and follow the laws where you play.</p></section>` : ''}

  <section id="share" class="card share-box" data-share-url="${esc(url)}" data-share-title="${esc(title)}" data-share-text="${esc(shareText)}" data-share-card="${img}-square.png">
    <div class="share-grid"><img class="share-preview" src="${img}-square.png" alt="Share graphic for ${esc(title)}" width="1080" height="1080" loading="lazy">
    <div><h2 class="seo-h2" style="margin-top:0">Share This Match</h2>
    <p class="muted">Post it and get people talking. The link shows this graphic on Facebook, TikTok, X and in texts.</p>
    <div class="actbar"><button type="button" class="btn btn-green" data-share="native" hidden>Share…</button>
      <a class="btn btn-blue" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${u}">Facebook</a>
      <a class="btn btn-out" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${u}&amp;text=${tx}">X</a>
      <a class="btn btn-out" href="sms:?&amp;body=${tx}%20${u}">Text</a>
      <button type="button" class="btn btn-out" data-share="copy">Copy Link</button></div>
    <p class="muted" style="margin:14px 0 6px;font-size:14px">Download the graphic:</p>
    <div class="actbar"><a class="btn btn-out btn-sm" href="${img}-story.png?download" download>Tall (TikTok / Reels / Stories)</a>
      <a class="btn btn-out btn-sm" href="${img}-square.png?download" download>Square post</a>
      <a class="btn btn-out btn-sm" href="${img}-og.png?download" download>Wide</a></div></div></div>
  </section>

  <section class="mm-rail" id="comments"><h2 class="seo-h2">💬 The Rail (<span id="cCount">${comments.length}</span>)</h2>
    <div class="mcomments" id="cList">${comments.map(c => `<div class="mcomment"><div class="mcomment-top"><b>${esc(c.name)}</b></div><p>${linkContacts(c.body)}</p>${c.contact ? `<p class="mcontact">📞 ${linkContacts(c.contact)}</p>` : ''}</div>`).join('') || '<p class="muted">No comments yet. Start the conversation.</p>'}</div>
    <form class="card" id="cForm" style="margin-top:12px">
      <div class="fg"><label class="f">Your name *</label><input name="name" required maxlength="40"></div>
      <div class="fg"><label class="f">Comment *</label><textarea name="body" required maxlength="500" rows="3" placeholder="Who you got? Going to watch? Talk about the match…"></textarea></div>
      <div class="fg"><label class="f">How to reach you</label><input name="contact" maxlength="120" placeholder="Optional: phone, email or Facebook link"></div>
      <div id="cMsg"></div><button class="btn btn-green" type="submit">Post Comment</button>
      <p class="muted" style="font-size:13px;margin:8px 0 0">Comments are public, including any contact info you add. Keep it respectful.</p>
    </form></section>
  ${NOTE}
  <p class="actbar"><a class="btn btn-out" href="/money-matches/">All Money Matches</a><a class="btn btn-out" href="/#/money/new">Post a Money Match</a></p>`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${title} (${mmGame(m)} money match)`, sport: 'Billiards',
    startDate: m.time ? `${m.date}T${m.time}` : m.date, eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    competitor: [{ '@type': 'Person', name: m.player1 }, { '@type': 'Person', name: m.player2 }],
    location: { '@type': 'Place', name: m.room || `${m.city}, ${m.state}`, address: { '@type': 'PostalAddress', ...(m.address ? { streetAddress: m.address } : {}), addressLocality: m.city, addressRegion: m.state, addressCountry: 'US' } },
    url, ...(m.flyerUrl ? { image: cfg.publicUrl + m.flyerUrl } : {}), description }];
  return layout(cfg, { title: `${title} | ${mmGame(m)} Money Match, ${m.city}, ${m.state}`, description, path: m.path, body, jsonld, ogImage: `${cfg.publicUrl}${img}-og.png` })
    .replace('<script src="/share.js" defer></script>', '<script src="/share.js" defer></script><script src="/moneymatch.js" defer></script>');
}

export function hubPage(cfg, { upcoming, results }) {
  const body = `<h1>💰 Money Matches</h1>
  <p class="muted">Big-money challenge matches across the country: who's playing, the game, the race, what's on the line, and the final score.</p>
  <p><a class="btn btn-gold" href="/#/money/new">Post a Money Match</a></p>
  <h2 class="seo-h2">Upcoming</h2>
  ${upcoming.length ? `<div class="mm-grid">${upcoming.map(card).join('')}</div>` : '<p class="muted">No upcoming money matches posted right now. Know of one? Post it.</p>'}
  <h2 class="seo-h2">🏆 Results</h2>
  ${results.length ? `<div class="mm-grid">${results.slice(0, 60).map(card).join('')}</div>` : '<p class="muted">Final scores show here after each match.</p>'}
  ${NOTE}`;
  return layout(cfg, { title: 'Pool Money Matches: Upcoming Matches and Results | Billiard Action Time',
    description: 'Upcoming pool money matches and challenge matches, with the game, race, stakes, date and location, plus final scores.', path: '/money-matches/', body });
}

export function playerPage(cfg, slug, name, matches) {
  const decided = matches.filter(m => m.winner);
  const wins = decided.filter(m => (m.winner === 1 ? m.player1 : m.player2) === name).length;
  const body = `<div class="crumbs"><a href="/money-matches/">Money Matches</a> / ${esc(name)}</div>
  <h1>${esc(name)}: Money Matches</h1>
  <p class="muted">${matches.length} money match${matches.length === 1 ? '' : 'es'} on Billiard Action Time${decided.length ? ` · ${wins} won, ${decided.length - wins} lost` : ''}.</p>
  <div class="mm-grid">${matches.map(card).join('')}</div>${NOTE}`;
  return layout(cfg, { title: `${name} Money Matches and Results | Billiard Action Time`, description: `${name}'s pool money matches: upcoming matches and final scores.`, path: `/money-matches/player/${slug}`, body });
}

// Calendar file (with a 2-hour reminder) for "Add to Calendar".
export function ics(cfg, m) {
  const d = m.date.replace(/-/g, ''), t = (m.time || '19:00').replace(':', '') + '00';
  const e = s => String(s || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Billiard Action Time//Money Matches//EN', 'BEGIN:VEVENT',
    `UID:money-match-${m.id}@billiardactiontime.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${d}T${t}`, 'DURATION:PT4H', `SUMMARY:${e(`${mmTitle(m)} (${mmGame(m)} money match)`)}`,
    `LOCATION:${e([m.room, m.address, `${m.city}, ${m.state}`].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${e(`${m.race ? 'Race to ' + m.race + '. ' : ''}${m.stakes ? m.stakes + ' on the line. ' : ''}${cfg.publicUrl}${m.path}`)}`,
    `URL:${cfg.publicUrl}${m.path}`, 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Money match in 2 hours', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
