// Games (/play/...): the aim trainer runs in public/play.js; the page text is server-rendered so it reads
// well and teaches the idea behind the game even without JavaScript.
import { layout } from './seo.js';
import { SHOTS } from './trickshots.js';
import { todayIso } from './db.js';

const btn = (extra = '') => `style="padding:10px 14px;font-size:16px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;${extra}"`;
const GAMES = [
  { href: '/play/aim-trainer', icon: '🎯', title: 'Aim Trainer', desc: 'Pocket the ball in the highlighted pocket. Ten shots a round, three levels, and it tells you if you were thick or thin.' },
  { href: '/play/bank-trainer', icon: '↗️', title: 'Bank Shot Trainer', desc: 'Pick the spot on the rail and bank the ball into the highlighted pocket. Learn the mirror method by feel.' },
  { href: '/play/kick-trainer', icon: '🦵', title: 'Kick Shot Trainer', desc: 'A blocker is in the way. Kick the cue ball off a rail into the target ball, the way you escape a safety in a real match.' },
  { href: '/play/lag-challenge', icon: '📏', title: 'Lag Challenge', desc: 'Stop the power meter and lag the ball to the head rail. Five lags, scored in inches. Pure speed control.' },
  { href: '/play/which-game', icon: '🎱', title: 'Which Pool Game Is Yours?', desc: 'Five quick questions match you with 8-Ball, 9-Ball, 10-Ball, One Pocket, Banks, Straight Pool or Scotch Doubles.' },
  { href: '/play/practice-log', icon: '📈', title: 'Practice Log', desc: 'Log your drill scores after each session and watch your personal bests climb. Saved on your device, no sign-up.' },
  { href: '/tools/pool-rules-quiz', icon: '❓', title: 'Pool Rules Quiz', desc: 'Twelve questions on 8-Ball, 9-Ball, 10-Ball and more. Share your score with your league.' },
  { href: '/trick-shots/', icon: '✨', title: 'Trick Shots', desc: 'Fourteen trick shots with diagrams to try at the table, from easy combos to the jump and the massé.' },
  { href: '/guides/pool-practice-drills', icon: '📋', title: 'Practice Drills', desc: 'Seven drills with scores to beat. Play the ghost and see how often you really run out.' }
];

