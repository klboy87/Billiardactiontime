// Games (/play/...): the aim trainer runs in public/play.js; the page text is server-rendered so it reads
// well and teaches the idea behind the game even without JavaScript.
import { layout } from './seo.js';

const btn = (extra = '') => `style="padding:10px 14px;font-size:16px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;${extra}"`;
const GAMES = [
  { href: '/play/aim-trainer', icon: '🎯', title: 'Aim Trainer', desc: 'Pocket the ball in the highlighted pocket. Ten shots a round, three levels, and it tells you if you were thick or thin.' },
  { href: '/tools/pool-rules-quiz', icon: '❓', title: 'Pool Rules Quiz', desc: 'Twelve questions on 8-Ball, 9-Ball, 10-Ball and more. Share your score with your league.' },
  { href: '/trick-shots/', icon: '✨', title: 'Trick Shots', desc: 'Ten trick shots with diagrams to try at the table, from easy combos to the jump and the massé.' },
  { href: '/guides/pool-practice-drills', icon: '📋', title: 'Practice Drills', desc: 'Seven drills with scores to beat. Play the ghost and see how often you really run out.' }
];

export function playIndexPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Play</span></nav>
  <div class="pagehead"><h1>Pool Games &amp; Challenges</h1><p>Sharpen your eye between tournaments. Free, no sign-up, and they work on your phone.</p></div>
  <div class="ts-grid">${GAMES.map(g => `<a class="ts-card" href="${g.href}"><span style="font-size:38px;line-height:1">${g.icon}</span><b>${g.title}</b><span class="muted">${g.desc}</span></a>`).join('')}</div>
  <p style="margin-top:16px"><a href="/guides/">Read the guides →</a> · <a href="/this-weekend/">Find a tournament this weekend →</a></p>`;
  return layout(cfg, { title: 'Pool Games: Aim Trainer, Rules Quiz & Trick Shots | Billiard Action Time', description: 'Free pool games and challenges: an aim trainer that scores your cut shots, a pool rules quiz, trick shots and practice drills.', path: '/play/', body });
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
    <a href="/tools/pool-rules-quiz"><small>Quiz</small><b>Pool rules quiz: 12 questions</b></a>
    <a href="/trick-shots/"><small>Trick shots</small><b>10 trick shots with diagrams</b></a>
    <a href="/trick-shots/ninety-degree-carom"><small>Learn</small><b>The 90-degree rule: where the cue ball goes</b></a>
    <a href="/guides/how-to-aim-in-pool"><small>Guide</small><b>How to aim in pool</b></a>
  </div></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Pool Aim Trainer', url: `${cfg.publicUrl}/play/aim-trainer`, description: 'A free browser game for practicing pool cut shots with ghost-ball aiming.', genre: 'Sports', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  return layout(cfg, { title: 'Pool Aim Trainer: Free Cut Shot Game | Billiard Action Time', description: 'A free pool aim trainer game. Cut the ball into the highlighted pocket, see how thick or thin you were, and beat your best score. Three levels, works on your phone.', path: '/play/aim-trainer', body, jsonld: [ld], scripts: ['/play.js'] });
}
