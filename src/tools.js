// Free calculators for tournament directors and players (/tools/...). The page text is server-rendered
// so it reads well without JavaScript; public/tools.js does the math in the browser.
import { layout } from './seo.js';

export const TOOLS = [
  { slug: 'payout-calculator', title: 'Pool Tournament Payout Calculator',
    desc: 'Enter players, entry fee, greens fee and added money to get the prize pool and a fair payout for each place. Free, works on your phone.' },
  { slug: 'fargo-race-calculator', title: 'Fargo Race Calculator for Handicapped Matches',
    desc: 'Enter two FargoRate ratings and see fair handicapped races, with each player\'s chance to win the match.' },
  { slug: 'round-robin-generator', title: 'Round Robin Schedule Generator for Pool Leagues & Tournaments',
    desc: 'Type in your players or teams and get a printable round robin schedule where everyone plays everyone once, with table numbers and a standings sheet.' },
  { slug: 'pool-table-room-size', title: 'Pool Table Room Size Calculator: Will a 7, 8 or 9-Foot Table Fit?',
    desc: 'Enter your room size and see which pool table fits with full-length cues, and when a short cue makes a bigger table work. Free, instant, works on your phone.' },
  { slug: 'pool-rules-quiz', title: 'Pool Rules Quiz: How Well Do You Know 8-Ball, 9-Ball and More?',
    desc: 'Twelve quick questions drawn from a bank of 25 on 8-Ball, 9-Ball, 10-Ball, straight pool, one pocket and more. New questions every time. See your score and share it.' }
];