export function playIndexPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Play</span></nav>
  <div class="pagehead"><h1>Pool Games &amp; Challenges</h1><p>Sharpen your eye between tournaments. Free, no sign-up, and they work on your phone.</p></div>
  ${(() => { const day = Math.floor(Date.parse(todayIso() + 'T00:00:00Z') / 864e5), shot = SHOTS[day % SHOTS.length];
    return `<a class="ts-card" href="/trick-shots/${shot.slug}" style="margin-bottom:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:14px;align-items:center"><div>${shot.diagram.replace(/<figcaption>[\s\S]*?<\/figcaption>/, '')}</div><div><span class="ts-meta">✨ Trick shot of the day</span><br><b style="font-size:20px">${shot.title}</b><br><span class="muted">${shot.desc}</span><br><span style="font-weight:700">Learn it →</span></div></a>`; })()}
  <div class="ts-grid">${GAMES.map(g => `<a class="ts-card" href="${g.href}"><span style="font-size:38px;line-height:1">${g.icon}</span><b>${g.title}</b><span class="muted">${g.desc}</span></a>`).join('')}</div>
  <p style="margin-top:16px"><a href="/guides/">Read the guides →</a> · <a href="/this-weekend/">Find a tournament this weekend →</a></p>`;
  return layout(cfg, { title: 'Free Pool Games: Aim, Bank & Kick Trainers, Rules Quiz | Billiard Action Time', description: 'Free pool games that work on your phone: an aim trainer with a daily challenge, bank and kick shot trainers, a lag challenge, a rules quiz, trick shots and a practice log.', path: '/play/', body });
}

export function aimTrainerPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/play/">Play</a> <span>/</span> <span>Aim Trainer</span></nav>
  <div class="pagehead"><h1>Pool Aim Trainer</h1><p>Can you cut it in? Tap the table to aim the cue ball, fine-tune, and shoot. Ten shots a round, or try the <b>daily challenge</b>: the same 5 shots for everyone, new every day. It tells you exactly how thick or thin you were.</p></div>
  <section id="aimGame" class="card" style="padding:14px">
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b data-status style="font-size:15px">Loading…</b>
      <label style="font-size:15px">Level <select data-level style="font-size:15px;padding:4px 6px"><option value="daily">⭐ Daily challenge (5 shots)</option><option value="easy">Easy (shows contact point)</option><option value="normal" selected>Normal</option><option value="pro">Pro (tight pockets)</option></select></label>
    </div>
    <div data-table style="max-width:min(100%, calc((100vh - 230px) * 1.83), 820px);margin:0 auto"></div>
    <p data-loading class="muted">Turn on JavaScript to play.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0 4px">
      <button type="button" data-nudge="-1" ${btn()} aria-label="Rotate aim 1 degree counterclockwise">↺ 1°</button>
      <button type="button" data-nudge="-0.2" ${btn()} aria-label="Rotate aim a little counterclockwise">↺</button>
      <button type="button" data-shoot ${btn('background:#144b2e;color:#fff;border-color:#144b2e;font-weight:700;padding:10px 26px')}>Shoot</button>
      <button type="button" data-next hidden ${btn('background:#1c6fe6;color:#fff;border-color:#1c6fe6;font-weight:700')}>Next shot →</button>
      <button type="button" data-nudge="0.2" ${btn()} aria-label="Rotate aim a little clockwise">↻</button>
      <button type="button" data-nudge="1" ${btn()} aria-label="Rotate aim 1 degree clockwise">↻ 1°</button>
    </div>
    <p data-msg aria-live="polite" style="margin:8px 2px 0;min-height:3em"></p>
  </section>
  <p class="muted" style="font-size:14px">On a computer: move the mouse to aim, arrow keys to fine-tune (hold Shift for bigger steps), Space to shoot. Scores are kept on this device only.</p>
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">How to aim a cut shot</h2>
  <p>Every cut shot comes down to one idea: the <b>ghost ball</b>. Picture a ball touching the object ball on the side opposite the pocket, so that the line from the pocket runs through the center of the object ball and into the center of that imaginary ball. Send the cue ball to that spot, and the object ball goes in.</p>
  <ul><li><b>Missing "thick"</b> means you hit the object ball too fully, so it didn't cut enough. Aim farther outside the object ball.</li>
  <li><b>Missing "thin"</b> means you over-cut it. Aim a little more into the object ball.</li>
  <li><b>Thin cuts are hard</b> because a small aiming error makes a big miss. Over 60 degrees, even pros slow down and look twice.</li></ul>
  <p>The game uses simple geometry on a 7-foot bar-box table. In real play, friction ("throw") makes slow cut shots go a touch thicker than the geometry says; read about it in the <a href="/trick-shots/throw-shot">throw shot</a>. Then take it to the table with the <a href="/guides/pool-practice-drills">practice drills</a>.</p></article>
  <section class="sec seo-sec"><h2>More to play</h2><div class="guide-next">
    <a href="/play/bank-trainer"><small>Game</small><b>Bank shot trainer: find the spot on the rail</b></a>
    <a href="/tools/pool-rules-quiz"><small>Quiz</small><b>Pool rules quiz: 12 questions</b></a>
    <a href="/trick-shots/ninety-degree-carom"><small>Learn</small><b>The 90-degree rule: where the cue ball goes</b></a>
    <a href="/guides/how-to-aim-in-pool"><small>Guide</small><b>How to aim in pool</b></a>
  </div></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Pool Aim Trainer', url: `${cfg.publicUrl}/play/aim-trainer`, description: 'A free browser game for practicing pool cut shots with ghost-ball aiming.', genre: 'Sports', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  return layout(cfg, { title: 'Pool Aim Trainer: Free Cut Shot Game | Billiard Action Time', description: 'A free pool aim trainer game. Cut the ball into the highlighted pocket, see how thick or thin you were, and beat your best score. Three levels, works on your phone.', path: '/play/aim-trainer', body, jsonld: [ld], scripts: ['/play.js'] });
}

export function bankTrainerPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/play/">Play</a> <span>/</span> <span>Bank Shot Trainer</span></nav>
  <div class="pagehead"><h1>Bank Shot Trainer</h1><p>Bank the red ball off the rail into the highlighted pocket. Tap where on the rail it should hit, fine-tune, and shoot. Ten banks a round.</p></div>
  <section id="bankGame" class="card" style="padding:14px">
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b data-status style="font-size:15px">Loading…</b>
      <label style="font-size:15px">Level <select data-level style="font-size:15px;padding:4px 6px"><option value="easy">Easy (shows the rebound)</option><option value="normal" selected>Normal</option></select></label>
    </div>
    <div data-table style="max-width:min(100%, calc((100vh - 230px) * 1.83), 820px);margin:0 auto"></div>
    <p data-loading class="muted">Turn on JavaScript to play.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0 4px">
      <button type="button" data-nudge="-1" ${btn()} aria-label="Rotate 1 degree counterclockwise">↺ 1°</button>
      <button type="button" data-nudge="-0.2" ${btn()} aria-label="Rotate a little counterclockwise">↺</button>
      <button type="button" data-shoot ${btn('background:#144b2e;color:#fff;border-color:#144b2e;font-weight:700;padding:10px 26px')}>Shoot</button>
      <button type="button" data-next hidden ${btn('background:#1c6fe6;color:#fff;border-color:#1c6fe6;font-weight:700')}>Next bank →</button>
      <button type="button" data-nudge="0.2" ${btn()} aria-label="Rotate a little clockwise">↻</button>
      <button type="button" data-nudge="1" ${btn()} aria-label="Rotate 1 degree clockwise">↻ 1°</button>
    </div>
    <p data-msg aria-live="polite" style="margin:8px 2px 0;min-height:3em"></p>
  </section>
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">The mirror method</h2>
  <p>A ball comes off a cushion at about the same angle it went in. So picture a second table on the other side of the rail, a mirror image of this one, and aim the ball at where the pocket would be on that mirror table. The spot where that line crosses the rail is your bank point.</p>
  <ul><li><b>Hit the rail too far toward the pocket</b> and the ball comes off short of it.</li>
  <li><b>Hit it too far back</b> and the ball runs long, past the pocket.</li>
  <li><b>In real play, speed and spin change the angle.</b> Firm banks come off a little shorter; soft banks run a little longer. This game shows the pure geometry, the place to start.</li></ul>
  <p>Learn more in the <a href="/trick-shots/cross-corner-bank">cross-corner bank</a> trick shot, read the <a href="/guides/bank-pool-rules">bank pool rules</a>, and try the <a href="/guides/pool-practice-drills">kick drill</a> on a real table.</p></article>
  <section class="sec seo-sec"><h2>More to play</h2><div class="guide-next">
    <a href="/play/aim-trainer"><small>Game</small><b>Aim trainer and daily challenge</b></a>
    <a href="/tools/pool-rules-quiz"><small>Quiz</small><b>Pool rules quiz: 12 questions</b></a>
    <a href="/trick-shots/"><small>Trick shots</small><b>14 trick shots with diagrams</b></a>
    <a href="/guides/safety-play-in-pool"><small>Guide</small><b>Safety play: win without making a ball</b></a>
  </div></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Bank Shot Trainer', url: `${cfg.publicUrl}/play/bank-trainer`, description: 'A free browser game for practicing one-rail bank shots with the mirror method.', genre: 'Sports', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  return layout(cfg, { title: 'Bank Shot Trainer: Free Pool Banking Game | Billiard Action Time', description: 'Practice one-rail bank shots in your browser. Pick the spot on the rail, bank the ball into the pocket, and learn the mirror method. Free, works on your phone.', path: '/play/bank-trainer', body, jsonld: [ld], scripts: ['/play.js'] });
}

export function kickTrainerPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/play/">Play</a> <span>/</span> <span>Kick Shot Trainer</span></nav>
  <div class="pagehead"><h1>Kick Shot Trainer</h1><p>You're snookered: the black ball blocks the yellow one. Kick the cue ball off one rail into the yellow ball. Tap the rail where it should hit, fine-tune, and shoot. Ten kicks a round.</p></div>
  <section id="kickGame" class="card" style="padding:14px">
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b data-status style="font-size:15px">Loading…</b>
      <label style="font-size:15px">Level <select data-level style="font-size:15px;padding:4px 6px"><option value="easy">Easy (shows the rebound)</option><option value="normal" selected>Normal</option></select></label>
    </div>
    <div data-table style="max-width:min(100%, calc((100vh - 230px) * 1.83), 820px);margin:0 auto"></div>
    <p data-loading class="muted">Turn on JavaScript to play.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0 4px">
      <button type="button" data-nudge="-1" ${btn()} aria-label="Rotate 1 degree counterclockwise">↺ 1°</button>
      <button type="button" data-nudge="-0.2" ${btn()} aria-label="Rotate a little counterclockwise">↺</button>
      <button type="button" data-shoot ${btn('background:#144b2e;color:#fff;border-color:#144b2e;font-weight:700;padding:10px 26px')}>Shoot</button>
      <button type="button" data-next hidden ${btn('background:#1c6fe6;color:#fff;border-color:#1c6fe6;font-weight:700')}>Next kick →</button>
      <button type="button" data-nudge="0.2" ${btn()} aria-label="Rotate a little clockwise">↻</button>
      <button type="button" data-nudge="1" ${btn()} aria-label="Rotate 1 degree clockwise">↻ 1°</button>
    </div>
    <p data-msg aria-live="polite" style="margin:8px 2px 0;min-height:3em"></p>
  </section>
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">How to aim a one-rail kick</h2>
  <p>A kick is a bank shot with the cue ball. When your opponent hides the ball you need to hit, you can't go straight at it, so you send the cue ball into a rail first. Missing is a foul, and in most games that means ball in hand for the other player. A good kicker turns their opponent's best safeties into nothing.</p>
  <ul><li><b>Use the mirror.</b> Picture the yellow ball reflected on the other side of the rail, the same distance past the cushion as it is in front of it. Aim the cue ball at that mirror ball. Where the line crosses the rail is your kick point.</li>
  <li><b>Aim at the cushion's nose, not the wood.</b> The ball's center bounces off a line half a ball width inside the cushion. That's the line this game uses.</li>
  <li><b>Medium speed and center ball.</b> Sidespin and hard hits change the rebound angle. Learn the pure angle first, then adjust on a real table.</li>
  <li><b>Just hit it.</b> In 9-ball and 10-ball you only need to contact the lowest ball, then a ball has to reach a rail. A thin legal hit beats a full miss every time.</li></ul>
  <p>Practice it for real with the <a href="/guides/pool-practice-drills#5-the-kick-drill">kick drill</a>, learn when to play safe in <a href="/guides/safety-play-in-pool">safety play</a>, and try the <a href="/play/bank-trainer">bank shot trainer</a> for the same geometry with the object ball.</p></article>
  <section class="sec seo-sec"><h2>More to play</h2><div class="guide-next">
    <a href="/play/bank-trainer"><small>Game</small><b>Bank shot trainer</b></a>
    <a href="/play/aim-trainer"><small>Game</small><b>Aim trainer and daily challenge</b></a>
    <a href="/play/lag-challenge"><small>Game</small><b>Lag challenge</b></a>
    <a href="/tools/pool-rules-quiz"><small>Quiz</small><b>Pool rules quiz: 12 questions</b></a>
  </div></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Kick Shot Trainer', url: `${cfg.publicUrl}/play/kick-trainer`, description: 'A free browser game for practicing one-rail kick shots to escape safeties.', genre: 'Sports', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  return layout(cfg, { title: 'Kick Shot Trainer: Free Pool Kicking Game | Billiard Action Time', description: 'Practice one-rail kick shots in your browser. Kick the cue ball off a rail around a blocker into the target ball. Learn the mirror method. Free, works on your phone.', path: '/play/kick-trainer', body, jsonld: [ld], scripts: ['/play.js'] });
}

export function lagChallengePage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/play/">Play</a> <span>/</span> <span>Lag Challenge</span></nav>
  <div class="pagehead"><h1>Lag Challenge</h1><p>Start the power meter, stop it at the right moment, and roll the ball to the far rail and back. Finish as close to the head rail as you can. Five lags, scored in inches. Lower is better.</p></div>
  <section id="lagGame" class="card" style="padding:14px">
    <b data-status style="font-size:15px;display:block;margin-bottom:8px">Loading…</b>
    <div data-table style="max-width:min(100%, calc((100vh - 260px) * 1.83), 820px);margin:0 auto"></div>
    <p data-loading class="muted">Turn on JavaScript to play.</p>
    <div data-meter style="max-width:420px;margin:12px auto 6px;height:18px;border-radius:9px;background:linear-gradient(90deg,#d8f3e0,#ffe9a8 55%,#fbdada);border:1px solid var(--line);overflow:hidden"><div data-fill style="height:100%;width:0;background:#144b2e;opacity:.85"></div></div>
    <p style="text-align:center;margin:8px 0"><button type="button" data-go ${btn('background:#144b2e;color:#fff;border-color:#144b2e;font-weight:700;padding:12px 28px')}>Start power meter</button></p>
    <p data-msg aria-live="polite" style="margin:8px 2px 0;min-height:3em"></p>
  </section>
  <p class="muted" style="font-size:14px">Tip: the ball must touch the far (foot) rail. Space bar works too. Measured on a 9-foot table, where one diamond is 12.5 inches.</p>
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">Why the lag matters</h2>
  <p>Most tournament matches start with a lag: both players shoot a ball to the foot rail and back at the same time, and whoever stops closest to the head rail chooses who breaks. Touching a side rail or never reaching the foot rail loses the lag.</p>
  <p>More than that, the lag is the purest test of <b>speed control</b>. A ball rolling on cloth slows at a steady rate, so the distance it travels grows with the square of its starting speed: a little more power goes a lot farther. Players who can lag well can control the cue ball for position.</p>
  <p>Take it to the table with the <a href="/trick-shots/perfect-lag">perfect lag</a> drill and the <a href="/guides/pool-practice-drills">practice drills</a>.</p></article>
  <section class="sec seo-sec"><h2>More to play</h2><div class="guide-next">
    <a href="/play/aim-trainer"><small>Game</small><b>Aim trainer and daily challenge</b></a>
    <a href="/play/bank-trainer"><small>Game</small><b>Bank shot trainer</b></a>
    <a href="/trick-shots/"><small>Trick shots</small><b>14 trick shots with diagrams</b></a>
    <a href="/guides/english-in-pool"><small>Guide</small><b>English explained: follow, draw and side spin</b></a>
  </div></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Lag Challenge', url: `${cfg.publicUrl}/play/lag-challenge`, description: 'A free browser game for practicing pool speed control by lagging to the head rail.', genre: 'Sports', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  return layout(cfg, { title: 'Pool Lag Challenge: Speed Control Game | Billiard Action Time', description: 'Can you lag to the rail? A free pool speed-control game: stop the power meter, roll to the far rail and back, and finish closest to the head rail.', path: '/play/lag-challenge', body, jsonld: [ld], scripts: ['/play.js'] });
}

// Which-game quiz: each answer adds points to games; the highest total wins. Results link to the rules guide
// and the game's tournament listings.
const WG_GAMES = {
  '8-Ball': { guide: '/guides/8-ball-rules', list: '/tournaments/8-ball', blurb: 'The game everyone knows. Easy to start, deep to master: planning your group, breaking up clusters and locking up your opponent.' },
  '9-Ball': { guide: '/guides/9-ball-rules', list: '/tournaments/9-ball', blurb: 'Fast, aggressive and full of action. Runouts, push outs and the chance to win on any shot.' },
  '10-Ball': { guide: '/guides/10-ball-rules', list: '/tournaments/10-ball', blurb: 'The shot-maker\'s game: call your shots, no slop, and a big rack that rewards real control.' },
  'One Pocket': { guide: '/guides/one-pocket', list: '/tournaments/one-pocket', blurb: 'Pool\'s chess game. Every shot is offense and defense at once, and patience beats power.' },
  'Banks': { guide: '/guides/bank-pool-rules', list: '/tournaments/banks', blurb: 'Every ball off a rail. For players who love angles, feel and a good gamble.' },
  'Straight Pool': { guide: '/guides/straight-pool-rules', list: '/tournaments/straight-pool', blurb: 'The classic: call every ball, rack after rack. The purest test of position play.' },
  'Scotch Doubles': { guide: '/guides/scotch-doubles', list: '/tournaments/scotch-doubles', blurb: 'Pool with a partner, taking turns. Social, strategic and the most fun you can have losing a rack together.' }
};
const WG_Q = [
  ['What do you enjoy most at the table?', [['Making hard shots', { '10-Ball': 2, '9-Ball': 1 }], ['Outthinking my opponent', { 'One Pocket': 2, '8-Ball': 1 }], ['Running rack after rack', { 'Straight Pool': 2, '9-Ball': 1 }], ['Playing with friends', { 'Scotch Doubles': 2, '8-Ball': 1 }]]],
  ['How fast do you like a game?', [['Quick, a few minutes a rack', { '9-Ball': 2, '8-Ball': 1 }], ['Medium, with some thinking', { '10-Ball': 1, '8-Ball': 1, 'Banks': 1 }], ['Long and tactical', { 'One Pocket': 2, 'Straight Pool': 1 }], ['Doesn\'t matter if the company\'s good', { 'Scotch Doubles': 2 }]]],
  ['Your favorite kind of shot?', [['A thin cut down the rail', { '10-Ball': 1, '9-Ball': 1 }], ['A cross-corner bank', { 'Banks': 3 }], ['A perfect safety', { 'One Pocket': 2, '8-Ball': 1 }], ['A soft position shot', { 'Straight Pool': 2, '10-Ball': 1 }]]],
  ['How do you feel about luck?', [['A lucky roll is part of the fun', { '9-Ball': 2, '8-Ball': 1 }], ['I want to earn every ball', { '10-Ball': 2, 'Straight Pool': 1 }], ['I make my own luck with defense', { 'One Pocket': 2, 'Banks': 1 }], ['We win or lose as a team', { 'Scotch Doubles': 2 }]]],
  ['Where do you usually play?', [['Bar tables and league night', { '8-Ball': 3, 'Scotch Doubles': 1 }], ['A pool room on big tables', { '9-Ball': 1, '10-Ball': 1, 'One Pocket': 1 }], ['Money games and action', { 'Banks': 2, 'One Pocket': 1, '9-Ball': 1 }], ['Anywhere I can get a practice table', { 'Straight Pool': 2 }]]]
];

export function whichGamePage(cfg) {
  const qs = WG_Q.map(([q, opts], i) => `<li class="card quiz-q" style="padding:14px 18px;margin:0 0 12px"><p style="margin:0 0 8px;font-weight:700">${i + 1}. ${q}</p>
    <div style="display:grid;gap:6px">${opts.map(([label, pts]) => `<button type="button" data-pts='${JSON.stringify(pts).replace(/'/g, '&#39;')}' style="text-align:left;padding:10px 12px;font-size:16px;border-radius:8px;border:1px solid var(--line);background:var(--surface2);color:var(--text);cursor:pointer">${label}</button>`).join('')}</div></li>`).join('');
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/play/">Play</a> <span>/</span> <span>Which Pool Game Is Yours?</span></nav>
  <div class="pagehead"><h1>Which Pool Game Is Yours?</h1><p>Five quick questions. We'll match you with the pool game that fits how you like to play, and show you where to play it.</p></div>
  <ol id="whichGame" data-games='${JSON.stringify(WG_GAMES).replace(/'/g, '&#39;')}' style="list-style:none;padding:0;margin:0">${qs}</ol>
  <div id="whichOut" class="card" style="padding:16px 18px" aria-live="polite"><p class="muted" style="margin:0">Answer all five to see your game.</p></div>
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">The games</h2><ul>${Object.entries(WG_GAMES).map(([g, x]) => `<li><b><a href="${x.guide}">${g}</a>:</b> ${x.blurb}</li>`).join('')}</ul></article>
  <section class="sec seo-sec"><h2>More to play</h2><div class="guide-next">
    <a href="/play/aim-trainer"><small>Game</small><b>Aim trainer and daily challenge</b></a>
    <a href="/tools/pool-rules-quiz"><small>Quiz</small><b>Pool rules quiz: 12 questions</b></a>
    <a href="/play/lag-challenge"><small>Game</small><b>Lag challenge</b></a>
    <a href="/trick-shots/"><small>Trick shots</small><b>14 trick shots with diagrams</b></a>
  </div></section>`;
  return layout(cfg, { title: 'Which Pool Game Is Yours? 5-Question Quiz | Billiard Action Time', description: 'Take the quiz to find your pool game: 8-Ball, 9-Ball, 10-Ball, One Pocket, Banks, Straight Pool or Scotch Doubles. Then learn the rules and find tournaments.', path: '/play/which-game', body, scripts: ['/play.js'] });
}

