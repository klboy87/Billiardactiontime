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
  { key: 'tips', icon: '🔘', name: 'Replacement cue tips', q: 'pool cue tips 13mm layered', why: 'A fresh tip is the cheapest way to make an old cue play like new. Layered tips hold their shape longest; match the size to your ferrule.', guide: '/guides/pool-cue-tips' },
  { key: 'brush', icon: '🧹', name: 'A pool table brush', q: 'pool table brush', why: 'A soft brush made for billiard cloth lifts chalk and dust without pulling the weave. Brush toward the head of the table.', guide: '/guides/how-to-clean-a-pool-table' },
  { key: 'level', icon: '📐', name: 'A machinist level', q: 'machinist level 12 inch', why: 'A precise level shows how far off a table is. A cheap bubble level is not accurate enough for a slate table.', guide: '/guides/how-to-level-a-pool-table' },
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
  'first-pool-tournament': ['case', 'glove', 'chalk'], 'how-to-aim-in-pool': ['balls', 'book'], 'how-to-kick-in-pool': ['book', 'balls'], 'jump-shot': ['jump'], '8-ball-rules': ['rack', 'balls'], '9-ball-rules': ['rack', 'break'], '10-ball-rules': ['rack', 'break'], 'pool-tips': ['chalk', 'glove', 'tip'], 'safety-play-in-pool': ['book', 'balls'], '8-ball-patterns': ['book'], '9-ball-strategy': ['book', 'break'], 'pool-tournament-nerves': ['glove', 'case'], 'bank-pool-rules': ['book'], 'one-pocket': ['book'], 'straight-pool-rules': ['book', 'rack'], 'pool-vs-billiards-vs-snooker': ['cue', 'book'], 'pool-table-sizes': ['cue', 'rack'], 'pool-rules-questions': ['rack', 'book'], 'how-to-hold-a-pool-cue': ['glove', 'cue', 'chalk'], 'pool-cue-tips': ['tips', 'tip', 'chalk'], 'how-to-bank-in-pool': ['balls', 'book'], 'pool-ball-colors-and-numbers': ['rack', 'balls'], 'pool-games-to-play': ['rack', 'cue'], 'how-to-clean-a-pool-table': ['brush', 'balls'], 'how-to-level-a-pool-table': ['level', 'brush'], 'history-of-pool': ['book', 'cue'], 'pool-cue-weight': ['cue', 'break', 'case'], 'cutthroat-pool-rules': ['rack', 'cue'], 'masse-curve': ['balls', 'chalk'], 'power-draw': ['balls', 'tip'] };

export function gearBox(cfg, slug) {
  const keys = GEAR_FOR[slug]; if (!keys) return '';
  return `<section class="card gear-box" style="padding:14px 18px;margin-top:16px"><h2 class="seo-h2" style="margin-top:0">🛒 Gear for this</h2><ul class="gear-list">${keys.map(k => BY[k]).map(g => `<li><span aria-hidden="true">${g.icon}</span> <a href="${esc(href(cfg, g.q))}" target="_blank" rel="sponsored nofollow noopener">${esc(g.name)}</a> <span class="muted">· ${esc(g.why.split('. ')[0])}.</span></li>`).join('')}</ul><p style="margin:6px 0 0"><a href="/gear/">Full pool gear guide →</a> · <a href="/gear/gifts-for-pool-players">🎁 Gift ideas for pool players</a>${['pool-table-sizes', 'cutthroat-pool-rules', '8-ball-rules', 'pool-basics-for-beginners'].includes(slug) ? ' · <a href="/gear/home-pool-table">🏠 Buying a home pool table</a>' : ''}${['how-to-choose-a-pool-cue', 'pool-cue-tips', 'pool-cue-care', 'pool-basics-for-beginners', 'pool-cue-weight'].includes(slug) ? ' · <a href="/gear/pool-cue-prices">💲 What a pool cue costs</a>' : ''}</p>${disclosure(cfg)}</section>`;
}

