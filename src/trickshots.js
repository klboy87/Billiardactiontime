// Trick shots and skill shots (/trick-shots/...). Each shot has its own page with a table diagram, the
// setup, how to shoot it and why it works. Diagram positions are in diamonds (x 0–8, y 0–4), and balls
// that should be frozen together are placed with frozen() so they touch on the drawing.
import { layout } from './seo.js';
import { table } from './guides-more.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = 0.3;                                                   // ball diameter on the diagrams, in diamonds
const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
const step = (p, u, k) => [+(p[0] + u[0] * k).toFixed(3), +(p[1] + u[1] * k).toFixed(3)];
// n balls in a frozen line from `start` toward `target`; returns their centers.
const frozen = (start, target, n) => { const u = unit(start, target); return Array.from({ length: n }, (_, i) => step(start, u, i * D)); };
const ghost = (ball, pocket) => step(ball, unit(pocket, ball), D);   // where the cue ball must be to send `ball` to `pocket`
const Y = '#ffd54a';
const STARS = n => '★'.repeat(n) + '☆'.repeat(3 - n);

const combo2 = frozen([6.3, 1.7], [8, 0], 2);
const combo3 = frozen([5.9, 2.1], [8, 0], 3);
const throwPair = frozen([6.3, 1.45], [7.92, 0.25], 2);           // pointed a little above the pocket
const railBall = [6.4, 0.16];
const cutBall = [6.5, 1], cutPocket = [8, 0], cutGhost = ghost(cutBall, cutPocket);
const second = step(cutGhost, [0.555, 0.832], 1.75);
const drawObj = [6.5, 1], drawCue = [5, 2];
const wingBall = [3.4, 2.2], wingGhost = ghost(wingBall, [0, 4]);
const bankBall = [6, 2.6], bankRail = [6 + 2 * 2.6 / 6.6, 0], bankGhost = ghost(bankBall, bankRail);   // mirror pocket at (8, -4)

