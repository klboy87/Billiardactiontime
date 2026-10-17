// Pool gear guide (/gear/) and "gear for this" boxes on guides. Links go to Amazon search results; when
// AMAZON_TAG (an Amazon Associates tracking id) is set, purchases earn a commission at no cost to players.
import { layout } from './seo.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const GEAR = [
  { key: 'cue', icon: '🎱', name: 'A playing cue', q: 'pool cue 58 inch 19 oz', why: 'Your own straight cue with a good tip beats a warped house cue every time. Most players start between 18 and 20 ounces, 58 inches long, with a 12 to 13 mm tip.', guide: '/guides/how-to-choose-a-pool-cue' },
  { key: 'case', icon: '🧳', name: 'A hard cue case', q: 'hard pool cue case 2x2', why: 'Protects the shaft from warping and dings in the car and at the hall. A 2x2 case holds a playing cue and a spare shaft or a break cue.', guide: '/guides/pool-cue-care' },
  { key: 'chalk', icon: '🟦', name: 'Good chalk', q: 'premium pool cue chalk', why: 'Better chalk grips the cue ball longer and means fewer miscues on draw and English shots. Chalk before every shot.', guide: '/guides/english-in-pool' },
  { key: 'glove', icon: '🧤', name: 'A billiard glove', q: 'billiard glove three finger', why: 'Lets the cue slide smoothly through your bridge hand, especially on humid nights or in a sweaty tournament match.', guide: '/guides/pool-basics-for-beginners' },
  { key: 'tip', icon: '🛠️', name: 'A tip tool', q: 'pool cue tip tool shaper scuffer', why: 'Shapes and scuffs your tip so it holds chalk. A dome the shape of a nickel is a good starting point.', guide: '/guides/pool-cue-care' },
  { key: 'break', icon: '💥', name: 'A break cue', q: 'pool break cue hard tip', why: 'A hard tip and a stiff shaft for a powerful, controlled break. It also saves the tip on your playing cue.', guide: '/guides/how-to-break-in-pool' },
  { key: 'jump', icon: '🦘', name: 'A jump cue', q: 'jump cue pool', why: 'A short, light cue that makes jump shots possible when you are snookered. Check your event rules first.', guide: '/trick-shots/jump-shot' },
  { key: 'balls', icon: '🔴', name: 'A training cue ball', q: 'training cue ball dots', why: 'A cue ball with dots shows exactly how much spin you put on it. Great for learning draw, follow and English.', guide: '/guides/how-to-draw-the-cue-ball' },
  { key: 'rack', icon: '🔺', name: 'A rack template', q: 'pool rack template sheet magic rack', why: 'Thin templates give a tight, frozen rack every time. Many tournaments use them now, so practice with one.', guide: '/guides/how-to-rack-pool-balls' },
  { key: 'book', icon: '📘', name: 'A pool instruction book', q: 'pool billiards instruction book', why: 'A good book on aiming, cue ball control and patterns is the cheapest lesson you will ever buy.', guide: '/guides/pool-practice-drills' }
];
const BY = Object.fromEntries(GEAR.map(g => [g.key, g]));
const href = (cfg, q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}${cfg.amazonTag ? '&tag=' + encodeURIComponent(cfg.amazonTag) : ''}`;
const disclosure = cfg => cfg.amazonTag ? '<p class="muted" style="font-size:13px;margin:8px 0 0">As an Amazon Associate we earn from qualifying purchases. It costs you nothing extra and helps keep this site free.</p>' : '';

// Which gear fits which guide or trick shot.
export const GEAR_FOR = { 'how-to-choose-a-pool-cue': ['cue', 'case', 'tip'], 'pool-cue-care': ['case', 'tip', 'chalk'], 'how-to-break-in-pool': ['break', 'rack'], 'english-in-pool': ['balls', 'chalk'],
  'how-to-draw-the-cue-ball': ['balls', 'chalk', 'tip'], 'pool-basics-for-beginners': ['cue', 'glove', 'chalk'], 'pool-practice-drills': ['balls', 'book'], 'how-to-rack-pool-balls': ['rack'],
  'first-pool-tournament': ['case', 'glove', 'chalk'], 'how-to-aim-in-pool': ['balls', 'book'], 'how-to-kick-in-pool': ['book', 'balls'], 'jump-shot': ['jump'], '8-ball-rules': ['rack', 'balls'], '9-ball-rules': ['rack', 'break'], '10-ball-rules': ['rack', 'break'], 'pool-tips': ['chalk', 'glove', 'tip'], 'safety-play-in-pool': ['book', 'balls'], '8-ball-patterns': ['book'], '9-ball-strategy': ['book', 'break'], 'pool-tournament-nerves': ['glove', 'case'], 'bank-pool-rules': ['book'], 'one-pocket': ['book'], 'straight-pool-rules': ['book', 'rack'], 'pool-vs-billiards-vs-snooker': ['cue', 'book'], 'masse-curve': ['balls', 'chalk'], 'power-draw': ['balls', 'tip'] };

export function gearBox(cfg, slug) {
  const keys = GEAR_FOR[slug]; if (!keys) return '';
  return `<section class="card gear-box" style="padding:14px 18px;margin-top:16px"><h2 class="seo-h2" style="margin-top:0">🛒 Gear for this</h2><ul class="gear-list">${keys.map(k => BY[k]).map(g => `<li><span aria-hidden="true">${g.icon}</span> <a href="${esc(href(cfg, g.q))}" target="_blank" rel="sponsored nofollow noopener">${esc(g.name)}</a> <span class="muted">· ${esc(g.why.split('. ')[0])}.</span></li>`).join('')}</ul><p style="margin:6px 0 0"><a href="/gear/">See the full pool gear guide →</a></p>${disclosure(cfg)}</section>`;
}

export function gearPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Pool Gear</span></nav>
  <div class="pagehead"><h1>Pool Gear Guide: What You Actually Need</h1><p>The ten things worth owning when you start playing tournaments, what each one does, and what to look for. Start with a cue, a case and chalk; add the rest as your game grows.</p></div>
  <div class="gear-grid">${GEAR.map((g, i) => `<article class="card gear-card"><span class="gear-ic" aria-hidden="true">${g.icon}</span><h2>${i + 1}. ${esc(g.name)}</h2><p>${esc(g.why)}</p>
    <p class="gear-cta"><a class="btn btn-gold btn-sm" href="${esc(href(cfg, g.q))}" target="_blank" rel="sponsored nofollow noopener">See prices on Amazon</a> <a href="${g.guide}">Learn more</a></p></article>`).join('')}</div>
  ${disclosure(cfg)}
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">Buying tips</h2><ul>
  <li><b>Don't overspend on your first cue.</b> A straight, solid cue with a good tip plays as well as one that costs ten times more. Spend the difference on table time.</li>
  <li><b>Roll it before you buy it</b> if you can: a warped shaft wobbles when you roll it on a flat table.</li>
  <li><b>Keep it out of the car.</b> Heat and cold warp shafts. A good case helps, but bring your cue inside.</li></ul>
  <p>Then put it to use: <a href="/tonight/">find a tournament tonight</a>.</p></article>`;
  return layout(cfg, { title: 'Pool Gear Guide: Cues, Cases, Chalk & More for Tournament Players | Billiard Action Time', description: 'What pool gear you actually need: a playing cue, case, chalk, glove, tip tool, break and jump cues, training balls and more, with what to look for in each.', path: '/gear/', body });
}