export function gearPage(cfg) {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Pool Gear</span></nav>
  <div class="pagehead"><h1>Pool Gear Guide: What You Actually Need</h1><p>The gear worth owning when you start playing tournaments, what each one does, and what to look for. Start with a cue, a case and chalk; add the rest as your game grows.</p></div>
  <div class="gear-grid">${GEAR.map((g, i) => `<article class="card gear-card"><span class="gear-ic" aria-hidden="true">${g.icon}</span><h2>${i + 1}. ${esc(g.name)}</h2><p>${esc(g.why)}</p>
    <p class="gear-cta"><a class="btn btn-gold btn-sm" href="${esc(href(cfg, g.q))}" target="_blank" rel="sponsored nofollow noopener">See prices on Amazon</a> <a href="${g.guide}">Learn more</a></p></article>`).join('')}</div>
  <section class="sec seo-sec"><h2>Buying guides</h2><div class="guide-next">${BUYING.map(x => `<a href="/gear/${x.slug}"><small>${x.icon} Buying guide</small><b>${esc(x.title)}</b></a>`).join('')}</div></section>
  ${disclosure(cfg)}
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">Buying tips</h2><ul>
  <li><b>Don't overspend on your first cue.</b> A straight, solid cue with a good tip plays as well as one that costs ten times more. Spend the difference on table time.</li>
  <li><b>Roll it before you buy it</b> if you can: a warped shaft wobbles when you roll it on a flat table.</li>
  <li><b>Keep it out of the car.</b> Heat and cold warp shafts. A good case helps, but bring your cue inside.</li></ul>
  <p>Then put it to use: <a href="/tonight/">find a tournament tonight</a>.</p></article>`;
  return layout(cfg, { title: 'Pool Gear Guide: Cues, Cases, Chalk & More for Tournament Players | Billiard Action Time', description: 'What pool gear you actually need: a playing cue, case, chalk, glove, tip tool, break and jump cues, training balls and more, with what to look for in each.', path: '/gear/', body, ogImage: `${cfg.publicUrl}/og/gear/index.png` });
}

// ---- Buying guides under /gear/<slug>: shopping intent pages (gifts, home tables). Same Amazon search links. ----
export const BUYING = [
  { slug: 'gifts-for-pool-players', icon: '🎁', title: 'Gifts for Pool Players: 15 Ideas They\'ll Actually Use',
    desc: 'Gift ideas for pool players at every budget: cue cases, gloves, chalk, training balls, break cues, books and more. What to buy for a beginner, a league player or a serious tournament player.',
    intro: 'Shopping for someone who plays pool? These are gifts players really use, sorted by budget. If you are not sure what they have, a case, a glove or good chalk is always safe: every player wears them out.',
    groups: [
      { h: 'Under $25', items: [
        ['🧤', 'A billiard glove', 'billiard glove', 'Every player wears one out eventually. Ask which hand they bridge with (usually the left for right-handed players).'],
        ['🟦', 'Premium chalk', 'premium pool cue chalk', 'Serious players are picky about chalk, and better chalk means fewer miscues. A few cubes make a great stocking stuffer.'],
        ['🛠️', 'A tip tool', 'pool cue tip tool', 'Shapes and scuffs the cue tip so it holds chalk. Small, cheap, and used every week.'],
        ['🔺', 'A rack template', 'pool rack template sheet', 'Gives a perfect frozen rack every time. Great for players who practice at home or run a weekly tournament.'],
        ['🧽', 'A shaft cleaner and slicker', 'pool cue shaft cleaner', 'Keeps the shaft smooth and clean so it glides through the bridge.']]},
      { h: '$25 to $100', items: [
        ['🔴', 'A training cue ball', 'training cue ball dots', 'A cue ball with dots shows exactly how much spin a player puts on it. Great for learning draw and English.'],
        ['🧳', 'A hard cue case', 'hard pool cue case 2x2', 'Protects the cue from warping and dings. A 2x2 case holds two butts and two shafts.'],
        ['📘', 'A pool instruction book', 'pool billiards instruction book', 'A good book on aiming, position play or the mental game is a gift that keeps paying off.'],
        ['🦘', 'A jump cue', 'jump cue pool', 'A short, light cue for jumping over blocking balls. Popular with 9-Ball and 10-Ball players.'],
        ['🧮', 'A wall cue rack', 'wall mount pool cue rack', 'For anyone with a home table: keeps cues straight and off the floor.']]},
      { h: 'Big gifts', items: [
        ['🎱', 'A new playing cue', 'pool cue 58 inch', 'The gift every player wants. Most players like 18 to 20 ounces and a 12 to 13 mm tip; ask their weight if you can.'],
        ['💥', 'A break cue', 'pool break cue', 'A hard tip and stiff shaft for a powerful break. It also saves the tip on their playing cue.'],
        ['🔵', 'A tournament ball set', 'tournament billiard ball set', 'A quality set of balls plays truer and lasts for decades on a home table.'],
        ['🎟️', 'A tournament entry', '/big-tournaments/', 'Pay their entry into a big local event. Find one on our big tournaments page, then wrap a printout of the flyer.'],
        ['🏠', 'A home pool table', 'pool table', 'The biggest pool gift there is. Read our home pool table buying guide first: room size matters most.']]}],
    tips: ['Not sure about cue weight or tip size? A case, a glove or chalk are safe picks every time.', 'Players are particular about cues. If you buy one, keep the receipt, or give a gift card with a printout of the cue you picked.', 'Pair any gift with a night out: <a href="/this-weekend/">find a tournament this weekend</a> and go watch them play.'] },
  { slug: 'home-pool-table', icon: '🏠', title: 'Buying a Home Pool Table: Size, Room, Slate and Budget',
    desc: 'How to buy a pool table for your home: how much room you need for 7, 8 and 9-foot tables, slate vs non-slate, what to look for, and the accessories you need.',
    intro: 'A pool table is a big purchase that lasts for decades if you buy right. The order matters: measure your room first, then pick a table size that fits, then choose the build quality your budget allows.',
    groups: [
      { h: '1. Measure the room', html: '<p><b>Quick check:</b> try the free <a href="/tools/pool-table-room-size">room size calculator</a>. You need room for a full stroke on every side. With a standard 58-inch cue, add about 5 feet on each side of the playing surface. Rough room sizes: <b>7-foot table:</b> about 13 by 16 feet. <b>8-foot table:</b> about 13 by 17 feet. <b>9-foot table:</b> about 14 by 18 feet. Short on space? Keep a 48 or 52-inch short cue for tight spots. See exact playing surface sizes in our <a href="/guides/pool-table-sizes">pool table sizes guide</a>.</p>' },
      { h: '2. Pick the table', items: [
        ['🪨', 'A slate table', 'slate pool table', 'Slate beds stay flat for decades and play like a real pool hall. One-inch, three-piece slate is the standard for good tables. They are heavy, so plan on professional delivery and setup.'],
        ['🪵', 'A non-slate table', 'pool table for home', 'Cheaper and lighter, made of MDF or particle board. Fine for kids and casual play, but they can sag and roll off over time.'],
        ['🔄', 'A convertible table', 'convertible pool table dining', 'Converts to a dining or game table with a top. A good choice when the room has to do double duty.']]},
      { h: '3. Get the accessories', items: [
        ['🎱', 'House cues', 'pool cue set of 4', 'At least four cues so friends can play. Add a short cue if any side of the room is tight.'],
        ['🔵', 'A ball set', 'billiard ball set', 'A better ball set plays truer and lasts longer than the one that comes with most tables.'],
        ['🔺', 'A rack and template', 'pool rack triangle template', 'A wooden triangle plus a thin template for tight racks.'],
        ['🧹', 'A table brush and cover', 'pool table brush cover', 'Brush the cloth after play and cover it to keep dust and drinks off.'],
        ['💡', 'A pool table light', 'pool table light', 'Even light over the whole table. Hang it about 32 to 36 inches above the playing surface.'],
        ['🧮', 'A wall cue rack', 'wall mount pool cue rack', 'Keeps cues straight and off the floor.']]}],
    tips: ['Have slate tables leveled by a pro after delivery. A table that is not level never plays right (see <a href="/guides/how-to-level-a-pool-table">how to level a pool table</a>).', 'Brush the cloth after every session and cover it: <a href="/guides/how-to-clean-a-pool-table">how to clean a pool table</a>.', 'Worsted (tournament) cloth plays faster and truer than the felt on cheap tables. It is the most noticeable upgrade.', 'Learn the games your family will play: <a href="/guides/8-ball-rules">8-Ball rules</a>, <a href="/guides/cutthroat-pool-rules">cutthroat</a> for three players, and our <a href="/play/">free pool games</a> for rainy days.'] }
];

BUYING.push({ slug: 'game-room-setup', icon: '🍻', title: 'Game Room Setup: Everything Around the Pool Table',
  desc: 'How to set up a home game room around a pool table: lighting, cue racks, seating, a scoreboard, flooring, a dartboard and the small things that make it feel like a pool hall.',
  intro: 'The table is the star, but the room around it decides whether people want to hang out and play. Here is what to add, in the order most people should buy it.',
  groups: [
    { h: 'Light and space first', items: [
      ['💡', 'A pool table light', 'pool table light fixture', 'Even light over the whole playing surface, with no shadows from the rails. Hang it about 32 to 36 inches above the cloth.'],
      ['🧮', 'A wall cue rack', 'wall mount pool cue rack', 'Keeps cues straight and off the floor, with a spot for the bridge, balls and chalk.'],
      ['🟫', 'A rug or floor protection', 'game room area rug', 'Protects the floor from chalk and dropped balls, and quiets the room. Keep it under the whole table and stroke area.']]},
    { h: 'Make people stay', items: [
      ['🪑', 'Spectator chairs or pub stools', 'spectator chairs pool', 'Tall seats along the wall let people watch the game without standing in the way of a stroke.'],
      ['🍸', 'A pub table', 'pub table set', 'A spot for drinks that is not the rail of your table. Keep it outside the stroke area.'],
      ['🧾', 'A scoreboard', 'billiard scoreboard wall', 'A bead scoreboard or a chalkboard keeps race-to-7 sets honest and adds pool hall style.']]},
    { h: 'More games', items: [
      ['🎯', 'A dartboard cabinet', 'dartboard cabinet set', 'The classic partner to a pool table. Put it on a different wall so dart throwers and shooters do not collide.'],
      ['🃏', 'A card and game table', 'folding card table', 'For poker night and board games when the table is busy.'],
      ['📺', 'A TV mount for streams', 'tv wall mount', 'Watch pro events and streams between racks. Mount it high so it clears the cue.']]},
    { h: 'Finishing touches', items: [
      ['🖼️', 'Billiard wall art', 'billiards wall art', 'Vintage pool posters and neon signs give the room character.'],
      ['🧹', 'A table brush and cover', 'pool table brush cover', 'Brush the cloth after play and cover it to keep dust and spills off.'],
      ['🔵', 'A better ball set', 'billiard ball set', 'The balls that come with most tables are the first thing worth upgrading.']]}],
  tips: ['Plan the stroke area before anything else: about 5 feet around the playing surface, clear of furniture and walls.', 'A dimmer on the room lights (not the table light) makes the table pop and sets the mood.', 'Host a home tournament: print a free <a href="/tools/brackets/">tournament bracket</a> and use the <a href="/tools/payout-calculator">payout calculator</a> for the pot.'] });

BUYING.push({ slug: 'pool-cue-prices', icon: '💲', title: 'How Much Does a Pool Cue Cost? Prices by Level',
  desc: 'What pool cues cost at every level: house and starter cues, good beginner cues, mid-range player cues and custom cues, plus what you get for the money and where to spend it.',
  intro: 'You can buy a pool cue for $25 or $2,500. The good news: you do not need an expensive cue to play well. Here is what each price range gets you, so you spend where it matters.',
  groups: [
    { h: 'Under $75: starter cues', items: [
      ['🎱', 'A starter one-piece or two-piece cue', 'pool cue under 75', 'Straight wood, a basic tip and a simple wrap. Fine for learning and home tables. Check that it rolls straight, and plan on upgrading the tip.'],
      ['🔘', 'A better tip', 'pool cue tips 13mm layered', 'The cheapest upgrade there is. A good layered tip makes a starter cue play much better.']]},
    { h: '$75 to $250: the sweet spot for most players', items: [
      ['🎯', 'A good beginner to league cue', 'pool cue 150', 'Better shafts, layered tips, a real joint and a wrap that stays put. Most league players never need more than this.'],
      ['🧳', 'A case to protect it', 'hard pool cue case 2x2', 'Once you own a real cue, a hard case keeps it straight. Budget $40 to $100.']]},
    { h: '$250 to $800: serious player cues', items: [
      ['🏆', 'A player cue with a low-deflection shaft', 'low deflection pool cue shaft', 'Low-deflection (low squirt) shafts move the cue ball less off line when you use English. Popular with tournament players.'],
      ['💥', 'A separate break cue', 'pool break cue', 'Serious players break with a different cue to save the tip and shaft on their playing cue. Good ones start around $100.']]},
    { h: '$800 and up: custom cues', html: '<p>Custom cues are built by hand by cue makers, with exotic woods, inlays and a long wait list. They play beautifully, but the extra money mostly buys craftsmanship and looks, not more made balls. Buy one because you love it, not to fix your game.</p>' }],
  tips: ['Spend on the shaft and tip first. They decide how the cue plays; the butt mostly decides how it looks.', 'Most players like 18 to 20 ounces and 58 inches. If you are not sure, start at 19 ounces.', 'Buying used? Roll the cue on a flat table to check it is straight, and look for cracks near the joint and ferrule.', 'Read <a href="/guides/how-to-choose-a-pool-cue">how to choose a pool cue</a> and <a href="/guides/pool-cue-tips">pool cue tips explained</a> before you buy.'] });

export function buyingPage(cfg, slug) {
  const g = BUYING.find(x => x.slug === slug); if (!g) return null;
  const item = ([ic, name, q, why]) => `<article class="card gear-card"><span class="gear-ic" aria-hidden="true">${ic}</span><h3 style="font-size:18px;margin:6px 0">${esc(name)}</h3><p>${esc(why)}</p><p class="gear-cta">${q.startsWith('/') ? `<a class="btn btn-blue btn-sm" href="${q}">Find a big tournament</a>` : `<a class="btn btn-gold btn-sm" href="${esc(href(cfg, q))}" target="_blank" rel="sponsored nofollow noopener">See prices on Amazon</a>`}</p></article>`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/gear/">Pool Gear</a> <span>/</span> <span>${esc(g.title.split(':')[0])}</span></nav>
  <div class="pagehead"><h1>${esc(g.title)}</h1><p>${esc(g.intro)}</p></div>
  ${g.groups.map(gr => `<section class="sec seo-sec"><h2>${esc(gr.h)}</h2>${gr.html || ''}${gr.items ? `<div class="gear-grid">${gr.items.map(item).join('')}</div>` : ''}</section>`).join('')}
  ${disclosure(cfg)}
  <article class="card guide" style="margin-top:16px"><h2 style="margin-top:0">Tips</h2><ul>${g.tips.map(t => `<li>${t}</li>`).join('')}</ul></article>
  <section class="sec seo-sec"><h2>More gear guides</h2><div class="guide-next"><a href="/gear/"><small>Gear</small><b>Pool gear guide: what players need</b></a>${BUYING.filter(x => x.slug !== g.slug).map(x => `<a href="/gear/${x.slug}"><small>Buying guide</small><b>${esc(x.title)}</b></a>`).join('')}<a href="/guides/how-to-choose-a-pool-cue"><small>Guide</small><b>How to choose a pool cue</b></a></div></section>`;
  return layout(cfg, { title: `${g.title} | Billiard Action Time`, description: g.desc, path: `/gear/${g.slug}`, body, ogImage: `${cfg.publicUrl}/og/gear/${g.slug}.png` });
}

// Guides with Amazon links written into the text: add the tracking id (and the disclosure) when one is set.
export function tagAmazon(cfg, html) {
  if (!cfg.amazonTag || !html || !html.includes('https://www.amazon.com/s?k=')) return html;
  const out = html.replace(/(https:\/\/www\.amazon\.com\/s\?k=[^"&]+)"/g, (m, u) => `${u}&amp;tag=${encodeURIComponent(cfg.amazonTag)}"`);
  return out.includes('As an Amazon Associate') ? out : out.replace('</article>', '<p class="muted" style="font-size:13px">As an Amazon Associate we earn from qualifying purchases.</p></article>');
}