export const SHOTS = [
  {
    slug: 'dead-combination', title: 'The Dead Combination: Two Balls, One Pocket', level: 1, teaches: 'Combination shots and how frozen balls react',
    desc: 'Two frozen balls lined up with a pocket go in almost no matter how you hit the first one. The easiest trick shot in pool, and a real game-winner.',
    diagram: table({ balls: [{ x: combo2[0][0], y: combo2[0][1], n: 1 }, { x: combo2[1][0], y: combo2[1][1], n: 9 }, { x: 3.4, y: 3.2, n: 0 }],
      paths: [[[3.4, 3.2], [combo2[0][0] - 0.12, combo2[0][1] + 0.12]], { pts: [combo2[1], [7.85, 0.15]], color: Y }] }, 'Two balls frozen together, lined up with the corner pocket. Hit the back ball and the front ball goes in.'),
    setup: ['Freeze two balls together (touching) so the line through their centers points at a corner pocket.', 'Start about a diamond and a half from the pocket. Put the cue ball anywhere it can hit the back ball.'],
    how: ['Aim to hit the back ball fairly full, at medium-soft speed.', 'Don\'t aim the front ball. If the two balls are frozen and lined up, the front ball leaves along the line of centers and goes in.'],
    why: 'When two balls are frozen, the front ball is pushed out along the line between their centers. The cue ball only changes how hard it goes, not where. That is why players call it "dead."',
    mistakes: ['Balls not quite touching. Even a tiny gap turns it into a real combination that you have to aim.', 'Hitting the back ball with a big cut angle and lots of speed. Friction can "throw" the front ball off line, so stay near full.'],
    game: 'In 9-Ball, spotting a dead combination on the 9 wins games. Look for it every time two balls are touching near a pocket.'
  },
  {
    slug: 'three-ball-train', title: 'The Train: Three Balls in a Row', level: 1, teaches: 'Lining up frozen balls and reading the line of centers',
    desc: 'Line up three frozen balls toward a corner and pocket the front one with a single hit. A crowd-pleaser that only takes a minute to set up.',
    diagram: table({ balls: [{ x: combo3[0][0], y: combo3[0][1], n: 3 }, { x: combo3[1][0], y: combo3[1][1], n: 5 }, { x: combo3[2][0], y: combo3[2][1], n: 8 }, { x: 2.6, y: 3.3, n: 0 }],
      paths: [[[2.6, 3.3], [combo3[0][0] - 0.13, combo3[0][1] + 0.11]], { pts: [combo3[2], [7.85, 0.15]], color: Y }] }, 'Three frozen balls in a line toward the corner. Only the front ball moves much.'),
    setup: ['Freeze three balls in a straight line pointing at a corner pocket. Use the rack or a straight edge if you have one.', 'Put the cue ball 2 to 3 diamonds away from the back ball, at any angle.'],
    how: ['Hit the back ball solidly near full.', 'The energy passes through the middle ball and the front ball shoots into the pocket. The back two barely move.'],
    why: 'Like a row of hanging balls on a desk toy, the push travels through the line. The front ball takes most of it, and its direction is set by the line of centers.',
    mistakes: ['A crooked line. Sight it from behind the back ball like a rifle before you shoot.', 'Hitting too hard. Medium speed is plenty and keeps the line from jumping.'],
    game: 'The same idea shows up when two or three balls are clustered near a pocket after the break. Read the line of centers before you decide a cluster is a problem.'
  },
  {
    slug: 'throw-shot', title: 'The Throw Shot: Make a Combination That Isn\'t Lined Up', level: 2, teaches: 'Throw, the friction that pushes balls off line',
    desc: 'Two frozen balls point a little off the pocket. Hit the back ball on the correct side and the front ball is "thrown" into the pocket anyway.',
    diagram: table({ balls: [{ x: throwPair[0][0], y: throwPair[0][1], n: 2 }, { x: throwPair[1][0], y: throwPair[1][1], n: 7 }, { x: 4.4, y: 2.6, n: 0 }],
      paths: [[[4.4, 2.6], [throwPair[0][0] - 0.12, throwPair[0][1] + 0.1]], { pts: [throwPair[1], [7.86, 0.12]], color: Y }], labels: [[7.2, 1.5, 'line misses']] }, 'The frozen pair points just past the pocket. Cutting the back ball from the other side throws the front ball in.'),
    setup: ['Freeze two balls so their line points about one ball-width to the side of a corner pocket.', 'Put the cue ball off to one side so you can cut the back ball.'],
    how: ['Cut the back ball on the side that moves it toward the pocket\'s side of the line, at soft to medium speed.', 'The front ball still leaves mostly along the line of centers, but friction drags it a little in the direction the back ball is moving. That small push is enough.'],
    why: 'At the instant the balls touch, they rub. That friction "throws" the front ball a few degrees off the line of centers, toward the way the back ball is traveling. Slower speed and cleaner balls mean more throw.',
    mistakes: ['Shooting too hard. Throw is biggest at slow speed.', 'Trying to throw a ball more than a couple of degrees. If the line misses by more than about a ball width, it won\'t go.'],
    game: 'Knowing about throw saves you on cut shots too: on slow, thin cuts, the object ball goes a little thicker than you aim. Aim a touch thinner.'
  },
  {
    slug: 'rail-cut', title: 'The Frozen Rail Shot: Cut a Ball Down the Rail', level: 2, teaches: 'Rail shots, the most common "hard" shot in games',
    desc: 'A ball frozen to the rail looks impossible to cut in. The secret is to hit the rail and the ball at the same time.',
    diagram: table({ balls: [{ x: railBall[0], y: railBall[1], n: 4 }, { x: 3.4, y: 1.8, n: 0 }],
      paths: [[[3.4, 1.8], [railBall[0] - 0.24, 0.12]], { pts: [railBall, [7.86, 0.08]], color: Y }] }, 'Ball frozen on the rail. Aim to touch the rail and the ball at the same moment.'),
    setup: ['Freeze an object ball against the long rail, about one and a half diamonds from a corner pocket.', 'Put the cue ball near the middle of the table so you have a cut of about 30 to 45 degrees.'],
    how: ['Aim so the cue ball touches the cushion and the object ball at almost the same time. In practice that means hitting a hair of rail first.', 'Use medium speed and a center or slightly high hit. Running English (spin toward the rail) helps hold the ball on the rail.'],
    why: 'A ball frozen to the rail can\'t be cut "into" the rail, so the cushion has to help. Hitting both at once squeezes the object ball straight down the rail.',
    mistakes: ['Hitting the ball first and full. It bounces off the rail and wobbles out.', 'Too much speed. Soft and medium rail shots are much more forgiving.'],
    game: 'Rail shots come up in every rack of 8-Ball. Practice ten from different distances and you\'ll win games your opponents give up on.'
  },
  {
    slug: 'ninety-degree-carom', title: 'Two Balls, Two Pockets: The 90-Degree Carom', level: 2, teaches: 'The 90-degree rule and where the cue ball goes after a cut',
    desc: 'Cut one ball into a corner and send the cue ball off at 90 degrees to knock a second ball into the other corner. Pure geometry, and very useful to know.',
    diagram: table({ balls: [{ x: cutBall[0], y: cutBall[1], n: 1 }, { x: second[0], y: second[1], n: 6 }, { x: 4, y: 0.6, n: 0 }],
      paths: [[[4, 0.6], cutGhost, step(cutGhost, [0.555, 0.832], 1.5)], { pts: [cutBall, [7.85, 0.12]], color: Y }, { pts: [second, [7.88, 3.86]], color: Y }] }, 'With a stun hit, the cue ball leaves at 90 degrees to the object ball\'s path, straight into the second ball.'),
    setup: ['Place the first ball about one and a half diamonds out from a corner, and the cue ball for a cut of 40 to 50 degrees.', 'Place the second ball on the line 90 degrees from the first ball\'s path, aimed at the opposite corner.'],
    how: ['Hit the cue ball dead center (or a touch below) with firm speed so it slides, not rolls, into the first ball. That is called a stun shot.', 'After contact the cue ball leaves along the "tangent line," 90 degrees from the first ball\'s path, and caroms the second ball in.'],
    why: 'When a sliding cue ball hits an object ball, the two balls always separate at 90 degrees. Topspin bends the cue ball forward of that line and draw bends it back, so center ball gives the clean 90.',
    mistakes: ['Hitting with follow at soft speed. The cue ball rolls and curves forward, missing the second ball.', 'Setting the second ball by eye. Lay a cue along the tangent line to place it.'],
    game: 'The 90-degree rule is how good players see where the cue ball goes, and how they avoid scratches. Learn it with this shot and you\'ll use it every game.'
  },
  {
    slug: 'power-draw', title: 'The Power Draw: Two Rails Back', level: 3, teaches: 'Draw stroke, follow-through and cue ball control',
    desc: 'Pocket the ball and pull the cue ball back off two rails. A test of a straight stroke that impresses everyone watching.',
    diagram: table({ balls: [{ x: drawObj[0], y: drawObj[1], n: 3 }, { x: drawCue[0], y: drawCue[1], n: 0 }],
      paths: [[drawCue, [6.32, 1.12]], { pts: [drawObj, [7.86, 0.1]], color: Y }, [[6.15, 1.25], [2, 4], [0.1, 2.75]]] }, 'Pocket the 3 and draw the cue ball back across the table, off the long rail and the end rail.'),
    setup: ['Place an object ball about one and a half diamonds from a corner pocket, and the cue ball about a diamond and a half behind it, close to straight-in.', 'A slight angle is fine; it gives the cue ball a path back across the table.'],
    how: ['Use a firm bridge and chalk well. Aim low on the cue ball, about one tip below center (not lower, or you risk a miscue).', 'Use a smooth, accelerating stroke and follow through. Stay down until the cue ball comes back.'],
    why: 'Backspin keeps spinning after the cue ball stops moving forward at contact. With enough spin, it grabs the cloth and pulls back hard enough to travel off two rails.',
    mistakes: ['Jabbing at the ball. Draw comes from a long, loose follow-through, not from hitting hard.', 'Raising the back of the cue too much. Keep the cue as level as you can.'],
    game: 'You won\'t need two-rail draw often, but practicing it builds the stroke for every short draw shot you will use.'
  },
  {
    slug: 'wing-shot', title: 'The Wing Shot: Pocket a Moving Ball', level: 3, teaches: 'Timing, rhythm and aiming at a moving target',
    desc: 'Roll a ball across the table and shoot it into a pocket while it is still moving. The classic exhibition shot.',
    diagram: table({ balls: [{ x: wingBall[0], y: wingBall[1], n: 9 }, { x: 5.8, y: 3.1, n: 0 }],
      paths: [{ pts: [[1.2, 0.6], [3.25, 2.05]], color: Y }, [[5.8, 3.1], wingGhost], { pts: [wingBall, [0.14, 3.86]], color: Y }], labels: [[1.2, 0.45, 'roll']] }, 'Roll the 9 from the corner, then shoot it into the far corner as it crosses the middle.'),
    setup: ['Put the cue ball near the middle of the table, a little toward one side.', 'Stand ready in your stance. Have a friend roll an object ball by hand from near a corner, across the table toward the middle (or roll it yourself with your bridge hand and get down fast).'],
    how: ['Pick the spot where you want to meet the ball and wait for it, rather than chasing it.', 'Shoot when the ball is about one ball-width before your spot, firmly, aiming at the ghost ball for the pocket you picked.'],
    why: 'It is all timing. The ball rolls at a steady speed across the middle, so if you shoot at the same moment every time, you can learn it like a rhythm.',
    mistakes: ['Shooting too softly. A firm hit means less time for the ball to move while the cue ball travels.', 'Changing the spot. Pick one meeting point and stick with it.'],
    game: 'It won\'t come up in a match, but the focus it needs makes everything else feel slow and easy.'
  },
  {
    slug: 'jump-shot', title: 'The Jump Shot: Hop Over a Blocker', level: 3, teaches: 'Elevated stroke and when jumping is legal',
    desc: 'A ball blocks your path. Elevate the cue and hit down so the cue ball hops over it and still makes the shot.',
    diagram: table({ balls: [{ x: 3.4, y: 2, n: 8 }, { x: 5.4, y: 1.3, n: 2 }, { x: 2.4, y: 2.35, n: 0 }],
      paths: [{ pts: [[2.4, 2.35], [3.4, 1.6], [5.12, 1.4]], color: '#fff', curve: true }, { pts: [[5.4, 1.3], [7.86, 0.12]], color: Y }], labels: [[3.4, 1.5, 'hop']] }, 'The cue ball hops over the 8 and comes down before it reaches the 2.'),
    setup: ['Put a blocking ball about one diamond in front of the cue ball, and an object ball 2 diamonds further on, lined up with a pocket.', 'Use a jump cue if you have one; it is shorter and lighter and makes this much easier. Many tournaments allow jump cues, but check first.'],
    how: ['Raise the back of the cue to about 45 to 60 degrees. Hit the cue ball slightly above center with a short, quick stroke, like throwing a dart.', 'The cue ball bounces off the slate, flies over the blocker and lands before the object ball.'],
    why: 'Hitting down drives the cue ball into the slate, which bounces it into the air. The steeper the cue and the faster the stroke, the higher it jumps.',
    mistakes: ['Scooping under the cue ball. That is a foul in nearly every rule set. The jump must come from hitting down.', 'Following through into the cloth. Keep the stroke short to protect the table and the tip.'],
    game: 'When you get ball in hand behind a blocker, a jump can be better than a kick. But know your event\'s rules and practice before trying it in a match.'
  },
  {
    slug: 'masse-curve', title: 'The Massé: Curve the Cue Ball Around a Ball', level: 3, teaches: 'Spin, swerve and cue elevation',
    desc: 'Elevate the cue and hit the side of the cue ball to make it curve around a blocking ball and into the target.',
    diagram: table({ balls: [{ x: 4, y: 2, n: 5 }, { x: 5.6, y: 2, n: 1 }, { x: 2.6, y: 2, n: 0 }],
      paths: [{ pts: [[2.6, 2], [3.9, 3.1], [5.32, 2.1]], color: '#fff', curve: true }, { pts: [[5.6, 2], [7.86, 3.86]], color: Y }] }, 'The cue ball swings out around the 5 and curves back into the 1.'),
    setup: ['Put a blocking ball directly between the cue ball and the object ball, a diamond or so from each.', 'Make it easy first: a short distance and a big, open target ball.'],
    how: ['Raise the cue to about 30 to 45 degrees and hit the cue ball off center on the side you want it to curve toward. With right spin, the cue ball first pushes out a little to the left, then bends back to the right.', 'Aim the cue out to the side of the blocker and use a soft, smooth stroke. Too much speed straightens the curve.'],
    why: 'An elevated cue puts side spin on a tilted axis. As the ball rolls, the spin grips the cloth and bends its path, like a curveball.',
    mistakes: ['Hitting down too hard. You risk damaging the cloth and many rooms don\'t allow full massé shots on their tables. Ask first.', 'Expecting a big curve on the first try. Start with a small swerve and work up.'],
    game: 'A small, controlled swerve to get around a ball is a real game shot. Big massé shots are mostly for show.'
  },
  {
    slug: 'cross-corner-bank', title: 'The Cross-Corner Bank: Use the Diamonds', level: 2, teaches: 'Banking with the diamond system',
    desc: 'Bank a ball off the long rail into the opposite corner. Use the diamonds to find the line and you will make it more often than you think.',
    diagram: table({ balls: [{ x: bankBall[0], y: bankBall[1], n: 7 }, { x: 4.2, y: 3.6, n: 0 }],
      paths: [[[4.2, 3.6], bankGhost], { pts: [bankBall, bankRail, [7.9, 3.88]], color: Y }] }, 'The 7 banks off the far rail into the corner on the near side.'),
    setup: ['Place an object ball near the middle of the table, a little off the rail, and the cue ball behind it for a fairly full hit.'],
    how: ['Picture a second table on the other side of the far rail, a mirror image of this one. Find where the pocket would be on that mirror table.', 'The spot where the line from the object ball to that mirror pocket crosses the rail is your target. Aim the object ball there with medium speed and no side spin.'],
    why: 'A ball comes off a cushion at about the same angle it went in, so its path looks like a straight line to the pocket on the mirror table. The diamonds on the rail help you measure the spot.',
    mistakes: ['Hitting too hard. Firm banks come off the rail at a shorter angle; soft banks run longer.', 'Using side spin. It changes the angle off the rail. Learn the straight version first.'],
    game: 'Banks win games when there is no direct shot, and they are the whole game in <a href="/guides/bank-pool-rules">bank pool</a>.'
  }
];