// Drills for the practice log: [id, name, unit, higherIsBetter, guide link]
const DRILLS = [
  ['stop-ladder', 'Stop-shot ladder', 'diamonds back', true, '/guides/pool-practice-drills#1-the-stop-shot-ladder'],
  ['line-up', 'Line-up drill', 'balls in a row', true, '/guides/pool-practice-drills#2-the-line-up-drill'],
  ['circle', 'Circle drill', 'balls', true, '/guides/pool-practice-drills#3-the-circle-drill'],
  ['ladder', 'Position ladder', 'balls run in order', true, '/guides/pool-practice-drills#4-position-ladder-three-balls'],
  ['kick', 'Kick drill', 'hits out of 10', true, '/guides/pool-practice-drills#5-the-kick-drill'],
  ['long-straight', 'Long straight-in shots', 'made out of 10', true, '/guides/pool-practice-drills#6-long-straight-in-shots'],
  ['ghost', 'Play the ghost (race to 5)', 'racks won', true, '/guides/pool-practice-drills#7-play-the-ghost'],
  ['speed-run', 'Hanger speed run', 'seconds', false, '/trick-shots/hanger-speed-run'],
  ['break', 'Breaks: balls made in 10 breaks', 'balls', true, '/guides/how-to-break-in-pool']
];