// [question, options, correct index, explanation]. Answers follow the World Standardized Rules used by most
// tournaments; where leagues commonly differ, the explanation says so.
const QUIZ = [
  ['In 9-Ball, which ball must the cue ball hit first?', ['The 9-ball', 'Any ball', 'The lowest-numbered ball on the table', 'The ball closest to a pocket'], 2, 'You must always hit the lowest-numbered ball first. After that, any ball can go in, including the 9.'],
  ['In 9-Ball, you hit the 1-ball into the 9-ball and the 9 goes in. What happens?', ['You win the game', 'The 9 is spotted and you keep shooting', 'It is a foul', 'The game is replayed'], 0, 'A legal shot that pockets the 9 wins, even on a combination. That is what makes 9-Ball so fast.'],
  ['After the cue ball hits a ball and nothing goes in, what has to happen for the shot to be legal?', ['Nothing, any hit is legal', 'Some ball has to touch a rail', 'The cue ball has to touch two rails', 'The object ball has to cross the center line'], 1, 'If no ball is pocketed, the cue ball or any object ball must hit a cushion after contact. Otherwise it is a foul.'],
  ['You scratch in a tournament run on standard rules. Where does your opponent place the cue ball?', ['Behind the head string', 'Anywhere on the table', 'On the head spot', 'Where it went in'], 1, 'Most tournaments play ball in hand anywhere after any foul. Some leagues and bar rules use behind the head string after a scratch, so ask.'],
  ['When can a player "push out" in 9-Ball?', ['Any time once per game', 'On the shot right after the break', 'Only after a foul', 'Only on the 9-ball'], 1, 'The push out is only allowed on the first shot after the break. The opponent then chooses who shoots next.'],
  ['In 9-Ball, what happens after three fouls in a row by the same player?', ['Nothing special', 'The opponent gets two shots', 'That player loses the game', 'The balls are re-racked'], 2, 'Three successive fouls lose the game, but only if the player was warned after the second one.'],
  ['In 10-Ball under standard rules, the 10 goes in on the break. What happens?', ['The breaker wins', 'The 10 is spotted and play continues', 'It is a foul', 'The rack is replayed'], 1, 'Unlike 9-Ball, the 10 on the break does not win in standard 10-Ball rules. It is spotted.'],
  ['In 8-Ball, you pocket the 8-ball before clearing your group. What happens?', ['You lose the game', 'The 8 is spotted', 'You get to keep shooting', 'It is ball in hand for your opponent'], 0, 'Pocketing the 8 early, or scratching on the 8, loses the game.'],
  ['In straight pool (14.1), when are the balls re-racked?', ['When all 15 are made', 'When one object ball is left on the table', 'After every five balls', 'Only after a foul'], 1, 'When one ball is left, the other 14 are re-racked and the player keeps shooting, usually breaking the new rack with the last ball.'],
  ['How many balls do you need to win a game of One Pocket?', ['5', '7', '8', '10'], 2, 'The first player to get eight balls in their pocket wins.'],
  ['In a 16-player double-elimination bracket, how many matches are played (not counting an "if needed" match)?', ['15', '24', '30', '32'], 2, 'A double-elimination bracket with N players takes 2N − 2 matches, plus one more if the final goes to a second set.'],
  ['In FargoRate, what does a 100-point rating gap mean?', ['The stronger player always wins', 'The stronger player wins about 2 games for every 1', 'The players are even', 'The stronger player wins 10 games for every 1'], 1, 'A 100-point gap means about a 2-to-1 game ratio, so the stronger player wins about two out of three games.'],
  ['In 8-Ball, what does it mean when the table is "open"?', ['Anyone can shoot', 'Groups (solids or stripes) are not decided yet', 'The 8 can be shot at', 'The break was illegal'], 1, 'Right after the break the table is open: you may hit a solid or a stripe first, and your group is set by the first ball you legally pocket on a called shot.'],
  ['When racking 8-Ball, where does the 8-ball go?', ['At the front', 'In the middle of the third row', 'In a back corner', 'Anywhere'], 1, 'The 8 goes in the center of the third row, with a solid and a stripe in the two back corners.'],
  ['When racking 9-Ball, where does the 9-ball go?', ['At the front', 'In the middle of the diamond', 'At the back', 'Anywhere'], 1, 'The 1 goes in front on the foot spot and the 9 goes in the middle of the diamond.'],
  ['What is a "scratch"?', ['Missing every ball', 'The cue ball going in a pocket or off the table', 'Hitting the wrong ball first', 'Touching a ball with your hand'], 1, 'A scratch is when the cue ball is pocketed or leaves the table. It is a foul.'],
  ['Making the cue ball jump by scooping under it with the tip is…', ['A legal jump shot', 'A foul', 'Only legal in 9-Ball', 'Legal with a jump cue'], 1, 'A legal jump comes from hitting down on the cue ball. Scooping under it is a foul in nearly every rule set.'],
  ['The cue tip touches the cue ball twice on one stroke. That is…', ['Legal if the shot goes in', 'A foul (double hit)', 'Legal on the break', 'A re-rack'], 1, 'A double hit is a foul. It is most common when the cue ball is very close to the object ball.'],
  ['In 9-Ball Banks, how many balls do you need to win a game?', ['3', '5', '8', '9'], 1, 'In 9-Ball Banks you need five banked balls, more than half of the nine.'],
  ['In a lag for the break, who wins?', ['The ball that hits the foot rail hardest', 'The ball that stops closest to the head rail', 'The ball that stops in the middle', 'Whoever shoots first'], 1, 'Both players shoot to the foot rail and back; closest to the head rail wins and chooses who breaks.'],
  ['"Ball in hand" under standard rules means…', ['Shoot from behind the head string', 'Place the cue ball anywhere on the table', 'Your opponent places it for you', 'Shoot from where it stopped'], 1, 'With ball in hand you may place the cue ball anywhere on the table. Some leagues limit it to behind the head string after a scratch on the break.'],
  ['In scotch doubles, how do partners shoot?', ['Each partner plays a full rack', 'They take turns, alternating shots', 'Only the stronger partner breaks and shoots', 'Both shoot at once'], 1, 'Partners alternate shots, so you have to play position for your partner, not for yourself.'],
  ['In three-player cutthroat, how many balls are in each player\'s group?', ['3', '5', '7', '15'], 1, 'Three groups of five: 1–5, 6–10 and 11–15. You try to sink your opponents\' balls.'],
  ['What is the "head string"?', ['The line two diamonds from the head rail; the cue ball starts behind it for the break', 'The string on the rack', 'The center line of the table', 'The line between the side pockets'], 0, 'The head string runs two diamonds from the head rail. On the break, the cue ball is placed behind it.'],
  ['In 10-Ball under standard rules, do you have to call your shots?', ['No, slop counts', 'Yes, call ball and pocket', 'Only the 10-ball', 'Only after a foul'], 1, '10-Ball is a call-shot game. A ball made in the wrong pocket does not count, which removes most of the luck.']
];
export const QUIZ_LEN = QUIZ.length;

