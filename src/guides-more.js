// More guide articles (glossary, practice drills, chip tournaments, banks, cues, breaking). Plain data,
// merged into GUIDES in guides.js. Table diagrams are drawn here as inline SVG so they need no images.

// A pool table seen from above, 8 diamonds long and 4 wide. Positions are in diamonds from the
// top-left corner pocket: x 0–8 (long side), y 0–4. Balls: {x, y, n} (n = number, 0 = cue ball,
// 'g' = ghost ball). Paths: [[x1,y1],[x2,y2],...] drawn as dashed arrows.
const U = 50, R = 22;                                          // pixels per diamond, rail width
const px = v => R + v * U;
const BALL = { 0: '#fff', 1: '#f2c400', 2: '#1f4fd1', 3: '#d63a40', 4: '#6b2fb3', 5: '#f07800', 6: '#13804a', 7: '#7a2a1a', 8: '#111', 9: '#f2c400', 10: '#1f4fd1', 11: '#d63a40', 12: '#6b2fb3', 13: '#f07800', 14: '#13804a', 15: '#7a2a1a' };
export function table({ balls = [], paths = [], labels = [] } = {}, caption = '') {
  const W = 8 * U + 2 * R, H = 4 * U + 2 * R;
  const pockets = [[0, 0], [4, 0], [8, 0], [0, 4], [4, 4], [8, 4]].map(([x, y]) => `<circle cx="${px(x)}" cy="${px(y)}" r="11" fill="#111"/>`).join('');
  const diamonds = [];
  for (let i = 1; i < 8; i++) if (i !== 4) { diamonds.push([px(i), R / 2], [px(i), H - R / 2]); }
  for (let j = 1; j < 4; j++) diamonds.push([R / 2, px(j)], [W - R / 2, px(j)]);
  const dia = diamonds.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#f4e7c4"/>`).join('');
  // A path is [[x,y],...] (white, cue ball) or {pts, color, curve} (curve: smooth quadratic through the middle point).
  const lines = paths.map(p => {
    const pts = Array.isArray(p) ? p : p.pts, color = (!Array.isArray(p) && p.color) || '#fff', mk = color === '#fff' ? 'arr' : 'arrY';
    const d = !Array.isArray(p) && p.curve && pts.length === 3
      ? `M${px(pts[0][0])} ${px(pts[0][1])} Q${px(pts[1][0])} ${px(pts[1][1])} ${px(pts[2][0])} ${px(pts[2][1])}`
      : 'M' + pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(' L');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#${mk})" opacity=".95"/>`;
  }).join('');
  const b = balls.map(({ x, y, n }) => {
    if (n === 'g') return `<circle cx="${px(x)}" cy="${px(y)}" r="7.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 2"/>`;
    const stripe = typeof n === 'number' && n >= 9 && n <= 15;
    const fill = BALL[n] ?? '#ddd';
    return `<g><circle cx="${px(x)}" cy="${px(y)}" r="7.5" fill="${stripe ? '#fff' : fill}" stroke="#222" stroke-width=".8"/>${stripe ? `<rect x="${px(x) - 7.5}" y="${px(y) - 3.5}" width="15" height="7" fill="${fill}"/>` : ''}${n ? `<text x="${px(x)}" y="${px(y) + 3}" font-size="8" text-anchor="middle" font-family="Arial" font-weight="bold" fill="${[2, 4, 6, 7, 8, 10, 12, 14, 15].includes(n) ? '#fff' : '#111'}">${n}</text>` : ''}</g>`;
  }).join('');
  const lab = labels.map(([x, y, t]) => `<text x="${px(x)}" y="${px(y)}" font-size="11" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${t}</text>`).join('');
  return `<figure class="diagram"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${caption.replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#fff"/></marker><marker id="arrY" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffd54a"/></marker></defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="#5a3518"/><rect x="${R}" y="${R}" width="${8 * U}" height="${4 * U}" fill="#1f7a4a"/>
<line x1="${px(2)}" y1="${R}" x2="${px(2)}" y2="${H - R}" stroke="#fff" stroke-opacity=".25"/><circle cx="${px(6)}" cy="${px(2)}" r="2" fill="#fff" fill-opacity=".6"/>
${pockets}${dia}${lines}${b}${lab}</svg>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}


// ---------- Fargo chart (same math as the race calculator in public/tools.js) ----------
const gameP = d => 1 / (1 + Math.pow(2, -d / 100));
const matchP = (p, a, b) => { let total = 0, c = 1; for (let k = 0; k < b; k++) { if (k > 0) c = c * (a - 1 + k) / k; total += c * p ** a * (1 - p) ** k; } return total; };
const pct = x => x >= 0.995 ? '>99%' : Math.round(x * 100) + '%';
const fairRace = (d, base) => { let best = base, gap = 2; for (let r = base; r <= base + 40; r++) { const g = Math.abs(matchP(gameP(d), r, base) - 0.5); if (g < gap) { gap = g; best = r; } } return best; };
const fargoRows = () => [0, 25, 50, 75, 100, 125, 150, 200, 250, 300].map(d => `<tr><td><b>${d}</b></td><td>${pct(gameP(d))}</td><td>${pct(matchP(gameP(d), 5, 5))}</td><td>${pct(matchP(gameP(d), 7, 7))}</td><td>${pct(matchP(gameP(d), 9, 9))}</td></tr>`).join('');
const raceRows = () => [25, 50, 75, 100, 125, 150, 200].map(d => `<tr><td><b>${d}</b></td><td>${fairRace(d, 3)} to 3</td><td>${fairRace(d, 4)} to 4</td><td>${fairRace(d, 5)} to 5</td></tr>`).join('');


// Rack layouts for the racking guide: rows of ball numbers, apex on the foot spot, rows going toward the foot rail.
const rack = (rows) => { const out = []; rows.forEach((row, r) => row.forEach((n, i) => out.push({ x: +(6 + r * 0.26).toFixed(3), y: +(2 + (i - (row.length - 1) / 2) * 0.3).toFixed(3), n }))); return out; };

// ---------- glossary ----------
const TERMS = [
  ['Action', 'Betting on pool, or the money being played for. "Looking for action" means looking for a money game.'],
  ['Angle', 'The cut angle of a shot. Also used for having a good angle on the next ball to get position.'],
  ['APA, BCA, VNEA', 'The best-known amateur pool leagues and rule-making groups in North America. Each has its own rules and handicaps.'],
  ['Bank shot', 'A shot where the object ball hits one or more cushions before it goes in the pocket.'],
  ['Bar box', 'A 7-foot table, usually coin-operated, as found in most bars.'],
  ['Break', 'The opening shot of a rack, where the cue ball is driven into the racked balls.'],
  ['Break and run', 'Breaking and then running every ball to win without the opponent shooting.'],
  ['Bridge', 'The hand that supports the front of the cue. Also the mechanical "rake" used for long reaches.'],
  ['Bye', 'A free pass to the next round of a bracket when there are not enough players to fill it.'],
  ['Calcutta', 'An auction before a tournament where people bid on players, and the pot is paid to whoever "owns" the winners. See our <a href="/guides/calcutta-auction-explained">Calcutta guide</a>.'],
  ['Call shot', 'A rule that you must name the ball and pocket before shooting. Obvious shots usually do not need to be said out loud.'],
  ['Carom', 'When the cue ball or an object ball glances off one ball into another. A "carom shot" uses a ball to redirect another into a pocket.'],
  ['Chalk', 'The cube rubbed on the cue tip so it grips the cue ball and does not miscue.'],
  ['Cheat the pocket', 'Aiming at one side of the pocket instead of the center to change the cue ball path.'],
  ['Chip tournament', 'A format where each player starts with chips, loses one with each loss, and is out when the chips are gone. See our <a href="/guides/chip-tournaments">chip tournament guide</a>.'],
  ['Cling', 'Extra friction between two balls (often from bad chalk marks) that makes the object ball go thicker than expected. Also called "skid."'],
  ['Cluster', 'Two or more balls touching or close together, which usually need to be broken apart.'],
  ['Combination', 'A shot where the cue ball hits one object ball into another, which then goes in.'],
  ['Cut shot', 'A shot where the object ball is hit at an angle, off center.'],
  ['Dead ball', 'A shot or combination that cannot miss if hit correctly.'],
  ['Deflection (squirt)', 'The cue ball pushing off the aiming line when you hit it with side spin. Low-deflection shafts reduce it.'],
  ['Diamond', 'The markers on the rails, used for aiming kicks and banks and for describing positions.'],
  ['Double elimination', 'A bracket where a player is out only after two losses. See our <a href="/guides/double-elimination-brackets">bracket guide</a>.'],
  ['Double hit', 'A foul where the cue tip touches the cue ball twice on one stroke, common when the cue ball is very close to an object ball.'],
  ['Draw', 'Backspin. Hitting the cue ball below center so it comes back after contact.'],
  ['Dry break', 'A break that does not make a ball.'],
  ['English', 'Side spin, from hitting the cue ball left or right of center.'],
  ['FargoRate', 'A rating system for pool players. A 100-point gap means the stronger player wins about two games for every one. See our <a href="/guides/fargo-ratings-handicaps">Fargo guide</a>.'],
  ['Follow', 'Topspin. Hitting the cue ball above center so it rolls forward after contact.'],
  ['Foot spot', 'The spot where the front ball of the rack sits, two diamonds from the foot rail.'],
  ['Foul', 'A rule break such as scratching, hitting the wrong ball first, or no rail after contact. It usually gives the opponent ball in hand.'],
  ['Frozen', 'A ball touching another ball or a cushion.'],
  ['Ghost ball', 'The imaginary ball where the cue ball needs to be at contact to pocket the object ball. Also a practice game: "playing the ghost."'],
  ['Greens fee', 'Money from each entry kept by the room for table time, separate from the prize fund.'],
  ['Hanger', 'A ball sitting in the jaws of a pocket, easy to make.'],
  ['Head string', 'The imaginary line two diamonds from the head rail. The cue ball is placed behind it for the break.'],
  ['Hill', 'Needing one more game to win the match. "Hill-hill" means both players need one game.'],
  ['House cue', 'A cue that belongs to the room, usually on the wall rack.'],
  ['Jump shot', 'Hitting down on the cue ball so it hops over a blocking ball. Usually done with a short jump cue.'],
  ['Kick shot', 'A shot where the cue ball hits a cushion before the object ball.'],
  ['Kiss', 'When a ball touches another ball on its way, often changing its path.'],
  ['Lag', 'Both players shoot a ball up and back the length of the table; the one closest to the head rail chooses who breaks.'],
  ['Masse', 'A shot with an elevated cue and heavy spin that curves the cue ball around a blocker.'],
  ['Miscue', 'When the tip slips off the cue ball, often from too little chalk or hitting too far from center.'],
  ['Nine-ball', 'A rotation game where the lowest-numbered ball must be hit first and the 9 wins. See our <a href="/guides/9-ball-rules">9-Ball rules</a>.'],
  ['Nit', 'A player who will only play when they are sure to have the advantage.'],
  ['Object ball', 'Any ball other than the cue ball.'],
  ['One Pocket', 'A game where each player has one pocket and needs eight balls. See our <a href="/guides/one-pocket">One Pocket guide</a>.'],
  ['Open table', 'In 8-Ball, the time after the break before groups are chosen.'],
  ['Position', 'Where the cue ball ends up for the next shot. "Playing position" means controlling it.'],
  ['Push out', 'In 9-Ball and 10-Ball, a special shot right after the break where the shooter can move the cue ball without hitting the lowest ball. The opponent picks who shoots next.'],
  ['Race', 'The number of games needed to win a match, as in "race to 5." Handicaps change the race for each player.'],
  ['Rack', 'The triangle or template used to set up the balls, and the set of balls in one game.'],
  ['Rail', 'The cushion around the edge of the table. "Rail first" means hitting the cushion before a ball.'],
  ['Rail bird', 'A spectator, especially one who watches money games.'],
  ['Rotation', 'Any game where balls must be hit in number order, such as 9-Ball and 10-Ball.'],
  ['Run out', 'Making all the remaining balls in one turn to win the game.'],
  ['Safety', 'A defensive shot meant to leave the opponent with no good shot.'],
  ['Scotch doubles', 'A team game where two partners take turns shooting. See our <a href="/guides/scotch-doubles">Scotch Doubles guide</a>.'],
  ['Scratch', 'When the cue ball goes in a pocket or off the table. It is a foul.'],
  ['Shark', 'Distracting an opponent on purpose, or a strong player who hides their skill.'],
  ['Slop', 'Balls that go in by accident. Some games count them, others do not.'],
  ['Snooker (snookered)', 'Being left with no direct path from the cue ball to the ball you must hit.'],
  ['Speed', 'How hard a player hits the ball, and also slang for how good a player really is ("I don\'t know his speed").'],
  ['Spot', 'A handicap. In money games, a stronger player "gives a spot," such as the 8-ball or extra games.'],
  ['Stake', 'Money put up to back a player in a match or tournament in return for a share of winnings.'],
  ['Stop shot', 'Hitting the cue ball so it stops dead where it hits a straight-in object ball.'],
  ['Stroke', 'The motion of the cue. "A good stroke" means a smooth, straight delivery.'],
  ['Ten-ball', 'A call-shot rotation game with 10 balls. See our <a href="/guides/10-ball-rules">10-Ball rules</a>.'],
  ['Three-foul rule', 'In many games, three fouls in a row by the same player lose the game.'],
  ['Throw', 'The object ball being pushed slightly off line by friction at contact, especially on cut shots and with side spin.'],
  ['Tip', 'The leather piece on the end of the cue that hits the cue ball.'],
  ['True double', 'A double-elimination final where the losers-side player must win twice. See our <a href="/guides/double-elimination-brackets">bracket guide</a>.'],
  ['Wing ball', 'The balls at the side corners of the rack. In 9-Ball, a wing ball often goes in on a good break.'],
];
const glossaryBody = () => {
  const letters = [...new Set(TERMS.map(([t]) => t[0].toUpperCase()))];
  const groups = letters.map(L => `<h3 id="letter-${L.toLowerCase()}">${L}</h3><dl>${TERMS.filter(([t]) => t[0].toUpperCase() === L).map(([t, d]) => `<dt id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}">${t}</dt><dd>${d}</dd>`).join('')}</dl>`).join('');
  return `
<p>Pool has its own language, and you will hear most of it at your first tournament. Here are ${TERMS.length} common pool and billiards terms, in plain English.</p>
<p class="glossary-az">${letters.map(L => `<a href="#letter-${L.toLowerCase()}">${L}</a>`).join('')}</p>
${groups}
<p style="margin-top:20px">Know the words, now learn the games: <a href="/guides/8-ball-rules">8-Ball</a>, <a href="/guides/9-ball-rules">9-Ball</a> and <a href="/guides/10-ball-rules">10-Ball</a> rules, or read <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`;
};

export const MORE_GUIDES = [
  {
    slug: 'pool-cue-care', title: 'Pool Cue Care: Tips, Chalk, Shafts and Cases',
    desc: 'Keep your cue playing like new: shaping and scuffing the tip, chalking the right way, cleaning the shaft, avoiding warps, and when to replace a tip.',
    body: `
<p>A cue that is cared for plays the same every time. Most cue problems come from a worn tip, a dirty shaft or a cue left somewhere hot or damp. A few minutes of care now and then fixes nearly all of them.</p>
<h2>The tip</h2>
<ul>
<li><b>Shape:</b> a tip should be rounded, about the curve of a nickel or a dime. A flat tip miscues more on off-center hits. Use a tip shaper and work it lightly from the edges toward the middle.</li>
<li><b>Scuff:</b> a tip that has gone shiny and hard won't hold chalk. Roughen the surface lightly with a tip tool. Don't overdo it; scuffing wears the tip down.</li>
<li><b>Mushrooming:</b> when the tip spreads wider than the ferrule, trim the edges with a sharp blade or a tip trimmer, or have a cue repair shop do it.</li>
<li><b>Replace it</b> when it gets thin (a few millimeters), cracks, separates from the ferrule, or won't hold a shape. Many pool rooms and cue shops replace tips for a small fee.</li>
</ul>
<h2>Chalk</h2>
<ul>
<li>Chalk before nearly every shot, and always before shots with spin or draw.</li>
<li><b>Brush the chalk on</b> with light strokes, turning the cube. Don't screw the tip into the chalk; that leaves a bare spot in the middle.</li>
<li>Check the tip: it should be evenly covered with a thin layer, with no bare patches.</li>
<li>Don't put chalk face-down on the rail where it will smear the cloth.</li>
</ul>
<h2>The shaft</h2>
<ul>
<li>Wipe the shaft with a clean, dry cloth after you play to remove chalk and hand oils.</li>
<li>For a deeper clean, a slightly damp cloth (not wet), then dry it right away. Wood swells with water.</li>
<li>A shaft burnisher or a piece of leather can smooth the wood. Avoid sandpaper unless you know what you are doing; it removes wood and changes the taper.</li>
<li>If your hand sticks to the shaft, wipe it clean or use a glove rather than powder, which ends up everywhere.</li>
</ul>
<h2>Storage and travel</h2>
<ul>
<li><b>Use a case.</b> Even a simple soft case protects against dings.</li>
<li><b>Never leave a cue in a hot car</b> or a damp basement. Heat and humidity are the main causes of warping.</li>
<li>Store it upright in a rack or flat in a case, not leaning in a corner.</li>
<li>Screw the joint together by hand, snug but not forced. Keep the joint and pin clean.</li>
</ul>
<h2>Is my cue warped?</h2>
<p>Roll the assembled cue on a flat table, or look down it like a rifle while you turn it. A small wobble in the shaft is common and often doesn't matter; a big one does. A cue repair shop can tell you whether it can be straightened.</p>
<p>Shopping for a new one? Read <a href="/guides/how-to-choose-a-pool-cue">how to choose a pool cue</a>.</p>`
  },
  {
    slug: 'money-game-spots', title: 'Spots in Pool Money Games: The Breaks, the 8, Games on the Wire',
    desc: 'How handicaps work in pool money games: giving the breaks, the 8-ball or the 7, games on the wire, races and sets, and how to make a fair game.',
    body: `
<p>When two players of different skill play for money, the stronger player usually gives a <b>spot</b>, a handicap that makes the game closer to even. Knowing the common spots helps you agree to a fair game, and keeps you from accepting a bad one.</p>
<h2>Common spots</h2>
<ul>
<li><b>The breaks:</b> the weaker player breaks every rack instead of alternating or winner breaking. In 9-Ball and 10-Ball, that is a big spot.</li>
<li><b>The 8-ball (in 9-Ball):</b> the weaker player also wins the game by legally making the 8. "The 7 and 8" or "the 7-8-9" give even more ways to win.</li>
<li><b>Games on the wire:</b> the weaker player starts with games already counted. "Race to 7, two on the wire" means they only need 5 more.</li>
<li><b>A shorter race:</b> "7 to 5" means the stronger player needs 7 games and the weaker player needs 5.</li>
<li><b>In One Pocket:</b> a ball count spot, such as 8 to 6, where the weaker player needs fewer balls to win.</li>
<li><b>In 8-Ball:</b> sometimes the weaker player gets ball in hand after the break, or the "last two" (the stronger player must run the last two balls and the 8 in one turn).</li>
</ul>
<h2>Races and sets</h2>
<p>Money games are usually played as a race (first to a number of games) or by sets, such as "race to 5 for $50, best of three sets." Agree on the format, the spot, who breaks the first rack and the rules before anyone puts money up. Short races favor the underdog; long races favor the stronger player.</p>
<h2>Finding a fair spot</h2>
<p>Ratings make it easier. With two FargoRate ratings you can work out a fair race in seconds with our <a href="/tools/fargo-race-calculator">Fargo race calculator</a>, or see the whole <a href="/guides/fargo-rating-chart">Fargo rating chart</a>. Without ratings, ask around: in most rooms, everyone knows everyone's "speed."</p>
<h2>Etiquette for money games</h2>
<ul>
<li>Agree on everything before the first break, and say it out loud.</li>
<li>Many players put the money up with a trusted third person, or on the light over the table, so there's no question after the match.</li>
<li>Pay right away when you lose. Your reputation is worth more than any one game.</li>
<li>Play within your budget. A game you can't afford to lose is a game you'll play badly.</li>
</ul>
<p>Looking for a game? See the <a href="/money-matches/">money matches</a> board and the <a href="/matches">match finder</a>, and learn the lingo in the <a href="/guides/pool-terms-glossary">pool glossary</a>.</p>`
  },
  {
    slug: 'how-to-rack-pool-balls', title: 'How to Rack Pool Balls: 8-Ball, 9-Ball and 10-Ball (With Diagrams)',
    desc: 'How to rack for 8-Ball, 9-Ball and 10-Ball: where each ball goes, how to get a tight rack, and the racking rules used in most tournaments.',
    body: `
<p>A good rack is tight, in the right place and set up correctly for the game. A loose rack spreads badly no matter how hard the breaker hits it. Here is how to rack each of the common games.</p>
<h2>Where the rack goes</h2>
<p>The front ball (the "apex" or "head ball") sits on the <b>foot spot</b>: the spot two diamonds from the foot rail, in the middle of the table. The rest of the rack points toward the foot rail, square to the table.</p>
<h2>8-Ball</h2>
${table({ balls: rack([[1], [9, 2], [3, 8, 10], [11, 4, 12, 5], [6, 13, 7, 14, 15]]) }, '8-Ball: the 8 in the middle of the third row, a solid and a stripe in the two back corners.')}
<ul>
<li>Use the triangle with all 15 balls.</li>
<li>The <b>8-ball goes in the center</b> of the third row.</li>
<li>The two <b>back corners</b> hold one solid and one stripe.</li>
<li>Mix the rest; many rules ask that solids and stripes alternate around the outside as much as possible.</li>
</ul>
<h2>9-Ball</h2>
${table({ balls: rack([[1], [2, 3], [4, 9, 5], [6, 7], [8]]) }, '9-Ball: a diamond with the 1 in front and the 9 in the middle.')}
<ul>
<li>Use 9 balls in a <b>diamond shape</b> (use the triangle and leave it empty at the back, or use a diamond rack).</li>
<li>The <b>1-ball goes in front</b> on the foot spot, and the <b>9-ball goes in the middle</b>.</li>
<li>The other balls can go anywhere.</li>
</ul>
<h2>10-Ball</h2>
${table({ balls: rack([[1], [2, 3], [4, 10, 5], [6, 7, 8, 9]]) }, '10-Ball: the 1 in front and the 10 in the middle of the third row.')}
<ul>
<li>Use the triangle with 10 balls (the first four rows).</li>
<li>The <b>1-ball goes in front</b> on the foot spot, and the <b>10-ball goes in the middle</b> of the third row.</li>
<li>The other balls can go anywhere.</li>
</ul>
<h2>How to get a tight rack</h2>
<ol>
<li>Put the balls in the triangle and slide it so the front ball sits on the foot spot.</li>
<li>Push the balls forward toward the front of the triangle with your fingers, so the front balls press together.</li>
<li>Hold the balls in place and lift the triangle straight up slowly, without bumping them.</li>
<li>Look from the side and the front: every ball should touch its neighbors. If you see gaps, rack again.</li>
</ol>
<p>On worn tables, balls sit in little dents around the spot and won't freeze together. Rolling the rack slightly back and forth or tapping the balls in place can help. Many tournaments now use a thin <b>template rack</b> (a plastic sheet with holes) that holds the balls frozen and stays under them for the break.</p>
<h2>Who racks?</h2>
<p>It depends on the event: in some, the loser of the last game racks; in others, players rack their own or the opponent always racks. Some events use "rack your own" with a template. If you rack for your opponent, rack well. It is part of <a href="/guides/pool-tournament-etiquette">tournament etiquette</a>, and a fair rack is something every opponent can ask to see.</p>
<p>Now break it: read <a href="/guides/how-to-break-in-pool">how to break in 8-Ball, 9-Ball and 10-Ball</a>.</p>`
  },
  {
    slug: 'pool-basics-for-beginners', title: 'Pool for Beginners: Stance, Bridge, Grip and Stroke',
    desc: 'Start playing pool the right way: how to stand, how to make a bridge, how to hold the cue, and how to make a smooth, straight stroke. Plus a simple first practice plan.',
    body: `
<p>Most of what makes a good pool player is a simple, repeatable set of basics. Getting them right early saves months of bad habits. Here is the whole foundation, in plain English.</p>
<h2>Stance</h2>
<ul>
<li>Stand behind the shot and step into it along the line, so your body is lined up before you bend down.</li>
<li>For a right-handed player, the right foot is roughly on the line of the shot and the left foot is forward and to the left. Feet about shoulder-width apart.</li>
<li>Bend at the waist and bring your chin down close to the cue, over the line. How low is up to you; lower makes aiming easier, but stay comfortable.</li>
<li>Stay balanced: you should be able to hold your stance without leaning on the table.</li>
</ul>
<h2>Bridge</h2>
<p>The bridge is your front hand. It has to hold the cue steady and let it slide straight.</p>
<ul>
<li><b>Open bridge:</b> lay your hand flat on the cloth, raise the knuckles slightly and rest the cue in the V between your thumb and the base of your first finger. Easy and stable; good for beginners.</li>
<li><b>Closed bridge:</b> curl your first finger over the cue to make a loop. More control on firm shots.</li>
<li>Keep the bridge about 6 to 9 inches from the cue ball on normal shots.</li>
<li>Rail bridge: when the cue ball is near the cushion, rest the cue on the rail and guide it with your fingers.</li>
</ul>
<h2>Grip</h2>
<p>Hold the cue loosely with your back hand, near the balance point or a little behind it, with your thumb and first two fingers doing most of the work. A tight grip makes the cue steer off line. At the moment of contact, your forearm should hang about straight down from the elbow.</p>
<h2>Stroke</h2>
<ul>
<li>Only your forearm should move, swinging from the elbow like a pendulum. Keep your shoulder and head still.</li>
<li>Take a few smooth practice strokes, pause briefly at the back, then stroke through.</li>
<li><b>Follow through</b> past where the cue ball was, and <b>stay down</b> until the ball is well on its way. Jumping up is the most common reason beginners miss.</li>
</ul>
<h2>Where to look</h2>
<p>During your practice strokes, your eyes go back and forth between the cue ball and the spot you are aiming at on the object ball. On the final stroke, most players look at the object ball. Learn how to pick the aim point in <a href="/guides/how-to-aim-in-pool">how to aim in pool</a>.</p>
<h2>Your first practice plan</h2>
<ol>
<li><b>Straight-in shots</b> (10 minutes): an object ball a diamond from a corner pocket and the cue ball straight behind it. Make ten in a row.</li>
<li><b>Stop shots</b> (10 minutes): same shot, but make the cue ball stop dead. See the <a href="/guides/pool-practice-drills">stop-shot ladder</a>.</li>
<li><b>Easy cuts</b> (10 minutes): move the cue ball off to the side for gentle cut shots.</li>
<li><b>Play a rack</b>: 8-Ball against a friend or the "ghost."</li>
</ol>
<p>Practice your eye between sessions with the <a href="/play/aim-trainer">aim trainer game</a>, learn the <a href="/guides/pool-terms-glossary">pool terms</a>, and when you are ready, read <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
  {
    slug: 'cutthroat-pool-rules', title: 'Cutthroat Pool Rules: The Best Game for Three Players',
    desc: 'How to play cutthroat pool with three players: choosing groups, the goal of sinking your opponents\' balls, fouls, and how to win.',
    body: `
<p>Cutthroat is the classic pool game for three players (it also works for five). Instead of making your own balls, you try to <b>sink everyone else's</b>. The last player with a ball left on the table wins. It is fast, a little ruthless, and great for a group.</p>
<h2>The groups</h2>
<ul>
<li>Use all 15 balls, racked in the triangle with the 1-ball at the front.</li>
<li>Three groups: <b>1 to 5</b>, <b>6 to 10</b> and <b>11 to 15</b>.</li>
<li>With five players, use five groups of three: 1–3, 4–6, 7–9, 10–12 and 13–15.</li>
</ul>
<h2>How groups are chosen</h2>
<p>Many players use this simple rule: the first player to legally pocket a ball after the break picks their group, or gets that ball's group, and the others follow in turn. Other games assign groups by shooting order before the break. Agree on it before you start.</p>
<h2>How to play</h2>
<ul>
<li>Players shoot in a fixed order. You keep shooting as long as you legally pocket an opponent's ball.</li>
<li>If you pocket one of your <b>own</b> balls, it stays down and your turn ends (in most house rules).</li>
<li>When all of a player's balls are pocketed, that player is out.</li>
<li>The last player with any ball left on the table wins.</li>
</ul>
<h2>Fouls</h2>
<p>A common rule: when you scratch or foul, <b>each opponent gets one of their pocketed balls back</b> on the table (spotted on the foot spot). That rewards the players who are behind. Some groups also give the next player ball in hand. Again, agree before the break.</p>
<h2>Strategy</h2>
<ul>
<li><b>Pick on the leader.</b> Sink the balls of the player with the most left, so the others don't gang up on you.</li>
<li><b>Hide your own balls.</b> Leave them near rails and away from pockets, and use safeties to protect them.</li>
<li><b>Count before you shoot.</b> Making the last ball of a player who is almost out can turn the game into a duel you might not want.</li>
</ul>
<p>Cutthroat is a fun way to practice runouts and safeties. When you are ready for something more serious, learn <a href="/guides/9-ball-rules">9-Ball</a> or <a href="/guides/one-pocket">One Pocket</a>.</p>`
  },
  {
    slug: 'bar-rules-vs-tournament-rules', title: 'Bar Rules vs. Tournament Rules: What Changes in 8-Ball',
    desc: 'The most common differences between bar (house) 8-Ball rules and tournament rules: scratches, calling shots, the 8 on the break, slop and more.',
    body: `
<p>If you learned 8-Ball in a bar or at home, some tournament rules will surprise you. Neither one is "wrong": bar rules are local custom, and tournament rules are written down so everyone plays the same game. Here are the differences that come up most.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Situation</th><th>Common bar rules</th><th>Most tournament rules</th></tr></thead><tbody>
<tr><td>Cue ball scratch</td><td>Behind the head string ("in the kitchen")</td><td>Ball in hand anywhere on the table</td></tr>
<tr><td>Calling shots</td><td>Often only the 8 is called</td><td>Call ball and pocket on every non-obvious shot</td></tr>
<tr><td>Balls made by luck ("slop")</td><td>Often count</td><td>Only count if the called ball went in the called pocket</td></tr>
<tr><td>8-ball on the break</td><td>Often a win</td><td>Depends on the event: a win, a re-rack or spotted; check</td></tr>
<tr><td>Scratch on the 8</td><td>Loss</td><td>Loss</td></tr>
<tr><td>Calling the 8-ball pocket</td><td>Sometimes "mark the pocket" with chalk or a coaster</td><td>Call it out loud or mark it, as the event says</td></tr>
<tr><td>Hitting the wrong group first</td><td>Sometimes just loss of turn</td><td>Foul, ball in hand</td></tr>
<tr><td>No rail after contact</td><td>Often not called</td><td>Foul, ball in hand</td></tr>
</tbody></table></div>
<h2>Why tournaments use ball in hand anywhere</h2>
<p>Ball in hand anywhere makes every foul costly, which rewards careful play and safeties. It also removes arguments about what was and wasn't a foul in the kitchen.</p>
<h2>Before your first tournament</h2>
<ul>
<li>Ask which rule set the event uses. Many weekly events post their rules on the wall or on the flyer.</li>
<li>Ask about the 8 on the break, and whether you must call the 8 pocket out loud.</li>
<li>If something is unclear during a match, stop and ask the director before the shot, not after.</li>
</ul>
<p>Read the full <a href="/guides/8-ball-rules">8-Ball rules guide</a>, test yourself with the <a href="/tools/pool-rules-quiz">rules quiz</a>, and see <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
  {
    slug: 'how-to-aim-in-pool', title: 'How to Aim in Pool: Ghost Ball, Contact Points and Cut Angles',
    desc: 'Learn to aim pool shots: the ghost ball method, fractional aiming (full, 3/4, 1/2, 1/4 ball), why thin cuts are hard, and how to fix missing thick or thin.',
    body: `
<p>Aiming is the first thing every player struggles with, and there is no magic trick. But there is a simple picture that makes every cut shot make sense, and a few reference angles that make it faster. Learn these, then train your eye with our <a href="/play/aim-trainer">aim trainer game</a>.</p>
<h2>The ghost ball</h2>
<p>Draw an imaginary line from the center of the pocket through the center of the object ball and out the other side. The spot on that line, one ball-width behind the object ball, is where the <b>center of the cue ball</b> needs to be at the moment of contact. Players call the imaginary ball sitting there the ghost ball.</p>
${table({ balls: [{ x: 6.2, y: 1.3, n: 1 }, { x: 5.96, y: 1.48, n: 'g' }, { x: 3.2, y: 2.6, n: 0 }], paths: [[[3.2, 2.6], [5.85, 1.52]], { pts: [[6.2, 1.3], [7.86, 0.12]], color: '#ffd54a' }] }, 'Aim the cue ball at the ghost ball (dashed circle), not at the object ball.')}
<p>So you aim the cue ball at the ghost ball, not at the object ball. On a straight-in shot the ghost ball is right behind the object ball, and you aim at its center. The more the shot is cut, the farther your aim moves away from the object ball.</p>
<h2>Contact point</h2>
<p>Another way to see the same thing: the <b>contact point</b> is the spot on the object ball farthest from the pocket. The cue ball has to touch exactly there. Some players find it easier to look at the contact point; others see the ghost ball. Both give the same aim. Use whichever one your eye trusts.</p>
<h2>Fractional aiming: four reference shots</h2>
<p>Many players learn a few fixed "overlaps" between the cue ball and object ball, and the cut angle each one makes:</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Aim (cue ball center at…)</th><th>Hit</th><th>Cut angle</th></tr></thead><tbody>
<tr><td>Center of the object ball</td><td>Full ball</td><td>0° (straight in)</td></tr>
<tr><td>Halfway between center and edge</td><td>3/4 ball</td><td>about 15°</td></tr>
<tr><td>The edge of the object ball</td><td>1/2 ball</td><td>30°</td></tr>
<tr><td>Halfway outside the edge</td><td>1/4 ball</td><td>about 49°</td></tr>
<tr><td>Just grazing the edge</td><td>Very thin</td><td>close to 90°</td></tr>
</tbody></table></div>
<p>The half-ball hit is the most useful one to memorize: aim the center of the cue ball at the edge of the object ball and the object ball leaves at 30 degrees. Shots between the references are "a bit fuller than half ball" and so on.</p>
<h2>Why thin cuts are so hard</h2>
<p>On a straight-in shot, a small aiming error barely changes where the object ball goes. On a thin cut, the same error is multiplied several times. That is why good players avoid leaving themselves thin cuts, and why the <a href="/play/aim-trainer">aim trainer</a> gets harder as the angle grows.</p>
<h2>Fixing "thick" and "thin" misses</h2>
<ul>
<li><b>Missing thick</b> means you hit the object ball too full, so it didn't cut enough. Aim farther outside the object ball.</li>
<li><b>Missing thin</b> means you over-cut it, so it went past the pocket on the other side. Aim a touch fuller.</li>
<li><b>Slow cut shots go a little thicker</b> than the geometry says because of friction between the balls, called throw. On slow, thin cuts, aim a hair thinner. See the <a href="/trick-shots/throw-shot">throw shot</a>.</li>
<li><b>Side spin moves the cue ball off line.</b> Learn to aim with a center hit first. See <a href="/guides/english-in-pool">English explained</a>.</li>
</ul>
<h2>A simple routine that helps</h2>
<ol>
<li>Stand behind the shot and find the line from the pocket through the object ball.</li>
<li>Pick the ghost ball (or contact point) while you are standing, not once you are down.</li>
<li>Walk into the shot along the aiming line and get down on it.</li>
<li>Take a couple of smooth practice strokes, pause, and stroke through.</li>
</ol>
<p>Practice it: <a href="/play/aim-trainer">play the aim trainer</a>, then take the <a href="/guides/pool-practice-drills">practice drills</a> to the table.</p>`
  },
  {
    slug: 'english-in-pool', title: 'English in Pool Explained: Follow, Draw, Stun and Side Spin',
    desc: 'How cue ball spin works: follow, draw and stun, side spin off the rails, and why English makes the cue ball squirt and swerve. Plus when not to use it.',
    body: `
<p>"English" is side spin, but most players use the word for any spin on the cue ball. Spin is how good players control where the cue ball goes after the shot. It also causes a lot of misses, so it helps to know what it really does.</p>
<h2>The cue ball's face</h2>
<p>Picture the cue ball as a clock face. Hitting above center (12 o'clock) puts on <b>follow</b>. Below center (6 o'clock) puts on <b>draw</b>. Left and right (9 and 3 o'clock) put on <b>side spin</b>. Most shots only need about one tip of offset from center; more than that risks a miscue.</p>
<h2>Follow, draw and stun</h2>
<ul>
<li><b>Follow (topspin):</b> after hitting the object ball, the cue ball keeps rolling forward. On a straight-in shot, it follows the object ball toward the pocket.</li>
<li><b>Draw (backspin):</b> the cue ball comes back toward you after contact. The farther the cue ball has to travel to the object ball, the more draw you need, because the cloth wears the backspin off.</li>
<li><b>Stun (stop):</b> a center or slightly-low hit that makes the cue ball slide, with no spin, at contact. On a straight-in shot it stops dead. On a cut, it leaves at 90 degrees to the object ball's path (see the <a href="/trick-shots/ninety-degree-carom">90-degree carom</a>).</li>
</ul>
<p>On cut shots, follow bends the cue ball forward of the 90-degree line, and draw bends it back. That is the main tool for position play.</p>
<h2>Side spin off the rails</h2>
<p>Side spin mostly matters when the cue ball hits a cushion. <b>Running English</b> (spin in the direction the ball is going along the rail) makes the cue ball come off the rail longer and faster. <b>Reverse English</b> (the other side) makes it come off shorter and slower, or even straight back. Players use side spin to open up angles off the rail that a center hit can't reach.</p>
<h2>The catch: squirt and swerve</h2>
<p>Side spin changes the cue ball's path even before it hits anything:</p>
<ul>
<li><b>Squirt (deflection):</b> hit the right side and the cue ball pushes slightly to the left of where you aimed. Low-deflection shafts reduce this.</li>
<li><b>Swerve:</b> because the cue is never perfectly level, side spin makes the cue ball curve back the other way as it travels. It grows with distance and slower speed.</li>
<li><b>Throw:</b> side spin can also push the object ball a little off line at contact.</li>
</ul>
<p>Squirt and swerve partly cancel at some speeds and distances, which is why players learn to "feel" English rather than calculate it.</p>
<h2>When not to use English</h2>
<p>If you can get position with a center-ball hit and the right speed, do that. Side spin adds risk to every shot. The best players use the least spin they can.</p>
<h2>Practice</h2>
<ul>
<li>Stop shots from straight-in, at growing distance (the <a href="/guides/pool-practice-drills">stop-shot ladder</a>).</li>
<li>Draw and follow on the same shot to see how far each one sends the cue ball.</li>
<li>One-rail kicks with left, center and right spin to see how much the angle changes.</li>
</ul>
<p>Then try the <a href="/trick-shots/power-draw">power draw</a> and, if your room allows it, the <a href="/trick-shots/masse-curve">massé</a>.</p>`
  },
  {
    slug: 'safety-play-in-pool', title: 'Safety Play in Pool: How to Win Without Making a Ball',
    desc: 'Pool safety basics: when to play safe, the main types of safeties, two-way shots, the rules every safety must follow, and simple safeties anyone can learn.',
    body: `
<p>A safety is a shot where your goal is not to make a ball, but to leave your opponent with no good shot. Strong players often win more games with safeties than with runouts. You don't need to be a great shot-maker to play good safeties; you need to know a few patterns.</p>
<h2>The rules every safety must follow</h2>
<p>A safety is still a normal shot. In most games you must hit the correct ball first, and then a ball must go in a pocket or <b>some ball must hit a rail</b> after contact. If you just roll the cue ball up behind a ball and nothing hits a rail, it is a foul. In 8-Ball and 10-Ball you may also need to call "safety" before the shot; ask how your event plays it.</p>
<h2>When to play safe</h2>
<ul>
<li>The shot you have is hard <b>and</b> a miss would leave your opponent an easy out.</li>
<li>You can't get from the ball you are shooting to the next one.</li>
<li>Your opponent is a much stronger shot-maker than you.</li>
<li>In 8-Ball, your opponent has trouble balls and you have a chance to lock them up.</li>
</ul>
<h2>The main kinds of safety</h2>
<ul>
<li><b>Hide the cue ball.</b> Put the cue ball behind another ball so your opponent can't see the ball they need to hit (a "snooker").</li>
<li><b>Distance.</b> Leave the cue ball and the object ball at opposite ends of the table, ideally with one of them on a rail. Long shots are hard to make, and harder to make with position.</li>
<li><b>Freeze to a rail.</b> A cue ball frozen on the rail is hard to cue and hard to control.</li>
<li><b>Two-way shot.</b> Try the shot, but with a speed that leaves your opponent safe if you miss. This is the best option when it is available.</li>
</ul>
<h2>Three safeties anyone can learn</h2>
<ol>
<li><b>Thin cut to the far rail.</b> Barely clip the object ball so it goes to a rail, and send the cue ball the length of the table.</li>
<li><b>Stop behind a ball.</b> When a blocker is near the object ball, hit the object ball softly to a rail and stop the cue ball behind the blocker.</li>
<li><b>Roll up in 8-Ball.</b> Push the cue ball gently behind one of your balls so it blocks your opponent's shot, while a ball still reaches a rail.</li>
</ol>
<h2>Kicking out of safeties</h2>
<p>Once you start playing safeties, your opponent will too. Learn one-rail kicks using the diamonds: they are the best answer to a good safety. The <a href="/guides/pool-practice-drills">kick drill</a> is a great place to start.</p>
<p>Next: learn to plan your runs with <a href="/guides/8-ball-patterns">8-Ball pattern play</a>, or try a <a href="/guides/one-pocket">game of One Pocket</a>, where almost every shot is part offense, part safety.</p>`
  },
  {
    slug: '8-ball-patterns', title: '8-Ball Strategy: How to Plan a Runout',
    desc: 'How to run out in 8-Ball: read the table first, pick the right group, find your key ball, break up clusters early and keep insurance balls near pockets.',
    body: `
<p>Most 8-Ball games are lost by players who could make the balls but didn't plan. The good news: a little planning before your first shot wins more games than any amount of extra shot-making.</p>
<h2>Step 1: Read the whole table before you shoot</h2>
<p>When the table is open, look at both groups before you choose. Ask for each group: are any balls stuck in clusters or on rails with no pocket? Are any balls blocked from every pocket? Choose the group with the fewest problems, not the one with the easiest first shot.</p>
<h2>Step 2: Work backward from the 8</h2>
<p>Look at where the 8-ball is and which pocket it can go in. Then pick the <b>key ball</b>: the last ball of your group, the one that will give you an easy angle on the 8. Then pick the ball before that. Planning the last two or three balls first keeps you from finishing in a bad spot.</p>
<h2>Step 3: Fix problems early</h2>
<ul>
<li><b>Break out clusters while you still have other balls to shoot.</b> If you wait, you may have to break them up with your last ball and nothing to shoot after.</li>
<li><b>Use a ball near the cluster as a "break-out" ball.</b> Shoot it and let the cue ball carry into the cluster at a soft speed.</li>
<li><b>Move problem balls off the rail</b> with a carom or a soft hit if you can't pocket them yet.</li>
</ul>
<h2>Step 4: Keep insurance balls</h2>
<p>A ball sitting near a pocket is an <b>insurance ball</b>: you can make it from almost anywhere. Don't shoot it early just because it's easy. Save it for when you get out of line.</p>
<h2>Step 5: Use the simplest position</h2>
<p>Choose shots that need the least cue ball movement. Stay on the same side of the table when you can. Plan to land on the correct side of each next ball, so you are never forced to go across it.</p>
<h2>When there is no runout</h2>
<p>If you can't see a way out, don't just shoot and hope. Make the balls you can while you improve your layout, then play a <a href="/guides/safety-play-in-pool">safety</a>. In 8-Ball, leaving your opponent's balls blocked by yours is often worth more than pocketing one more ball.</p>
<h2>A quick checklist</h2>
<ol>
<li>Which group has fewer problems?</li>
<li>Where does the 8 go, and what is my key ball?</li>
<li>Which clusters do I need to break, and with what?</li>
<li>Which ball is my insurance?</li>
<li>If I can't run out, where is my safety?</li>
</ol>
<p>Brush up on the <a href="/guides/8-ball-rules">8-Ball rules</a>, test yourself with the <a href="/tools/pool-rules-quiz">rules quiz</a>, and practice runouts with the <a href="/guides/pool-practice-drills">play-the-ghost drill</a>.</p>`
  },
  {
    slug: 'pool-tournament-nerves', title: 'Beating Tournament Nerves: The Mental Game of Pool',
    desc: 'Why you play worse in tournaments than in practice, and what to do about it: a pre-shot routine, breathing, staying in the present, and handling a bad rack.',
    body: `
<p>Almost every player shoots worse in a tournament than on a practice table. Your arm tightens, you rush, and easy shots look hard. That's normal, and it gets better with a few simple habits.</p>
<h2>Why nerves hurt your game</h2>
<p>Under pressure, your body speeds up: faster breathing, tighter muscles, quicker decisions. In pool that turns into a shorter, jerky stroke and getting up off the shot too soon. The fix is not to "not be nervous." It is to have a routine that works even when you are.</p>
<h2>Build a pre-shot routine</h2>
<ol>
<li>Stand behind the shot. Decide the shot, the spin and the speed while standing.</li>
<li>Commit. If you're unsure, stand up and start again. Never shoot with a doubt.</li>
<li>Step in along the line and get down.</li>
<li>Take the same number of practice strokes every time.</li>
<li>Pause at the back, then stroke through and stay down.</li>
</ol>
<p>Practice the routine on every shot at home, so in a match it runs on its own.</p>
<h2>Breathe out before you shoot</h2>
<p>A slow breath out as you settle into your stance relaxes your grip and shoulder. Many players breathe out during the last practice stroke. It's simple and it works.</p>
<h2>Play the shot in front of you</h2>
<p>Don't think about the score, the payout or who's watching. Think about the next shot: the line, the speed, where the cue ball goes. If your mind jumps ahead, go back to your routine.</p>
<h2>After a bad rack</h2>
<ul>
<li>Sit down, take a drink, and let it go. The next rack doesn't know you just missed.</li>
<li>Look at what went wrong once (wrong plan, bad stroke, bad luck), then move on.</li>
<li>Don't change your whole game mid-match. Trust the stroke you practiced.</li>
</ul>
<h2>Dealing with distractions</h2>
<p>Noise, slow players and the occasional shark are part of tournament pool. If something bothers you, stand up and restart your routine. If an opponent is breaking the rules or sharking on purpose, calmly ask the director. See our guide to <a href="/guides/pool-tournament-etiquette">tournament etiquette</a>.</p>
<h2>Between matches</h2>
<ul>
<li>Stay warm: hit a few balls if there's a practice table, or at least stretch your arm and shoulder.</li>
<li>Eat something light and drink water. Long days add up.</li>
<li>Watch your next opponent if you can, but don't over-think it.</li>
</ul>
<p>The best cure for nerves is experience. <a href="/this-weekend/">Find a tournament this weekend</a> and play as many as you can. Your first ones are covered in <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
  {
    slug: 'fargo-rating-chart', title: 'Fargo Rating Chart: Win Odds by Rating Difference',
    desc: 'How often does a higher-rated player win? A chart of game and match win chances by Fargo rating difference, plus fair handicap races and what ratings mean.',
    body: `
<p>FargoRate is built on one simple rule: <b>a 100-point rating gap means the stronger player wins about two games for every one</b> the weaker player wins. From that rule you can work out how often the better player wins a game, a race to 5 or a race to 9. Here are the numbers.</p>
<h2>Win chances by rating difference</h2>
<p>"Gap" is the higher rating minus the lower rating. Percentages are the stronger player's chance to win, in even races with no handicap.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Gap</th><th>One game</th><th>Race to 5</th><th>Race to 7</th><th>Race to 9</th></tr></thead><tbody>${fargoRows()}</tbody></table></div>
<p>Notice how fast the odds grow in longer races. A 100-point favorite wins two out of three single games, but most of the time over a race to 9. That is why short races are kinder to underdogs, and why handicapped events give the weaker player fewer games to win.</p>
<h2>Fair handicap races</h2>
<p>To make a match roughly even, the stronger player has to win more games. These are the races that come closest to 50/50 for each rating gap, given how many games the lower-rated player needs.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Gap</th><th>Lower player to 3</th><th>Lower player to 4</th><th>Lower player to 5</th></tr></thead><tbody>${raceRows()}</tbody></table></div>
<p>Read "6 to 3" as: the stronger player races to 6, the weaker player races to 3. For any two exact ratings, use the <a href="/tools/fargo-race-calculator">Fargo race calculator</a>.</p>
<h2>What do Fargo ratings mean?</h2>
<p>These are rough descriptions that many players use. A rating only measures results, so treat them as a guide, not a label.</p>
<ul>
<li><b>Below 400:</b> newer players still learning to make balls and avoid scratches.</li>
<li><b>400 to 500:</b> typical league players who can run a few balls and play some safeties.</li>
<li><b>500 to 600:</b> strong league players who can run out an open 8-ball rack.</li>
<li><b>600 to 700:</b> top local players, regular winners at weekly tournaments.</li>
<li><b>700 to 750:</b> regional stars who contend at bigger events.</li>
<li><b>Above 750:</b> touring professionals; the very best in the world are around 800 and up.</li>
</ul>
<h2>Why the chart is only a starting point</h2>
<ul>
<li><b>Ratings move.</b> A rating is based on past games, and newer players' ratings carry less certainty.</li>
<li><b>The game matters.</b> Some players are much stronger at 8-Ball than 9-Ball, or on a bar box than a 9-foot table.</li>
<li><b>Breaks and formats matter.</b> Winner breaks favor the stronger player more than alternate breaks.</li>
</ul>
<p>More on how handicaps work in our <a href="/guides/fargo-ratings-handicaps">Fargo and handicaps guide</a>. FargoRate is a trademark of its owners; this chart is independent and not affiliated with FargoRate.</p>`
  },
  {
    slug: 'major-pool-events-calendar', title: 'Major Pool Events 2026–2027: The Big Tournaments Every Player Should Know',
    desc: 'The biggest pool events of the 2026–27 season: Mosconi Cup, Derby City Classic, league national championships in Las Vegas, Super Billiards Expo, US Open and more, with dates and who can play.',
    body: `
<p>Most of the pool calendar is weekly tournaments at your local room. But a handful of big events each year bring the whole pool world together, and many of them are open to amateurs. Here is the season ahead, in date order.</p>
<p class="tip"><b>Dates last checked October 2026.</b> Organizers sometimes move events, so confirm on the official site before you book travel. Looking for big events closer to home? See <a href="/big-tournaments/">the biggest upcoming tournaments</a> on our listings.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Dates</th><th>Event</th><th>Where</th><th>Who plays</th></tr></thead><tbody>
<tr><td>Nov 27–30, 2026</td><td>Mosconi Cup</td><td>Orlando, FL</td><td>Team USA vs. Team Europe (pros, by invitation)</td></tr>
<tr><td>Jan 22–31, 2027</td><td>Derby City Classic</td><td>Elizabeth, IN</td><td>Open entry: banks, one pocket, 9-ball</td></tr>
<tr><td>Feb 23 – Mar 6, 2027</td><td>USA Pool League (formerly BCA Pool League) National Championships</td><td>Las Vegas, NV</td><td>League players, plus open events</td></tr>
<tr><td>Apr 15–18, 2027</td><td>Super Billiards Expo</td><td>Oaks, PA (near Philadelphia)</td><td>Amateur and pro events, trade show</td></tr>
<tr><td>Apr 25 – May 1, 2027</td><td>APA Poolplayer Championships</td><td>Las Vegas, NV</td><td>APA league members (qualifiers)</td></tr>
<tr><td>Late spring 2027 (TBA)</td><td>VNEA World Pool Championships</td><td>Las Vegas, NV</td><td>VNEA league players, on bar-box tables</td></tr>
<tr><td>Summer 2027 (TBA)</td><td>APA World Pool Championships</td><td>Las Vegas, NV</td><td>APA teams that qualify locally</td></tr>
<tr><td>Late summer 2027 (TBA)</td><td>US Open Pool Championship</td><td>TBA (2026: Frisco, TX)</td><td>Pros and top amateurs</td></tr>
</tbody></table></div>
<h2>Mosconi Cup</h2>
<p>Pool's version of golf's Ryder Cup: a team of American pros against a team of European pros over four days, in a loud, party-like arena. The 2026 Mosconi Cup is set for <b>November 27–30 at the Caribe Royale in Orlando</b>. You can't enter, but it is the most fun event of the year to watch in person or on TV.</p>
<h2>Derby City Classic</h2>
<p>Held every January near Louisville, Kentucky, the Derby City Classic is a ten-day festival of <a href="/guides/bank-pool-rules">bank pool</a>, <a href="/guides/one-pocket">one pocket</a> and <a href="/guides/9-ball-rules">9-ball</a>. Anyone can enter, so amateurs regularly play the biggest names in the game. Just as famous is the action: money games run around the clock. The 2027 event is <b>January 22–31 at Caesars Southern Indiana</b> in Elizabeth, Indiana.</p>
<h2>League national championships in Las Vegas</h2>
<p>Every big league ends its season in Las Vegas, with hundreds of tables in one ballroom. To play, you usually qualify through your local league during the season.</p>
<ul>
<li><b>USA Pool League National Championships</b> (the former BCA Pool League nationals): <b>February 23 – March 6, 2027</b> at the Westgate Las Vegas. Along with league divisions, there are open events.</li>
<li><b>APA Poolplayer Championships</b>: the APA's individual championships, listed for <b>April 25 – May 1, 2027</b> at the Westgate (dates subject to change).</li>
<li><b>VNEA World Pool Championships</b>: VNEA's week-long event, played on bar-box tables. It is usually in late May; 2027 dates are not yet published.</li>
<li><b>APA World Pool Championships</b>: the APA team championships, usually in August; 2027 dates are listed as to be announced.</li>
</ul>
<p>Not in a league yet? League night is the easiest way into tournament pool. Read <a href="/guides/find-pool-tournaments-near-you">how to find tournaments near you</a>.</p>
<h2>Super Billiards Expo</h2>
<p>A huge show near Philadelphia with a trade floor full of cues, cases and tables, plus amateur and pro tournaments running at the same time. It is one of the friendliest big events for amateurs. The 2027 Expo is <b>April 15–18 at the Greater Philadelphia Expo Center</b> in Oaks, Pennsylvania.</p>
<h2>US Open Pool Championship</h2>
<p>The oldest name in American 9-ball. The 2026 US Open was held August 25–30 in Frisco, Texas, with a $500,000 prize fund. The 2027 dates and venue have not been announced yet.</p>
<h2>Regional tours and opens</h2>
<p>Between the big ones, regional tours run stops nearly every weekend, often with added money and a second-chance event for amateurs. Events like the Turning Stone Classic in Verona, New York, which has run twice a year, draw players from across the Northeast. Our <a href="/big-tournaments/">big tournaments page</a> and <a href="/calendar">calendar</a> track added-money events near you, updated every day.</p>
<h2>Going to a big event?</h2>
<ul>
<li><b>Book rooms early.</b> Event hotels sell out, especially in Las Vegas.</li>
<li><b>Read the rules ahead of time.</b> Big events often use a break box, a shot clock or different 8-ball rules than your league.</li>
<li><b>Bring a backup.</b> A spare tip or shaft, chalk and a glove if you use one.</li>
<li><b>Budget for more than entry fees.</b> Practice table time, food and the Calcutta (read our <a href="/guides/calcutta-auction-explained">Calcutta guide</a>) all add up.</li>
</ul>`
  },
  {
    slug: 'pool-terms-glossary', title: `Pool Terms Glossary: ${TERMS.length} Billiards Words Explained`,
    desc: 'A plain-English glossary of pool and billiards terms: from action, bar box and break and run to throw, true double and wing ball.',
    body: glossaryBody()
  },
  {
    slug: 'pool-practice-drills', title: '7 Pool Practice Drills That Actually Make You Better (With Diagrams)',
    desc: 'Seven pool practice drills with table diagrams: stop shots, the line-up drill, the circle drill, position ladders, kicking and playing the ghost.',
    body: `
<p>Hitting balls around without a plan feels like practice, but it rarely makes you better. These seven drills each train one skill, take 10 to 20 minutes, and give you a score you can try to beat next time. Do two or three in a session and keep a note of your scores.</p>
<p class="tip"><b>Tip:</b> Practice on the same size table you play tournaments on. If your weekly event is on a bar box, practice on a bar box.</p>
<h2>1. The stop-shot ladder</h2>
<p>Put an object ball one diamond from a corner pocket and the cue ball straight behind it, one diamond back. Shoot a stop shot: the cue ball should stop dead where it hit the object ball. Each time you make it with a clean stop, move the cue ball back half a diamond. Miss or let the cue ball roll, and you start again.</p>
${table({ balls: [{ x: 7, y: 1, n: 1 }, { x: 6, y: 2, n: 0 }, { x: 5, y: 3, n: 'g' }], paths: [[[6, 2], [7.85, 0.15]]], labels: [[4.6, 3.55, 'move back']] }, 'Stop-shot ladder: start close, then move the cue ball back after each clean stop.')}
<p><b>Score:</b> how far back you get. Good players can stop the ball from three diamonds or more.</p>
<p>Then do the same thing with <b>draw</b> (bring the cue ball back a diamond) and <b>follow</b> (follow the object ball half a diamond). Clean, straight shots build the stroke everything else depends on.</p>
<h2>2. The line-up drill</h2>
<p>Place 15 balls in a straight line down the long string of the table (the middle of the table, from the head spot to the foot spot). Take ball in hand and run them in any order. You may not touch another ball with the cue ball. If you miss or bump a ball, count how many you made and start over.</p>
${table({ balls: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, i) => ({ x: 1.6 + i * 0.52, y: 2, n })) .concat([{ x: 3, y: 3.2, n: 0 }]) }, 'Line-up drill: balls on the middle line of the table. Run them without bumping the others.')}
<p><b>Score:</b> balls in a row. This is a classic drill because it makes you think two or three balls ahead and play gentle position. Beginners can start with 7 balls.</p>
<h2>3. The circle drill</h2>
<p>Set 8 to 10 balls in a circle about one diamond across around the center spot of the table, with the cue ball in the middle. Pocket every ball without the cue ball touching any other ball and without it leaving the circle area more than you need.</p>
${table({ balls: Array.from({ length: 9 }, (_, i) => ({ x: 4 + 0.95 * Math.cos(i * 2 * Math.PI / 9), y: 2 + 0.95 * Math.sin(i * 2 * Math.PI / 9), n: i + 1 })).concat([{ x: 4, y: 2, n: 0 }]) }, 'Circle drill: run the balls without the cue ball touching the others.')}
<p>This drill teaches soft speed and short-range position, which is exactly what you need in crowded 8-Ball racks.</p>
<h2>4. Position ladder: three balls</h2>
<p>Throw three balls on the table at random and take ball in hand. Run the three in order (lowest number first). If you do it, add a fourth ball next time. If you miss, go back to three.</p>
<p><b>Score:</b> the most balls you run in order. This is a mini 9-Ball rack and teaches you to plan the route, not just the next shot.</p>
<h2>5. The kick drill</h2>
<p>Place an object ball near a corner pocket, frozen on the rail. Put the cue ball where you cannot hit the ball directly (behind another ball or across the table). Kick at it off one rail. Count how many out of ten you hit, and how many you make.</p>
${table({ balls: [{ x: 7.4, y: 0.16, n: 9 }, { x: 2, y: 1, n: 0 }, { x: 4.6, y: 0.62, n: 8 }], paths: [[[2, 1], [4.75, 3.97], [7.3, 0.35]]] }, 'Kick drill: one rail into a ball near the corner. Use the diamonds to find your aim point.')}
<p>Kicks decide a lot of tournament matches, and most players never practice them. Use the diamonds: shooting from a diamond to a diamond on the opposite rail gives you a starting point you can adjust.</p>
<h2>6. Long straight-in shots</h2>
<p>Put an object ball one diamond off the foot rail in line with a corner pocket, and the cue ball on the opposite end, so the shot is the full length of the table. Shoot ten. Then try it with a stop and with draw.</p>
<p><b>Score:</b> out of ten. If you make fewer than six, your stroke is going off line. Slow down, keep your head still, and finish the stroke.</p>
<h2>7. Play the ghost</h2>
<p>Rack 9 balls, break, take ball in hand, and try to run the rack. If you miss anywhere, the "ghost" wins that rack. Play a race to 5 against the ghost. When you can beat the ghost often, play it in 8-Ball or with no ball in hand after the break.</p>
<p>Playing the ghost is honest: it shows exactly how often you can run out. Keep your score from week to week.</p>
<h2>A simple practice plan</h2>
<ul>
<li><b>10 minutes:</b> stop-shot ladder (warm-up and stroke).</li>
<li><b>15 minutes:</b> line-up or circle drill (position).</li>
<li><b>10 minutes:</b> kick drill.</li>
<li><b>15 minutes:</b> play the ghost.</li>
</ul>
<p>Then test it where it counts: <a href="/this-weekend/">find a tournament this weekend</a>, or use the <a href="/tools/fargo-race-calculator">Fargo race calculator</a> to set a fair race with a practice partner.</p>`
  },
  {
    slug: 'chip-tournaments', title: 'Chip Tournaments in Pool: How They Work and How to Run One',
    desc: 'How a pool chip tournament works: chips by skill level, single-game matches, the draw, payouts, and tips for running one at your room.',
    body: `
<p>A chip tournament is a fun, fast format that many pool rooms run as a weekly event. Instead of a bracket, every player gets a number of chips, loses a chip each time they lose a game, and is out when their chips are gone. The last player with chips wins.</p>
<h2>How it works</h2>
<ol>
<li><b>Chips by skill.</b> Each player gets chips based on their skill level. A common setup is 2 chips for the strongest players and 3, 4 or 5 for weaker ones. Some rooms use FargoRate or league ratings to decide; others use the director's judgment.</li>
<li><b>The draw.</b> Names are drawn in a random order, often written on a board or called from a list. The first two names play a single game.</li>
<li><b>One game at a time.</b> Matches are usually one game of 8-Ball or 9-Ball. The loser gives up a chip. The winner goes back to the end of the list and plays again when their name comes up.</li>
<li><b>Out of chips, out of the event.</b> When a player has no chips left, they are eliminated.</li>
<li><b>The end.</b> Play goes on until only a few players are left with chips. Those players finish in the money.</li>
</ol>
<h2>Why players like it</h2>
<ul>
<li><b>Everyone has a chance.</b> Extra chips give newer players more lives, so the field feels more even than a scratch bracket.</li>
<li><b>Lots of games.</b> Short, single-game matches mean you play more often and wait less between turns.</li>
<li><b>Easy to follow.</b> A board with names and chip counts shows exactly where everyone stands.</li>
</ul>
<h2>Running a chip tournament</h2>
<ul>
<li><b>Set chip levels before sign-up.</b> Post them so nobody argues later. Keep it simple: three levels are plenty for a weekly event.</li>
<li><b>Use a board.</b> List names in draw order with chip counts. Cross off chips as they are lost.</li>
<li><b>Several tables.</b> Send the next two names to each open table. With 24 players and 3 tables, a chip tournament usually takes two to three hours.</li>
<li><b>Decide the finish.</b> Many rooms stop when two or three players are left and pay those places, or let the last two play a short race for first.</li>
<li><b>Ball-in-hand and break rules.</b> Single-game formats make the break important. Many rooms use winner breaks or alternate breaks; announce it before you start.</li>
</ul>
<h2>Payouts</h2>
<p>Chip tournaments usually pay fewer places than brackets because the field shrinks one player at a time. Paying the last two or three is common. Use our <a href="/tools/payout-calculator">payout calculator</a> and choose the number of places, and read our <a href="/guides/pool-tournament-payouts">payout guide</a> for typical splits.</p>
<h2>Chip tournament or bracket?</h2>
<p>A <a href="/guides/double-elimination-brackets">double-elimination bracket</a> is better when you want longer races and a clear schedule. A chip tournament is better for mixed-skill fields, a lively room and an event that runs without a lot of paperwork. Need a bracket instead? Print a <a href="/tools/brackets/">free double-elimination bracket</a>.</p>
<p>Running one? <a href="/post">Post your chip tournament free</a> so local players can find it.</p>`
  },
  {
    slug: 'bank-pool-rules', title: 'Bank Pool Rules: How 9-Ball Banks and 15-Ball Banks Are Played',
    desc: 'How bank pool works: what counts as a bank, calling shots, kisses and crossovers, fouls, and the race in 9-ball banks and 15-ball banks.',
    body: `
<p>Bank pool is a game where every ball has to be <b>banked</b>: the called ball must hit at least one cushion before it goes in the pocket. It is a favorite of gamblers and old-school players, and it is one of the best ways to learn how balls come off the rails.</p>
<h2>The basics</h2>
<ul>
<li>Any ball can be shot at, in any order.</li>
<li>Each shot must be a bank: the called ball hits one or more cushions, then goes in the called pocket.</li>
<li>Call the ball and the pocket on every shot. Most players also expect you to call the number of rails if it is not obvious.</li>
<li>Make a called bank and you keep shooting. Miss, and it is your opponent's turn.</li>
</ul>
<h2>Kisses and "clean" banks</h2>
<p>In most bank pool, the called ball has to go in <b>cleanly</b>. If it touches another ball on the way to the pocket (a kiss), or if the cue ball touches it again, the shot does not count. Balls that fall by accident do not count either and are usually spotted. Rules on this vary, so agree before you start.</p>
<p>A <b>crossover</b> or "cross-side" bank is when the cue ball crosses the path of the object ball near the cushion. Many players treat it as a legal shot; some rule sets do not. Ask.</p>
<h2>9-Ball Banks and 15-Ball Banks</h2>
<div class="t-wrap"><table class="t"><thead><tr><th>Game</th><th>Balls</th><th>To win a game</th></tr></thead><tbody>
<tr><td>9-Ball Banks (the most common)</td><td>9 balls racked in a diamond</td><td>Bank 5 balls</td></tr>
<tr><td>15-Ball Banks</td><td>15 balls racked in a triangle</td><td>Bank 8 balls</td></tr>
</tbody></table></div>
<p>Because you need more than half the balls, nobody can win until they have more than the opponent can get. A match is a race of games, often short, such as race to 3 or 5.</p>
<h2>Fouls</h2>
<p>Common fouls are scratching, not hitting a ball, or no cushion after contact. In most bank pool, a foul costs a ball: you spot one of the balls you have banked (or owe one if you have none). Many players do not play ball in hand in banks; the incoming player shoots from where the cue ball is, or from behind the head string after a scratch.</p>
<h2>Strategy</h2>
<ul>
<li><b>Defense matters.</b> If you do not have a good bank, play safe and leave your opponent a hard one.</li>
<li><b>Learn the natural angles.</b> A cross-corner bank and a cross-side bank are the shots you will use most.</li>
<li><b>Speed changes the angle.</b> Hit a bank harder and it comes off the cushion shorter; softer and it runs longer.</li>
</ul>
<p>Bank pool and <a href="/guides/one-pocket">One Pocket</a> are often played together at big events. Look for <a href="/tournaments/banks">bank pool tournaments</a> and check the <a href="/big-tournaments/">biggest upcoming events</a>.</p>`
  },
  {
    slug: 'how-to-choose-a-pool-cue', title: 'How to Choose a Pool Cue: Weight, Tip, Shaft and Price',
    desc: 'A practical guide to buying your first or next pool cue: weight, tip size, shaft taper, low-deflection shafts, wraps, break and jump cues, and what to spend.',
    body: `
<p>You don't need an expensive cue to play well, but a straight cue that feels the same every time makes a real difference. Here is what matters, and what doesn't, when you buy one.</p>
<h2>Weight</h2>
<p>Most playing cues weigh <b>18 to 21 ounces</b>, and 19 ounces is the most common. A lighter cue tends to feel quicker and easier to control on soft shots; a heavier cue can feel more solid. If a house cue around 19 ounces feels good to you, start there.</p>
<h2>Length</h2>
<p>A standard cue is <b>58 inches</b>. Taller players or players with long arms sometimes like 59 to 61 inches. Shorter cues (48 to 52 inches) are made for kids and very tight rooms.</p>
<h2>Tip size and hardness</h2>
<p>Tips are usually <b>12 to 13 millimeters</b> across. 13 mm is the most common and forgiving; a smaller tip can feel more precise. Tips come soft, medium and hard: soft tips grip well but wear faster and need more care; hard tips last longer and are less likely to mushroom. Medium is a good first choice. A good tip, kept shaped and chalked, matters more than the brand.</p>
<h2>Shaft</h2>
<ul>
<li><b>Maple shafts</b> are the classic choice and are affordable.</li>
<li><b>Low-deflection shafts</b> push the cue ball off line less when you use side spin, so English is more predictable. Many good players use them, but they cost more.</li>
<li><b>Carbon fiber shafts</b> are a newer low-deflection option. They are stiff, don't warp, and are easy to clean, but they are the most expensive and some players don't like the feel.</li>
<li><b>Taper</b> is how the shaft narrows toward the tip. A "pro taper" stays thin for longer and feels smooth through a bridge.</li>
</ul>
<h2>Wrap</h2>
<p>The grip area can be Irish linen (classic, absorbs sweat), leather (soft and grippy), rubber, or no wrap at all (smooth wood). It is mostly personal taste. If your hands sweat, linen or leather helps.</p>
<h2>Joint</h2>
<p>The joint is where the cue screws together. Different pins (such as 3/8-10, 5/16-14 and radial pins) change the feel slightly and decide which extra shafts fit your butt. It matters mostly if you plan to buy more shafts later.</p>
<h2>Break and jump cues</h2>
<p>Serious players often carry a second cue to break with, so the playing tip doesn't get crushed. Break cues usually have a very hard tip. Jump cues are short and light for jump shots, and many "break-jump" cues do both. Check your tournament's rules on jump cues before you use one.</p>
<h2>How much to spend</h2>
<ul>
<li><b>Under $100:</b> fine to start, if it's straight and the tip is good.</li>
<li><b>$100 to $300:</b> where most players get a solid, good-hitting cue that lasts for years.</li>
<li><b>$300 and up:</b> low-deflection or carbon shafts, custom work and inlays. Better materials, but they won't make you a better player on their own.</li>
</ul>
<h2>Checking a cue</h2>
<ul>
<li><b>Roll it</b> on a flat table: it should roll smoothly without wobbling.</li>
<li><b>Look down the shaft</b> like a rifle while turning it. A warp shows as a wobble.</li>
<li><b>Hit some balls</b> if you can, and see how the tip feels on soft shots and draw shots.</li>
</ul>
<p>Keep your cue in a case, out of hot cars and damp basements, and wipe the shaft after you play. Then put it to use: <a href="/tournaments/">find a pool tournament near you</a>.</p>`
  },
  {
    slug: 'how-to-break-in-pool', title: 'How to Break in Pool: 8-Ball, 9-Ball and 10-Ball Breaks',
    desc: 'How to break better in pool: stance, speed and cue ball control, plus where to place the cue ball and what to hit for 8-Ball, 9-Ball and 10-Ball.',
    body: `
<p>A good break can win games before your opponent picks up a cue. The goal is not just power: it is a solid hit that spreads the balls, makes a ball, and leaves the cue ball near the middle of the table.</p>
<h2>The basics of every break</h2>
<ul>
<li><b>Hit the cue ball in the center, or just below.</b> A center hit sends the most energy into the rack. Hitting slightly low helps the cue ball stop or come back instead of following into a pocket.</li>
<li><b>Solid, square contact beats raw speed.</b> A controlled break at 80% of your power usually spreads the balls better than a wild swing that hits the head ball off center.</li>
<li><b>Stay down and keep the bridge firm.</b> Use a slightly longer bridge, and don't jump up before the cue ball hits the rack.</li>
<li><b>Watch the cue ball.</b> A great break leaves the cue ball near the center of the table. If it flies around, you are hitting it off center or too hard.</li>
</ul>
<h2>8-Ball break</h2>
${table({ balls: [{ x: 6, y: 2, n: 1 }, { x: 6.22, y: 1.87, n: 9 }, { x: 6.22, y: 2.13, n: 2 }, { x: 6.44, y: 1.74, n: 10 }, { x: 6.44, y: 2, n: 8 }, { x: 6.44, y: 2.26, n: 3 }, { x: 1.6, y: 2, n: 0 }], paths: [[[1.6, 2], [5.8, 2]]] }, '8-Ball: break from the middle of the head string and hit the head ball square.')}
<p>Most players break from <b>near the middle</b> of the head string and hit the head ball as full as they can. Some prefer the cue ball a diamond or so off center for a slightly better chance at making a ball in the corner. If the rules in your event say the 8 on the break wins, you will hear players talk about which breaks make it most often; for most players, a solid, square hit is the best plan.</p>
<p>Under most rules, the break must pocket a ball or drive a certain number of balls to the rails. Check the rules in your event and read our <a href="/guides/8-ball-rules">8-Ball rules guide</a>.</p>
<h2>9-Ball break</h2>
${table({ balls: [{ x: 6, y: 2, n: 1 }, { x: 0.6, y: 3.6, n: 0 }], paths: [[[0.6, 3.6], [5.82, 2.05]]] }, '9-Ball: many players break from near the side rail and hit the 1-ball as full as possible.')}
<p>In 9-Ball, many players break from <b>near the side rail</b> (the "cut break"), aiming to hit the 1-ball full. A good 9-Ball break often makes a <b>wing ball</b> in a corner pocket and sends the 1-ball toward a side pocket. A softer, controlled break is common in tournaments, because keeping the cue ball in the middle gives you a shot at the 1.</p>
<p>Some events use a "break box," a rule that balls must pass the head string, or a template rack, all of which change the best break. Read our <a href="/guides/9-ball-rules">9-Ball rules guide</a>.</p>
<h2>10-Ball break</h2>
<p>10-Ball is harder to break and run because the rack is bigger and, in most rules, you must call your shots. Players often break from near the side rail like in 9-Ball, with a firm, controlled hit. Making a ball and having a shot at the 1 matters more than power. See our <a href="/guides/10-ball-rules">10-Ball rules guide</a>.</p>
<h2>Rack quality matters</h2>
<p>A loose rack spreads poorly no matter how well you hit it. Make sure the balls are frozen together. In many tournaments, the opponent racks; if you are allowed to look, check the rack before you break.</p>
<h2>Practice your break</h2>
<p>Break 20 racks and keep track of: balls made, where the cue ball ended up, and whether you had a shot after the break. Change one thing at a time (cue ball position, speed, or where you hit the cue ball) and compare. Add it to the <a href="/guides/pool-practice-drills">practice drills</a> you already do.</p>`
  }
];