export function practiceLogPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/play/">Play</a> <span>/</span> <span>Practice Log</span></nav>
  <div class="pagehead"><h1>Pool Practice Log</h1><p>Log your drill scores after each session and watch your personal bests climb. Everything is saved on this device only. No sign-up.</p></div>
  <section id="practiceLog" class="card" style="padding:16px 18px" data-drills='${JSON.stringify(DRILLS).replace(/'/g, '&#39;')}'>
    <form data-form style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
      <label>Drill<select name="drill" style="display:block;width:100%;padding:8px;font-size:16px;margin-top:4px">${DRILLS.map(d => `<option value="${d[0]}">${d[1]}</option>`).join('')}</select></label>
      <label>Score <span data-unit class="muted"></span><input name="score" type="number" step="any" min="0" inputmode="decimal" required style="display:block;width:100%;padding:8px;font-size:16px;margin-top:4px"></label>
      <label>Date<input name="date" type="date" style="display:block;width:100%;padding:8px;font-size:16px;margin-top:4px"></label>
      <button type="submit" style="padding:10px 16px;font-size:16px;font-weight:700;border-radius:8px;border:0;background:#144b2e;color:#fff;cursor:pointer">Save score</button>
    </form>
    <p data-msg class="muted" aria-live="polite" style="margin:10px 0 0"></p>
    <p data-loading class="muted">Turn on JavaScript to use the practice log.</p>
    <div data-out style="margin-top:14px"></div>
  </section>
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">How to use it</h2>
  <ul><li>Pick two or three drills from the <a href="/guides/pool-practice-drills">practice drills</a> and do them every session.</li>
  <li>Log your score right after each drill. The log shows your best, your last five, and a trend line.</li>
  <li>Your log stays in this browser. If you clear your browser data, it's gone, so use the <b>Download</b> button now and then to keep a copy.</li></ul>
  <p>Between sessions, keep your eye sharp with the <a href="/play/aim-trainer">aim trainer</a> and the <a href="/play/lag-challenge">lag challenge</a>.</p></article>`;
  return layout(cfg, { title: 'Pool Practice Log: Track Your Drill Scores | Billiard Action Time', description: 'A free pool practice log. Record your drill scores, see personal bests and track your progress over time. Saved on your device, no sign-up.', path: '/play/practice-log', body, scripts: ['/play.js'] });
}