const crumbs = (name) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/tools/">Tools</a> <span>/</span> <span>${name}</span></nav>`;
const appLd = (cfg, t) => ({ '@context': 'https://schema.org', '@type': 'WebApplication', name: t.title, description: t.desc, url: `${cfg.publicUrl}/tools/${t.slug}`,
  applicationCategory: 'SportsApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } });
const FIELD = 'style="display:block;width:100%;max-width:220px;padding:8px;font-size:16px;margin-top:4px"';

export function toolsIndexPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Tools</span></nav>
  <div class="pagehead"><h1>Free Pool Tournament Tools</h1><p>Calculators for tournament directors and players. Free, no sign-up, and they work on your phone at the table.</p></div>
  <ul style="list-style:none;padding:0;display:grid;gap:14px">${TOOLS.map(t => `<li class="card" style="padding:14px 18px"><a href="/tools/${t.slug}"><b>${t.title}</b></a><br><span class="muted">${t.desc}</span></li>`).join('')}
  <li class="card" style="padding:14px 18px"><a href="/tools/brackets/"><b>Printable Double Elimination Brackets</b></a><br><span class="muted">Blank 8, 16, 32 and 64-player brackets with numbered matches and losers-side drop spots. Print or save as PDF.</span></li>
  <li class="card" style="padding:14px 18px"><a href="/auctions"><b>Online Calcutta Auction</b></a><br><span class="muted">Run a Calcutta from everyone's phones: live bidding, buy-backs and automatic payouts.</span></li></ul>
  <p>Looking for how-tos? See our <a href="/guides/">guides</a> on brackets, payouts, handicaps and game rules.</p>`;
  return layout(cfg, { title: 'Free Pool Tournament Tools: Brackets, Payout & Fargo Race Calculators | Billiard Action Time', description: 'Free tools for pool tournament directors and players: printable double elimination brackets, payout calculator, Fargo handicap race calculator and an online Calcutta auction.', path: '/tools/', body });
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
  } else if (slug === 'pool-table-room-size') {
    tool = `<form id="roomForm" class="card" style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      <label>Room length (feet)<input ${FIELD} type="number" name="len" min="6" max="60" step="0.5" value="17" inputmode="decimal"></label>
      <label>Room width (feet)<input ${FIELD} type="number" name="wid" min="6" max="60" step="0.5" value="14" inputmode="decimal"></label>
      <label>Cue length<select ${FIELD} name="cue"><option value="58">58 in (standard)</option><option value="57">57 in</option><option value="52">52 in (short)</option><option value="48">48 in (short)</option></select></label>
    </form>
    <div id="roomOut" class="card" style="padding:16px 18px;margin-top:12px" aria-live="polite"><p class="muted" style="margin:0">Turn on JavaScript to use the calculator.</p></div>`;
    about = `<h2>How the calculator works</h2>
    <p>You need room for a full backstroke when the cue ball is frozen against any rail. So the room has to be the table's <b>playing surface</b> plus one cue length on every side. Playing surfaces used here: 7-foot 39 x 78 in, 8-foot 44 x 88 in, oversized 8-foot 46 x 92 in, 9-foot 50 x 100 in.</p>
    <ul><li>Walls, posts and furniture inside that space will cramp some shots. A few tight spots are fine if you keep a short cue (48 or 52 inches) on the wall.</li>
    <li>Bar tables (coin-op "bar boxes") vary a little by maker; check the exact playing surface before you buy.</li></ul>
    <p>Ready to shop? Read the <a href="/gear/home-pool-table">home pool table buying guide</a>, the <a href="/guides/pool-table-sizes">pool table sizes guide</a> and the <a href="/gear/game-room-setup">game room setup guide</a>.</p>`;
  } else if (slug === 'pool-rules-quiz') {
    const qs = QUIZ.map(([q, opts, ok, why], i) => `<li class="card quiz-q" data-ok="${ok}" style="padding:14px 18px;margin:0 0 12px">
      <p style="margin:0 0 8px;font-weight:700">${i + 1}. ${q}</p>
      <div class="quiz-opts" style="display:grid;gap:6px">${opts.map((o, j) => `<button type="button" data-i="${j}" style="text-align:left;padding:10px 12px;font-size:16px;border-radius:8px;border:1px solid var(--line);background:var(--surface2);color:var(--text);cursor:pointer">${String.fromCharCode(65 + j)}. ${o}</button>`).join('')}</div>
      <details class="quiz-ans" style="margin-top:8px"><summary class="muted">Show answer</summary><p style="margin:6px 0 0"><b>${String.fromCharCode(65 + ok)}. ${opts[ok]}.</b> ${why}</p></details></li>`).join('');
    tool = `<p class="muted no-js-hide" style="margin:0 0 10px">Each quiz picks 12 of our ${QUIZ.length} questions at random.</p><ol id="quiz" data-pick="12" style="list-style:none;padding:0;margin:0">${qs}</ol>
    <div id="quizScore" class="card" style="padding:16px 18px;margin-top:4px" aria-live="polite"><p class="muted" style="margin:0">Answer all 12 questions to see your score.</p></div>`;
    about = `<h2>About the rules in this quiz</h2>
    <p>Answers follow the standardized rules most pool tournaments use. Leagues and bars often have their own house rules, especially for scratches, the 8-ball on the break and calling shots, so always ask before your match.</p>
    <p>Brush up with our guides: <a href="/guides/8-ball-rules">8-Ball rules</a>, <a href="/guides/9-ball-rules">9-Ball rules</a>, <a href="/guides/10-ball-rules">10-Ball rules</a>, <a href="/guides/straight-pool-rules">straight pool</a>, <a href="/guides/one-pocket">One Pocket</a> and the <a href="/guides/pool-terms-glossary">pool glossary</a>.</p>`;
  } else if (slug === 'round-robin-generator') {
    tool = `<form id="rrForm" class="card no-print" style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      <label>Players or teams (one per line)<textarea name="names" rows="8" style="display:block;width:100%;padding:8px;font-size:16px;margin-top:4px">Player A\nPlayer B\nPlayer C\nPlayer D\nPlayer E\nPlayer F</textarea></label>
      <div><label>Tables available<input ${FIELD} type="number" name="tables" min="1" max="40" value="3" inputmode="numeric"></label>
      <label style="display:block;margin-top:10px">Event name<input ${FIELD} name="event" maxlength="80" placeholder="Fall 9-Ball Round Robin"></label>
      <label style="display:block;margin-top:10px"><input type="checkbox" name="shuffle"> Shuffle the order</label>
      <p style="margin:12px 0 0"><button type="button" data-print style="padding:10px 16px;font-size:16px;font-weight:700;border-radius:6px;border:0;background:#144b2e;color:#fff;cursor:pointer">🖨️ Print schedule</button></p></div>
    </form>
    <div id="rrOut" class="card" style="padding:16px 18px;margin-top:14px" aria-live="polite"><p class="muted">Turn on JavaScript to build a schedule.</p></div>
    <style>@media print{header,footer,nav,.crumbs,.no-print,.seo-cta,.pagehead,article.card{display:none!important}#rrOut{border:0;box-shadow:none;padding:0}.rr-round{break-inside:avoid}}</style>`;
    about = `<h2>How the schedule works</h2>
    <p>A round robin means every player (or team) plays every other one once. The generator uses the standard "circle" method: one player stays in place while the others rotate, so each round is different and nobody plays the same opponent twice. With an odd number of players, one player sits out (has a bye) each round, and everyone gets exactly one bye.</p>
    <p>With <i>N</i> players there are <b>N − 1 rounds</b> (N rounds if N is odd) and <b>N × (N − 1) ÷ 2 matches</b>. Eight players means 7 rounds and 28 matches. If you have fewer tables than matches in a round, the extra matches are marked "next table free."</p>
    <h2>Standings and tiebreakers</h2>
    <p>Print the standings sheet and mark wins and losses as matches finish. Most events rank by match wins, then by the head-to-head result between tied players, then by total games won. Announce the tiebreakers before the first match.</p>
    <p>A round robin is a great format for leagues, small fields, and the group stage of bigger events. For larger one-day fields, a <a href="/tools/brackets/">double-elimination bracket</a> is faster. Set handicapped races with the <a href="/tools/fargo-race-calculator">Fargo race calculator</a>.</p>`;
  } else {
    tool = `<form id="raceForm" class="card" style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
      <label>Player A rating<input ${FIELD} type="number" name="a" min="100" max="900" value="600" inputmode="numeric"></label>
      <label>Player B rating<input ${FIELD} type="number" name="b" min="100" max="900" value="500" inputmode="numeric"></label>
      <label>Lower player races to<select ${FIELD} name="base">${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    </form>
    <div id="raceOut" class="card" style="padding:16px 18px;margin-top:14px" aria-live="polite"><p class="muted">Turn on JavaScript to use the calculator.</p></div>`;
    about = `<h2>How the calculator works</h2>
    <p>FargoRate ratings are built so that a <b>100-point difference means the higher-rated player wins about two games for every one</b> the lower-rated player wins. From the two ratings, the calculator works out each player's chance of winning a single game, then the chance of winning a whole race. It suggests the race for the stronger player that brings the match closest to an even 50/50.</p>
    <p>Real matches depend on the game, the table and the day, so treat the numbers as a starting point. Many rooms use a printed chart; this gives you the same idea for any two ratings. Learn more in our <a href="/guides/fargo-ratings-handicaps">Fargo and handicaps guide</a>, or see the full <a href="/guides/fargo-rating-chart">Fargo rating chart</a> of win odds by rating gap.</p>
    <p class="muted">FargoRate is a trademark of its owners. This calculator is an independent tool and is not affiliated with FargoRate.</p>`;
  }
  const body = `${crumbs(t.title)}
  <div class="pagehead"><h1>${t.title}</h1><p>${t.desc}</p></div>
  ${tool}
  <article class="card" style="padding:18px 20px;margin-top:16px;line-height:1.65">${about}</article>
  <p style="margin-top:14px"><a href="/tools/">All tools</a> · <a href="/guides/">Guides</a> · <a href="/post">Post your tournament free</a></p>`;
  return layout(cfg, { title: `${t.title} | Billiard Action Time`, description: t.desc, path: `/tools/${t.slug}`, body, jsonld: [appLd(cfg, t)], scripts: ['/tools.js'] });
}

// Landing page for tournament directors and room owners (/directors/): everything free that helps fill a bracket.
export function directorsPage(cfg) {
  const F = [
    ['➕', 'Post your tournament free', 'Takes two minutes. Weekly event? Choose "Repeats every week" and post up to 12 weeks at once.', '/post', 'Post a tournament'],
    ['📷', 'Snap the flyer instead', 'Take a photo of your flyer and the flyer scanner fills in the details for you.', '/scan', 'Scan a flyer'],
    ['📣', 'Ready-made share graphics', 'Every tournament gets its own page plus square, tall and wide graphics for Facebook, Instagram and TikTok.', '/tonight/', 'See examples'],
    ['🖥️', 'A schedule widget for your website', 'One line of code shows your upcoming tournaments on your own site and updates itself. Find it on your room\'s page.', '/pool-halls/', 'Find your room'],
    ['🖨️', 'A printable poster for your wall', 'Your weekly tournament nights in big type, ready to print and tape up by the door or the bar. It updates whenever your schedule does.', '/pool-halls/', 'Find your room'],
    ['📅', 'Calendar feeds for your regulars', 'Players subscribe once and every tournament at your room lands in their phone calendar.', '/pool-halls/', 'Find your room'],
    ['🏆', 'Printable brackets with names', 'Double-elimination brackets for 8 to 64 players, filled in with a random draw and spread-out byes.', '/tools/brackets/', 'Print a bracket'],
    ['💵', 'Payout calculator', 'Prize pool, greens fee, added money and fair splits for any field size.', '/tools/payout-calculator', 'Work out payouts'],
    ['🔄', 'Round robin schedules', 'Everyone plays everyone, with table numbers and a standings sheet to print.', '/tools/round-robin-generator', 'Make a schedule'],
    ['🔨', 'Online Calcutta auctions', 'Run the Calcutta from everyone\'s phones with automatic payout math.', '/auctions', 'Start a Calcutta'],
    ['✅', 'Claim your listing', 'Already listed? Claim it to keep the details right and get the verified badge.', '/claim', 'Claim a listing']
  ];
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>For Tournament Directors</span></nav>
  <div class="pagehead"><h1>Fill Your Bracket: Free Tools for Tournament Directors</h1><p>Billiard Action Time is where pool players look for tournaments: tonight, this weekend and near them. List your event free and use everything below to fill your bracket. No fees, no sign-up required to post.</p>
    <div class="actbar" style="margin-top:12px"><a class="btn btn-green" href="/post">➕ Post a Tournament Free</a><a class="btn btn-out" href="/guides/start-a-weekly-pool-tournament">How to start a weekly tournament</a></div></div>
  <div class="ts-grid">${F.map(([ic, t, d, href, cta]) => `<div class="ts-card" style="gap:6px"><span style="font-size:32px;line-height:1">${ic}</span><b>${t}</b><span class="muted">${d}</span><a href="${href}" style="margin-top:auto;font-weight:700">${cta} →</a></div>`).join('')}</div>
  <article class="card guide" style="margin-top:18px"><h2 style="margin-top:0">Why list here</h2>
  <ul><li><b>Players find you by night and by place.</b> Your event shows on its own page, on your city and state pages, on <a href="/tonight/">Tonight</a> and <a href="/this-weekend/">This Weekend</a>, and in the weekly email.</li>
  <li><b>Weekly events are easy.</b> Post once for up to 12 weeks. Each date gets its own page, and past dates point players to the next one.</li>
  <li><b>It's free.</b> No listing fees, no commission on entries.</li></ul>
  <p>Questions or a listing that needs fixing? Email <a href="mailto:billiardactiontime@gmail.com">billiardactiontime@gmail.com</a>.</p>
  <p>Learn more: <a href="/guides/how-to-run-a-pool-tournament">how to run a pool tournament</a>, <a href="/guides/tournament-formats">tournament formats</a>, <a href="/guides/pool-tournament-payouts">payouts</a> and <a href="/guides/calcutta-auction-explained">Calcutta auctions</a>.</p></article>`;
  return layout(cfg, { title: 'Free Tools for Pool Tournament Directors: List, Promote & Run Events | Billiard Action Time', path: '/directors/', body,
    description: 'List your pool tournament free and fill your bracket: weekly repeat posting, share graphics, a website schedule widget, calendar feeds, printable brackets, payout and round robin tools.' });
}