const crumbs = (last) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> ${last ? `<a href="/trick-shots/">Trick shots</a> <span>/</span> <span>${esc(last)}</span>` : '<span>Trick shots</span>'}</nav>`;

export function trickShotsIndexPage(cfg) {
  const card = (s, i) => `<a class="ts-card" href="/trick-shots/${s.slug}">${s.diagram.replace(/<figcaption>[\s\S]*?<\/figcaption>/, '')}<span class="ts-meta">#${i + 1} · <span class="ts-stars" title="Difficulty">${STARS(s.level)}</span></span><b>${esc(s.title)}</b><span class="muted">${esc(s.desc)}</span></a>`;
  const body = `${crumbs('')}
  <div class="pagehead"><h1>Pool Trick Shots You Can Learn</h1><p>${SHOTS.length} trick shots and skill shots with diagrams and step-by-step setup, from easy table tricks to the jump and the massé. Every one teaches something you can use in a real game.</p></div>
  <p class="glossary-az"><a href="#easy" style="min-width:auto;padding:4px 12px">★ Easy</a><a href="#medium" style="min-width:auto;padding:4px 12px">★★ Medium</a><a href="#hard" style="min-width:auto;padding:4px 12px">★★★ Hard</a><a href="/play/aim-trainer" style="min-width:auto;padding:4px 12px">🎯 Aim trainer game</a></p>
  ${[[1, 'easy', 'Easy'], [2, 'medium', 'Medium'], [3, 'hard', 'Hard']].map(([lv, id, name]) => `<h2 id="${id}" style="margin:22px 0 10px">${STARS(lv)} ${name}</h2><div class="ts-grid">${SHOTS.map((s, i) => [s, i]).filter(([s]) => s.level === lv).map(([s, i]) => card(s, i)).join('')}</div>`).join('')}
  <article class="card guide" style="margin-top:22px"><h2 style="margin-top:0">Before you try them</h2>
  <ul><li><b>Ask the room.</b> Jump and massé shots can damage cloth. Many rooms don't allow them, and some don't allow jump cues.</li>
  <li><b>Set up carefully.</b> Most trick shots fail because the balls are not quite where they should be. Use the diagram and take your time.</li>
  <li><b>Learn the "why."</b> Each page explains the physics, so the skill carries over to real games.</li></ul>
  <p>Want to build the basics first? Try the <a href="/guides/pool-practice-drills">7 practice drills</a>, test your eye with the <a href="/play/aim-trainer">aim trainer</a>, or see how well you know the rules with the <a href="/tools/pool-rules-quiz">rules quiz</a>.</p></article>`;
  return layout(cfg, { title: 'Pool Trick Shots: 10 Shots You Can Learn (With Diagrams) | Billiard Action Time', description: `${SHOTS.length} pool trick shots and skill shots with table diagrams and step-by-step setup: dead combinations, throw shots, the 90-degree carom, power draw, jump and massé shots.`,
    path: '/trick-shots/', body, jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Pool trick shots', itemListElement: SHOTS.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${cfg.publicUrl}/trick-shots/${s.slug}`, name: s.title })) }] });
}

export function trickShotPage(cfg, slug) {
  const i = SHOTS.findIndex(s => s.slug === slug);
  if (i < 0) return null;
  const s = SHOTS[i], prev = SHOTS[(i - 1 + SHOTS.length) % SHOTS.length], next = SHOTS[(i + 1) % SHOTS.length];
  const ol = list => `<ol>${list.map(x => `<li>${x}</li>`).join('')}</ol>`;
  const body = `${crumbs(s.title)}
  <article class="card guide"><h1>${esc(s.title)}</h1>
  <p class="guide-meta"><a class="guide-tag" href="/trick-shots/" style="text-decoration:none">Trick shot #${i + 1} of ${SHOTS.length}</a><span>Difficulty: <span class="ts-stars">${STARS(s.level)}</span></span><span>Teaches: ${esc(s.teaches)}</span></p>
  <p>${esc(s.desc)}</p>
  ${s.diagram}
  <p class="muted" style="font-size:14px">White dashes: cue ball path. Yellow dashes: object ball path.</p>
  <h2>Setup</h2>${ol(s.setup)}
  <h2>How to shoot it</h2>${ol(s.how)}
  <h2>Why it works</h2><p>${s.why}</p>
  <h2>Common mistakes</h2><ul>${s.mistakes.map(x => `<li>${x}</li>`).join('')}</ul>
  <h2>In a real game</h2><p>${s.game}</p>
  </article>
  <section class="sec seo-sec"><h2>Next shot</h2><div class="guide-next">
    <a href="/trick-shots/${prev.slug}"><small>← Previous · ${STARS(prev.level)}</small><b>${esc(prev.title)}</b></a>
    <a href="/trick-shots/${next.slug}"><small>Next → · ${STARS(next.level)}</small><b>${esc(next.title)}</b></a>
    <a href="/play/aim-trainer"><small>Game</small><b>Test your aim: play the aim trainer</b></a>
    <a href="/guides/pool-practice-drills"><small>Practice</small><b>7 drills that actually make you better</b></a>
  </div><p style="margin-top:12px"><a href="/trick-shots/">All ${SHOTS.length} trick shots →</a> · <a href="/this-weekend/">Find a tournament this weekend →</a></p></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'HowTo', name: s.title, description: s.desc, url: `${cfg.publicUrl}/trick-shots/${s.slug}`,
    step: [...s.setup, ...s.how].map((t, k) => ({ '@type': 'HowToStep', position: k + 1, text: t.replace(/<[^>]+>/g, '') })) };
  return layout(cfg, { title: `${s.title} | Pool Trick Shots | Billiard Action Time`, description: s.desc, path: `/trick-shots/${s.slug}`, body, jsonld: [ld] });
}
